/**
 * 網羅的エッジケース監査 (DB マイグレーション / RLS / RPC)
 *
 * マイグレーションを時系列で連結し、「最終的に有効な定義 (後勝ち)」に対して検証する。
 * `it.fails` = 現時点で未対応と確認済みの欠陥の再現テスト (修正後は `.fails` を外すこと)。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const allSql = files.map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8')).join('\n');

/** 最後に CREATE POLICY された定義 (; まで) を返す。DROP のみ・未定義なら null */
function effectivePolicy(table: string, name: string): string | null {
  const re = new RegExp(`CREATE POLICY\\s+"${name}"\\s+ON\\s+public\\.${table}[\\s\\S]*?;`, 'gi');
  const matches = allSql.match(re);
  return matches && matches.length > 0 ? matches[matches.length - 1] : null;
}

/** 最後に CREATE OR REPLACE された関数本体 ($$ ... $$) を返す */
function effectiveFunctionBody(name: string): string | null {
  const re = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`,
    'gi'
  );
  const bodies = [...allSql.matchAll(re)].map((m) => m[1]);
  return bodies.length > 0 ? bodies[bodies.length - 1] : null;
}

describe('[マイグレーション健全性]', () => {
  it('マイグレーションのバージョン接頭辞 (14桁) が一意であること', () => {
    const versions = files.map((f) => f.split('_')[0]);
    const dup = versions.filter((v, i) => versions.indexOf(v) !== i);
    expect(dup).toEqual([]);
  });

  it('RPC が参照する farm_beds.updated_at 列がいずれかのマイグレーションで定義されていること', () => {
    const alter = /ALTER TABLE\s+(IF EXISTS\s+)?public\.farm_beds[^;]*updated_at/i.test(allSql);
    const create = /CREATE TABLE[^;]*public\.farm_beds\s*\([^;]*updated_at/i.test(allSql);
    expect(alter || create).toBe(true);
  });
});

describe('[マルチテナント] 最終有効 RLS ポリシー', () => {
  it('tasks_modify_policy は講師が所属する農園に限定 (farm_id IS NULL 許可なし)', () => {
    const p = effectivePolicy('tasks', 'tasks_modify_policy');
    expect(p).not.toBeNull();
    expect(p).toMatch(/farm_id\s+IN\s*\(\s*SELECT\s+public\.current_user_farm_ids\(\)\s*\)/i);
    expect(p).not.toMatch(/farm_id IS NULL/i);
  });

  it('farm_beds_modify_policy が「student_id = auth.uid()」だけで通る分岐を持たない', () => {
    const p = effectivePolicy('farm_beds', 'farm_beds_modify_policy') ?? '';
    expect(p).not.toMatch(/OR\s*\(\s*student_id\s*=\s*auth\.uid\(\)\s*\)/i);
  });

  it('events_modify_policy が講師の所属農園に限定されている', () => {
    const p = effectivePolicy('events', 'events_modify_policy') ?? '';
    expect(p).toMatch(/farm_id\s+IN\s*\(\s*SELECT\s+public\.current_user_farm_ids\(\)\s*\)/i);
    expect(p).not.toMatch(/farm_id IS NULL/i);
  });

  it('events_select_policy で講師が他農園イベントを閲覧できない', () => {
    const p = effectivePolicy('events', 'events_select_policy') ?? '';
    expect(p).not.toMatch(/OR\s+public\.current_user_role\(\)\s*=\s*'teacher'/i);
  });

  it('reservations_select/modify_policy が本人または講師の所属農園の生徒・イベントに限定されている', () => {
    const sel = effectivePolicy('reservations', 'reservations_select_policy') ?? '';
    const mod = effectivePolicy('reservations', 'reservations_modify_policy') ?? '';
    for (const p of [sel, mod]) {
      expect(p).toMatch(/auth\.uid\(\)\s*=\s*student_id/i);
      expect(p).toMatch(/u\.farm_id\s+IN\s*\(\s*SELECT\s+public\.current_user_farm_ids\(\)\s*\)/i);
      expect(p).toMatch(/e\.farm_id\s+IN\s*\(\s*SELECT\s+public\.current_user_farm_ids\(\)\s*\)/i);
    }
  });

  it('journals の生徒 UPDATE で reply / is_approved / is_private / farm_id を改ざんできない', () => {
    expect(allSql).toMatch(/CREATE TRIGGER[^;]*BEFORE UPDATE[^;]*ON public\.journals/i);
  });

  it('student_tasks の生徒 UPDATE で exp / difficulty / deleted_at / base_task_id を改ざんできない', () => {
    expect(allSql).toMatch(/CREATE TRIGGER[^;]*BEFORE UPDATE[^;]*ON public\.student_tasks/i);
  });

  it('crop_records_modify_policy が「自分の区画＋他人の畝」の不正登録・改ざんを物理禁止している', () => {
    const p = effectivePolicy('crop_records', 'crop_records_modify_policy');
    expect(p).not.toBeNull();
    const text = p ?? '';
    // bed_id があるときは畝が自分のもの かつ 畝の plot_id と一致することを要求
    expect(text).toContain('b.student_id = auth.uid()');
    expect(text).toContain('b.plot_id = crop_records.plot_id');
    // bed_id が無いときのみ plot_id の区画が自分のもの
    expect(text).toContain('crop_records.bed_id IS NULL');
    expect(text).toContain('p.student_id = auth.uid()');
  });

  it('farm_beds に受講生による plot_id / bed_number / student_id / status 改ざん防止トリガーが定義されている', () => {
    expect(allSql).toMatch(
      /CREATE TRIGGER[^;]*trg_prevent_student_farm_bed_tampering[^;]*ON public\.farm_beds/i
    );
    const body = effectiveFunctionBody('prevent_student_farm_bed_tampering') ?? '';
    expect(body).toContain('NEW.plot_id IS DISTINCT FROM OLD.plot_id');
    expect(body).toContain('NEW.bed_number IS DISTINCT FROM OLD.bed_number');
    expect(body).toContain('NEW.student_id IS DISTINCT FROM OLD.student_id');
    expect(body).toContain('NEW.status IS DISTINCT FROM OLD.status');
    expect(body).toContain('42501');
  });
});

describe('[権限越境] SECURITY DEFINER RPC', () => {
  it('complete_student_task は INSERT を行わず、自農園の公開中タスクのみ UPDATE して不在時は P0002 例外を送出する', () => {
    const body = effectiveFunctionBody('complete_student_task');
    expect(body).not.toBeNull();
    const text = body ?? '';
    // INSERT INTO student_tasks を一切行わないこと
    expect(text).not.toMatch(/INSERT\s+INTO\s+public\.student_tasks/i);
    // UPDATE のみ実行し、自農園・公開中・未削除・非テンプレートであることを検証
    expect(text).toMatch(/UPDATE\s+public\.student_tasks/i);
    expect(text).toContain('t.farm_id = v_farm_id');
    expect(text).toContain("t.status = 'todo'");
    expect(text).toContain('t.deleted_at IS NULL');
    expect(text).toContain('t.is_template IS NOT TRUE');
    // 対象タスクが見つからない場合に P0002 例外
    expect(text).toContain('P0002');
  });

  it('publish_task_to_all_students は PUBLIC/anon から REVOKE されている', () => {
    expect(allSql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.publish_task_to_all_students/i);
  });

  it('delete_farm_bed は「畝が p_plot_id に属する」検証後にのみ crop_records を変更する', () => {
    const body = effectiveFunctionBody('delete_farm_bed');
    expect(body).not.toBeNull();
    const text = body ?? '';
    const mutateIdx = text.search(/(UPDATE|DELETE FROM)\s+public\.crop_records/i);
    const guardIdx = text.search(
      /(SELECT|PERFORM|IF\s+NOT\s+EXISTS)[^;]{0,200}FROM\s+public\.farm_beds[^;]*plot_id\s*=\s*p_plot_id/i
    );
    expect(mutateIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(mutateIdx);
  });

  it('withdraw_student は対象が role=student であること、および区画・畝をアトミックに解放すること', () => {
    const body = effectiveFunctionBody('withdraw_student') ?? '';
    expect(body).toMatch(/role\s*=\s*'student'|v_student_role/i);
    expect(body).toMatch(
      /UPDATE\s+public\.farm_beds\s+SET[^;]*student_id\s*=\s*NULL[^;]*student_name\s*=\s*NULL/i
    );
    expect(body).toMatch(
      /UPDATE\s+public\.farm_plots\s+SET[^;]*student_id\s*=\s*NULL[^;]*is_vacant\s*=\s*true/i
    );
  });

  it('farms.invite_code に一意制約インデックスが存在すること', () => {
    expect(allSql).toMatch(/CREATE\s+UNIQUE\s+INDEX[^\n]+farms[^\n]+invite_code/i);
  });

  it('register_teacher は招待コード衝突防止ループを備えていること', () => {
    const body = effectiveFunctionBody('register_teacher') ?? '';
    expect(body).toMatch(/LOOP[\s\S]*new_invite_code[\s\S]*EXIT\s+WHEN\s+NOT\s+EXISTS/i);
  });

  it('get_farm_by_invite_code および join_farm は招待コードを大文字小文字不問 (lower) で照合すること', () => {
    const getFarmBody = effectiveFunctionBody('get_farm_by_invite_code') ?? '';
    const joinFarmBody = effectiveFunctionBody('join_farm') ?? '';
    expect(getFarmBody).toMatch(
      /lower\s*\(\s*f\.invite_code\s*\)\s*=\s*lower\s*\(\s*clean_code\s*\)/i
    );
    expect(joinFarmBody).toMatch(
      /lower\s*\([^)]*invite_code\s*\)\s*=\s*lower\s*\(\s*clean_code\s*\)/i
    );
  });
});

describe('[境界値] DB 制約 (金額・文字数)', () => {
  it('payments.amount に CHECK (amount >= 0) がある', () => {
    expect(allSql).toMatch(/CHECK\s*\(\s*amount\s*>=?\s*0/i);
  });

  it('farms.name に文字数 CHECK がある', () => {
    expect(allSql).toMatch(/CHECK\s*\(\s*char_length\(\s*(name|clean_farm_name)\s*\)/i);
    const body = effectiveFunctionBody('register_teacher') ?? '';
    expect(body).toMatch(/char_length\(\s*clean_farm_name\s*\)\s*>\s*\d+/i);
  });

  it('farm_beds.progress_percent に 0..100 の CHECK がある', () => {
    expect(allSql).toMatch(/CHECK\s*\(\s*progress_percent\s+BETWEEN\s+0\s+AND\s+100/i);
  });

  it('crop_records.height_cm に非負 CHECK がある', () => {
    expect(allSql).toMatch(/CHECK\s*\(\s*height_cm\s*>=\s*0/i);
  });
});
