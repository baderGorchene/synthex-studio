'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { MAP_GOALS, MAP_PURPOSES, MAP_STARTING_POINTS, type MapBrief } from '@/lib/map-brief';

type Option = { id: string; label: string; hint: string };

function Choices<T extends string>({ name, legend, options, value, onChange }: {
  name: string; legend: string; options: readonly Option[]; value: T | null; onChange: (value: T) => void;
}) {
  return (
    <fieldset className="brief-question">
      <legend>{legend}</legend>
      <div className="brief-choices">
        {options.map(option => (
          <label key={option.id} className={`brief-choice ${value === option.id ? 'is-picked' : ''}`}>
            <input type="radio" name={name} value={option.id} checked={value === option.id} onChange={() => onChange(option.id as T)} />
            <strong>{option.label}</strong>
            {option.hint && <small>{option.hint}</small>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Asked once, right after a map is created: what it's for, whether it has an end goal, and where the person is
 * starting from. Every question is optional and the map already exists, so skipping costs nothing.
 */
export function MapBriefDialog({ mapTitle, initial, onSave, onSkip }: {
  mapTitle: string;
  initial?: MapBrief | null;
  onSave: (brief: MapBrief) => void;
  onSkip: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const [purpose, setPurpose] = useState<MapBrief['purpose']>(initial?.purpose ?? null);
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [goal, setGoal] = useState<MapBrief['goal']>(initial?.goal ?? null);
  const [goalDetail, setGoalDetail] = useState(initial?.goalDetail ?? '');
  const [startingPoint, setStartingPoint] = useState<MapBrief['startingPoint']>(initial?.startingPoint ?? null);
  const answered = Boolean(purpose || summary.trim() || goal || startingPoint);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLInputElement>('input')?.focus());
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onSkip(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, [onSkip]);

  // Keep Tab inside the dialog.
  const trapTab = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab' || !dialog.current) return;
    const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button, input:not([type=radio]), input[type=radio]:checked, textarea')].filter(el => !el.hasAttribute('disabled'));
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      purpose,
      summary: summary.trim().slice(0, 280),
      goal,
      goalDetail: goal === 'defined' ? goalDetail.trim().slice(0, 280) : '',
      startingPoint,
      savedAt: Date.now()
    });
  };

  return (
    <div className="note-editor-scrim" role="presentation">
      <section ref={dialog} className="map-brief" role="dialog" aria-modal="true" aria-labelledby="map-brief-title" aria-describedby="map-brief-intro" onKeyDown={trapTab}>
        <header className="note-editor-head">
          <h2 id="map-brief-title">Set up “{mapTitle}”</h2>
          <button type="button" className="icon-button" aria-label="Skip for now" onClick={onSkip}><X size={20} strokeWidth={1.75} /></button>
        </header>
        <form className="map-brief-body" onSubmit={submit}>
          <p id="map-brief-intro" className="map-brief-intro">Three quick questions so the map can fit how you work. All optional.</p>

          <Choices name="brief-purpose" legend="1. What is this map for?" options={MAP_PURPOSES} value={purpose} onChange={setPurpose} />
          <label className="brief-text">
            <span>In a sentence <small>(optional)</small></span>
            <input className="field-input" value={summary} onChange={event => setSummary(event.target.value)} maxLength={280} placeholder="e.g. Whether small language models can run well on phones" />
          </label>

          <Choices name="brief-goal" legend="2. Does it have an end goal?" options={MAP_GOALS} value={goal} onChange={setGoal} />
          {goal === 'defined' && (
            <label className="brief-text">
              <span>What does done look like? <small>(optional)</small></span>
              <input className="field-input" value={goalDetail} onChange={event => setGoalDetail(event.target.value)} maxLength={280} placeholder="e.g. Pick a model for the beta by June" />
            </label>
          )}

          <Choices name="brief-start" legend="3. Where are you starting from?" options={MAP_STARTING_POINTS} value={startingPoint} onChange={setStartingPoint} />

          <footer className="map-brief-actions">
            <button type="button" className="text-button" onClick={onSkip}>Skip for now</button>
            <button type="submit" className="ink-button" disabled={!answered}>Save and start</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
