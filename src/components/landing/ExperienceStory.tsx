'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileText, FolderArchive, GitBranch, Image as ImageIcon } from 'lucide-react';
import { useFitScale } from './motion';

const QUESTION = 'Does a four-day work week actually work?';

const CHAPTERS = [
  { kicker: '01 · Ask', title: 'Ask it the way you’d ask a friend.', body: 'No prompt tricks, no keywords. Type the question that keeps nagging you, or paste the messy notes you already have.' },
  { kicker: '02 · Read', title: 'Watch it do the reading.', body: 'Synthex searches, opens the sources and shows you what it’s looking at while it works. Every query and every link stays in view.' },
  { kicker: '03 · Draft', title: 'Ideas land in blue, as drafts.', body: 'Concepts, claims and open questions pin themselves to your board, already linked and cited. Blue means they aren’t yours yet.' },
  { kicker: '04 · Decide', title: 'You’re the editor. Always.', body: 'Keep what’s right and toss what isn’t. Claims stay unverified until you link evidence, and nothing joins your map without your say-so.' },
  { kicker: '05 · Share', title: 'Take it anywhere.', body: 'Read it as a document, drop it into slides as an image, open it in Obsidian or paste the brief into your report. Your thinking goes where you go.' }
];

const SEARCHES = ['four-day week pilot results', 'four-day week productivity evidence', 'four-day week criticism'];
const SOURCES = [
  { n: 1, title: 'UK four-day week pilot report (2023)' },
  { n: 2, title: 'Iceland shorter-week trials, 2015–2019' },
  { n: 3, title: 'Microsoft Japan trial coverage (2019)' },
  { n: 4, title: 'Critiques of pilot self-selection' }
];
const DRAFTS = [
  { id: 'a', type: 'concept', title: 'Most pilot companies kept the shorter week', meta: 'Idea · cites [1]', x: 40, y: 128, tossed: false },
  { id: 'b', type: 'claim', title: 'Productivity rose 40% at Microsoft Japan', meta: 'Claim · Unverified', x: 330, y: 128, tossed: false },
  { id: 'c', type: 'question', title: 'Does it work outside office jobs?', meta: 'Open question', x: 40, y: 320, tossed: false },
  { id: 'd', type: 'claim', title: 'Every company should switch tomorrow', meta: 'Claim · no source', x: 330, y: 320, tossed: true }
];
const EXPORTS = [
  { icon: <ImageIcon size={20} strokeWidth={1.75} />, name: 'four-day-week.png', hint: 'For slides' },
  { icon: <FileText size={20} strokeWidth={1.75} />, name: 'Brief.md', hint: 'With numbered sources' },
  { icon: <FolderArchive size={20} strokeWidth={1.75} />, name: 'Obsidian vault', hint: 'One note per idea' },
  { icon: <GitBranch size={20} strokeWidth={1.75} />, name: 'diagram.mmd', hint: 'Mermaid for docs' }
];

export function ExperienceStory() {
  const [step, setStep] = useState(0);
  const [frame, scale] = useFitScale<HTMLDivElement>(640);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);

  // The chapter crossing the middle of the viewport drives the stage.
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) setStep(Number((entry.target as HTMLElement).dataset.step));
      }
    }, { rootMargin: '-45% 0px -45% 0px' });
    chapterRefs.current.forEach(element => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="story" data-step={step}>
      <div className="story-stage-wrap">
        <div className="story-stage" ref={frame} style={{ height: 560 * scale }}>
          <div className="story-board" style={{ transform: `scale(${scale})` }} aria-hidden="true">
            <div className="story-progress">{CHAPTERS.map((_, index) => <i key={index} className={index <= step ? 'is-on' : ''} />)}</div>

            <div className="story-composer">
              <span key={step === 0 ? 'typing' : 'typed'} className={`story-typed ${step === 0 ? 'is-typing' : ''}`}>{QUESTION}</span>
              <span className="ink-button icon-send"><ArrowRight size={18} strokeWidth={1.75} /></span>
            </div>

            <div className="story-reading">
              <p className="story-reading-head"><span className="story-dot" />Reading the web…</p>
              <ul className="story-searches">{SEARCHES.map((query, index) => <li key={query} style={{ transitionDelay: `${index * 160}ms` }}>Searched “{query}”</li>)}</ul>
              <ol className="story-sources">{SOURCES.map((source, index) => <li key={source.n} style={{ transitionDelay: `${500 + index * 180}ms` }}><b>[{source.n}]</b> {source.title}</li>)}</ol>
            </div>

            <svg className="story-lines" width="640" height="560" viewBox="0 0 640 560">
              <path d="M 175 250 L 175 320" pathLength={1} />
              <path d="M 310 190 L 330 190" pathLength={1} />
            </svg>

            {DRAFTS.map((draft, index) => (
              <article
                key={draft.id}
                className={`knowledge-card type-${draft.type === 'claim' ? 'claim' : draft.type} story-card ${draft.tossed ? 'is-tossable' : ''}`}
                style={{ left: draft.x, top: draft.y, width: 270, transitionDelay: `${index * 140}ms` }}
              >
                <span className="note-pin" />
                <h2>{draft.title}</h2>
                <p className="note-meta">{draft.meta}</p>
              </article>
            ))}

            <div className="story-verdict"><span className="line-button">Toss</span><span className="ink-button">Keep 3</span></div>

            <div className="story-exports">
              {EXPORTS.map((item, index) => (
                <div key={item.name} className="story-export" style={{ ['--i' as string]: index }}>
                  {item.icon}
                  <span><strong>{item.name}</strong><small>{item.hint}</small></span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="note-meta story-caption">Illustrative example. Your map, your sources, your call.</p>
      </div>

      <ol className="story-chapters">
        {CHAPTERS.map((chapter, index) => (
          <li
            key={chapter.kicker}
            data-step={index}
            ref={element => { chapterRefs.current[index] = element; }}
            className={index === step ? 'is-active' : ''}
          >
            <p className="story-kicker">{chapter.kicker}</p>
            <h3>{chapter.title}</h3>
            <p>{chapter.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
