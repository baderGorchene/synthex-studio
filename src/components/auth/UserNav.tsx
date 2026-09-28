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

      {/* Context Credits Meter Badge */}
      <button
        type="button"
        onClick={onOpenCreditsModal}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors"
        title="Click to view Context Credit usage or refill"
      >
        <Zap size={11} className="text-indigo-600 fill-indigo-600" />
        <span>{contextCredits.toLocaleString()} Credits</span>
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
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors"
          title={`Context Credits balance (Local Development Mode · ${subscriptionTier})`}
        >
          <Zap size={11} className="text-indigo-600 fill-indigo-600" />
          <span>Local Mode · 5,000 Credits</span>
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
