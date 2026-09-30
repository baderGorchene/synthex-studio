'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ChevronDown, FileJson2, FileText, FolderArchive, GitBranch, Image as ImageIcon, Menu, Shapes, X
} from 'lucide-react';
import { SynthexLogo, SynthexMark } from '@/components/brand/SynthexLogo';
import { CREDIT_RATES, REFILL_PACKS, SUBSCRIPTION_TIERS } from '@/lib/plans';

const PLAN_ORDER = ['trial', 'byok', 'pro', 'team'] as const;
const RECOMMENDED = 'pro';
const ANNUAL_SAVING = Math.round((1 - SUBSCRIPTION_TIERS.pro.priceAnnualUsd / SUBSCRIPTION_TIERS.pro.priceMonthlyUsd) * 100);
const usd = (value: number) => (value === 0 ? '$0' : `$${value.toFixed(2)}`);
const icon = { size: 18, strokeWidth: 1.75 };

const FAQS = [
  {
    q: 'What does a credit buy?',
    a: `Asking a question about your map costs ${CREDIT_RATES.chat} credit, quick research ${CREDIT_RATES.quick_research} credits and deep research ${CREDIT_RATES.deep_research}. Reading a PDF costs ${CREDIT_RATES.pdf_extract} credits a page. The free trial starts you with ${SUBSCRIPTION_TIERS.trial.creditsMonthly} credits, and you can top up ${REFILL_PACKS.refill_500.credits} credits for ${usd(REFILL_PACKS.refill_500.priceUsd)} without changing plan.`
  },
  {
    q: 'Does the AI write straight onto my map?',
    a: 'No. Research lands as drafts in blue, clearly marked. Nothing joins your map until you keep it: keep all, review them one by one, or discard them. AI-drafted claims start as unverified.'
  },
  {
    q: 'Can I use my own OpenAI or Gemini key?',
    a: `Yes. ${SUBSCRIPTION_TIERS.byok.name} costs ${usd(SUBSCRIPTION_TIERS.byok.priceMonthlyUsd)} a month (${usd(SUBSCRIPTION_TIERS.byok.priceAnnualUsd)} a month billed yearly) and uses your own key, with no markup on AI calls.`
  },
  {
    q: 'Does it work offline?',
    a: 'If you run Synthex on your own computer without any keys, it works fully offline and keeps your maps in a local SQLite file. AI research needs a Gemini or OpenAI key.'
  },
  {
    q: 'Can I take my maps elsewhere?',
    a: 'Yes. Share any map as a PNG or SVG image, a Markdown brief with its sources, an Obsidian vault with one linked note per idea, a Mermaid diagram, or JSON you can import again.'
  },
  {
    q: 'How do teams work?',
    a: `${SUBSCRIPTION_TIERS.team.name} is ${usd(SUBSCRIPTION_TIERS.team.priceMonthlyUsd)} per seat a month and shares ${SUBSCRIPTION_TIERS.team.creditsMonthly.toLocaleString()} credits a month across the team, with shared maps and one review queue.`
  }
];

