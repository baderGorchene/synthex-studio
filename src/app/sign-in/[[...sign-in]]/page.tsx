import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { Sparkles, ArrowLeft } from 'lucide-react';

export default function SignInPage() {
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
        <p className="text-xs text-[#64748b] mt-1.5 max-w-xs">
          Sign in to your grounded semantic knowledge workspace.
        </p>
      </div>

      <div className="w-full max-w-md flex justify-center">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
        />
      </div>
    </main>
  );
}
