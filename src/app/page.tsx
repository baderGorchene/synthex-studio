'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ChevronDown, FileJson2, FileText, FolderArchive, GitBranch, Image as ImageIcon, Menu, Shapes, X
} from 'lucide-react';
import { SynthexLogo, SynthexMark } from '@/components/brand/SynthexLogo';
import { CREDIT_RATES, REFILL_PACKS, SUBSCRIPTION_TIERS } from '@/lib/plans';
import { HeroDemo } from '@/components/landing/HeroDemo';
import { ChaosToMap } from '@/components/landing/ChaosToMap';
import { ExperienceStory } from '@/components/landing/ExperienceStory';
import { TypewriterComposer } from '@/components/landing/TypewriterComposer';
import { useRevealOnScroll } from '@/components/landing/motion';

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
  { title: 'Map and document, in sync', body: 'Open the document beside the map. Select an idea on one side and it lights up on the other. Edit either and both follow.', crop: <CropDocument /> },
  { title: 'Sources, numbered and cited', body: 'Every source gets a number. Claims show which sources back them, and the document lists them at the end.', crop: <CropSources /> },
  { title: 'Lines you can read', body: 'Every line has a label and a pattern: solid supports, dashed challenges, dotted asks. You can see an argument’s shape at a glance.', crop: <CropRelations /> }
];

/* Questions people carry around. The marquee repeats them, so the list is short. */
const QUESTIONS = [
  'Is intermittent fasting worth it?',
  'Why is my team always behind schedule?',
  'What do we actually know about long COVID?',
  'Should I switch careers at 35?',
  'How do vaccines train the immune system?',
  'Which CRM should a 10-person team pick?',
  'Did the printing press cause the Reformation?',
  'Is nuclear power safer than solar?'
];

const MOMENTS = [
  { who: 'Students & researchers', when: '…your advisor circles a paragraph and writes “source?”', tone: 'sticky' },
  { who: 'Writers & journalists', when: '…the piece is due tomorrow and every claim needs a link.', tone: 'paper' },
  { who: 'Product & strategy teams', when: '…everyone in the meeting has an opinion and nobody has evidence.', tone: 'paper' },
  { who: 'The endlessly curious', when: '…you went down a rabbit hole and want to remember the way out.', tone: 'sticky' }
];

const PROMISES = [
  { title: 'Every claim starts unverified', body: 'AI-drafted claims are flagged until you link evidence to them. Confidence has to be earned.' },
  { title: 'Every source gets a number', body: 'Ideas point at the sources behind them, so you can check any line in two clicks.' },
  { title: 'Nothing lands without you', body: 'Drafts stay blue until you keep them. Your map only ever holds what you decided belongs there.' }
];

