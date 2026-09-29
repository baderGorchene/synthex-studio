'use client';

import React, { useState, useEffect } from 'react';
import { SynthexLogo } from '@/components/brand/SynthexLogo';
import {
  Check,
  Sparkles,
  Key,
  Users,
  ShieldCheck,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';

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
        window.location.href = data.url;
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
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300"
      onClick={e => e.stopPropagation()}
    >
      <div
        className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="relative px-6 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800 text-center bg-gradient-to-b from-slate-50 dark:from-slate-800/40 to-white dark:to-slate-900">
          <div className="absolute top-6 right-6 flex items-center gap-3">
            {isClerkConfigured && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 hidden sm:inline">Signed in as</span>
                <UserButton appearance={{ elements: { avatarBox: 'w-7 h-7' } }} />
              </div>
            )}
          </div>

          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 mb-4">
            <SynthexLogo size={20} />
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 tracking-wide uppercase">
              Synthex Studio Activation
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Choose Your Research Workspace Plan
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            To ensure complete privacy and dedicated resources, each account requires an active plan. Select a tier to enter your personal, isolated workspace.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="mt-6 inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setInterval('month')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                interval === 'month'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setInterval('year')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                interval === 'year'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Annual Billing
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/70 px-1.5 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>

          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium max-w-lg mx-auto">
              {errorMessage}
            </div>
          )}
        </div>

        {/* 4 Plan Cards Grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 bg-slate-50/50 dark:bg-slate-950/40">
          {/* Card 1: 3-Day Free Trial */}
          <div className="relative rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Free Trial
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Instant Access
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">$0</span>
                <span className="text-xs text-slate-500">/ 3 days</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Test Synthex Studio with zero commitment. No credit card required.
              </p>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>100</strong> Context Credits</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Autonomous Deep Research trial</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Private isolated knowledge graph</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Full Mermaid &amp; Markdown exports</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                disabled={Boolean(loadingPlan)}
                onClick={() => handleSelectPlan('trial')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loadingPlan === 'trial' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Activating...
                  </>
                ) : (
                  <>
                    Start Free Trial <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 2: BYOK / No-AI */}
          <div className="relative rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  BYOK Studio
                </span>
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <Key size={10} className="inline mr-1" /> Own Key
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  ${interval === 'year' ? '2.40' : '3.00'}
                </span>
                <span className="text-xs text-slate-500">/ month</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Bring your own OpenAI or Gemini key. 0 platform AI markup.
              </p>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                  <span>Bring OpenAI or Gemini key</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                  <span>Zero platform token surcharge</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                  <span>Cloud DB multi-device sync</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                  <span>Document Vault &amp; PDF jumps</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                disabled={Boolean(loadingPlan)}
                onClick={() => handleSelectPlan('byok')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loadingPlan === 'byok' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Preparing...
                  </>
                ) : (
                  <>
                    Choose BYOK <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 3: Pro Studio (RECOMMENDED) */}
          <div className="relative rounded-2xl p-5 bg-gradient-to-b from-indigo-50/60 dark:from-indigo-950/30 to-white dark:to-slate-900 border-2 border-indigo-500 dark:border-indigo-500 flex flex-col justify-between shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/20">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-white bg-indigo-600 px-2.5 py-0.5 rounded-full shadow-xs">
                <Sparkles size={10} /> Recommended
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2 mt-1">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                  Pro Studio
                </span>
                <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                  1,500 Credits/mo
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  ${interval === 'year' ? '7.99' : '9.99'}
                </span>
                <span className="text-xs text-slate-500">/ month</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                The flagship AI research experience with autonomous multi-hop web grounding.
              </p>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-indigo-100 dark:border-indigo-900/50">
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <span><strong>1,500</strong> Context Credits / month</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <span>Autonomous Deep Research grounding</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <span>Verified web citations &amp; evidence audit</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <span>Obsidian &amp; Logseq Vault exports</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                disabled={Boolean(loadingPlan)}
                onClick={() => handleSelectPlan('pro')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loadingPlan === 'pro' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Preparing...
                  </>
                ) : (
                  <>
                    Start Pro Studio <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 4: Team Plan */}
          <div className="relative rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Team Plan
                </span>
                <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                  <Users size={10} className="inline mr-1" /> Teams
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  ${interval === 'year' ? '23.99' : '29.99'}
                </span>
                <span className="text-xs text-slate-500">/ seat / mo</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                For research groups, university labs, and enterprise analysts.
              </p>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-purple-500 shrink-0 mt-0.5" />
                  <span><strong>5,000</strong> Pooled Credits / month</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-purple-500 shrink-0 mt-0.5" />
                  <span>Clerk Organization RBAC &amp; invites</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-purple-500 shrink-0 mt-0.5" />
                  <span>Shared collaborative research graphs</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-purple-500 shrink-0 mt-0.5" />
                  <span>Centralized team billing &amp; invoices</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                disabled={Boolean(loadingPlan)}
                onClick={() => handleSelectPlan('team')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loadingPlan === 'team' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Preparing...
                  </>
                ) : (
                  <>
                    Choose Team <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-100/70 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Encrypted cloud storage · Strict account data isolation · Cancel anytime</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Synthex Studio v2.4 · All rights reserved
          </span>
        </div>
      </div>
    </div>
  );
};
