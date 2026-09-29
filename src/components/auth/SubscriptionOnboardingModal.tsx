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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(40, 75, 99, 0.65)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={e => e.stopPropagation()}
    >
      <div
        className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-[#d9d9d9] overflow-hidden my-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="relative px-6 pt-8 pb-6 border-b border-[#d9d9d9] text-center bg-gradient-to-b from-[#f7f8f7] to-white">
          <div className="absolute top-6 right-6 flex items-center gap-3">
            {isClerkConfigured && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64706f] hidden sm:inline">Signed in as</span>
                <UserButton appearance={{ elements: { avatarBox: 'w-7 h-7' } }} />
              </div>
            )}
          </div>

          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#3c6e71]/[0.08] border border-[#3c6e71]/25 mb-4">
            <SynthexLogo size={20} />
            <span className="text-xs font-bold text-[#3c6e71] tracking-wide uppercase">
              Synthex Studio Activation
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#353535] tracking-tight">
            Choose Your Research Workspace Plan
          </h1>
          <p className="mt-2 text-sm text-[#64706f] max-w-xl mx-auto">
            To ensure complete privacy and dedicated resources, each account requires an active plan. Select a tier to enter your personal, isolated workspace.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="mt-6 inline-flex items-center p-1 rounded-xl bg-[#f7f8f7] border border-[#d9d9d9]">
            <button
              type="button"
              onClick={() => setInterval('month')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                interval === 'month'
                  ? 'bg-white text-[#353535] shadow-sm border border-[#d9d9d9]'
                  : 'text-[#64706f] hover:text-[#353535]'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setInterval('year')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                interval === 'year'
                  ? 'bg-white text-[#353535] shadow-sm border border-[#d9d9d9]'
                  : 'text-[#64706f] hover:text-[#353535]'
              }`}
            >
              Annual Billing
              <span className="text-[10px] font-bold text-[#167256] bg-[#167256]/10 px-1.5 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>

          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium max-w-lg mx-auto">
              {errorMessage}
            </div>
          )}
        </div>

        {/* 4 Plan Cards Grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 bg-[#f7f8f7]/60">
          {/* Card 1: 3-Day Free Trial */}
          <div className="relative rounded-2xl p-5 bg-white border border-[#d9d9d9] flex flex-col justify-between hover:border-[#b8c2bf] transition-all shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-[#4f5d5b] uppercase tracking-wider">
                  Free Trial
                </span>
                <span className="text-[10px] font-semibold text-[#167256] bg-[#167256]/10 px-2 py-0.5 rounded-full border border-[#167256]/20">
                  Instant Access
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold text-[#353535]">$0</span>
                <span className="text-xs text-[#64706f]">/ 3 days</span>
              </div>
              <p className="text-xs text-[#64706f] mb-4">
                Test Synthex Studio with zero commitment. No credit card required.
              </p>

              <div className="space-y-2.5 text-xs text-[#4f5d5b] pt-3 border-t border-[#d9d9d9]/60">
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#3c6e71] shrink-0 mt-0.5" />
                  <span><strong>100</strong> Context Credits</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#3c6e71] shrink-0 mt-0.5" />
                  <span>Autonomous Deep Research trial</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#3c6e71] shrink-0 mt-0.5" />
                  <span>Private isolated knowledge graph</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#3c6e71] shrink-0 mt-0.5" />
                  <span>Full Mermaid &amp; Markdown exports</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                disabled={Boolean(loadingPlan)}
                onClick={() => handleSelectPlan('trial')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[#353535] bg-[#f7f8f7] hover:bg-[#eef1f0] border border-[#d9d9d9] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
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
          <div className="relative rounded-2xl p-5 bg-white border border-[#d9d9d9] flex flex-col justify-between hover:border-[#b8c2bf] transition-all shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-[#4f5d5b] uppercase tracking-wider">
                  BYOK Studio
                </span>
                <span className="text-[10px] font-semibold text-[#8a5a00] bg-[#8a5a00]/10 px-2 py-0.5 rounded-full border border-[#8a5a00]/20">
                  <Key size={10} className="inline mr-1" /> Own Key
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold text-[#353535]">
                  ${interval === 'year' ? '2.40' : '3.00'}
                </span>
                <span className="text-xs text-[#64706f]">/ month</span>
              </div>
              <p className="text-xs text-[#64706f] mb-4">
                Bring your own OpenAI or Gemini key. 0 platform AI markup.
              </p>

              <div className="space-y-2.5 text-xs text-[#4f5d5b] pt-3 border-t border-[#d9d9d9]/60">
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#3c6e71] shrink-0 mt-0.5" />
                  <span>Bring OpenAI or Gemini key</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#3c6e71] shrink-0 mt-0.5" />
                  <span>Zero platform token surcharge</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#3c6e71] shrink-0 mt-0.5" />
                  <span>Cloud DB multi-device sync</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#3c6e71] shrink-0 mt-0.5" />
                  <span>Document Vault &amp; PDF jumps</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                disabled={Boolean(loadingPlan)}
                onClick={() => handleSelectPlan('byok')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[#353535] bg-[#f7f8f7] hover:bg-[#eef1f0] border border-[#d9d9d9] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
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
          <div className="relative rounded-2xl p-5 bg-gradient-to-b from-[#3c6e71]/[0.06] to-white border-2 border-[#3c6e71] flex flex-col justify-between shadow-lg shadow-[#284b63]/10 ring-2 ring-[#3c6e71]/15">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-white bg-[#3c6e71] px-2.5 py-0.5 rounded-full shadow-sm">
                <Sparkles size={10} /> Recommended
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2 mt-1">
                <span className="text-xs font-bold text-[#284b63] uppercase tracking-wider">
                  Pro Studio
                </span>
                <span className="text-[10px] font-semibold text-[#284b63] bg-[#284b63]/10 px-2 py-0.5 rounded-full">
                  1,500 Credits/mo
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold text-[#353535]">
                  ${interval === 'year' ? '7.99' : '9.99'}
                </span>
                <span className="text-xs text-[#64706f]">/ month</span>
              </div>
              <p className="text-xs text-[#64706f] mb-4">
                The flagship AI research experience with autonomous multi-hop web grounding.
              </p>

              <div className="space-y-2.5 text-xs text-[#4f5d5b] pt-3 border-t border-[#3c6e71]/15">
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#284b63] shrink-0 mt-0.5" />
                  <span><strong>1,500</strong> Context Credits / month</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#284b63] shrink-0 mt-0.5" />
                  <span>Autonomous Deep Research grounding</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#284b63] shrink-0 mt-0.5" />
                  <span>Verified web citations &amp; evidence audit</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#284b63] shrink-0 mt-0.5" />
                  <span>Obsidian &amp; Logseq Vault exports</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                disabled={Boolean(loadingPlan)}
                onClick={() => handleSelectPlan('pro')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#3c6e71] hover:bg-[#345f62] shadow-sm shadow-[#284b63]/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
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
          <div className="relative rounded-2xl p-5 bg-white border border-[#d9d9d9] flex flex-col justify-between hover:border-[#b8c2bf] transition-all shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-[#4f5d5b] uppercase tracking-wider">
                  Team Plan
                </span>
                <span className="text-[10px] font-semibold text-[#284b63] bg-[#284b63]/10 px-2 py-0.5 rounded-full border border-[#284b63]/20">
                  <Users size={10} className="inline mr-1" /> Teams
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold text-[#353535]">
                  ${interval === 'year' ? '23.99' : '29.99'}
                </span>
                <span className="text-xs text-[#64706f]">/ seat / mo</span>
              </div>
              <p className="text-xs text-[#64706f] mb-4">
                For research groups, university labs, and enterprise analysts.
              </p>

              <div className="space-y-2.5 text-xs text-[#4f5d5b] pt-3 border-t border-[#d9d9d9]/60">
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#284b63] shrink-0 mt-0.5" />
                  <span><strong>5,000</strong> Pooled Credits / month</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#284b63] shrink-0 mt-0.5" />
                  <span>Clerk Organization RBAC &amp; invites</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#284b63] shrink-0 mt-0.5" />
                  <span>Shared collaborative research graphs</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-[#284b63] shrink-0 mt-0.5" />
                  <span>Centralized team billing &amp; invoices</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                disabled={Boolean(loadingPlan)}
                onClick={() => handleSelectPlan('team')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[#353535] bg-[#f7f8f7] hover:bg-[#eef1f0] border border-[#d9d9d9] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
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
        <div className="px-6 py-4 bg-[#f7f8f7] border-t border-[#d9d9d9] flex flex-col sm:flex-row items-center justify-between text-xs text-[#64706f] gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#3c6e71]" />
            <span>Encrypted cloud storage · Strict account data isolation · Cancel anytime</span>
          </div>
          <span className="text-[11px] text-[#b8c2bf]">
            Synthex Studio v2.4 · All rights reserved
          </span>
        </div>
      </div>
    </div>
  );
};
