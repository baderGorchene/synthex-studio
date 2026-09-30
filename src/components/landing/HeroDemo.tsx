'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useFitScale, useInView, useReducedMotion } from './motion';

type DemoPhase = 'typing' | 'drafting' | 'review' | 'pressing' | 'kept';
const DEMO_QUESTION = 'How does sleep affect memory?';
const DEMO_DRAFTS = [
  { id: 'd1', type: 'concept', title: 'Sleep spindles tag memories for replay', body: 'Brief bursts of activity in light sleep seem to mark which memories get replayed.', kind: 'Idea', x: 660, y: 36 },
  { id: 'd2', type: 'concept', title: 'A lost night blocks new learning', body: 'After no sleep, the brain struggles to store new memories.', kind: 'Idea', x: 350, y: 262 },
  { id: 'd3', type: 'source', title: 'Diekelmann & Born (2010)', body: 'The memory function of sleep. Nature Reviews Neuroscience.', kind: 'Source', x: 660, y: 282 }
];
const HOLD_KEPT_MS = 4200;

/** The real board notes, playing the core loop: ask, drafts land in blue, keep, pins turn ink. Loops while visible. */
export function HeroDemo() {
  const reduced = useReducedMotion();
  const [frame, scale] = useFitScale<HTMLDivElement>(960);
  const [figure, inView] = useInView<HTMLElement>({ threshold: 0.25 });
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<DemoPhase>('typing');
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduced || !inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));
    at(0, () => { setTyped(''); setPhase('typing'); });
    for (let i = 1; i <= DEMO_QUESTION.length; i++) at(500 + i * 45, () => setTyped(DEMO_QUESTION.slice(0, i)));
    const typedAt = 500 + DEMO_QUESTION.length * 45;
    at(typedAt + 300, () => setPhase('drafting'));
    at(typedAt + 1500, () => setPhase('review'));
    at(typedAt + 2900, () => setPhase('pressing'));
    at(typedAt + 3060, () => setPhase('kept'));
    at(typedAt + 3060 + HOLD_KEPT_MS, () => setCycle(value => value + 1));
    return () => timers.forEach(clearTimeout);
  }, [reduced, inView, cycle]);

  const shownPhase: DemoPhase = reduced ? 'kept' : phase;
  const shownTyped = reduced ? DEMO_QUESTION : typed;
  const draftsVisible = shownPhase !== 'typing';
  const isDraft = draftsVisible && shownPhase !== 'kept';
  const edge = (draft: boolean) => (draft && isDraft ? 'var(--proof)' : 'var(--faint)');

  return (
    <figure className="landing-demo" ref={figure}>
      <div className="landing-demo-frame" ref={frame} style={{ height: 540 * scale }}>
        <div className="landing-demo-board" style={{ transform: `scale(${scale})` }} aria-hidden="true">
          <svg className="landing-demo-lines" width="960" height="540" viewBox="0 0 960 540">
            <path d="M 280 208 C 316 208, 310 110, 350 110" stroke={edge(false)} />
            {draftsVisible && <g key={cycle} className="lx-draw">
              <path d="M 590 110 C 625 110, 625 110, 660 110" stroke={edge(true)} strokeDasharray={isDraft ? '4 4' : undefined} />
              <path d="M 280 230 C 318 230, 310 330, 350 330" stroke={edge(true)} strokeDasharray="1.5 5" strokeLinecap="round" />
              <path d="M 590 330 C 625 330, 625 346, 660 346" stroke={edge(true)} strokeDasharray={isDraft ? '4 4' : undefined} />
            </g>}
          </svg>
          <span className="landing-demo-label" style={{ left: 294, top: 140 }}>explains</span>
          {draftsVisible && <>
            <span className={`landing-demo-label ${isDraft ? 'is-draft' : ''}`} style={{ left: 604, top: 88 }}>supports</span>
            <span className={`landing-demo-label ${isDraft ? 'is-draft' : ''}`} style={{ left: 300, top: 268 }}>asks</span>
            <span className={`landing-demo-label ${isDraft ? 'is-draft' : ''}`} style={{ left: 608, top: 314 }}>cites</span>
          </>}

          <article className="knowledge-card type-question" style={{ left: 40, top: 150, width: 240, rotate: '-0.3deg' }}>
            <span className="note-pin" />
            <h2>{DEMO_QUESTION}</h2>
            <p className="node-summary">Your starting question.</p>
            <p className="note-meta">Question</p>
          </article>
          <article className="knowledge-card type-concept" style={{ left: 350, top: 36, width: 240, rotate: '0.4deg' }}>
            <span className="note-pin" />
            <h2>Slow-wave sleep replays the day</h2>
            <p className="node-summary">Deep sleep replays recent experiences into long-term memory.</p>
            <p className="note-meta">Idea · From research</p>
          </article>
          {draftsVisible && DEMO_DRAFTS.map((note, index) => (
            <article
              key={`${cycle}-${note.id}`}
              className={`knowledge-card type-${note.type} ${isDraft ? 'is-draft' : 'is-kept'}`}
              style={{ left: note.x, top: note.y, width: 240, rotate: `${index % 2 ? -0.4 : 0.3}deg`, animationDelay: `${index * 160}ms` }}
            >
              <span className="note-pin" style={{ animationDelay: `${300 + index * 160}ms` }} />
              <h2>{note.title}</h2>
              <p className="node-summary">{note.body}</p>
              <p className="note-meta">{note.kind} · {isDraft ? 'Draft' : 'Kept by you'}</p>
            </article>
          ))}

          {(shownPhase === 'review' || shownPhase === 'pressing') && (
            <div className="draft-bar landing-demo-draftbar">
              <span>2 ideas and 1 source drafted · nothing joins your map until you keep it</span>
              <div>
                <span className="text-button">Discard</span>
                <span className="line-button">Review one by one</span>
                <span className={`ink-button ${shownPhase === 'pressing' ? 'is-pressed' : ''}`}>Keep all</span>
              </div>
            </div>
          )}

          <div className="composer landing-demo-composer">
            <div className="composer-input">
              <span className={`landing-demo-input ${shownTyped ? '' : 'is-empty'}`}>{shownTyped || 'Ask a question to grow the map'}{shownPhase === 'typing' && <i className="landing-demo-caret" />}</span>
              <span className="ink-button icon-send"><ArrowRight size={18} strokeWidth={1.75} /></span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="note-meta">Illustrative example map, not a product result.</figcaption>
    </figure>
  );
}
