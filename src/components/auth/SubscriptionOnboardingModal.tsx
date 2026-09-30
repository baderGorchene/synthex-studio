'use client';

import React, { useState, useEffect } from 'react';
import { SynthexLogo } from '@/components/brand/SynthexLogo';
import { UserButton } from '@clerk/nextjs';
import { SUBSCRIPTION_TIERS } from '@/lib/plans';

const PLAN_ORDER = ['trial', 'byok', 'pro', 'team'] as const;
const RECOMMENDED = 'pro';
const ANNUAL_SAVING = Math.round((1 - SUBSCRIPTION_TIERS.pro.priceAnnualUsd / SUBSCRIPTION_TIERS.pro.priceMonthlyUsd) * 100);

export interface SubscriptionOnboardingModalProps {
  isOpen: boolean;
  onPlanSelected: (result: {
    tier: string;
    credits: number;
    project?: { id: string; title: string };
  }) => void;
}

export const SubscriptionOnboardingModal: React.FC<SubscriptionOnboardingModalProps> = ({
  isOpen,
  onPlanSelected
}) => {
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prevent escape key dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPlan = async (planId: 'trial' | 'byok' | 'pro' | 'team') => {
    setLoadingPlan(planId);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/billing/select-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          interval
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to select plan. Please try again.');
      }

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.assign(data.url);
        return;
      }

      if (data.hasSelectedPlan) {
        onPlanSelected({
          tier: data.tier || planId,
          credits: data.credits || 0,
          project: data.project
        });
      }
    } catch (err) {
      console.error('Plan selection error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Could not activate subscription.');
      setLoadingPlan(null);
    }
  };

  const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="modal-scrim onboarding-scrim" role="presentation" onClick={e => e.stopPropagation()}>
      <section className="work-modal onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" onClick={e => e.stopPropagation()}>
        <div className="onboarding-head">
          <SynthexLogo size={18} />
          {isClerkConfigured && <UserButton appearance={{ elements: { avatarBox: 'clerk-avatar' } }} />}
        </div>
        <h1 id="onboarding-title">Pick a plan to start mapping</h1>
        <p className="onboarding-lede">Every account needs a plan. You can start free and change it later.</p>

        <div className="layout-switch onboarding-interval" role="group" aria-label="Billing">
          <button type="button" aria-pressed={interval === 'month'} onClick={() => setInterval('month')}>Monthly</button>
          <button type="button" aria-pressed={interval === 'year'} onClick={() => setInterval('year')}>Yearly, save {ANNUAL_SAVING}%</button>
        </div>

        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}

        <div className="plan-columns is-four">
          {PLAN_ORDER.map(id => {
            const plan = SUBSCRIPTION_TIERS[id];
            const price = interval === 'year' ? plan.priceAnnualUsd : plan.priceMonthlyUsd;
            const recommended = id === RECOMMENDED;
            return (
              <div key={id} className={`plan-column ${recommended ? 'is-recommended' : ''}`}>
                <h3>{plan.name}</h3>
                <p className="plan-price">
                  <strong>${price === 0 ? '0' : price.toFixed(2)}</strong>{' '}
                  <span>{id === 'trial' ? 'for 3 days' : plan.perSeat ? 'per seat a month' : 'a month'}</span>
                </p>
                <p className="note-meta">{recommended ? 'Recommended · ' : ''}{plan.creditsMonthly.toLocaleString()} credits a month</p>
                <ul className="plan-features">
                  {plan.features.map(feature => <li key={feature}>{feature}</li>)}
                </ul>
                <button
                  type="button"
                  disabled={Boolean(loadingPlan)}
                  onClick={() => handleSelectPlan(id)}
                  className={recommended ? 'ink-button' : 'line-button'}
                >
                  {loadingPlan === id ? 'One moment…' : id === 'trial' ? 'Start free' : `Choose ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <p className="note-meta onboarding-foot">Cancel any time. Payments are handled by Stripe.</p>
      </section>
    </div>
  );
};
