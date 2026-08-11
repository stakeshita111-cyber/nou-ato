'use client';

import React from 'react';
import Link from 'next/link';
import { useThemeStore, ThemeSettings } from '@/store/useThemeStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useThemeStore();

  return (
    <div className="container max-w-3xl py-8 px-4 space-y-8 mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">表示・テーマ設定</h1>
          <p className="text-muted-foreground mt-2">
            泥だらけの手袋をしていたり、日差しが強い屋外の畑で作業していても、サクサク使いやすいように調整できます。
          </p>
        </div>
        <Link href="/teacher/dashboard">
          <Button variant="outline">講師ダッシュボードへ戻る</Button>
        </Link>
      </div>

      {/* 1. 基本設定（カラー・サイズ） */}
      <Card>
        <CardHeader>
          <CardTitle>テーマ・カラー & サイズ</CardTitle>
          <CardDescription>アプリのメイン色と、視認性を決める最も重要な設定項目です。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primary-color" className="font-semibold">農園のシンボルカラー（メイン）</Label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  id="primary-color"
                  value={settings.primaryColor}
                  onChange={(e) => updateSettings({ primaryColor: e.target.value })}
                  className="w-12 h-10 rounded border cursor-pointer ring-offset-background focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                <span className="font-mono text-sm">{settings.primaryColor}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-color" className="font-semibold">アクセントカラー（通知・警告）</Label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  id="secondary-color"
                  value={settings.secondaryColor}
                  onChange={(e) => updateSettings({ secondaryColor: e.target.value })}
                  className="w-12 h-10 rounded border cursor-pointer ring-offset-background focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                <span className="font-mono text-sm">{settings.secondaryColor}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="font-semibold">文字の大きさ（屋外ズーム機能）</Label>
              <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                {settings.fontSize === 'small' && '小 (14px)'}
                {settings.fontSize === 'medium' && '標準 (16px)'}
                {settings.fontSize === 'large' && '大 (20px)'}
                {settings.fontSize === 'xlarge' && '極大 (24px) ⚠️シニア農家推奨'}
              </span>
            </div>
            <div className="px-2 py-2">
              <Slider
                value={[
                  settings.fontSize === 'small' ? 0 : settings.fontSize === 'medium' ? 1 : settings.fontSize === 'large' ? 2 : 3
                ]}
                max={3}
                step={1}
                onValueChange={(value) => {
                  const sizes: ThemeSettings['fontSize'][] = ['small', 'medium', 'large', 'xlarge'];
                  updateSettings({ fontSize: sizes[value[0]] });
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. 表示形式（新規追加項目） */}
      <Card>
        <CardHeader>
          <CardTitle>屋外作業・アクセシビリティ</CardTitle>
          <CardDescription>日差し反射の軽減、手袋対応、日付・数字の表記としるべぇの言葉遣いを調整します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* フォント */}
            <div className="space-y-2">
              <Label className="font-semibold">表示フォント</Label>
              <Select
                value={settings.fontFamily}
                onValueChange={(value: string) => updateSettings({ fontFamily: value as ThemeSettings['fontFamily'] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sans">標準（ゴシック）</SelectItem>
                  <SelectItem value="serif">クラシック（明朝体）</SelectItem>
                  <SelectItem value="rounded">丸ゴシック（丸くて太い・一番読みやすい）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 文字の太さ */}
            <div className="space-y-2">
              <Label className="font-semibold">文字の太さ（日差し反射対策）</Label>
              <Select
                value={settings.fontWeight}
                onValueChange={(value: string) => updateSettings({ fontWeight: value as ThemeSettings['fontWeight'] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">標準（細め）</SelectItem>
                  <SelectItem value="medium">中（読みやすい）</SelectItem>
                  <SelectItem value="bold">極太（クッキリ輪郭を浮き立たせる）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 行間 */}
            <div className="space-y-2">
              <Label className="font-semibold">文章の行間（隙間）</Label>
              <Select
                value={settings.lineHeight}
                onValueChange={(value: string) => updateSettings({ lineHeight: value as ThemeSettings['lineHeight'] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">標準（ぎっしり）</SelectItem>
                  <SelectItem value="relaxed">ゆったり（読みやすい）</SelectItem>
                  <SelectItem value="loose">広い（シニア向け誤読防止）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ボタン形状 */}
            <div className="space-y-2">
              <Label className="font-semibold">ボタンの形</Label>
              <Select
                value={settings.borderRadius}
                onValueChange={(value: string) => updateSettings({ borderRadius: value as ThemeSettings['borderRadius'] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">四角形</SelectItem>
                  <SelectItem value="md">少し丸い（角丸）</SelectItem>
                  <SelectItem value="full">楕円（丸みがあって見つけやすい）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ボタンパディング（手袋サイズ） */}
            <div className="space-y-2">
              <Label className="font-semibold">ボタンの押しやすさ（手袋対応）</Label>
              <Select
                value={settings.buttonPadding}
                onValueChange={(value: string) => updateSettings({ buttonPadding: value as ThemeSettings['buttonPadding'] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">通常（スマート）</SelectItem>
                  <SelectItem value="large">極大（泥だらけの手袋でも誤タップ防止）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 日付形式 */}
            <div className="space-y-2">
              <Label className="font-semibold">日付の書き方</Label>
              <RadioGroup
                value={settings.dateFormat}
                onValueChange={(value: string) => updateSettings({ dateFormat: value as ThemeSettings['dateFormat'] })}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="slash" id="df-slash" />
                  <Label htmlFor="df-slash" className="cursor-pointer">2026/08/11</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="japanese" id="df-jap" />
                  <Label htmlFor="df-jap" className="cursor-pointer">8月11日(火)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* 数値表記 */}
            <div className="space-y-2 col-span-1 sm:col-span-2">
              <Label className="font-semibold">収穫量・単位の表記</Label>
              <Select
                value={settings.numberFormat}
                onValueChange={(value: string) => updateSettings({ numberFormat: value as ThemeSettings['numberFormat'] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">そのまま (1500)</SelectItem>
                  <SelectItem value="comma">区切りマークあり (1,500)</SelectItem>
                  <SelectItem value="unit">単位つき (1,500g)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* AIしるべぇ口調変換 */}
            <div className="space-y-2 col-span-1 sm:col-span-2 bg-slate-50 p-4 rounded border">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-bold text-base">しるべぇの言葉遣い</Label>
                  <p className="text-sm text-muted-foreground">
                    「〜だべぇ！」を解除し、標準的な「です/ます」に切り替えます。
                  </p>
                </div>
                <Switch
                  checked={settings.politeStyle === 'shirube'}
                  onCheckedChange={(checked) =>
                    updateSettings({ politeStyle: checked ? 'shirube' : 'polite' })
                  }
                />
              </div>
            </div>

          </div>

          <Separator />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={resetSettings}>
              初期設定に戻す
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
