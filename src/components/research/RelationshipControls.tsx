'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Settings2, Trash2, X } from 'lucide-react';
import type { Connection } from '@/types/canvas';

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

  return <foreignObject x={x - 92} y={y - 18} width="184" height={optionsOpen ? 204 : 38} className="relationship-controls-foreign">
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
        <label>Line <select value={connection.lineStyle || 'curved'} onChange={event => onUpdate({ lineStyle: event.target.value as Connection['lineStyle'] })}><option value="curved">Curved</option><option value="straight">Straight</option><option value="stepped">Stepped</option></select></label>
        <label>Arrow <select value={connection.arrowhead || 'end'} onChange={event => onUpdate({ arrowhead: event.target.value as Connection['arrowhead'] })}><option value="end">Forward</option><option value="both">Both ends</option><option value="start">Reverse</option><option value="none">None</option></select></label>
        <label>Pattern <select value={connection.strokePattern || 'solid'} onChange={event => onUpdate({ strokePattern: event.target.value as Connection['strokePattern'] })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>
        <div className="relationship-color-row" aria-label="Relationship color">{colors.map(([id, color]) => <button key={id} aria-label={`${id} relationship color`} aria-pressed={(connection.color || 'neutral') === id} style={{ backgroundColor: color }} onClick={() => onUpdate({ color: id })}>{connection.color === id && <Check size={11} />}</button>)}</div>
        <label className="relationship-animation"><input type="checkbox" checked={Boolean(connection.animated)} onChange={event => onUpdate({ animated: event.target.checked })} /> Flow animation</label>
      </div>}
    </div>
  </foreignObject>;
}
