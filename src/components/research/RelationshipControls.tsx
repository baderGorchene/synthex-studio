'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Settings2, Trash2, X } from 'lucide-react';
import type { Connection } from '@/types/canvas';
import { CustomSelect } from './CustomSelect';

const colors = [
  ['neutral', '#86948a'], ['indigo', '#6571a6'], ['emerald', '#53806b'],
  ['rose', '#a76e69'], ['amber', '#a48652'], ['sky', '#64859a'], ['purple', '#856d9a']
] as const;

export function RelationshipControls({ connection, x, y, onUpdate, onDelete }: {
  connection: Connection;
  x: number;
  y: number;
  onUpdate: (fields: Partial<Connection>) => void;
  onDelete: () => void;
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(connection.label || '');
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  useEffect(() => {
    if (!optionsOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOptionsOpen(false);
    };
    window.addEventListener('pointerdown', closeOutside, true);
    return () => window.removeEventListener('pointerdown', closeOutside, true);
  }, [optionsOpen]);
  const save = () => { onUpdate({ label: label.trim() }); setEditing(false); };

  return <foreignObject x={x - 92} y={y - 18} width="184" height={optionsOpen ? 330 : 38} className="relationship-controls-foreign">
    <div ref={root} className={`relationship-controls ${optionsOpen ? 'options-open' : ''}`} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') setOptionsOpen(false); }}>
      <div className="relationship-pill">
        <button className="relationship-control-icon relationship-settings" aria-label="Relationship settings" title="Style relationship" onClick={() => setOptionsOpen(value => !value)}><Settings2 size={13} /></button>
        <span className="relationship-control-divider" />
        {editing ? <input ref={input} aria-label="Relationship label" value={label} maxLength={100} placeholder="Add a label" onChange={event => setLabel(event.target.value)} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') save(); if (event.key === 'Escape') { setEditing(false); } }} onBlur={save} /> : <button className="relationship-label" onClick={() => { setLabel(connection.label || ''); setEditing(true); }} title="Click to edit relationship label"><i style={{ background: colors.find(([id]) => id === (connection.color || 'neutral'))?.[1] }} />{connection.label?.replaceAll('_', ' ') || 'Add label'}</button>}
        <span className="relationship-control-divider" />
        <button className="relationship-control-icon relationship-delete" aria-label="Delete relationship" title="Delete relationship" onClick={onDelete}><Trash2 size={13} /></button>
      </div>
      {optionsOpen && <div className="relationship-options">
        <div className="relationship-options-head"><span>Relationship style</span><button aria-label="Close relationship settings" onClick={() => setOptionsOpen(false)}><X size={12} /></button></div>
        <label>Line <CustomSelect className="relationship-select" ariaLabel="Line style" value={connection.lineStyle || 'curved'} options={[{ value: 'curved', label: 'Curved' }, { value: 'straight', label: 'Straight' }, { value: 'stepped', label: 'Stepped' }]} onChange={value => onUpdate({ lineStyle: value as Connection['lineStyle'] })} /></label>
        <label>Arrow <CustomSelect className="relationship-select" ariaLabel="Arrow direction" value={connection.arrowhead || 'end'} options={[{ value: 'end', label: 'Forward' }, { value: 'both', label: 'Both ends' }, { value: 'start', label: 'Reverse' }, { value: 'none', label: 'None' }]} onChange={value => onUpdate({ arrowhead: value as Connection['arrowhead'] })} /></label>
        <label>Pattern <CustomSelect className="relationship-select" ariaLabel="Line pattern" value={connection.strokePattern || 'solid'} options={[{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }]} onChange={value => onUpdate({ strokePattern: value as Connection['strokePattern'] })} /></label>
        <div className="relationship-color-row" aria-label="Relationship color">{colors.map(([id, color]) => <button key={id} aria-label={`${id} relationship color`} aria-pressed={(connection.color || 'neutral') === id} style={{ backgroundColor: color }} onClick={() => onUpdate({ color: id })}>{connection.color === id && <Check size={11} />}</button>)}</div>
        <label className="relationship-animation"><input type="checkbox" checked={Boolean(connection.animated)} onChange={event => onUpdate({ animated: event.target.checked })} /> Flow animation</label>
      </div>}
    </div>
  </foreignObject>;
}
