'use client';

import { useRef } from 'react';
import { Bold, Code2, Heading1, Heading2, Italic, List, ListChecks, ListOrdered, Quote } from 'lucide-react';

type Format = 'bold' | 'italic' | 'h1' | 'h2' | 'list' | 'ordered' | 'task' | 'quote' | 'code';
const formats: Array<{ id: Format; label: string; icon: typeof Bold }> = [
  { id: 'bold', label: 'Bold', icon: Bold }, { id: 'italic', label: 'Italic', icon: Italic },
  { id: 'h1', label: 'Heading 1', icon: Heading1 }, { id: 'h2', label: 'Heading 2', icon: Heading2 },
  { id: 'list', label: 'Bulleted list', icon: List }, { id: 'ordered', label: 'Numbered list', icon: ListOrdered },
  { id: 'task', label: 'Checklist', icon: ListChecks },
  { id: 'quote', label: 'Block quote', icon: Quote }, { id: 'code', label: 'Code block', icon: Code2 }
];

const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?/;

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
      const prefix = kind === 'h1' ? '# ' : kind === 'h2' ? '## ' : kind === 'list' ? '- ' : kind === 'task' ? '- [ ] ' : '> ';
      // Any existing list marker is replaced, so switching a bulleted list to numbers (or a checklist) doesn't stack markers.
      selected = selected.split('\n').map((line, index) => {
        const bare = kind === 'list' || kind === 'ordered' || kind === 'task' ? line.replace(LIST_MARKER, '') : line;
        return `${kind === 'ordered' ? `${index + 1}. ` : prefix}${bare}`;
      }).join('\n');
    }

    const updated = text.slice(0, from) + before + selected + after + text.slice(to);
    onChange(updated);
    requestAnimationFrame(() => {
      input.focus();
      const selectionStart = from + before.length;
      input.setSelectionRange(selectionStart, selectionStart + selected.length);
    });
  };

  // Enter inside a list continues it (next number, a fresh checkbox); Enter on an empty item ends the list.
  const continueList = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.nativeEvent.isComposing) return;
    const input = event.currentTarget;
    if (input.selectionStart !== input.selectionEnd) return;
    const caret = input.selectionStart;
    const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
    const match = LIST_ITEM.exec(value.slice(lineStart, caret));
    if (!match) return;
    event.preventDefault();
    const [whole, indent, marker, , task] = match;
    let updated: string;
    let nextCaret: number;
    if (whole.length === caret - lineStart && value.slice(caret, value.indexOf('\n', caret) === -1 ? undefined : value.indexOf('\n', caret)).trim() === '') {
      updated = value.slice(0, lineStart) + value.slice(caret);
      nextCaret = lineStart;
    } else {
      const ordered = /^(\d+)([.)])$/.exec(marker);
      const nextMarker = ordered ? `${Number(ordered[1]) + 1}${ordered[2]}` : marker;
      const insert = `\n${indent}${nextMarker} ${task ? '[ ] ' : ''}`;
      updated = value.slice(0, caret) + insert + value.slice(caret);
      nextCaret = caret + insert.length;
    }
    onChange(updated);
    requestAnimationFrame(() => input.setSelectionRange(nextCaret, nextCaret));
  };

  return <div className={`markdown-editor ${className}`}>
    <div className="markdown-toolbar" role="toolbar" aria-label="Markdown formatting">
      {formats.map(({ id, label, icon: Icon }) => <button key={id} type="button" title={label} aria-label={label} onPointerDown={event => event.preventDefault()} onClick={() => format(id)}><Icon size={16} strokeWidth={1.75} /></button>)}
    </div>
    <textarea ref={textarea} autoFocus aria-label={ariaLabel} maxLength={50000} value={value} onChange={event => onChange(event.target.value)} onKeyDown={continueList} />
  </div>;
}
