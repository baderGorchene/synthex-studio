import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SynthexLogo } from '@/components/brand/SynthexLogo';
import { SUBSCRIPTION_TIERS } from '@/lib/plans';

/** Clerk takes the board's look through its appearance prop: paper, ink, handwritten title. */
export const clerkAppearance = {
  variables: {
    colorPrimary: '#111214',
    colorText: '#111214',
    colorBackground: '#FFFDF7',
    colorInput: '#FFFFFF',
    borderRadius: '2px',
    fontFamily: 'var(--font-ui)'
  },
  elements: {
    cardBox: { boxShadow: 'none', border: '0', width: '100%' },
    card: { boxShadow: 'none', background: 'transparent' },
    headerTitle: { fontFamily: 'var(--font-hand)', fontSize: '34px', fontWeight: 700, lineHeight: 1 }
  }
};

type AuthVariant = 'sign-in' | 'sign-up';

const COPY: Record<AuthVariant, { eyebrow: string; line: string; points: string[]; note: string }> = {
  'sign-in': {
    eyebrow: 'Welcome back',
    line: 'Your maps are right where you pinned them.',
    points: ['Pick up any question mid-thought', 'Drafts wait in blue until you decide', 'Every source still numbered and one click away'],
    note: 'your board missed you'
  },
  'sign-up': {
    eyebrow: 'Start free',
    line: 'Bring the question. Leave with a map you can defend.',
    points: [`${SUBSCRIPTION_TIERS.trial.creditsMonthly} free credits for 3 days, no card needed`, 'AI drafts, you decide what stays', 'Share as a doc, image, Markdown or Obsidian vault'],
    note: 'takes about 30 seconds'
  }
};

/** Split layout for sign-in and sign-up: a slice of the board on the left, the form taped to paper on the right. */
export function AuthLayout({ variant, children }: { variant: AuthVariant; children: React.ReactNode }) {
  const isClerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const copy = COPY[variant];
  return (
    <main className={`auth-page is-${variant}`}>
      <section className="auth-side">
        <Link href="/" className="auth-brand" aria-label="Synthex home"><SynthexLogo size={18} /></Link>

        <div className="auth-pitch">
          <p className="auth-eyebrow">{copy.eyebrow}</p>
          <h1 className="auth-line">{copy.line}</h1>
          <ul className="auth-points">
            {copy.points.map((point, index) => <li key={point} style={{ animationDelay: `${300 + index * 120}ms` }}>{point}</li>)}
          </ul>
        </div>

        {/* A small illustrative corner of a board: a question with two notes pinned around it */}
        <div className="auth-board" aria-hidden="true">
          <svg className="auth-board-lines" viewBox="0 0 460 250" preserveAspectRatio="none">
            <path d="M 196 128 C 226 128, 220 60, 250 60" pathLength={1} />
            <path d="M 196 150 C 226 150, 220 196, 250 196" pathLength={1} />
          </svg>
          <article className="auth-note is-question" style={{ left: '2%', top: '30%' }}>
            <span className="note-pin" />
            <h2>How does sleep affect memory?</h2>
            <p className="note-meta">Question</p>
          </article>
          <article className="auth-note" style={{ left: '55%', top: '4%' }}>
            <span className="note-pin" />
            <h2>Deep sleep replays the day</h2>
            <p className="note-meta">Idea · cites [1]</p>
          </article>
          <article className="auth-note is-draft" style={{ left: '55%', top: '58%' }}>
            <span className="note-pin" />
            <h2>A lost night blocks learning</h2>
            <p className="note-meta">Draft · waiting for you</p>
          </article>
        </div>
      </section>

      <section className="auth-main">
        <div className="auth-sheet">
          {isClerkEnabled ? children : (
            <div className="auth-local">
              <h2>Local mode</h2>
              <p>Sign-in isn&apos;t set up on this server, so you work as a local user with maps stored on this computer. Add the Clerk keys to <code>.env.local</code> to turn accounts on.</p>
              <Link href="/app" className="ink-button">Open your maps <ArrowRight size={18} strokeWidth={1.75} /></Link>
            </div>
          )}
        </div>
        <p className="auth-scribble" aria-hidden="true">{copy.note}</p>
        <p className="note-meta auth-foot">
          <Link href="/">Back to the homepage</Link>
          <span aria-hidden="true">·</span>
          {variant === 'sign-in' ? <Link href="/sign-up">New here? Start free</Link> : <Link href="/sign-in">Already have an account? Sign in</Link>}
        </p>
      </section>
    </main>
  );
}
