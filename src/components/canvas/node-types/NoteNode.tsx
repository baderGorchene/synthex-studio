import React, { useRef, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Link2
} from 'lucide-react';
import { CanvasNode, ThemeTokens } from '@/types/canvas';

interface NoteNodeProps {
  node: CanvasNode;
  themeTokens: ThemeTokens;
  isLight?: boolean;
  /** Controlled from CanvasCard's header Edit/View toggle */
  isEditing?: boolean;
  onUpdate: (id: string, fields: Partial<CanvasNode>) => void;
}

export const NoteNode: React.FC<NoteNodeProps> = ({
  node,
  themeTokens,
  isLight = false,
  isEditing = false,
  onUpdate
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea while in edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(88, textareaRef.current.scrollHeight)}px`;
    }
  }, [node.content, isEditing]);

  // Focus textarea when switching into edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Synchronously parse Markdown with GFM enabled
  const renderedHtml = useMemo(() => {
    if (!node.content || !node.content.trim()) return '';
    try {
      const raw = marked.parse(node.content, { gfm: true, breaks: true }) as string;
      // Remove disabled so checkboxes are clickable in preview
      const interactive = raw.replace(/<input\s+disabled=""\s+type="checkbox"/g, '<input type="checkbox"');
      // Safe external links
      return interactive.replace(/<a\s+href=/g, '<a target="_blank" rel="noopener noreferrer" href=');
    } catch {
      return node.content;
    }
  }, [node.content]);

  // Interactive checklist toggling in preview
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      e.stopPropagation();
      const checkboxes = Array.from(e.currentTarget.querySelectorAll('input[type="checkbox"]'));
      const index = checkboxes.indexOf(target as HTMLInputElement);
      if (index !== -1) {
        let count = 0;
        const updated = (node.content || '').replace(
          /^([ \t]*[-*+]\s+\[)([ xX])(\])/gm,
          (match, prefix, check, suffix) => {
            if (count === index) { count++; return `${prefix}${check === ' ' ? 'x' : ' '}${suffix}`; }
            count++;
            return match;
          }
        );
        onUpdate(node.id, { content: updated });
      }
    }
  };

  // ─── Formatting helpers ──────────────────────────────────────────────────────

  // Guard against double-fire from overlapping pointer/mouse/click events
  const formatGuardRef = useRef(false);
  const guardedAction = (fn: () => void) => {
    if (formatGuardRef.current) return;
    formatGuardRef.current = true;
    fn();
    setTimeout(() => { formatGuardRef.current = false; }, 50);
  };

  const applyInlineFormat = (prefix: string, suffix: string, placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = node.content || '';
    const selected = text.substring(start, end);
    const pLen = prefix.length;
    const sLen = suffix.length;

    // Toggle off if already wrapped
    if (
      start >= pLen &&
      end <= text.length - sLen &&
      text.substring(start - pLen, start) === prefix &&
      text.substring(end, end + sLen) === suffix
    ) {
      const unwrapped = text.substring(0, start - pLen) + selected + text.substring(end + sLen);
      onUpdate(node.id, { content: unwrapped });
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start - pLen, end - pLen);
      });
      return;
    }

    const inserted = selected || placeholder;
    const newText = text.substring(0, start) + prefix + inserted + suffix + text.substring(end);
    onUpdate(node.id, { content: newText });
    requestAnimationFrame(() => {
      textarea.focus();
      if (selected) {
        textarea.setSelectionRange(start + pLen, end + pLen);
      } else {
        textarea.setSelectionRange(start + pLen, start + pLen + placeholder.length);
      }
    });
  };

  const applyLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = node.content || '';
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEndIdx = text.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
    const selectedBlock = text.substring(lineStart, lineEnd);
    const lines = selectedBlock.split('\n');
    const allHavePrefix = lines.every(l => l.startsWith(prefix));

    const newLines = allHavePrefix
      ? lines.map(l => l.slice(prefix.length))
      : lines.map(l => {
          if (prefix.startsWith('#')) return `${prefix}${l.replace(/^#{1,6}\s+/, '')}`;
          if (prefix === '- ' || prefix === '- [ ] ') return `${prefix}${l.replace(/^(\s*[-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+)/, '')}`;
          return `${prefix}${l}`;
        });

    const replaced = newLines.join('\n');
    const newText = text.substring(0, lineStart) + replaced + text.substring(lineEnd);
    onUpdate(node.id, { content: newText });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart, lineStart + replaced.length);
    });
  };

  const applyNumberedList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = node.content || '';
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEndIdx = text.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
    const lines = text.substring(lineStart, lineEnd).split('\n');
    const allNumbered = lines.every(l => /^\d+\.\s+/.test(l));
    const newLines = allNumbered
      ? lines.map(l => l.replace(/^\d+\.\s+/, ''))
      : lines.map((l, i) => `${i + 1}. ${l.replace(/^(\s*[-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+)/, '')}`);
    const replaced = newLines.join('\n');
    const newText = text.substring(0, lineStart) + replaced + text.substring(lineEnd);
    onUpdate(node.id, { content: newText });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart, lineStart + replaced.length);
    });
  };

  const applyLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = node.content || '';
    const selected = text.substring(start, end);
    if (selected) {
      const newText = text.substring(0, start) + `[${selected}](https://)` + text.substring(end);
      onUpdate(node.id, { content: newText });
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + selected.length + 3, start + selected.length + 11);
      });
    } else {
      const template = '[link text](https://)';
      const newText = text.substring(0, start) + template + text.substring(end);
      onUpdate(node.id, { content: newText });
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 10);
      });
    }
  };

  // Toolbar button helper: run on mousedown, prevent default, guard against double-fire
  const fmtBtn = (action: () => void) => ({
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      guardedAction(action);
    },
  });

  // Smart keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newVal = (node.content || '').substring(0, start) + '  ' + (node.content || '').substring(end);
      onUpdate(node.id, { content: newVal });
      requestAnimationFrame(() => textarea.setSelectionRange(start + 2, start + 2));
      return;
    }

    if (e.key === 'Enter') {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const pos = textarea.selectionStart;
      const text = node.content || '';
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      const currentLine = text.substring(lineStart, pos);

      const checkMatch = currentLine.match(/^(\s*[-*+]\s+\[(?: |x|X)\]\s+)(.*)$/);
      if (checkMatch) {
        e.preventDefault();
        if (!checkMatch[2].trim()) {
          const newVal = text.substring(0, lineStart) + text.substring(pos);
          onUpdate(node.id, { content: newVal });
          requestAnimationFrame(() => textarea.setSelectionRange(lineStart, lineStart));
          return;
        }
        const indent = currentLine.match(/^\s*/)?.[0] || '';
        const prefix = `\n${indent}- [ ] `;
        const newVal = text.substring(0, pos) + prefix + text.substring(pos);
        onUpdate(node.id, { content: newVal });
        requestAnimationFrame(() => textarea.setSelectionRange(pos + prefix.length, pos + prefix.length));
        return;
      }

      const bulletMatch = currentLine.match(/^(\s*[-*+]\s+)(.*)$/);
      if (bulletMatch) {
        e.preventDefault();
        if (!bulletMatch[2].trim()) {
          const newVal = text.substring(0, lineStart) + text.substring(pos);
          onUpdate(node.id, { content: newVal });
          requestAnimationFrame(() => textarea.setSelectionRange(lineStart, lineStart));
          return;
        }
        const prefix = `\n${bulletMatch[1]}`;
        const newVal = text.substring(0, pos) + prefix + text.substring(pos);
        onUpdate(node.id, { content: newVal });
        requestAnimationFrame(() => textarea.setSelectionRange(pos + prefix.length, pos + prefix.length));
        return;
      }

      const numMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (numMatch) {
        e.preventDefault();
        if (!numMatch[3].trim()) {
          const newVal = text.substring(0, lineStart) + text.substring(pos);
          onUpdate(node.id, { content: newVal });
          requestAnimationFrame(() => textarea.setSelectionRange(lineStart, lineStart));
          return;
        }
        const nextNum = parseInt(numMatch[2], 10) + 1;
        const prefix = `\n${numMatch[1]}${nextNum}. `;
        const newVal = text.substring(0, pos) + prefix + text.substring(pos);
        onUpdate(node.id, { content: newVal });
        requestAnimationFrame(() => textarea.setSelectionRange(pos + prefix.length, pos + prefix.length));
        return;
      }
    }
  };

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const btnBase = 'w-6 h-6 flex items-center justify-center rounded text-xs transition-colors';
  const btnTheme = isLight
    ? 'text-slate-600 hover:text-cyan-700 hover:bg-cyan-500/10 active:bg-cyan-500/20'
    : 'text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/15 active:bg-cyan-500/25';
  const dividerTheme = isLight ? 'bg-slate-200' : 'bg-slate-700/40';

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Formatting Toolbar — only visible when in Edit mode */}
      {isEditing && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className={`flex items-center flex-wrap gap-0.5 p-1 rounded-lg border backdrop-blur-xs select-none ${
            isLight
              ? 'bg-slate-50/90 border-slate-200/90 shadow-2xs text-slate-700'
              : 'bg-slate-900/50 border-slate-800/80 shadow-2xs text-slate-300'
          }`}
        >
          {/* Text styling */}
          <div className="flex items-center gap-0.5">
            <button type="button" title="Bold (**)" {...fmtBtn(() => applyInlineFormat('**', '**', 'bold text'))} className={`${btnBase} ${btnTheme}`}><Bold className="w-3.5 h-3.5" /></button>
            <button type="button" title="Italic (*)" {...fmtBtn(() => applyInlineFormat('*', '*', 'italic text'))} className={`${btnBase} ${btnTheme}`}><Italic className="w-3.5 h-3.5" /></button>
            <button type="button" title="Strikethrough (~~)" {...fmtBtn(() => applyInlineFormat('~~', '~~', 'strikethrough'))} className={`${btnBase} ${btnTheme}`}><Strikethrough className="w-3.5 h-3.5" /></button>
            <button type="button" title="Inline Code (`)" {...fmtBtn(() => applyInlineFormat('`', '`', 'code'))} className={`${btnBase} ${btnTheme}`}><Code className="w-3.5 h-3.5" /></button>
          </div>

          <div className={`w-[1px] h-3.5 mx-0.5 self-center ${dividerTheme}`} />

          {/* Headings */}
          <div className="flex items-center gap-0.5">
            <button type="button" title="Heading 1" {...fmtBtn(() => applyLinePrefix('# '))} className={`${btnBase} ${btnTheme}`}><Heading1 className="w-3.5 h-3.5" /></button>
            <button type="button" title="Heading 2" {...fmtBtn(() => applyLinePrefix('## '))} className={`${btnBase} ${btnTheme}`}><Heading2 className="w-3.5 h-3.5" /></button>
          </div>

          <div className={`w-[1px] h-3.5 mx-0.5 self-center ${dividerTheme}`} />

          {/* Lists */}
          <div className="flex items-center gap-0.5">
            <button type="button" title="Bullet list" {...fmtBtn(() => applyLinePrefix('- '))} className={`${btnBase} ${btnTheme}`}><List className="w-3.5 h-3.5" /></button>
            <button type="button" title="Numbered list" {...fmtBtn(applyNumberedList)} className={`${btnBase} ${btnTheme}`}><ListOrdered className="w-3.5 h-3.5" /></button>
            <button type="button" title="Task checklist" {...fmtBtn(() => applyLinePrefix('- [ ] '))} className={`${btnBase} ${btnTheme}`}><ListTodo className="w-3.5 h-3.5" /></button>
          </div>

          <div className={`w-[1px] h-3.5 mx-0.5 self-center ${dividerTheme}`} />

          {/* Quote & Link */}
          <div className="flex items-center gap-0.5">
            <button type="button" title="Blockquote" {...fmtBtn(() => applyLinePrefix('> '))} className={`${btnBase} ${btnTheme}`}><Quote className="w-3.5 h-3.5" /></button>
            <button type="button" title="Insert link" {...fmtBtn(applyLink)} className={`${btnBase} ${btnTheme}`}><Link2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {/* Content: textarea in edit mode, rendered markdown in view mode */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={node.content || ''}
          onChange={(e) => onUpdate(node.id, { content: e.target.value })}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          rows={4}
          className={`w-full bg-transparent resize-none border-none outline-none text-xs leading-relaxed font-sans ${themeTokens.bodyText} placeholder:text-slate-400/60`}
          placeholder="Write notes, markdown, tasks (- [ ]), or code..."
        />
      ) : (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handlePreviewClick}
          className={`markdown-note-content min-h-[60px] w-full p-0.5 select-text leading-relaxed ${
            isLight ? 'markdown-light text-slate-800' : 'markdown-note-dark text-slate-200'
          }`}
        >
          {renderedHtml ? (
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          ) : (
            <p className="text-slate-400/50 italic text-xs py-1">
              Press <span className={`font-semibold ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>Edit</span> above to write markdown&hellip;
            </p>
          )}
        </div>
      )}
    </div>
  );
};
