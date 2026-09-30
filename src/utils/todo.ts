import type { TaskItem } from '../types/canvas.ts';

/**
 * A to-do card keeps its items as a Markdown checklist in `content` ("- [ ] item" / "- [x] item"),
 * so it autosaves, exports and renders like every other note. Other lines are kept as they are.
 */
export const TODO_LINE = /^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s?(.*)$/;

export interface TodoLine { line: number; checked: boolean; text: string }

export function parseTodos(content: string) {
  const lines = content.split('\n');
  const todos: TodoLine[] = [];
  const other: string[] = [];
  lines.forEach((raw, line) => {
    const match = TODO_LINE.exec(raw);
    if (match) todos.push({ line, checked: match[2] !== ' ', text: match[3] });
    else other.push(raw);
  });
  return { lines, todos, notes: other.join('\n').trim() };
}

/** Number of checklist items in a to-do card, for sizing it before it renders. */
export function countTodos(content?: string, items?: TaskItem[]) {
  if (!content && items?.length) return items.length;
  return content ? parseTodos(content).todos.length : 0;
}

/** Legacy task cards stored items in `items`; show them as a checklist until the card is edited. */
export function todoContent(content?: string, items?: TaskItem[]) {
  if (content || !items?.length) return content || '';
  return items.map(item => `- [${item.completed ? 'x' : ' '}] ${item.text}`).join('\n');
}
