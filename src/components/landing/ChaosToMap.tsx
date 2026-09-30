'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useFitScale, useInView, useReducedMotion } from './motion';

type ScrapKind = 'tab' | 'sticky' | 'pdf' | 'bubble' | 'scribble';
interface Piece {
  id: string;
  kind: ScrapKind;
  mess: { x: number; y: number; r: number; w: number };
  tidy: { x: number; y: number; w: number } | null; // null: it doesn't make the map
  messText: string;
  messHint?: string;
  tidyType?: 'question' | 'concept' | 'source' | 'claim';
  tidyTitle?: string;
  tidyMeta?: string;
}

const W = 960;
const H = 520;

/* Seven scraps of a research night, and where each one ends up. */
const PIECES: Piece[] = [
  { id: 'q', kind: 'tab', mess: { x: 250, y: 190, r: -7, w: 250 }, tidy: { x: 40, y: 196, w: 220 },
    messText: 'sleep and memory - Google Search', tidyType: 'question', tidyTitle: 'How does sleep affect memory?', tidyMeta: 'Question' },
  { id: 'b', kind: 'sticky', mess: { x: 40, y: 40, r: -9, w: 170 }, tidy: { x: 330, y: 40, w: 240 },
    messText: 'REM vs deep sleep??', messHint: 'which one matters', tidyType: 'concept', tidyTitle: 'Deep sleep replays the day', tidyMeta: 'Idea' },
  { id: 'c', kind: 'scribble', mess: { x: 520, y: 330, r: 6, w: 200 }, tidy: { x: 330, y: 318, w: 240 },
    messText: 'all-nighter → forgot everything', tidyType: 'concept', tidyTitle: 'A lost night blocks new learning', tidyMeta: 'Idea' },
  { id: 'd', kind: 'pdf', mess: { x: 90, y: 360, r: 4, w: 230 }, tidy: { x: 660, y: 356, w: 240 },
    messText: 'Walker_2009_final_v3.pdf', messHint: 'downloaded 3 times', tidyType: 'source', tidyTitle: 'Walker (2009)', tidyMeta: 'Source · [2]' },
  { id: 'e', kind: 'tab', mess: { x: 600, y: 60, r: 5, w: 280 }, tidy: { x: 660, y: 30, w: 240 },
    messText: 'The memory function of sleep - Nature Rev…', tidyType: 'source', tidyTitle: 'Diekelmann & Born (2010)', tidyMeta: 'Source · [1]' },
  { id: 'f', kind: 'bubble', mess: { x: 380, y: 60, r: -3, w: 220 }, tidy: { x: 660, y: 194, w: 240 },
    messText: '“Sleep boosts memory by 40%.”', messHint: 'some chatbot, no source', tidyType: 'claim', tidyTitle: 'Sleep boosts memory by 40%', tidyMeta: 'Claim · Unverified' },
  { id: 'g', kind: 'tab', mess: { x: 700, y: 250, r: -5, w: 230 }, tidy: null,
    messText: 'Why do we dream? : r/AskReddit' }
];

const LINES = [
  { d: 'M 260 236 C 300 236, 290 96, 330 96', label: 'explains', lx: 274, ly: 150 },
  { d: 'M 260 258 C 300 258, 290 372, 330 372', label: 'explains', lx: 274, ly: 318 },
  { d: 'M 570 90 C 615 90, 615 84, 660 84', label: 'cites', lx: 598, ly: 66 },
  { d: 'M 570 380 C 615 380, 615 410, 660 410', label: 'cites', lx: 598, ly: 404 },
  { d: 'M 660 246 C 615 246, 615 130, 570 120', label: 'challenges', lx: 578, ly: 176, dashed: true }
];

export function ChaosToMap() {
  const reduced = useReducedMotion();
  const [frame, scale] = useFitScale<HTMLDivElement>(W);
  const [section, inView] = useInView<HTMLDivElement>({ once: true, threshold: 0.45 });
  const [tidy, setTidy] = useState(false);
  const [touched, setTouched] = useState(false);

  // Let the mess sit for a beat, then tidy it up by itself (once). After that the button is theirs.
  useEffect(() => {
    if (!inView || touched) return;
    const timer = setTimeout(() => setTidy(true), reduced ? 0 : 1400);
    return () => clearTimeout(timer);
  }, [inView, touched, reduced]);

  return (
    <div className={`chaos ${tidy ? 'is-tidy' : 'is-mess'}`} ref={section}>
      <div className="chaos-frame" ref={frame} style={{ height: H * scale }}>
        <div className="chaos-board" style={{ transform: `scale(${scale})`, width: W, height: H }} aria-hidden="true">
          <svg className="chaos-lines" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            {LINES.map((line, index) => (
              <path key={line.d} d={line.d} pathLength={1} strokeDasharray={line.dashed ? undefined : '1 1'} className={line.dashed ? 'is-dashed' : ''} style={{ transitionDelay: tidy ? `${700 + index * 120}ms` : '0ms' }} />
            ))}
          </svg>
          {LINES.map((line, index) => (
            <span key={line.lx + '-' + line.ly} className="chaos-label" style={{ left: line.lx, top: line.ly, transitionDelay: tidy ? `${900 + index * 120}ms` : '0ms' }}>{line.label}</span>
          ))}

          {PIECES.map((piece, index) => {
            const at = tidy && piece.tidy ? piece.tidy : null;
            const style: CSSProperties = at
              ? { left: at.x, top: at.y, width: at.w, rotate: '0deg', transitionDelay: `${index * 70}ms` }
              : { left: piece.mess.x, top: piece.mess.y, width: piece.mess.w, rotate: `${piece.mess.r}deg`, transitionDelay: `${index * 40}ms` };
            return (
              <div key={piece.id} className={`scrap scrap-${piece.kind} ${piece.tidy ? `to-${piece.tidyType}` : 'is-noise'}`} style={style}>
                <div className="scrap-mess">
                  {piece.kind === 'tab' && <span className="scrap-favicon" />}
                  {piece.kind === 'pdf' && <span className="scrap-pdf-badge">PDF</span>}
                  <span className="scrap-text">{piece.messText}</span>
                  {piece.messHint && <small>{piece.messHint}</small>}
                  {piece.kind === 'tab' && <span className="scrap-close">×</span>}
                </div>
                {piece.tidy && (
                  <div className="scrap-tidy">
                    <span className="note-pin" />
                    <h2>{piece.tidyTitle}</h2>
                    <p className="note-meta">{piece.tidyMeta}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="chaos-controls">
        <button
          type="button"
          className="line-button"
          aria-pressed={tidy}
          onClick={() => { setTouched(true); setTidy(value => !value); }}
        >
          {tidy ? 'Mess it up again' : 'Tidy it up'}
        </button>
        <p className="note-meta" aria-live="polite">
          {tidy ? 'One question, two ideas, two numbered sources, one claim flagged unverified. The Reddit tab didn’t make the cut.' : 'Seven scraps, zero structure. Sound familiar?'}
        </p>
      </div>
    </div>
  );
}