export default function MarketingLandingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useRevealOnScroll(root);

  const navLinks: Array<[string, string]> = [['#experience', 'How it feels'], ['#who', 'Who it’s for'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']];

  return (
    <div className="marketing-landing-page" ref={root}>
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-brand" aria-label="Synthex home">
            <SynthexLogo size={18} />
          </Link>

          <nav className="landing-nav-links" aria-label="Page">
            {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
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
            {navLinks.map(([href, label]) => <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}>{label}</a>)}
            <Link href="/app">Open the app</Link>
            <Link href="/sign-in">Sign in</Link>
          </nav>
        )}
      </header>

      <main>
        {/* 1. The hook: name the feeling, promise the relief, show it happening */}
        <section className="lx-hero">
          <div className="lx-hero-copy">
            <p className="lx-eyebrow">A research board that thinks with you</p>
            <h1>
              From 37 open tabs to{' '}
              <span className="lx-underline">one clear map.
                <svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true"><path d="M 4 16 C 60 6, 120 20, 180 11 S 270 8, 296 14" pathLength={1} /></svg>
              </span>
            </h1>
            <p className="lx-lede">Ask what you’re trying to figure out. Synthex reads the web, pins the ideas and sources to a board, and lets you keep only what holds up. You get research you can see, check and share.</p>
            <div className="lx-hero-actions">
              <Link href="/sign-up" className="ink-button landing-cta">Start thinking, free <ArrowRight {...icon} /></Link>
              <a href="#experience" className="text-button landing-link-button">See how it feels ↓</a>
            </div>
            <p className="note-meta lx-hero-meta">{SUBSCRIPTION_TIERS.trial.creditsMonthly} free credits · No card needed · Works with your own AI key too</p>
          </div>
          <div className="lx-hero-demo">
            <p className="lx-annotation" aria-hidden="true">
              watch: it drafts, <em>you</em> decide
              <svg viewBox="0 0 90 60" aria-hidden="true"><path d="M 6 6 C 40 4, 70 18, 78 50" pathLength={1} /><path d="M 68 42 L 78 52 L 84 38" pathLength={1} /></svg>
            </p>
            <HeroDemo />
          </div>
        </section>

        {/* 2. Social texture: the questions people bring, drifting past */}
        <section className="lx-marquee" aria-label="Questions people map with Synthex">
          <div className="lx-marquee-track">
            {[...QUESTIONS, ...QUESTIONS].map((question, index) => (
              <span key={index} className={`lx-marquee-note ${index % 3 === 0 ? 'is-sticky' : ''}`} aria-hidden={index >= QUESTIONS.length}>{question}</span>
            ))}
          </div>
        </section>

        {/* 3. The pain, then the transformation */}
        <section id="chaos" className="landing-section lx-chaos-section">
          <div className="landing-container lx-split">
            <div className="lx-split-copy" data-reveal>
              <p className="lx-eyebrow">You know this feeling</p>
              <h2 className="landing-h2">Research shouldn’t feel like losing an argument with your browser.</h2>
              <ul className="lx-pains">
                <li data-reveal style={{ ['--d' as string]: '80ms' }}><span>Tabs you swear you’ll read later</span></li>
                <li data-reveal style={{ ['--d' as string]: '200ms' }}><span>A notes app full of half-thoughts</span></li>
                <li data-reveal style={{ ['--d' as string]: '320ms' }}><span>That one source you can’t find again</span></li>
                <li data-reveal style={{ ['--d' as string]: '440ms' }}><span>An AI answer you have no way to check</span></li>
              </ul>
              <p className="lx-after" data-reveal style={{ ['--d' as string]: '600ms' }}>Synthex puts it all on one board, where every idea shows where it came from.</p>
            </div>
            <div data-reveal style={{ ['--d' as string]: '120ms' }}>
              <ChaosToMap />
            </div>
          </div>
        </section>

        {/* 4. The experience, chapter by chapter, driven by scroll */}
        <section id="experience" className="landing-section lx-story-section">
          <div className="landing-container">
            <div className="lx-section-head" data-reveal>
              <p className="lx-eyebrow">How it feels</p>
              <h2 className="landing-h2">Like having a research partner who shows their work.</h2>
            </div>
            <ExperienceStory />
          </div>
        </section>

        {/* 5. Relatable moments: see yourself in it */}
        <section id="who" className="landing-section lx-who-section">
          <div className="landing-container">
            <div className="lx-section-head" data-reveal>
              <p className="lx-eyebrow">Who it’s for</p>
              <h2 className="landing-h2">Made for the moment when…</h2>
            </div>
            <div className="lx-moments">
              {MOMENTS.map((moment, index) => (
                <figure key={moment.who} className={`lx-moment is-${moment.tone}`} data-reveal style={{ ['--d' as string]: `${index * 110}ms`, ['--tilt' as string]: `${[-1.6, 1.1, -0.8, 1.7][index]}deg` }}>
                  <span className="note-pin" aria-hidden="true" />
                  <blockquote>{moment.when}</blockquote>
                  <figcaption>{moment.who}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* 6. The trust promise: the reason to pick this over a chatbot */}
        <section className="landing-section lx-promise-section">
          <div className="landing-container">
            <h2 className="lx-promise-line" data-reveal>
              The AI does the legwork.{' '}
              <span className="lx-circle">You
                <svg viewBox="0 0 200 90" preserveAspectRatio="none" aria-hidden="true"><path d="M 150 12 C 90 -4, 12 14, 10 46 C 8 80, 120 86, 176 64 C 204 52, 196 18, 132 10" pathLength={1} /></svg>
              </span>{' '}get the last word.
            </h2>
            <div className="lx-promises">
              {PROMISES.map((promise, index) => (
                <article key={promise.title} data-reveal style={{ ['--d' as string]: `${200 + index * 140}ms` }}>
                  <span className="lx-promise-num">{index + 1}</span>
                  <h3>{promise.title}</h3>
                  <p>{promise.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 7. The details, for the people who read the spec */}
        <section id="features" className="landing-section">
          <div className="landing-container">
            <div className="lx-section-head" data-reveal>
              <p className="lx-eyebrow">The details</p>
              <h2 className="landing-h2">Built so you can check every line.</h2>
            </div>
            <div className="landing-features">
              {FEATURES.map(feature => (
                <article className="landing-feature" key={feature.title} data-reveal>
                  <div className="landing-feature-copy">
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                  </div>
                  {feature.crop}
                </article>
              ))}
            </div>
            <div className="lx-share-row" data-reveal>
              <div className="lx-share-copy">
                <h3>Share it anywhere</h3>
                <p>PNG, SVG, a Markdown brief, an Obsidian vault, Mermaid or JSON. Your thinking never gets stuck here.</p>
              </div>
              <CropShare />
            </div>
          </div>
        </section>

        <section id="pricing" className="landing-section landing-pricing">
          <div className="landing-container">
            <div className="landing-pricing-head" data-reveal>
              <div>
                <p className="lx-eyebrow">Pricing</p>
                <h2 className="landing-h2">Start free. Pay when it earns its keep.</h2>
              </div>
              <div className="layout-switch" role="group" aria-label="Billing">
                <button type="button" aria-pressed={billingCycle === 'monthly'} onClick={() => setBillingCycle('monthly')}>Monthly</button>
                <button type="button" aria-pressed={billingCycle === 'annual'} onClick={() => setBillingCycle('annual')}>Yearly, save {ANNUAL_SAVING}%</button>
              </div>
            </div>
            <div className="plan-columns is-four landing-plans" data-reveal>
              {PLAN_ORDER.map(id => {
                const plan = SUBSCRIPTION_TIERS[id];
                const price = billingCycle === 'annual' ? plan.priceAnnualUsd : plan.priceMonthlyUsd;
                const recommended = id === RECOMMENDED;
                return (
                  <div key={id} className={`plan-column ${recommended ? 'is-recommended' : ''}`}>
                    {recommended && <span className="lx-plan-flag">Most people pick this</span>}
                    <h3>{plan.name}</h3>
                    <p className="plan-price"><strong>{usd(price)}</strong> <span>{id === 'trial' ? 'for 3 days' : plan.perSeat ? 'per seat a month' : 'a month'}</span></p>
                    <p className="note-meta">{plan.creditsMonthly.toLocaleString()} credits a month</p>
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
            <div data-reveal>
              <p className="lx-eyebrow">FAQ</p>
              <h2 className="landing-h2">Fair questions.</h2>
            </div>
            <div className="landing-faq" data-reveal>
              {FAQS.map(faq => (
                <details key={faq.q}>
                  <summary>{faq.q}<ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" /></summary>
                  <p>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 8. Close on the user's own question, still being written */}
        <section className="landing-section lx-final">
          <div className="landing-container">
            <h2 data-reveal>What are you trying to figure&nbsp;out?</h2>
            <p className="lx-lede" data-reveal style={{ ['--d' as string]: '120ms' }}>Bring the question. Leave with a map you can defend.</p>
            <div data-reveal style={{ ['--d' as string]: '240ms' }}>
              <TypewriterComposer />
            </div>
            <p className="note-meta lx-hero-meta">{SUBSCRIPTION_TIERS.trial.creditsMonthly} free credits · No card needed</p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-row">
          <Link href="/" className="landing-brand" aria-label="Synthex home"><SynthexMark size={18} /></Link>
          <span>© {new Date().getFullYear()} Synthex · Made for people who like to know why</span>
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


