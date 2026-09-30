'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, Paperclip, X } from 'lucide-react';

export type ComposerTool = {
  id: string;
  /** Typed after `/` to invoke the tool, e.g. `deep` for `/deep`. */
  command: string;
  label: string;
  hint: string;
  cost?: string;
  /** Sticky tools stay on the input as a chip and apply to the next send; the rest run as soon as they are picked. */
  sticky?: boolean;
};

type ToolComposerProps = {
  inputId: string;
  inputLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (text: string, toolId: string | null) => void;
  tools: ComposerTool[];
  activeToolId: string | null;
  onActiveToolChange: (toolId: string | null) => void;
  /** Runs a non-sticky tool. `text` is whatever was typed besides the slash command. */
  onRunTool: (toolId: string, text: string) => void;
  placeholder: string;
  sendLabel: string;
  inputRef?: (element: HTMLTextAreaElement | null) => void;
  disabled?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  size?: 'large' | 'regular';
  menuPlacement?: 'above' | 'below';
  className?: string;
};

const SLASH_QUERY = /^\/(\S*)$/;
const SLASH_PREFIX = /^\/(\S+)\s+([\s\S]*)$/;

export function ToolComposer({
  inputId, inputLabel, value, onValueChange, onSubmit, tools, activeToolId, onActiveToolChange, onRunTool,
  placeholder, sendLabel, inputRef, disabled = false, maxLength, autoFocus, size = 'regular', menuPlacement = 'above', className = ''
}: ToolComposerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuId = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const slashMatch = SLASH_QUERY.exec(value);
  const slashOpen = Boolean(slashMatch) && !slashDismissed;
  const menuOpen = !disabled && (pickerOpen || slashOpen);
  const query = slashOpen && slashMatch ? slashMatch[1].toLowerCase() : '';
  const activeTool = tools.find(tool => tool.id === activeToolId) ?? null;

  const filtered = useMemo(() => {
    if (!query) return tools;
    return tools.filter(tool => tool.command.startsWith(query) || tool.label.toLowerCase().includes(query));
  }, [tools, query]);
  const highlighted = Math.min(highlight, Math.max(filtered.length - 1, 0));

  // Grow with the text, up to a few lines.
  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    // The stylesheet caps the height; past that the textarea scrolls.
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (formRef.current?.contains(event.target as Node)) return;
      setPickerOpen(false);
      setSlashDismissed(true);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  const setRefs = (element: HTMLTextAreaElement | null) => {
    textareaRef.current = element;
    inputRef?.(element);
  };

  const closeMenu = () => {
    setPickerOpen(false);
    setHighlight(0);
  };

  const pick = (tool: ComposerTool) => {
    const typed = slashMatch ? '' : value;
    closeMenu();
    if (slashMatch) onValueChange('');
    if (tool.sticky) {
      onActiveToolChange(tool.id);
    } else {
      onRunTool(tool.id, typed.trim());
    }
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const submit = () => {
    if (disabled) return;
    let text = value.trim();
    let toolId = activeToolId;
    // `/deep how does sleep work` sends with the tool without picking it from the menu first.
    const prefixed = SLASH_PREFIX.exec(text);
    const prefixedTool = prefixed ? tools.find(tool => tool.command === prefixed[1].toLowerCase()) : undefined;
    if (prefixed && prefixedTool) {
      text = prefixed[2].trim();
      if (!prefixedTool.sticky) {
        onValueChange('');
        onRunTool(prefixedTool.id, text);
        return;
      }
      toolId = prefixedTool.id;
    }
    if (!text) return;
    onSubmit(text, toolId);
  };

  const handleChange = (next: string) => {
    setSlashDismissed(false);
    setHighlight(0);
    // Typing `/deep ` turns the command into a chip on the same line.
    const exact = /^\/(\S+)\s$/.exec(next);
    const exactTool = exact ? tools.find(tool => tool.command === exact[1].toLowerCase() && tool.sticky) : undefined;
    if (exactTool) {
      onActiveToolChange(exactTool.id);
      onValueChange('');
      return;
    }
    onValueChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen && filtered.length > 0) {
      if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((highlighted + 1) % filtered.length); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((highlighted - 1 + filtered.length) % filtered.length); return; }
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') { event.preventDefault(); pick(filtered[highlighted]); return; }
    }
    if (menuOpen && event.key === 'Escape') {
      event.preventDefault();
      setPickerOpen(false);
      setSlashDismissed(true);
      return;
    }
    if (event.key === 'Backspace' && activeTool && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0) {
      event.preventDefault();
      onActiveToolChange(null);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const canSend = !disabled && value.trim().length > 0 && !SLASH_QUERY.test(value.trim());

  return (
    <form
      ref={formRef}
      className={`composer tool-composer is-${size} ${className}`}
      onSubmit={event => { event.preventDefault(); submit(); }}
    >
      <div className="tool-composer-line">
        <button
          type="button"
          className={`tool-clip ${menuOpen ? 'is-open' : ''}`}
          aria-label="Tools"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          title="Tools (or type /)"
          disabled={disabled}
          onClick={() => { setPickerOpen(open => !open); setSlashDismissed(true); textareaRef.current?.focus(); }}
        >
          <Paperclip size={size === 'large' ? 19 : 17} strokeWidth={1.75} />
        </button>
        {activeTool && (
          <span className="tool-chip" title={activeTool.cost ? `${activeTool.hint} · ${activeTool.cost}` : activeTool.hint}>
            <span className="tool-chip-slash" aria-hidden="true">/</span>{activeTool.label}
            <button type="button" aria-label={`Remove ${activeTool.label}`} onClick={() => { onActiveToolChange(null); textareaRef.current?.focus(); }}>
              <X size={12} strokeWidth={2} />
            </button>
          </span>
        )}
        <label htmlFor={inputId} className="sr-only">{inputLabel}</label>
        <textarea
          id={inputId}
          ref={setRefs}
          rows={1}
          value={value}
          onChange={event => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          autoFocus={autoFocus}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-activedescendant={menuOpen && filtered[highlighted] ? `${menuId}-${filtered[highlighted].id}` : undefined}
        />
        <button type="submit" className="ink-button icon-send" aria-label={sendLabel} disabled={!canSend}>
          <ArrowRight size={18} strokeWidth={1.75} />
        </button>
      </div>

      {menuOpen && (
        <ul id={menuId} role="listbox" aria-label="Tools" className={`tool-menu is-${menuPlacement}`}>
          {filtered.length === 0 ? (
            <li className="tool-menu-empty">No tool matches “/{query}”</li>
          ) : filtered.map((tool, index) => (
            <li
              key={tool.id}
              id={`${menuId}-${tool.id}`}
              role="option"
              aria-selected={index === highlighted}
              className={`tool-menu-item ${index === highlighted ? 'is-active' : ''} ${tool.id === activeToolId ? 'is-current' : ''}`}
              onPointerDown={event => event.preventDefault()}
              onPointerEnter={() => setHighlight(index)}
              onClick={() => pick(tool)}
            >
              <code>/{tool.command}</code>
              <span className="tool-menu-text">
                <strong>{tool.label}</strong>
                <small>{tool.hint}</small>
              </span>
              {tool.cost && <span className="tool-menu-cost">{tool.cost}</span>}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
