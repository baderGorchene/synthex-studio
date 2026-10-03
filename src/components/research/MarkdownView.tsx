'use client';

import { marked, type Token, type Tokens } from 'marked';
import { Fragment, type ReactNode } from 'react';
import Image from 'next/image';

function safeHref(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch { return undefined; }
}

function inline(tokens: Token[] = [], prefix = 'i'): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${prefix}-${index}`;
    const nested = (value: Token[]) => inline(value, key);
    switch (token.type) {
      case 'strong': return <strong key={key}>{nested((token as Tokens.Strong).tokens)}</strong>;
      case 'em': return <em key={key}>{nested((token as Tokens.Em).tokens)}</em>;
      case 'del': return <del key={key}>{nested((token as Tokens.Del).tokens)}</del>;
      case 'codespan': return <code key={key}>{(token as Tokens.Codespan).text}</code>;
      case 'br': return <br key={key} />;
      case 'link': {
        const link = token as Tokens.Link;
        const href = safeHref(link.href);
        return href ? <a key={key} href={href} target="_blank" rel="noreferrer">{nested(link.tokens)}</a> : <span key={key}>{nested(link.tokens)}</span>;
      }
      case 'image': {
        const image = token as Tokens.Image;
        const href = safeHref(image.href);
        return href ? <Image key={key} src={href} alt={image.text} width={600} height={300} unoptimized /> : <span key={key}>{image.text}</span>;
      }
      case 'escape': return <span key={key}>{(token as Tokens.Escape).text}</span>;
      case 'text': {
        const text = token as Tokens.Text;
        return <span key={key}>{text.tokens?.length ? nested(text.tokens) : text.text}</span>;
      }
      case 'html': return <span key={key}>{(token as Tokens.HTML).text}</span>;
      default: return <span key={key}>{'text' in token ? String(token.text) : ''}</span>;
    }
  });
}

type MarkdownContext = { taskIndex: number; onToggleTask?: (index: number) => void };

function blocks(tokens: Token[], prefix = 'b', context: MarkdownContext = { taskIndex: 0 }): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${prefix}-${index}`;
    switch (token.type) {
      case 'space': return null;
      case 'heading': {
        const heading = token as Tokens.Heading;
        const children = inline(heading.tokens, key);
        if (heading.depth === 1) return <h1 key={key}>{children}</h1>;
        if (heading.depth === 2) return <h2 key={key}>{children}</h2>;
        return <h3 key={key}>{children}</h3>;
      }
      case 'paragraph': return <p key={key}>{inline((token as Tokens.Paragraph).tokens, key)}</p>;
      // Items of a tight list hold their words in a block-level `text` token: render it inline, not as a paragraph.
      case 'text': {
        const text = token as Tokens.Text;
        return <Fragment key={key}>{text.tokens?.length ? inline(text.tokens, key) : text.text}</Fragment>;
      }
      // Task items carry a `checkbox` token; the list item below renders the (clickable) box itself.
      case 'checkbox': return null;
      case 'code': return <pre key={key}><code>{(token as Tokens.Code).text}</code></pre>;
      case 'blockquote': return <blockquote key={key}>{blocks((token as Tokens.Blockquote).tokens, key, context)}</blockquote>;
      case 'list': {
        const list = token as Tokens.List;
        const items = list.items.map((item, itemIndex) => {
          const taskIndex = item.task ? context.taskIndex++ : undefined;
          return <li key={`${key}-${itemIndex}`} className={item.task ? `task-list-item ${item.checked ? 'is-done' : ''}` : undefined}>{item.task && <input type="checkbox" checked={Boolean(item.checked)} readOnly={!context.onToggleTask} disabled={!context.onToggleTask} aria-label={item.checked ? 'Completed task' : 'Incomplete task'} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onChange={() => taskIndex !== undefined && context.onToggleTask?.(taskIndex)} />}{blocks(item.tokens, `${key}-${itemIndex}`, context)}</li>;
        });
        const taskList = list.items.some(item => item.task) ? 'contains-task-list' : undefined;
        return list.ordered ? <ol key={key} className={taskList} start={typeof list.start === 'number' && list.start !== 1 ? list.start : undefined}>{items}</ol> : <ul key={key} className={taskList}>{items}</ul>;
      }
      case 'table': {
        const table = token as Tokens.Table;
        const cell = (item: Tokens.TableCell, cellKey: string) => <td key={cellKey} style={{ textAlign: item.align || undefined }}>{inline(item.tokens, cellKey)}</td>;
        return <table key={key}><thead><tr>{table.header.map((item, cellIndex) => <th key={`${key}-h${cellIndex}`} style={{ textAlign: item.align || undefined }}>{inline(item.tokens, `${key}-h${cellIndex}`)}</th>)}</tr></thead><tbody>{table.rows.map((row, rowIndex) => <tr key={`${key}-r${rowIndex}`}>{row.map((item, cellIndex) => cell(item, `${key}-r${rowIndex}-${cellIndex}`))}</tr>)}</tbody></table>;
      }
      case 'hr': return <hr key={key} />;
      case 'html': return <p key={key}>{(token as Tokens.HTML).text}</p>;
      default: return <p key={key}>{'text' in token ? String(token.text) : ''}</p>;
    }
  });
}

export function MarkdownView({ content, className = '', onToggleTask }: { content: string; className?: string; onToggleTask?: (index: number) => void }) {
  if (!content.trim()) return null;
  return <div className={`markdown-view ${className}`}>{blocks(marked.lexer(content, { gfm: true }), 'md', { taskIndex: 0, onToggleTask })}</div>;
}

/** One line of Markdown (bold, italics, code, links) rendered inline, for places that hold a single line such as to-do items. */
export function MarkdownInline({ text }: { text: string }) {
  const tokens = marked.lexer(text, { gfm: true });
  const first = tokens[0];
  if (tokens.length !== 1 || first.type !== 'paragraph') return <>{text}</>;
  return <>{inline((first as Tokens.Paragraph).tokens, 'mi')}</>;
}
