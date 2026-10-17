'use client';

import React from 'react';

interface FormattedChatMessageProps {
  text: string;
  searchKeyword?: string;
  isMe?: boolean;
}

function renderKeywordHighlight(text: string, keyword?: string, keyPrefix = 'h'): React.ReactNode {
  if (!keyword || !keyword.trim()) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark
        key={`${keyPrefix}-${i}`}
        className="bg-amber-300 text-amber-950 px-1 py-0.5 rounded font-black shadow-2xs"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function renderInlineText(text: string, keyword?: string): React.ReactNode[] {
  // **太字** を検出して分割
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);

  return boldParts.map((part, bIdx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const innerText = part.slice(2, -2);
      return (
        <strong key={`b-${bIdx}`} className="font-black text-emerald-950">
          {renderKeywordHighlight(innerText, keyword, `b-${bIdx}`)}
        </strong>
      );
    }
    return (
      <React.Fragment key={`t-${bIdx}`}>
        {renderKeywordHighlight(part, keyword, `t-${bIdx}`)}
      </React.Fragment>
    );
  });
}

function normalizeStructuredLines(rawText: string): string[] {
  // 1行に繋がった Markdown 表の行 (| A | B | | --- | --- |) や番号付きリスト (1. xxx 2. yyy) を改行分割
  const normalized = rawText
    .replace(/\|\s+\|/g, '|\n|')
    .replace(/([。！？：:；;])\s*(?=\d+\.\s+)/g, '$1\n')
    .replace(/(\S)\s+(?=[2-9]\d*\.\s+)/g, '$1\n');

  return normalized.split('\n');
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length >= 3;
}

function isTableSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  return /^\|[\s\-:|]+\|$/.test(trimmed) && trimmed.includes('-');
}

function parseTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

export default function FormattedChatMessage({
  text,
  searchKeyword,
  isMe = false,
}: FormattedChatMessageProps) {
  // 生徒自身のメッセージはシンプルな吹き出し
  if (isMe) {
    return (
      <p className="whitespace-pre-wrap">{renderKeywordHighlight(text, searchKeyword, 'me')}</p>
    );
  }

  const lines = normalizeStructuredLines(text);
  const elements: React.ReactNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx].trim();

    // Markdown テーブル (| 項目 | 内容 |) のブロック検出と描画
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      const startIdx = idx;
      while (idx < lines.length && isTableRow(lines[idx].trim())) {
        tableLines.push(lines[idx].trim());
        idx++;
      }

      const contentRows = tableLines
        .filter((r) => !isTableSeparatorRow(r))
        .map((r) => parseTableCells(r));

      if (contentRows.length > 0) {
        const [headerRow, ...bodyRows] = contentRows;
        elements.push(
          <div
            key={`tbl-${startIdx}`}
            className="my-1.5 overflow-x-auto rounded-xl border border-emerald-200/90 bg-white shadow-2xs"
          >
            <table className="w-full border-collapse text-left text-[11px]">
              {bodyRows.length > 0 ? (
                <>
                  <thead className="bg-emerald-50/90 text-emerald-950 border-b border-emerald-200/80">
                    <tr>
                      {headerRow.map((cell, cIdx) => (
                        <th key={`th-${cIdx}`} className="px-2.5 py-1.5 font-black">
                          {renderInlineText(cell, searchKeyword)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bodyRows.map((row, rIdx) => (
                      <tr key={`tr-${rIdx}`} className="hover:bg-gray-50/60">
                        {row.map((cell, cIdx) => (
                          <td key={`td-${rIdx}-${cIdx}`} className="px-2.5 py-1.5 text-gray-800">
                            {renderInlineText(cell, searchKeyword)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : (
                <tbody>
                  <tr>
                    {headerRow.map((cell, cIdx) => (
                      <td key={`td-single-${cIdx}`} className="px-2.5 py-1.5 text-gray-800">
                        {renderInlineText(cell, searchKeyword)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        );
        continue;
      }
    }

    // 空行
    if (!line) {
      elements.push(<div key={`empty-${idx}`} className="h-1.5" />);
      idx++;
      continue;
    }

    // 見出し ### / ##
    if (line.startsWith('### ') || line.startsWith('## ')) {
      elements.push(
        <h4 key={`h3-${idx}`} className="font-black text-gray-900 pt-1 text-xs">
          {renderInlineText(line.replace(/^#{2,3}\s*/, ''), searchKeyword)}
        </h4>
      );
      idx++;
      continue;
    }

    // 箇条書き (* や - や ・)
    if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('・')) {
      const bulletContent = line.replace(/^(?:[*\-]\s+|・\s*)/, '');
      elements.push(
        <div key={`li-${idx}`} className="flex items-start gap-1.5 pl-1">
          <span className="text-emerald-700 font-bold shrink-0 leading-relaxed">•</span>
          <div className="flex-1">{renderInlineText(bulletContent, searchKeyword)}</div>
        </div>
      );
      idx++;
      continue;
    }

    // 番号付きリスト (1. 2. など)
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const [, num, numContent] = numMatch;
      elements.push(
        <div key={`ol-${idx}`} className="flex items-start gap-1.5 pl-1">
          <span className="text-emerald-800 font-black shrink-0 text-[11px] leading-relaxed">
            {num}.
          </span>
          <div className="flex-1">{renderInlineText(numContent, searchKeyword)}</div>
        </div>
      );
      idx++;
      continue;
    }

    // 通常の文章
    elements.push(
      <p key={`p-${idx}`} className="leading-relaxed">
        {renderInlineText(line, searchKeyword)}
      </p>
    );
    idx++;
  }

  return <div className="space-y-1.5 text-xs leading-relaxed text-gray-800">{elements}</div>;
}