/* ---------- Hero demo: the real Typeset notes, animated once ---------- */
type DemoPhase = 'typing' | 'drafting' | 'review' | 'pressing' | 'kept';
const DEMO_QUESTION = 'How does sleep affect memory?';
const DEMO_DRAFTS = [
  { id: 'd1', type: 'concept', title: 'Sleep spindles tag memories for replay', body: 'Brief bursts of activity in light sleep seem to mark which memories get replayed.', kind: 'Idea', x: 660, y: 36 },
  { id: 'd2', type: 'concept', title: 'A lost night blocks new learning', body: 'After no sleep, the brain struggles to store new memories.', kind: 'Idea', x: 350, y: 262 },
  { id: 'd3', type: 'source', title: 'Diekelmann & Born (2010)', body: 'The memory function of sleep. Nature Reviews Neuroscience.', kind: 'Source', x: 660, y: 282 }
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function LandingDemo() {
  const reduced = useReducedMotion();
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<DemoPhase>('typing');
  const [scale, setScale] = useState(1);
  const frame = useRef<HTMLDivElement>(null);

  // Scale the fixed 960px board to the column it sits in.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const fit = (width: number) => setScale(Math.min(1, width / 960));
    fit(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => fit(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The story plays once: type the question, drafts land, "Keep all" presses, pins turn ink. Then it holds.
  useEffect(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));
    for (let i = 1; i <= DEMO_QUESTION.length; i++) at(500 + i * 42, () => setTyped(DEMO_QUESTION.slice(0, i)));
    const typedAt = 500 + DEMO_QUESTION.length * 42;
    at(typedAt + 300, () => setPhase('drafting'));
    at(typedAt + 1300, () => setPhase('review'));
    at(typedAt + 2500, () => setPhase('pressing'));
    at(typedAt + 2660, () => setPhase('kept'));
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  const shownPhase: DemoPhase = reduced ? 'kept' : phase;
  const shownTyped = reduced ? DEMO_QUESTION : typed;
  const draftsVisible = shownPhase !== 'typing';
  const isDraft = draftsVisible && shownPhase !== 'kept';
  const edge = (draft: boolean) => (draft && isDraft ? 'var(--proof)' : 'var(--faint)');

  return (
    <figure className="landing-demo" id="evidence">
      <div className="landing-demo-frame" ref={frame} style={{ height: 540 * scale }}>
        <div className="landing-demo-board" style={{ transform: `scale(${scale})` }} aria-hidden="true">
          <svg className="landing-demo-lines" width="960" height="540" viewBox="0 0 960 540">
            <path d="M 280 208 C 316 208, 310 110, 350 110" stroke={edge(false)} />
            {draftsVisible && <>
              <path d="M 590 110 C 625 110, 625 110, 660 110" stroke={edge(true)} strokeDasharray={isDraft ? '4 4' : undefined} />
              <path d="M 280 230 C 318 230, 310 330, 350 330" stroke={edge(true)} strokeDasharray="1.5 5" strokeLinecap="round" />
              <path d="M 590 330 C 625 330, 625 346, 660 346" stroke={edge(true)} strokeDasharray={isDraft ? '4 4' : undefined} />
            </>}
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
              key={note.id}
              className={`knowledge-card type-${note.type} ${isDraft ? 'is-draft' : 'is-kept'}`}
              style={{ left: note.x, top: note.y, width: 240, rotate: `${index % 2 ? -0.4 : 0.3}deg`, animationDelay: `${index * 120}ms` }}
            >
              <span className="note-pin" style={{ animationDelay: `${300 + index * 120}ms` }} />
              <h2>{note.title}</h2>
              <p className="node-summary">{note.body}</p>
              <p className="note-meta">{note.kind} · {isDraft ? 'Draft' : 'From research'}</p>
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
              <span className={`landing-demo-input ${shownTyped ? '' : 'is-empty'}`}>{shownTyped || 'Ask a question to grow the map'}{shownPhase === 'typing' && shownTyped && <i className="landing-demo-caret" />}</span>
              <span className="ink-button icon-send"><ArrowRight {...icon} /></span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="note-meta">Example map. The notes are illustrative, not product results.</figcaption>
    </figure>
  );
}

/* ---------- Feature crops: small pieces of the real interface ---------- */
function CropDrafts() {
  return (
    <div className="landing-crop crop-drafts" aria-hidden="true">
      <div className="draft-bar landing-static-draftbar">
        <span>1 idea drafted · nothing joins your map until you keep it</span>
        <div><span className="text-button">Discard</span><span className="ink-button">Keep all</span></div>
      </div>
      <article className="knowledge-card type-concept is-draft landing-static-note">
        <span className="note-pin" />
        <h2>Sleep spindles tag memories for replay</h2>
        <p className="node-summary">Brief bursts of activity in light sleep seem to mark which memories get replayed.</p>
        <p className="note-meta">Idea · Draft</p>
      </article>
    </div>
  );
}

function CropDocument() {
  return (
    <div className="landing-crop crop-doc" aria-hidden="true">
      <p className="landing-crop-title">How does sleep affect memory?</p>
      <p className="doc-meta">4 ideas · 2 sources</p>
      <div className="doc-block">
        <h3>Slow-wave sleep replays the day</h3>
        <p className="doc-body">Deep sleep replays recent experiences into long-term memory.</p>
      </div>
      <div className="doc-block is-selected">
        <h3>A lost night blocks new learning</h3>
        <p className="doc-body">After no sleep, the brain struggles to store new memories. [1]</p>
        <p className="doc-cites">Cites 1 source</p>
      </div>
    </div>
  );
}

function CropSources() {
  return (
    <div className="landing-crop crop-sources" aria-hidden="true">
      <div className="doc-sources">
        <h2>Sources</h2>
        <ol>
          <li>Diekelmann &amp; Born (2010). The memory function of sleep.</li>
          <li>Rasch &amp; Born (2013). About sleep&apos;s role in memory.</li>
          <li>Walker (2009). The role of sleep in cognition and emotion.</li>
        </ol>
      </div>
    </div>
  );
}

function CropRelations() {
  return (
    <div className="landing-crop crop-relations" aria-hidden="true">
      <ul className="landing-line-grammar">
        <li><i /> <strong>supports</strong><span>solid</span></li>
        <li><i className="challenges" /> <strong>challenges</strong><span>dashed</span></li>
        <li><i className="asks" /> <strong>asks</strong><span>dotted</span></li>
      </ul>
    </div>
  );
}

function CropShare() {
  const rows: Array<[React.ReactNode, string, string]> = [
    [<ImageIcon key="i" {...icon} />, 'Image', 'PNG of the map'],
    [<Shapes key="s" {...icon} />, 'Vector image', 'SVG for slides and print'],
    [<FileText key="f" {...icon} />, 'Markdown brief', 'The document with its sources'],
    [<FolderArchive key="o" {...icon} />, 'Obsidian vault', 'One linked note per idea'],
    [<GitBranch key="g" {...icon} />, 'Mermaid diagram', 'Diagram code for docs'],
    [<FileJson2 key="j" {...icon} />, 'JSON', 'The full map, re-importable']
  ];
  return (
    <div className="landing-crop crop-share" aria-hidden="true">
      <p className="share-title">Share this map</p>
      <ul className="landing-share-list">
        {rows.map(([glyph, title, hint]) => <li key={title}>{glyph}<span><strong>{title}</strong><small>{hint}</small></span></li>)}
      </ul>
    </div>
  );
}

const FEATURES: Array<{ title: string; body: string; crop: React.ReactNode }> = [
  { title: 'Drafts you review', body: 'Research arrives as blue drafts on the board. Keep all of it, go one by one, or discard it. Nothing lands on your map by itself.', crop: <CropDrafts /> },
  { title: 'Map and document, in sync', body: 'Open the document beside the map. Select an idea on one side and it lights up on the other; edit either and both follow.', crop: <CropDocument /> },
  { title: 'Sources, numbered and cited', body: 'Every source gets a number. Claims show which sources back them, and the document lists them at the end.', crop: <CropSources /> },
  { title: 'Relations you can read', body: 'Every line has a label and a pattern: solid supports, dashed challenges, dotted asks. The legend stays on the board.', crop: <CropRelations /> },
  { title: 'Share anywhere', body: 'Export the map as PNG, SVG, Markdown, an Obsidian vault, Mermaid or JSON. Your thinking is never stuck here.', crop: <CropShare /> }
];

export default function MarketingLandingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="marketing-landing-page">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-brand" aria-label="Synthex home">
            <SynthexLogo size={18} />
          </Link>

          <nav className="landing-nav-links" aria-label="Page">
            <a href="#features">Product</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="landing-nav-actions">
            <Link href="/sign-in" className="text-button landing-link-button">Sign in</Link>
            <Link href="/sign-up" className="ink-button">Start free</Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(v => !v)}
              className="icon-button landing-menu-button"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="landing-mobile-menu" aria-label="Page">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Product</a>
            <a href="#metaphor" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <Link href="/app">Open the app</Link>
            <Link href="/sign-in">Sign in</Link>
          </nav>
        )}
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-bands" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div>
          <div className="landing-hero-copy">
            <h1>Think out loud. Get a map you can trust.</h1>
            <p className="landing-lede">Ask a question or paste your notes. Synthex drafts a map with numbered sources, you keep what&apos;s right, then share it anywhere.</p>
            <div className="landing-hero-actions">
              <Link href="/sign-up" className="ink-button landing-cta">Start free <ArrowRight {...icon} /></Link>
              <a href="#metaphor" className="text-button landing-link-button">See how it works ↓</a>
            </div>
            <p className="note-meta landing-hero-meta">{SUBSCRIPTION_TIERS.trial.creditsMonthly} free credits for 3 days · No card needed to start</p>
          </div>
          <LandingDemo />
        </section>

        <section id="metaphor" className="landing-section">
          <div className="landing-container">
            <h2 className="landing-h2">From a question to a map you can share.</h2>
            <ol className="landing-steps">
              <li><span className="landing-step-num">1</span><h3>Ask</h3><p>Type what you&apos;re trying to figure out, or paste the notes you already have.</p></li>
              <li><span className="landing-step-num">2</span><h3>Keep what&apos;s right</h3><p>Research lands as blue drafts with their sources; you keep, review or discard each one.</p></li>
              <li><span className="landing-step-num">3</span><h3>Share anywhere</h3><p>Read it as a document, or export it as an image, Markdown, an Obsidian vault or JSON.</p></li>
            </ol>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="landing-container">
            <h2 className="landing-h2">Built so you can check every line.</h2>
            <div className="landing-features">
              {FEATURES.map(feature => (
                <article className="landing-feature" key={feature.title}>
                  <div className="landing-feature-copy">
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                  </div>
                  {feature.crop}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="landing-section landing-pricing">
          <div className="landing-container">
            <div className="landing-pricing-head">
              <h2 className="landing-h2">Plans</h2>
              <div className="layout-switch" role="group" aria-label="Billing">
                <button type="button" aria-pressed={billingCycle === 'monthly'} onClick={() => setBillingCycle('monthly')}>Monthly</button>
                <button type="button" aria-pressed={billingCycle === 'annual'} onClick={() => setBillingCycle('annual')}>Yearly, save {ANNUAL_SAVING}%</button>
              </div>
            </div>
            <div className="plan-columns is-four landing-plans">
              {PLAN_ORDER.map(id => {
                const plan = SUBSCRIPTION_TIERS[id];
                const price = billingCycle === 'annual' ? plan.priceAnnualUsd : plan.priceMonthlyUsd;
                const recommended = id === RECOMMENDED;
                return (
                  <div key={id} className={`plan-column ${recommended ? 'is-recommended' : ''}`}>
                    <h3>{plan.name}</h3>
                    <p className="plan-price"><strong>{usd(price)}</strong> <span>{id === 'trial' ? 'for 3 days' : plan.perSeat ? 'per seat a month' : 'a month'}</span></p>
                    <p className="note-meta">{recommended ? 'Recommended · ' : ''}{plan.creditsMonthly.toLocaleString()} credits a month</p>
                    <ul className="plan-features">{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
                    <Link href="/sign-up" className={recommended ? 'ink-button' : 'line-button'}>
                      {id === 'trial' ? 'Start free' : `Choose ${plan.name}`}
                    </Link>
                  </div>
                );
              })}
            </div>
            <p className="note-meta landing-refill">Need more? Add {REFILL_PACKS.refill_500.credits} credits for {usd(REFILL_PACKS.refill_500.priceUsd)} any time without changing plan.</p>
          </div>
        </section>

        <section id="faq" className="landing-section">
          <div className="landing-container landing-faq-wrap">
            <h2 className="landing-h2">Questions</h2>
            <div className="landing-faq">
              {FAQS.map(faq => (
                <details key={faq.q}>
                  <summary>{faq.q}<ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" /></summary>
                  <p>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-final">
          <div className="landing-container">
            <h2>What are you trying to figure&nbsp;out?</h2>
            <Link href="/sign-up" className="composer landing-fake-composer">
              <span>How does sleep affect memory? What do we actually know?</span>
              <span className="ink-button">Build map <ArrowRight {...icon} /></span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-row">
          <Link href="/" className="landing-brand" aria-label="Synthex home"><SynthexMark size={18} /></Link>
          <span>© {new Date().getFullYear()} Synthex</span>
          <nav aria-label="Footer">
            <Link href="/app">Open the app</Link>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <Link href="/sign-in">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
