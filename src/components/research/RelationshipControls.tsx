'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Settings2, Trash2, X, Zap } from 'lucide-react';
import type { Connection } from '@/types/canvas';

const colors = [
  ['neutral', '#284b63'], ['indigo', '#284b63'], ['emerald', '#3c6e71'],
  ['rose', '#353535'], ['amber', '#353535'], ['sky', '#3c6e71'], ['purple', '#284b63']
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

  const activeLine = connection.lineStyle || 'curved';
  const activeArrow = connection.arrowhead || 'end';
  const activePattern = connection.strokePattern || 'solid';

  return (
    <foreignObject x={x - 110} y={y - 18} width="220" height={optionsOpen ? 370 : 38} className="relationship-controls-foreign">
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
            aria-label="Relationship settings"
            title="Style relationship"
            onClick={() => setOptionsOpen(value => !value)}
          >
            <Settings2 size={13} />
          </button>
          <span className="relationship-control-divider" />
          {editing ? (
            <input
              ref={input}
              aria-label="Relationship label"
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
              title="Click to edit relationship label"
            >
              <i style={{ background: colors.find(([id]) => id === (connection.color || 'neutral'))?.[1] }} />
              {connection.label?.replaceAll('_', ' ') || 'Add label'}
            </button>
          )}
          <span className="relationship-control-divider" />
          <button
            className="relationship-control-icon relationship-delete"
            aria-label="Delete relationship"
            title="Delete relationship"
            onClick={onDelete}
          >
            <Trash2 size={13} />
          </button>
        </div>

        {optionsOpen && (
          <div className="relationship-options">
            <div className="relationship-options-head">
              <span>Connector Style</span>
              <button aria-label="Close relationship settings" onClick={() => setOptionsOpen(false)}>
                <X size={12} />
              </button>
            </div>

            {/* Line Geometry with Visual Illustrations */}
            <div className="style-section">
              <span className="style-section-title">Line Geometry</span>
              <div className="style-segmented-row" role="radiogroup" aria-label="Line style">
                <button
                  type="button"
                  className={`style-option-btn ${activeLine === 'curved' ? 'active' : ''}`}
                  onClick={() => onUpdate({ lineStyle: 'curved' })}
                  title="Curved Bezier Line"
                >
                  <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
                    <path d="M2 10 C 7 10, 15 2, 20 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span className="style-option-caption">Curved</span>
                </button>
                <button
                  type="button"
                  className={`style-option-btn ${activeLine === 'straight' ? 'active' : ''}`}
                  onClick={() => onUpdate({ lineStyle: 'straight' })}
                  title="Direct Straight Line"
                >
                  <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
                    <path d="M2 10 L20 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span className="style-option-caption">Straight</span>
                </button>
                <button
                  type="button"
                  className={`style-option-btn ${activeLine === 'stepped' ? 'active' : ''}`}
                  onClick={() => onUpdate({ lineStyle: 'stepped' })}
                  title="Orthogonal Elbow Step"
                >
                  <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
                    <path d="M2 10 H11 V2 H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="style-option-caption">Stepped</span>
                </button>
              </div>
            </div>

            {/* Arrow Direction with Visual Illustrations */}
            <div className="style-section">
              <span className="style-section-title">Arrow Direction</span>
              <div className="style-segmented-row" role="radiogroup" aria-label="Arrow direction">
                <button
                  type="button"
                  className={`style-option-btn ${activeArrow === 'end' ? 'active' : ''}`}
                  onClick={() => onUpdate({ arrowhead: 'end' })}
                  title="Directed Forward (→)"
                >
                  <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                    <path d="M3 6 H16 M12 2 L16.5 6 L12 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="style-option-caption">Forward</span>
                </button>
                <button
                  type="button"
                  className={`style-option-btn ${activeArrow === 'both' ? 'active' : ''}`}
                  onClick={() => onUpdate({ arrowhead: 'both' })}
                  title="Bi-directional (↔)"
                >
                  <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                    <path d="M6 2 L2 6 L6 10 M3 6 H17 M14 2 L18 6 L14 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="style-option-caption">Both</span>
                </button>
                <button
                  type="button"
                  className={`style-option-btn ${activeArrow === 'start' ? 'active' : ''}`}
                  onClick={() => onUpdate({ arrowhead: 'start' })}
                  title="Reverse (←)"
                >
                  <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                    <path d="M17 6 H4 M8 2 L3.5 6 L8 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="style-option-caption">Reverse</span>
                </button>
                <button
                  type="button"
                  className={`style-option-btn ${activeArrow === 'none' ? 'active' : ''}`}
                  onClick={() => onUpdate({ arrowhead: 'none' })}
                  title="Plain Line (—)"
                >
                  <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                    <path d="M3 6 H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <span className="style-option-caption">None</span>
                </button>
              </div>
            </div>

            {/* Pattern with Visual Illustrations */}
            <div className="style-section">
              <span className="style-section-title">Line Pattern</span>
              <div className="style-segmented-row" role="radiogroup" aria-label="Line pattern">
                <button
                  type="button"
                  className={`style-option-btn ${activePattern === 'solid' ? 'active' : ''}`}
                  onClick={() => onUpdate({ strokePattern: 'solid' })}
                  title="Solid Line"
                >
                  <svg width="24" height="10" viewBox="0 0 24 10" fill="none">
                    <line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                  <span className="style-option-caption">Solid</span>
                </button>
                <button
                  type="button"
                  className={`style-option-btn ${activePattern === 'dashed' ? 'active' : ''}`}
                  onClick={() => onUpdate({ strokePattern: 'dashed' })}
                  title="Dashed Line"
                >
                  <svg width="24" height="10" viewBox="0 0 24 10" fill="none">
                    <line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" strokeWidth="2.2" strokeDasharray="5 3" strokeLinecap="round" />
                  </svg>
                  <span className="style-option-caption">Dashed</span>
                </button>
                <button
                  type="button"
                  className={`style-option-btn ${activePattern === 'dotted' ? 'active' : ''}`}
                  onClick={() => onUpdate({ strokePattern: 'dotted' })}
                  title="Dotted Line"
                >
                  <svg width="24" height="10" viewBox="0 0 24 10" fill="none">
                    <line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" strokeWidth="2.2" strokeDasharray="1.5 3.5" strokeLinecap="round" />
                  </svg>
                  <span className="style-option-caption">Dotted</span>
                </button>
              </div>
            </div>

            {/* Color Swatches */}
            <div className="style-section">
              <span className="style-section-title">Color Palette</span>
              <div className="relationship-color-row" aria-label="Relationship color">
                {colors.map(([id, color]) => (
                  <button
                    key={id}
                    aria-label={`${id} relationship color`}
                    aria-pressed={(connection.color || 'neutral') === id}
                    style={{ backgroundColor: color }}
                    onClick={() => onUpdate({ color: id })}
                  >
                    {connection.color === id && <Check size={11} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Animation Toggle with Live Preview Illustration */}
            <label className="relationship-animation">
              <input
                type="checkbox"
                checked={Boolean(connection.animated)}
                onChange={event => onUpdate({ animated: event.target.checked })}
              />
              <Zap size={12} className={connection.animated ? "text-[#3c6e71]" : "text-[#353535] opacity-60"} />
              <span>Flow animation</span>
              <svg width="34" height="10" viewBox="0 0 34 10" fill="none" className="ml-auto opacity-75">
                <line
                  x1="2"
                  y1="5"
                  x2="32"
                  y2="5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                  className={connection.animated ? "relationship-animated" : ""}
                />
              </svg>
            </label>
          </div>
        )}
      </div>
    </foreignObject>
  );
}
