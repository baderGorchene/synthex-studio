'use client';

import React from 'react';
import Link from 'next/link';
import { UserButton, OrganizationSwitcher, useUser } from '@clerk/nextjs';

export interface UserNavProps {
  contextCredits?: number;
  subscriptionTier?: string;
  onOpenCreditsModal?: () => void;
}

// Clerk popovers take the Typeset look: white paper, hairline, 2px corners, the one float shadow.
const clerkMenu = {
  variables: { colorPrimary: '#111214', colorText: '#111214', colorBackground: '#FFFFFF', borderRadius: '2px', fontFamily: 'var(--font-ui)' },
  elements: {
    avatarBox: 'clerk-avatar',
    userButtonPopoverCard: 'clerk-menu',
    organizationSwitcherPopoverCard: 'clerk-menu',
    organizationSwitcherTrigger: 'clerk-org-trigger'
  }
};

function CreditsButton({ label, title, onClick }: { label: string; title: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="credits-button" title={title}>
      {label}
    </button>
  );
}

const ClerkUserNavInner: React.FC<UserNavProps> = ({
  contextCredits = 100,
  onOpenCreditsModal
}) => {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="clerk-avatar is-loading" aria-hidden="true" />;
  }

  if (!isSignedIn) {
    return (
      <div className="user-nav">
        <Link href="/sign-in" className="text-button user-nav-link">Sign in</Link>
        <Link href="/sign-up" className="ink-button user-nav-link">Start free</Link>
      </div>
    );
  }

  return (
    <div className="user-nav">
      <OrganizationSwitcher
        afterCreateOrganizationUrl="/app"
        afterLeaveOrganizationUrl="/app"
        afterSelectOrganizationUrl="/app"
        appearance={clerkMenu}
      />
      <CreditsButton
        label={`${contextCredits.toLocaleString()} credits`}
        title="Your credits. Click to see the balance or top up."
        onClick={onOpenCreditsModal}
      />
      <UserButton appearance={clerkMenu} />
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
      <div className="user-nav">
        <CreditsButton
          label="5,000 credits"
          title={`Local mode (${subscriptionTier}). Click to see credits.`}
          onClick={onOpenCreditsModal}
        />
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
