// B-0 棚卸し: 本番 (nou-ato-DB2) のスキーマ定義と supabase/migrations の最新定義を突き合わせる
// 使い方: node scripts/compare-prod-schema.mjs <repo_root> <dump_dir>
//   <dump_dir> には docs/MULTI_FARM_INVENTORY.md の「再生成手順」の SQL で本番から取得した JSON (policies / functions / constraints / triggers / columns) を置く
import fs from 'node:fs';
import path from 'node:path';

const [repoRoot, dumpDir] = process.argv.slice(2);
const load = (n) => JSON.parse(fs.readFileSync(path.join(dumpDir, `${n}.json`), 'utf8')).rows;
const policies = load('policies');
const functions = load('functions');
const constraints = load('constraints');
const triggers = load('triggers');
const columns = load('columns');

const migDir = path.join(repoRoot, 'supabase', 'migrations');
const migFiles = fs
  .readdirSync(migDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const migs = migFiles.map((f) => ({
  f,
  sql: fs.readFileSync(path.join(migDir, f), 'utf8').replace(/\r/g, ''),
}));

const norm = (s) =>
  (s || '')
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// ---- functions: 最新の CREATE OR REPLACE FUNCTION 本体 ----
const migFn = new Map(); // name -> {file, body, dropped}
for (const { f, sql } of migs) {
  const re =
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS\s+(\$[a-z_]*\$)([\s\S]*?)\3/gi;
  let m;
  while ((m = re.exec(sql))) migFn.set(m[1], { file: f, body: m[4], dropped: false });
  const dre = /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?public\.([a-z0-9_]+)\s*\(/gi;
  while ((m = dre.exec(sql))) {
    // 同じファイル内で後から作り直していなければ削除扱い
    const after = sql.slice(m.index);
    if (
      !new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${m[1]}\\s*\\(`, 'i').test(after)
    ) {
      const cur = migFn.get(m[1]);
      if (cur) cur.dropped = true;
    }
  }
}
const prodFnNames = new Map();
for (const r of functions) {
  if (!prodFnNames.has(r.proname)) prodFnNames.set(r.proname, []);
  prodFnNames.get(r.proname).push(r);
}
const fnRows = [];
for (const [name, def] of migFn) {
  const prod = prodFnNames.get(name);
  let status;
  if (def.dropped) status = prod ? '本番に残存（migrationsでは削除）' : '一致（削除済み）';
  else if (!prod) status = '**本番に存在しない**';
  else if (prod.length > 1) status = `本番にオーバーロード ${prod.length} 件`;
  else status = norm(prod[0].body) === norm(def.body) ? '一致' : '**本体が異なる**';
  fnRows.push({ name, file: def.file, status });
}
const migOnlyNames = new Set(migFn.keys());
const prodOnlyFns = [...prodFnNames.keys()].filter((n) => !migOnlyNames.has(n));

// ---- policies ----
const migPol = new Map(); // "schema.table|name" -> file
for (const { f, sql } of migs) {
  const stmts = sql.split(/;\s*\n/);
  for (const s of stmts) {
    let m = s.match(/CREATE\s+POLICY\s+"?([^"\n]+?)"?\s+ON\s+([a-z_]+\.)?([a-z_]+)/i);
    if (m) migPol.set(`${(m[2] || 'public.').slice(0, -1)}.${m[3]}|${m[1].trim()}`, f);
    m = s.match(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"?([^"\n]+?)"?\s+ON\s+([a-z_]+\.)?([a-z_]+)/i);
    if (m) migPol.delete(`${(m[2] || 'public.').slice(0, -1)}.${m[3]}|${m[1].trim()}`);
  }
}
const prodPolKeys = new Set(policies.map((p) => `${p.schemaname}.${p.tablename}|${p.policyname}`));
const polMissingInProd = [...migPol.keys()].filter((k) => !prodPolKeys.has(k));
const polOnlyInProd = [...prodPolKeys].filter((k) => !migPol.has(k));

// ---- constraints (名前付きのもの) ----
const migCon = new Map();
for (const { f, sql } of migs) {
  let m;
  const re = /(?:ADD\s+)?CONSTRAINT\s+([a-z0-9_]+)/gi;
  while ((m = re.exec(sql))) migCon.set(m[1], f);
  const dre = /DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?([a-z0-9_]+)/gi;
  while ((m = dre.exec(sql))) {
    const after = sql.slice(m.index + m[0].length);
    if (!new RegExp(`ADD\\s+CONSTRAINT\\s+${m[1]}\\b`, 'i').test(after)) migCon.delete(m[1]);
  }
}
const prodConNames = new Set(constraints.map((c) => c.conname));
const conMissingInProd = [...migCon.entries()].filter(([n]) => !prodConNames.has(n));

// ---- triggers ----
const migTrg = new Map();
for (const { f, sql } of migs) {
  let m;
  const re =
    /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-z0-9_]+)[\s\S]*?ON\s+(?:public\.)?([a-z_]+)/gi;
  while ((m = re.exec(sql))) migTrg.set(`${m[2]}|${m[1]}`, f);
  const dre = /DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?([a-z0-9_]+)\s+ON\s+(?:public\.)?([a-z_]+)/gi;
  while ((m = dre.exec(sql))) {
    const after = sql.slice(m.index + m[0].length);
    if (!new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?TRIGGER\\s+${m[1]}\\b`, 'i').test(after))
      migTrg.delete(`${m[2]}|${m[1]}`);
  }
}
const prodTrgKeys = new Set(triggers.map((t) => `${t.tbl}|${t.trigger_name}`));
const trgMissingInProd = [...migTrg.entries()].filter(
  ([k]) => !k.startsWith('users|on_auth') && !prodTrgKeys.has(k)
);
const trgOnlyInProd = [...prodTrgKeys].filter((k) => !migTrg.has(k));

// ---- columns: types/supabase.ts の Row と本番の比較 ----
const typesSrc = fs
  .readFileSync(path.join(repoRoot, 'types', 'supabase.ts'), 'utf8')
  .replace(/\r/g, '');
const tablesBlock = typesSrc.slice(typesSrc.indexOf('Tables: {'), typesSrc.indexOf('Views: {'));
const typeCols = new Map();
const tre = /\n {6}([a-z_]+): \{\n {8}Row: \{([\s\S]*?)\n {8}\};/g;
let tm;
while ((tm = tre.exec(tablesBlock))) {
  typeCols.set(
    tm[1],
    [...tm[2].matchAll(/\n {10}([a-z_]+)\??:/g)].map((x) => x[1])
  );
}
const prodCols = new Map();
for (const c of columns) {
  if (!prodCols.has(c.table_name)) prodCols.set(c.table_name, []);
  prodCols.get(c.table_name).push(c.column_name);
}
const colDiffs = [];
for (const [t, cols] of typeCols) {
  const p = prodCols.get(t);
  if (!p) {
    colDiffs.push(`${t}: 本番にテーブルが無い`);
    continue;
  }
  const missing = cols.filter((c) => !p.includes(c));
  const extra = p.filter((c) => !cols.includes(c));
  if (missing.length || extra.length)
    colDiffs.push(`${t}: 型のみ [${missing.join(', ')}] / 本番のみ [${extra.join(', ')}]`);
}

// ---- B 向け分類 ----
const farmRe = /current_user_farm_id|current_user_role|owner_id|farm_id/i;
const classifyPolicy = (p) => {
  const txt = `${p.qual || ''} ${p.with_check || ''}`;
  const tags = [];
  if (/current_user_role\(\)\s*=\s*'teacher'|role\s*=\s*'teacher'/i.test(txt))
    tags.push('講師分岐');
  if (
    /current_user_role\(\)\s*=\s*'student'|role\s*=\s*'student'|student_id\s*=\s*auth\.uid\(\)/i.test(
      txt
    )
  )
    tags.push('生徒分岐');
  if (/current_user_farm_id\(\)/i.test(txt)) tags.push('users.farm_id依存');
  if (/owner_id/i.test(txt)) tags.push('owner_id依存');
  return tags.join(' / ') || '—';
};

const out = [];
out.push(`<!-- generated ${new Date().toISOString()} from production dump -->`);
out.push('### 関数（migrations の最新定義と本番の本体比較）\n');
out.push('| 関数 | 最新定義のファイル | 本番との比較 | 農園・ロール判定を含む |');
out.push('|---|---|---|---|');
for (const r of fnRows.sort((a, b) => a.name.localeCompare(b.name))) {
  const prod = prodFnNames.get(r.name);
  const uses = prod && prod.some((x) => farmRe.test(x.body)) ? '○' : '';
  out.push(`| ${r.name} | ${r.file} | ${r.status} | ${uses} |`);
}
out.push(
  `\n本番にだけある関数（migrations に定義なし）: ${prodOnlyFns.length} 件（拡張機能由来を含む）`
);
out.push(
  prodOnlyFns
    .filter(
      (n) =>
        !/^(vector|halfvec|sparsevec|l2_|l1_|cosine|inner_product|array_to_|ivfflat|hnsw|binary_quantize|subvector|avg|sum)/.test(
          n
        )
    )
    .map((n) => `- ${n}`)
    .join('\n') || '- （拡張機能由来のみ）'
);
out.push('\n### ポリシー\n');
out.push('| スキーマ.テーブル | ポリシー | 操作 | 判定の種類 |');
out.push('|---|---|---|---|');
for (const p of policies)
  out.push(
    `| ${p.schemaname}.${p.tablename} | ${p.policyname} | ${p.cmd} | ${classifyPolicy(p)} |`
  );
out.push(
  `\nmigrations にあるが本番に無いポリシー: ${polMissingInProd.length ? polMissingInProd.map((k) => `\`${k}\``).join(', ') : 'なし'}`
);
out.push(
  `\n本番にだけあるポリシー: ${polOnlyInProd.length ? polOnlyInProd.map((k) => `\`${k}\``).join(', ') : 'なし'}`
);
out.push('\n### 制約・トリガー・カラム\n');
out.push(
  `- migrations にあるが本番に無い名前付き制約: ${conMissingInProd.length ? conMissingInProd.map(([n, f]) => `\`${n}\`（${f}）`).join(', ') : 'なし'}`
);
out.push(
  `- migrations にあるが本番に無いトリガー: ${trgMissingInProd.length ? trgMissingInProd.map(([k, f]) => `\`${k}\`（${f}）`).join(', ') : 'なし'}`
);
out.push(
  `- 本番にだけあるトリガー: ${trgOnlyInProd.length ? trgOnlyInProd.map((k) => `\`${k}\``).join(', ') : 'なし'}`
);
out.push(
  `- types/supabase.ts と本番のカラム差: ${colDiffs.length ? '\n' + colDiffs.map((d) => `  - ${d}`).join('\n') : 'なし'}`
);
fs.writeFileSync(path.join(dumpDir, 'inventory.generated.md'), out.join('\n') + '\n');

console.log(
  'functions compared:',
  fnRows.length,
  'differ:',
  fnRows.filter((r) => /異なる|存在しない|オーバーロード|残存/.test(r.status)).length
);
for (const r of fnRows.filter((r) => /異なる|存在しない|オーバーロード|残存/.test(r.status)))
  console.log('  FN', r.name, '-', r.status, '-', r.file);
console.log(
  'policies prod:',
  policies.length,
  'missingInProd:',
  polMissingInProd.length,
  'onlyInProd:',
  polOnlyInProd.length
);
polMissingInProd.forEach((k) => console.log('  POL missing', k));
polOnlyInProd.forEach((k) => console.log('  POL prod-only', k));
console.log('constraints missingInProd:', conMissingInProd.map(([n]) => n).join(', ') || 'none');
console.log(
  'triggers missingInProd:',
  trgMissingInProd.map(([k]) => k).join(', ') || 'none',
  '| prodOnly:',
  trgOnlyInProd.join(', ') || 'none'
);
console.log('column diffs:', colDiffs.length);
colDiffs.forEach((d) => console.log('  COL', d));
console.log(
  'prod-only functions (non-extension):',
  prodOnlyFns
    .filter(
      (n) =>
        !/^(vector|halfvec|sparsevec|l2_|l1_|cosine|inner_product|array_to_|ivfflat|hnsw|binary_quantize|subvector|avg|sum)/.test(
          n
        )
    )
    .join(', ')
);
