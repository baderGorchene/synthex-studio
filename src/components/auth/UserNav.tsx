'use client';

import React from 'react';
import Link from 'next/link';
import { UserButton, OrganizationSwitcher, useUser } from '@clerk/nextjs';
import { Zap, Sparkles } from 'lucide-react';

export interface UserNavProps {
  contextCredits?: number;
  subscriptionTier?: string;
  onOpenCreditsModal?: () => void;
}

const ClerkUserNavInner: React.FC<UserNavProps> = ({
  contextCredits = 100,
  subscriptionTier = 'trial',
  onOpenCreditsModal
}) => {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="w-7 h-7 rounded-full bg-slate-100 animate-pulse" />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/sign-in"
          className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-md shadow-xs transition-colors"
        >
          <Sparkles size={11} /> Start Free Trial
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      {/* Team / Organization Switcher for Team Plan */}
      <OrganizationSwitcher
        afterCreateOrganizationUrl="/app"
        afterLeaveOrganizationUrl="/app"
        afterSelectOrganizationUrl="/app"
        appearance={{
          elements: {
            organizationSwitcherTrigger: 'px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200'
          }
        }}
      />

      {/* Context Credits Meter Badge with animated fill bar */}
      <button
        type="button"
        onClick={onOpenCreditsModal}
        className="relative group overflow-hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50/90 border border-indigo-200/80 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 hover:border-indigo-300 transition-all shadow-2xs"
        title="Context Credits · Click to view ledger or refill"
      >
        <div
          className="absolute inset-y-0 left-0 bg-indigo-200/50 -z-0 transition-all duration-500 rounded-full"
          style={{ width: `${Math.min(100, Math.max(5, Math.round((contextCredits / (subscriptionTier === 'team' ? 5000 : subscriptionTier === 'pro' ? 1500 : 100)) * 100)))}%` }}
        />
        <Zap size={11} className="relative z-10 text-indigo-600 fill-indigo-600 shrink-0" />
        <span className="relative z-10 font-bold">{contextCredits.toLocaleString()}</span>
        <span className="relative z-10 text-[10.5px] font-normal text-indigo-500 hidden sm:inline">Credits</span>
      </button>

      {/* User profile avatar & menu */}
      <UserButton
        appearance={{
          elements: {
            avatarBox: 'w-7 h-7'
          }
        }}
      />
    </div>
  );
};

export const UserNav: React.FC<UserNavProps> = ({
  contextCredits = 100,
  subscriptionTier = 'trial',
  onOpenCreditsModal
}) => {
  const isClerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (!isClerkEnabled) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCreditsModal}
          className="relative group overflow-hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50/90 border border-indigo-200/80 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 hover:border-indigo-300 transition-all shadow-2xs"
          title={`Context Credits balance (Local Development Mode · ${subscriptionTier}) · Click to open manager`}
        >
          <div
            className="absolute inset-y-0 left-0 bg-indigo-200/50 -z-0 transition-all duration-500 rounded-full"
            style={{ width: '100%' }}
          />
          <Zap size={11} className="relative z-10 text-indigo-600 fill-indigo-600 shrink-0" />
          <span className="relative z-10 font-bold">5,000</span>
          <span className="relative z-10 text-[10.5px] font-normal text-indigo-500 hidden sm:inline">Local Dev Credits</span>
        </button>
      </div>
    );
  }

  return (
    <ClerkUserNavInner
      contextCredits={contextCredits}
      subscriptionTier={subscriptionTier}
      onOpenCreditsModal={onOpenCreditsModal}
    />
  );
};
