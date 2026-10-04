'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import { Bold, Code2, Heading1, Heading2, Italic, List, ListChecks, ListOrdered, Quote, Strikethrough } from 'lucide-react';

/**
 * Notes are edited as formatted text (bold shows bold, a list shows bullets) and stored as Markdown, so exports,
 * search, AI context and MarkdownView keep reading the same string. Typing Markdown still works: `- `, `1. `,
 * `[ ] `, `# ` and `**bold**` turn into formatting as you type.
 */
const extensions = [
  StarterKit.configure({
    // Underline has no Markdown form that the rest of the app reads, so it stays off.
    underline: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' }
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: false } }),
  // Keep every picture a note already holds, data URIs included, so editing never drops one.
  Image.configure({ allowBase64: true }),
  Placeholder.configure({ placeholder: 'Write here. Type - for a list, 1. for numbers, [ ] for a checklist, # for a heading.' }),
  Markdown
];

type Tool = { label: string; icon: typeof Bold; isActive: (editor: Editor) => boolean; run: (editor: Editor) => void };
const tools: Tool[] = [
  { label: 'Bold', icon: Bold, isActive: e => e.isActive('bold'), run: e => e.chain().focus().toggleBold().run() },
  { label: 'Italic', icon: Italic, isActive: e => e.isActive('italic'), run: e => e.chain().focus().toggleItalic().run() },
  { label: 'Strikethrough', icon: Strikethrough, isActive: e => e.isActive('strike'), run: e => e.chain().focus().toggleStrike().run() },
  { label: 'Heading 1', icon: Heading1, isActive: e => e.isActive('heading', { level: 1 }), run: e => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2', icon: Heading2, isActive: e => e.isActive('heading', { level: 2 }), run: e => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Bulleted list', icon: List, isActive: e => e.isActive('bulletList'), run: e => e.chain().focus().toggleBulletList().run() },
  { label: 'Numbered list', icon: ListOrdered, isActive: e => e.isActive('orderedList'), run: e => e.chain().focus().toggleOrderedList().run() },
  { label: 'Checklist', icon: ListChecks, isActive: e => e.isActive('taskList'), run: e => e.chain().focus().toggleTaskList().run() },
  { label: 'Block quote', icon: Quote, isActive: e => e.isActive('blockquote'), run: e => e.chain().focus().toggleBlockquote().run() },
  { label: 'Code block', icon: Code2, isActive: e => e.isActive('codeBlock'), run: e => e.chain().focus().toggleCodeBlock().run() }
];

export function MarkdownEditor({ value, onChange, className = '', ariaLabel = 'Note in Markdown', autoFocus = true }: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}) {
  // The Markdown this editor last sent up. A `value` that differs came from elsewhere (undo, a teammate).
  const lastSent = useRef(value);
  // The editor is created once; its update handler reads the latest onChange through this ref.
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const editor = useEditor({
    extensions,
    content: value,
    contentType: 'markdown',
    autofocus: autoFocus ? 'end' : false,
    // Rendered on the client only; skipping the server pass avoids a hydration mismatch.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'markdown-view markdown-editor-content', 'aria-label': ariaLabel, 'aria-multiline': 'true', role: 'textbox' }
    },
    onUpdate: ({ editor: current, transaction }) => {
      // Only edits count. Opening a note can tidy it (a table gets its header row); that alone must not rewrite it.
      if (!transaction.docChanged) return;
      const markdown = current.getMarkdown();
      lastSent.current = markdown;
      onChangeRef.current(markdown);
    }
  });

  // Follow changes made outside the editor without echoing them back as an edit.
  useEffect(() => {
    if (!editor || value === lastSent.current) return;
    lastSent.current = value;
    if (value !== editor.getMarkdown()) editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => (current ? tools.map(tool => tool.isActive(current)) : tools.map(() => false))
  });

  return <div className={`markdown-editor ${className}`}>
    <div className="markdown-toolbar" role="toolbar" aria-label="Formatting">
      {tools.map(({ label, icon: Icon, run }, index) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={Boolean(active?.[index])}
          className={active?.[index] ? 'is-active' : undefined}
          disabled={!editor}
          onPointerDown={event => event.preventDefault()}
          onClick={() => editor && run(editor)}
        >
          <Icon size={16} strokeWidth={1.75} />
        </button>
      ))}
    </div>
    <EditorContent editor={editor} />
  </div>;
}
