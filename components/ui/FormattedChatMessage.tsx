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

  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-gray-800">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();

        // 空行
        if (!line) {
          return <div key={`empty-${idx}`} className="h-1.5" />;
        }

        // 見出し ###
        if (line.startsWith('### ')) {
          return (
            <h4 key={`h3-${idx}`} className="font-black text-gray-900 pt-1 text-xs">
              {renderInlineText(line.replace(/^###\s*/, ''), searchKeyword)}
            </h4>
          );
        }

        // 箇条書き (* や -)
        if (line.startsWith('* ') || line.startsWith('- ')) {
          const bulletContent = line.replace(/^[*\-]\s*/, '');
          return (
            <div key={`li-${idx}`} className="flex items-start gap-1.5 pl-1">
              <span className="text-emerald-700 font-bold shrink-0 leading-relaxed">•</span>
              <div className="flex-1">{renderInlineText(bulletContent, searchKeyword)}</div>
            </div>
          );
        }

        // 番号付きリスト (1. 2. など)
        const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          const [, num, numContent] = numMatch;
          return (
            <div key={`ol-${idx}`} className="flex items-start gap-1.5 pl-1">
              <span className="text-emerald-800 font-black shrink-0 text-[11px] leading-relaxed">
                {num}.
              </span>
              <div className="flex-1">{renderInlineText(numContent, searchKeyword)}</div>
            </div>
          );
        }

        // 通常の文章
        return (
          <p key={`p-${idx}`} className="leading-relaxed">
            {renderInlineText(line, searchKeyword)}
          </p>
        );
      })}
    </div>
  );
}
