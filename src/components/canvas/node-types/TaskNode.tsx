import React from 'react';
import { Check, Plus, X } from 'lucide-react';
import { CanvasNode, ThemeTokens } from '@/types/canvas';

interface TaskNodeProps {
  node: CanvasNode;
  themeTokens: ThemeTokens;
  isLight: boolean;
  onUpdate: (id: string, fields: Partial<CanvasNode>) => void;
}

export const TaskNode: React.FC<TaskNodeProps> = ({ node, themeTokens, isLight, onUpdate }) => {
  const items = node.items || [];
  const completedCount = items.filter(i => i.completed).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const handleToggleItem = (itemId: string) => {
    const newItems = items.map(i => (i.id === itemId ? { ...i, completed: !i.completed } : i));
    onUpdate(node.id, { items: newItems });
  };

  const handleUpdateItemText = (itemId: string, text: string) => {
    const newItems = items.map(i => (i.id === itemId ? { ...i, text } : i));
    onUpdate(node.id, { items: newItems });
  };

  const handleDeleteItem = (itemId: string) => {
    const newItems = items.filter(i => i.id !== itemId);
    onUpdate(node.id, { items: newItems });
  };

  const handleAddItem = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newItems = [
      ...items,
      { id: `t-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`, text: 'New milestone', completed: false }
    ];
    onUpdate(node.id, { items: newItems });
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className={`w-full h-1 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-zinc-800'}`}>
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-center space-x-2 group/item text-xs"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleToggleItem(item.id)}
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                item.completed
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : isLight
                  ? 'border-slate-300 hover:border-slate-500'
                  : 'border-zinc-700 hover:border-zinc-500'
              }`}
            >
              {item.completed && <Check className="w-2.5 h-2.5" />}
            </button>
            <input
              type="text"
              value={item.text}
              onChange={(e) => handleUpdateItemText(item.id, e.target.value)}
              className={`bg-transparent outline-none flex-1 text-xs transition ${
                item.completed ? 'line-through text-slate-400 dark:text-zinc-500' : themeTokens.bodyText
              }`}
            />
            <button
              onClick={() => handleDeleteItem(item.id)}
              className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-rose-500 transition"
              title="Delete task item"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddItem}
        className="flex items-center space-x-1.5 text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200 transition pt-1 cursor-pointer"
      >
        <Plus className="w-3 h-3" />
        <span>Add item</span>
      </button>
    </div>
  );
};
