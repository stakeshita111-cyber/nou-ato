'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import type { EventItem, Attendee } from '@/types/event';

export function useEvents(farmId?: string) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);

  const getEffectiveFarmId = useCallback(() => {
    if (farmId) return farmId;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nouato_active_farm_id') || null;
    }
    return null;
  }, [farmId]);

  // Supabase / LocalStorage からイベントデータを取得して同期
  const fetchEvents = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    const fid = getEffectiveFarmId();
    const eventKey = fid ? `nouato_shared_events_${fid}` : 'nouato_shared_events';

    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(eventKey) : null;
      if (saved) {
        setEvents(JSON.parse(saved));
      }

      const { data } = await supabase.from('events').select('*').order('date', { ascending: true });

      if (data && data.length > 0) {
        const formatted: EventItem[] = (
          data as Database['public']['Tables']['events']['Row'][]
        ).map((d) => ({
          id: d.id,
          title: d.title,
          date: d.date,
          dateDisplay: d.date_display || d.date,
          time: d.time || '10:00 - 12:00',
          location: d.location || '農園メインエリア',
          capacity: d.capacity || 10,
          reservedCount: d.reserved_count || 0,
          fee: d.fee || '無料',
          category: (d.category as EventItem['category']) || 'harvest',
          description: d.description || '',
          attendees: Array.isArray(d.attendees) ? (d.attendees as unknown as Attendee[]) : [],
        }));
        setEvents(formatted);
        try {
          localStorage.setItem(eventKey, JSON.stringify(formatted));
          localStorage.setItem('nouato_shared_events', JSON.stringify(formatted));
        } catch {}
      } else if (!saved) {
        setEvents([]);
      }
    } catch (e) {
      console.warn('fetchEvents info:', e);
    } finally {
      setLoading(false);
    }
  }, [getEffectiveFarmId]);

  useEffect(() => {
    const load = async () => {
      await fetchEvents();
    };
    void load();

    // Supabase Realtime でイベント変更を全端末・全画面に即座に同期
    const channel = supabase
      .channel('events_realtime_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        void fetchEvents();
      })
      .subscribe();

    if (typeof window !== 'undefined') {
      const handleSync = () => {
        void fetchEvents();
      };
      window.addEventListener('nouato_events_updated', handleSync);
      window.addEventListener('nouato_sync_event', handleSync);
      return () => {
        window.removeEventListener('nouato_events_updated', handleSync);
        window.removeEventListener('nouato_sync_event', handleSync);
        supabase.removeChannel(channel);
      };
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [farmId, fetchEvents]);

  // ローカル更新・共有保存ヘルパー
  const saveSharedEvents = (newEvents: EventItem[]) => {
    setEvents(newEvents);
    const fid = getEffectiveFarmId();
    const eventKey = fid ? `nouato_shared_events_${fid}` : 'nouato_shared_events';
    try {
      localStorage.setItem(eventKey, JSON.stringify(newEvents));
      localStorage.setItem('nouato_shared_events', JSON.stringify(newEvents));
    } catch (e) {
      console.error('saveSharedEvents error:', e);
    }
  };

  // 講師: イベント新規登録
  const addEvent = async (eventData: Omit<EventItem, 'id' | 'reservedCount' | 'attendees'>) => {
    const fid = getEffectiveFarmId();
    const validFarmId = fid && /^[0-9a-fA-F-]{36}$/.test(fid) ? fid : null;
    const newEv: EventItem = {
      ...eventData,
      id: `ev_${Date.now()}`,
      reservedCount: 0,
      attendees: [],
    };

    const nextEvents = [newEv, ...events];
    saveSharedEvents(nextEvents);

    try {
      const { error: insErr } = await supabase.from('events').insert([
        {
          id: newEv.id,
          title: newEv.title,
          date: newEv.date,
          date_display: newEv.dateDisplay,
          time: newEv.time,
          location: newEv.location,
          capacity: newEv.capacity,
          fee: newEv.fee,
          category: newEv.category,
          description: newEv.description,
          reserved_count: 0,
          attendees: [],
          farm_id: validFarmId,
        },
      ]);
      if (insErr) {
        console.error('addEvent DB error:', insErr);
      }
    } catch (e) {
      console.warn('addEvent DB warning:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nouato_events_updated'));
    }
    return newEv;
  };

  // 生徒: 参加予約の申し込み
  const reserveEvent = async (
    eventId: string,
    studentName: string,
    plotName: string = '受講区画'
  ) => {
    const target = events.find((e) => e.id === eventId);
    if (!target) return false;

    // 重複チェック
    if (target.attendees.some((a) => a.name === studentName)) {
      return 'already_reserved';
    }

    const newAttendee = {
      id: `u_${Date.now()}`,
      name: studentName,
      plot: plotName,
      status: 'pending' as const,
    };

    const updatedEvents = events.map((ev) => {
      if (ev.id === eventId) {
        return {
          ...ev,
          reservedCount: ev.reservedCount + 1,
          attendees: [...ev.attendees, newAttendee],
        };
      }
      return ev;
    });

    saveSharedEvents(updatedEvents);

    try {
      await supabase
        .from('events')
        .update({
          reserved_count: target.reservedCount + 1,
          attendees: [...target.attendees, newAttendee],
        })
        .eq('id', eventId);
    } catch (e) {
      console.warn('reserveEvent DB warning:', e);
    }

    return true;
  };

  // 講師: 参加予約の承認
  const approveAttendee = async (eventId: string, attendeeName: string) => {
    const updatedEvents = events.map((ev) => {
      if (ev.id === eventId) {
        return {
          ...ev,
          attendees: ev.attendees.map((a) =>
            a.name === attendeeName ? { ...a, status: 'confirmed' as const } : a
          ),
        };
      }
      return ev;
    });

    saveSharedEvents(updatedEvents);

    try {
      const target = updatedEvents.find((e) => e.id === eventId);
      if (target) {
        await supabase.from('events').update({ attendees: target.attendees }).eq('id', eventId);
      }
    } catch (e) {
      console.warn('approveAttendee DB warning:', e);
    }
    return true;
  };

  // イベント削除
  const deleteEvent = async (eventId: string) => {
    const nextEvents = events.filter((ev) => ev.id !== eventId);
    saveSharedEvents(nextEvents);

    try {
      await supabase.from('events').delete().eq('id', eventId);
    } catch (e) {
      console.warn('deleteEvent DB warning:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nouato_events_updated'));
    }
    return true;
  };

  return {
    events,
    loading,
    addEvent,
    reserveEvent,
    approveAttendee,
    deleteEvent,
    refetchEvents: fetchEvents,
  };
}
