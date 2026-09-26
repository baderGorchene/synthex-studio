'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function CustomSelect({ value, options, onChange, ariaLabel, className = '' }: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = options.find(option => option.value === value) || options[0];
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [open]);
  return <div className={`custom-select ${className}`} ref={root}>
    <button type="button" className="custom-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(state => !state)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => optionRefs.current[Math.max(0, options.findIndex(option => option.value === value))]?.focus()); }
      if (event.key === 'Escape') setOpen(false);
    }}>{selected?.label || 'Choose'}<ChevronDown size={13} /></button>
    {open && <div className="custom-select-menu" role="listbox" aria-label={ariaLabel}>{options.map((option, index) => <button type="button" role="option" aria-selected={value === option.value} className={value === option.value ? 'selected' : ''} key={option.value} ref={element => { optionRefs.current[index] = element; }} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); optionRefs.current[(index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length]?.focus(); }
      if (event.key === 'Escape') { setOpen(false); root.current?.querySelector<HTMLButtonElement>('.custom-select-trigger')?.focus(); }
    }} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}</div>}
  </div>;
}
