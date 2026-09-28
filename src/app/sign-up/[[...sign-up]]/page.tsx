import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { Sparkles, ArrowLeft, ArrowRight, Zap, Database, ShieldAlert } from 'lucide-react';

export default function SignUpPage() {
  const isClerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#ffffff] px-4 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-3 text-sm font-medium text-[#4f5d5b] hover:text-[#284b63] transition-colors">
          <ArrowLeft size={14} /> Back to Synthex Studio
        </Link>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-[#3c6e71] text-white flex items-center justify-center shadow-sm">
            <Sparkles size={16} />
          </span>
          <span className="text-xl font-bold tracking-tight text-[#353535]">Synthex Studio</span>
        </div>

        {/* 3-day free trial badge */}
        <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3c6e71]/10 border border-[#3c6e71]/30 text-[#3c6e71] text-xs font-semibold shadow-xs">
          <Zap size={12} className="text-[#3c6e71]" />
          <span>3-Day Free Trial · 100 Context Credits Included · No Credit Card Required</span>
        </div>
      </div>

      <div className="w-full max-w-md flex justify-center">
        {isClerkEnabled ? (
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/app"
          />
        ) : (
          <div className="w-full bg-[#fbfbfa] border border-[#d9d9d9] rounded-2xl p-6 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-[#3c6e71]/10 text-[#3c6e71] flex items-center justify-center mx-auto mb-4">
              <Database size={24} />
            </div>
            <h2 className="text-lg font-bold text-[#353535] mb-2">Local Development Mode</h2>
            <p className="text-xs text-[#4f5d5b] leading-relaxed mb-6">
              Clerk authentication keys are not configured in your <code className="text-[11px] px-1.5 py-0.5 rounded bg-[#f0f0ef] font-mono text-[#284b63]">.env.local</code>.
              Synthex is operating in zero-friction local mode with SQLite and 5,000 developer credits.
            </p>

            <Link
              href="/app"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3c6e71] hover:bg-[#2d5355] text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <span>Enter Studio Workspace</span>
              <ArrowRight size={14} />
            </Link>

            <div className="mt-4 pt-4 border-t border-[#d9d9d9]/70 flex items-center justify-center gap-1.5 text-[11px] text-[#4f5d5b]">
              <ShieldAlert size={12} className="text-[#3c6e71]" />
              <span>To enable cloud auth, add Clerk keys to .env.local</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
