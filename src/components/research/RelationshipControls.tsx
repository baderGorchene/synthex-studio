'use client';

import { useEffect, useRef, useState } from 'react';
import { Settings2, Trash2, X } from 'lucide-react';
import type { Connection } from '@/types/canvas';
import { ONTOLOGY_PRESETS } from '@/types/canvas';
import { strokeForLabel } from '@/lib/graph';

type Option<T extends string> = readonly [T, string];

const LINE_STYLES: Option<NonNullable<Connection['lineStyle']>>[] = [['curved', 'Curved'], ['straight', 'Straight'], ['stepped', 'Stepped']];
const PATTERNS: Option<NonNullable<Connection['strokePattern']>>[] = [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']];
const ARROWS: Option<NonNullable<Connection['arrowhead']>>[] = [['end', 'Forward'], ['both', 'Both ways'], ['none', 'None']];

function Segmented<T extends string>({ label, options, value, onPick }: {
  label: string;
  options: Option<T>[];
  value: T;
  onPick: (value: T) => void;
}) {
  return (
    <div className="relation-option-group">
      <span>{label}</span>
      <div className="layout-switch" role="group" aria-label={label}>
        {options.map(([id, name]) => (
          <button key={id} type="button" aria-pressed={value === id} onClick={() => onPick(id)}>{name}</button>
        ))}
      </div>
    </div>
  );
}

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

  const activeLine = connection.lineStyle || 'curved';
  const activeArrow = connection.arrowhead || 'end';
  const activePattern = connection.strokePattern || 'solid';
  // A pattern that differs from what the current label implies was picked by hand; presets leave it alone.
  const patternPickedByHand = activePattern !== strokeForLabel(connection.label);

  return (
    <foreignObject x={x - 150} y={y - 18} width="300" height={optionsOpen ? 520 : 38} className="relationship-controls-foreign">
      <div
        ref={root}
        className={`relationship-controls ${optionsOpen ? 'options-open' : ''} ${editing ? 'is-editing' : ''}`}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
        onKeyDown={event => { if (event.key === 'Escape') setOptionsOpen(false); }}
      >
        <div className={`relationship-pill ${optionsOpen ? 'options-open' : ''} ${editing ? 'is-editing' : ''}`}>
          <button
            className="relationship-control-icon relationship-settings"
            aria-label="Relation options"
            aria-expanded={optionsOpen}
            title="Relation options"
            onClick={() => setOptionsOpen(value => !value)}
          >
            <Settings2 size={14} strokeWidth={1.75} />
          </button>
          <span className="relationship-control-divider" />
          {editing ? (
            <input
              ref={input}
              aria-label="Relation label"
              value={label}
              maxLength={100}
              placeholder="Add a label"
              onChange={event => setLabel(event.target.value)}
              onKeyDown={event => {
                event.stopPropagation();
                if (event.key === 'Enter') save();
                if (event.key === 'Escape') setEditing(false);
              }}
              onBlur={save}
            />
          ) : (
            <button
              className="relationship-label"
              onClick={() => { setLabel(connection.label || ''); setEditing(true); }}
              title="Click to rename this relation"
            >
              {connection.label?.replaceAll('_', ' ') || 'Add label'}
            </button>
          )}
          <span className="relationship-control-divider" />
          <button
            className="relationship-control-icon relationship-delete"
            aria-label="Remove relation"
            title="Remove relation"
            onClick={onDelete}
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>

        {optionsOpen && (
          <div className="relationship-options relation-menu">
            <div className="relation-menu-head">
              <strong>Relation</strong>
              <button type="button" className="icon-button" aria-label="Close relation options" onClick={() => setOptionsOpen(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div className="relation-presets" role="group" aria-label="Relation type">
              {ONTOLOGY_PRESETS.map(preset => {
                const isSelected = connection.label === preset.label || connection.label === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={isSelected}
                    className={isSelected ? 'is-active' : ''}
                    onClick={() => {
                      onUpdate({
                        label: preset.label,
                        strokePattern: patternPickedByHand ? activePattern : strokeForLabel(preset.label),
                        lineStyle: preset.lineStyle,
                        arrowhead: preset.arrowhead
                      });
                      setLabel(preset.label);
                    }}
                  >
                    <strong>{preset.displayName}</strong>
                    <small>{preset.description}</small>
                  </button>
                );
              })}
            </div>

            <Segmented label="Line" options={LINE_STYLES} value={activeLine} onPick={lineStyle => onUpdate({ lineStyle })} />
            <Segmented label="Pattern" options={PATTERNS} value={activePattern} onPick={strokePattern => onUpdate({ strokePattern })} />
            <Segmented label="Arrow" options={ARROWS} value={activeArrow} onPick={arrowhead => onUpdate({ arrowhead })} />
          </div>
        )}
      </div>
    </foreignObject>
  );
}
