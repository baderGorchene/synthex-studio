import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { Sparkles, ArrowLeft, Zap } from 'lucide-react';

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#fbfbfb] px-4 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-3 text-sm font-medium text-[#64748b] hover:text-[#0f172a] transition-colors">
          <ArrowLeft size={14} /> Back to Synthex Studio
        </Link>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Sparkles size={16} />
          </span>
          <span className="text-xl font-bold tracking-tight text-[#0f172a]">Synthex Studio</span>
        </div>
        
        {/* 3-day free trial badge */}
        <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-xs">
          <Zap size={12} className="text-emerald-600" />
          <span>3-Day Free Trial · 100 Context Credits Included · No Credit Card Required</span>
        </div>
      </div>

      <div className="w-full max-w-md flex justify-center">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/"
        />
      </div>
    </main>
  );
}
