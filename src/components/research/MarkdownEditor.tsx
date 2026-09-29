'use client';

import { useRef } from 'react';
import { Bold, Code2, Heading1, Heading2, Italic, List, ListOrdered, Quote } from 'lucide-react';

type Format = 'bold' | 'italic' | 'h1' | 'h2' | 'list' | 'ordered' | 'quote' | 'code';
const formats: Array<{ id: Format; label: string; icon: typeof Bold }> = [
  { id: 'bold', label: 'Bold', icon: Bold }, { id: 'italic', label: 'Italic', icon: Italic },
  { id: 'h1', label: 'Heading 1', icon: Heading1 }, { id: 'h2', label: 'Heading 2', icon: Heading2 },
  { id: 'list', label: 'Bulleted list', icon: List }, { id: 'ordered', label: 'Numbered list', icon: ListOrdered },
  { id: 'quote', label: 'Block quote', icon: Quote }, { id: 'code', label: 'Code block', icon: Code2 }
];

export function MarkdownEditor({ value, onChange, className = '', ariaLabel = 'Note in Markdown' }: { value: string; onChange: (value: string) => void; className?: string; ariaLabel?: string }) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  const format = (kind: Format) => {
    const input = textarea.current;
    if (!input) return;
    const text = value;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    let from = start;
    let to = end;
    let before = '';
    let after = '';
    let selected = text.slice(start, end);

    if (kind === 'bold' || kind === 'italic') {
      before = kind === 'bold' ? '**' : '*';
      after = before;
      selected ||= 'text';
    } else if (kind === 'code') {
      before = '```\n'; after = '\n```'; selected ||= 'code';
    } else {
      from = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const lineEnd = text.indexOf('\n', end);
      to = lineEnd === -1 ? text.length : lineEnd;
      selected = text.slice(from, to) || 'text';
      const prefix = kind === 'h1' ? '# ' : kind === 'h2' ? '## ' : kind === 'list' ? '- ' : kind === 'ordered' ? '1. ' : '> ';
      selected = selected.split('\n').map(line => `${prefix}${line}`).join('\n');
    }

    const updated = text.slice(0, from) + before + selected + after + text.slice(to);
    onChange(updated);
    requestAnimationFrame(() => {
      input.focus();
      const selectionStart = from + before.length;
      input.setSelectionRange(selectionStart, selectionStart + selected.length);
    });
  };

  return <div className={`markdown-editor ${className}`}>
    <div className="markdown-toolbar" role="toolbar" aria-label="Markdown formatting">
      {formats.map(({ id, label, icon: Icon }) => <button key={id} type="button" title={label} aria-label={label} onPointerDown={event => event.preventDefault()} onClick={() => format(id)}><Icon size={14} /></button>)}
    </div>
    <textarea ref={textarea} autoFocus aria-label={ariaLabel} maxLength={50000} value={value} onChange={event => onChange(event.target.value)} />
  </div>;
}
