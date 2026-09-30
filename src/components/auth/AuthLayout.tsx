import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SynthexLogo } from '@/components/brand/SynthexLogo';

/** Clerk takes the Typeset look through its appearance prop only. */
export const clerkAppearance = {
  variables: {
    colorPrimary: '#111214',
    colorText: '#111214',
    colorBackground: '#FFFFFF',
    borderRadius: '2px',
    fontFamily: 'var(--font-ui)'
  }
};

/** Split layout for sign-in and sign-up: the brand and one line on the left, Clerk on the right. */
export function AuthLayout({ line, children }: { line: string; children: React.ReactNode }) {
  const isClerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <main className="auth-page">
      <section className="auth-side">
        <Link href="/" className="auth-brand" aria-label="Synthex home"><SynthexLogo size={18} /></Link>
        <p className="auth-line">{line}</p>
      </section>
      <section className="auth-main">
        {isClerkEnabled ? children : (
          <div className="auth-local">
            <h1>Local mode</h1>
            <p>Sign-in isn&apos;t set up on this server, so you work as a local user with maps stored on this computer. Add the Clerk keys to <code>.env.local</code> to turn accounts on.</p>
            <Link href="/app" className="ink-button">Open your maps <ArrowRight size={18} strokeWidth={1.75} /></Link>
          </div>
        )}
      </section>
    </main>
  );
}
