'use client';

import React, { useState } from 'react';
import {
  X,
  Zap,
  Sparkles,
  ArrowUpRight,
  History,
  Check,
  ShieldCheck,
  CreditCard,
  Layers,
  FileText,
  MessageCircle,
  Loader2
} from 'lucide-react';
import type { CreditTransaction } from '@/lib/db';

export interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance?: number;
  subscriptionTier?: string;
  onRefillSuccess?: (newBalance: number) => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({
  isOpen,
  onClose,
  currentBalance = 100,
  subscriptionTier = 'trial'
}) => {
  const [activeTab, setActiveTab] = useState<'refill' | 'history'>('refill');
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleSwitchToHistory = async () => {
    setActiveTab('history');
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/credits/history');
      const data = await res.json();
      if (Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Failed to load credit history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const handleRefillPack = async () => {
    setActionLoading('refill_500');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId: 'refill_500'
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpgradeTier = async (tierId: 'pro' | 'team') => {
    setActionLoading(tierId);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId,
          interval: 'month'
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Upgrade checkout failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const tierMaxCredits = subscriptionTier === 'team' ? 5000 : subscriptionTier === 'pro' ? 1500 : 100;
  const progressPct = Math.min(100, Math.round((currentBalance / tierMaxCredits) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold">
              <Zap size={18} className="fill-indigo-600 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 leading-tight">Context Credits &amp; Metering</h2>
              <p className="text-xs text-slate-500">Synthex Studio Research Currency</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Balance Status Banner */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-50/70 via-white to-slate-50 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Available Balance</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {currentBalance.toLocaleString()}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  / {tierMaxCredits.toLocaleString()} {subscriptionTier.toUpperCase()} Quota
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck size={12} /> {subscriptionTier === 'trial' ? '3-Day Free Trial' : subscriptionTier === 'pro' ? 'Pro Studio' : subscriptionTier === 'team' ? 'Team Organization' : 'BYOK'}
              </span>
            </div>
          </div>

          {/* Meter progress bar */}
          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 px-6 bg-white">
          <button
            type="button"
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'refill'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setActiveTab('refill')}
          >
            <CreditCard size={14} /> Refill &amp; Plan Upgrades
          </button>
          <button
            type="button"
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={handleSwitchToHistory}
          >
            <History size={14} /> Consumption Ledger
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {activeTab === 'refill' ? (
            <>
              {/* Instant Refill Pack */}
              <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-indigo-600 text-white">
                      Instant Refill
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">500 Context Credits Pack</h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Adds 500 credits immediately without altering your existing subscription cycle.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-lg font-bold text-slate-900">$5.00</span>
                  <button
                    type="button"
                    onClick={handleRefillPack}
                    disabled={Boolean(actionLoading)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'refill_500' ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Zap size={13} className="fill-white" />
                    )}
                    <span>Refill Pack</span>
                  </button>
                </div>
              </div>

              {/* Monthly Subscription Tiers */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Subscription Plans
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pro Plan */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    subscriptionTier === 'pro'
                      ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Pro Studio</h4>
                        <span className="text-xs text-slate-500">1,500 credits/mo</span>
                      </div>
                      <span className="text-base font-extrabold text-slate-900">$9.99<span className="text-xs font-normal text-slate-500">/mo</span></span>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-1.5 my-3">
                      <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-600" /> Managed multi-hop research</li>
                      <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-600" /> 20 GB GCS document vault</li>
                      <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-600" /> Priority model routing</li>
                    </ul>
                    {subscriptionTier === 'pro' ? (
                      <span className="block text-center py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100/60 rounded-md">
                        Current Plan
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpgradeTier('pro')}
                        disabled={Boolean(actionLoading)}
                        className="w-full py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors flex items-center justify-center gap-1"
                      >
                        {actionLoading === 'pro' ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpRight size={12} />}
                        <span>Upgrade to Pro</span>
                      </button>
                    )}
                  </div>

                  {/* Team Plan */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    subscriptionTier === 'team'
                      ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Team Plan</h4>
                        <span className="text-xs text-slate-500">5,000 pooled credits/mo</span>
                      </div>
                      <span className="text-base font-extrabold text-slate-900">$29.99<span className="text-xs font-normal text-slate-500">/seat</span></span>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-1.5 my-3">
                      <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-600" /> Multi-user Clerk Org RBAC</li>
                      <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-600" /> Shared collaborative graphs</li>
                      <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-600" /> Centralized team billing</li>
                    </ul>
                    {subscriptionTier === 'team' ? (
                      <span className="block text-center py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100/60 rounded-md">
                        Current Plan
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpgradeTier('team')}
                        disabled={Boolean(actionLoading)}
                        className="w-full py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center justify-center gap-1"
                      >
                        {actionLoading === 'team' ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpRight size={12} />}
                        <span>Upgrade to Team</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Consumption Rates Reference Table */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Transparent Consumption Rates
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <MessageCircle size={15} className="mx-auto text-indigo-600 mb-1" />
                    <span className="text-sm font-bold text-slate-900 block">1 Credit</span>
                    <span className="text-[11px] text-slate-500">Graph Chat Inquiry</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <Zap size={15} className="mx-auto text-emerald-600 mb-1" />
                    <span className="text-sm font-bold text-slate-900 block">5 Credits</span>
                    <span className="text-[11px] text-slate-500">Quick Web Research</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <Sparkles size={15} className="mx-auto text-purple-600 mb-1" />
                    <span className="text-sm font-bold text-slate-900 block">20 Credits</span>
                    <span className="text-[11px] text-slate-500">Deep Multi-Hop Run</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <FileText size={15} className="mx-auto text-amber-600 mb-1" />
                    <span className="text-sm font-bold text-slate-900 block">2 Credits</span>
                    <span className="text-[11px] text-slate-500">PDF Extraction / Page</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* History & Transparency Log Tab */
            <div>
              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-indigo-600" />
                  <span className="text-xs">Loading transaction ledger…</span>
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Layers size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium">No transactions recorded yet.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Your actions across graph chat, deep research, and credit refills will appear here.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3 text-right">Credits</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map(tx => {
                        const isPositive = tx.amount > 0;
                        const dateFormatted = new Date(tx.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{dateFormatted}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800 capitalize">
                                {tx.action.replace('_', ' ')}
                              </span>
                              {tx.metadata && (
                                <span className="block text-[10.5px] text-slate-400 truncate max-w-xs">
                                  {tx.metadata}
                                </span>
                              )}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                              isPositive ? 'text-emerald-600' : 'text-slate-700'
                            }`}>
                              {isPositive ? `+${tx.amount}` : tx.amount}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-500 whitespace-nowrap">
                              {tx.balanceAfter.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500">
          <span>Encrypted with Stripe 256-bit SSL</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
