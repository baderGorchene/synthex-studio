'use client';

import { useState, type FormEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { TODO_LINE, parseTodos } from '@/utils/todo';
import { MarkdownInline, MarkdownView } from '../MarkdownView';

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/** The body of a to-do card: tick items off, double-click to edit one, add new ones inline. */
export function TodoList({ content, onChange, autoFocus }: { content: string; onChange: (content: string) => void; autoFocus?: boolean }) {
  const { lines, todos, notes } = parseTodos(content);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ line: number; text: string } | null>(null);
  const done = todos.filter(todo => todo.checked).length;

  const write = (next: string[]) => onChange(next.join('\n').replace(/^\n+|\n+$/g, ''));
  const setLine = (line: number, text: string, checked: boolean) => {
    const next = [...lines];
    const indent = TODO_LINE.exec(next[line])?.[1] || '';
    next[line] = `${indent}- [${checked ? 'x' : ' '}] ${text}`;
    write(next);
  };
  const removeLine = (line: number) => write(lines.filter((_, index) => index !== line));

  function add(event: FormEvent) {
    event.preventDefault();
    const text = draft.replace(/\s+/g, ' ').trim();
    if (!text) return;
    const next = content.trim() ? [...lines] : [];
    // New items go right after the last one, so any notes written below the list stay below it.
    next.splice(todos.length ? todos[todos.length - 1].line + 1 : next.length, 0, `- [ ] ${text}`);
    write(next);
    setDraft('');
  }

  function saveEdit() {
    if (!editing) return;
    const todo = todos.find(item => item.line === editing.line);
    const text = editing.text.replace(/\s+/g, ' ').trim();
    if (todo) {
      if (text) setLine(todo.line, text, todo.checked); else removeLine(todo.line);
    }
    setEditing(null);
  }

  return (
    <div className="todo-card">
      {notes && <MarkdownView content={notes} className="node-summary todo-notes" />}

      {todos.length > 0 && (
        <div className="todo-progress" aria-label={`${done} of ${todos.length} done`}>
          <span>{done === todos.length ? 'All done' : `${done} of ${todos.length} done`}</span>
          <span className="todo-bar" aria-hidden="true"><i style={{ width: `${(done / todos.length) * 100}%` }} /></span>
        </div>
      )}

      <ul className="todo-items">
        {todos.map(todo => (
          <li key={todo.line} className={`todo-item ${todo.checked ? 'is-done' : ''}`}>
            <button
              type="button"
              role="checkbox"
              aria-checked={todo.checked}
              aria-label={todo.text || 'To-do'}
              className="todo-box"
              onPointerDown={stop}
              onClick={event => { stop(event); setLine(todo.line, todo.text, !todo.checked); }}
            >
              {todo.checked && <Check size={12} strokeWidth={3} />}
            </button>
            {editing?.line === todo.line ? (
              <input
                className="todo-edit"
                onPointerDown={stop}
                value={editing.text}
                maxLength={300}
                autoFocus
                aria-label="Edit to-do"
                onChange={event => setEditing({ line: todo.line, text: event.target.value })}
                onBlur={saveEdit}
                onKeyDown={event => {
                  event.stopPropagation();
                  if (event.key === 'Enter') { event.preventDefault(); saveEdit(); }
                  if (event.key === 'Escape') setEditing(null);
                }}
              />
            ) : (
              <span
                className="todo-text"
                title="Double-click to edit"
                onDoubleClick={event => { stop(event); setEditing({ line: todo.line, text: todo.text }); }}
              >
                {todo.text ? <MarkdownInline text={todo.text} /> : <em>Empty item</em>}
              </span>
            )}
            <button type="button" className="todo-remove" aria-label={`Remove “${todo.text}”`} title="Remove" onPointerDown={stop} onClick={event => { stop(event); removeLine(todo.line); }}>
              <X size={12} strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>

      <form className="todo-add" onSubmit={add} onPointerDown={stop} onClick={stop}>
        <Plus size={14} strokeWidth={2} aria-hidden="true" />
        <input
          value={draft}
          maxLength={300}
          placeholder={todos.length ? 'Add another…' : 'Add a to-do and press Enter'}
          aria-label="Add a to-do"
          autoFocus={autoFocus}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.blur(); }}
        />
      </form>

      {done > 0 && (
        <button type="button" className="todo-clear" onPointerDown={stop} onClick={event => { stop(event); write(lines.filter((_, index) => !todos.some(todo => todo.line === index && todo.checked))); }}>
          Clear {done} done
        </button>
      )}
    </div>
  );
}
