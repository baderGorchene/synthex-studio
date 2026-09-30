'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { CreditTransaction } from '@/lib/db';
import { CREDIT_RATES, REFILL_PACKS, SUBSCRIPTION_TIERS, TIER_CREDIT_QUOTAS } from '@/lib/plans';

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
        window.location.assign(data.url);
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
        window.location.assign(data.url);
      }
    } catch (err) {
      console.error('Upgrade checkout failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const tierMaxCredits = TIER_CREDIT_QUOTAS[subscriptionTier as keyof typeof TIER_CREDIT_QUOTAS] || TIER_CREDIT_QUOTAS.trial;
  const currentPlan = SUBSCRIPTION_TIERS[subscriptionTier] || SUBSCRIPTION_TIERS.trial;
  const refill = REFILL_PACKS.refill_500;
  const usd = (value: number) => `$${value.toFixed(2)}`;
  const rates: Array<[string, number]> = [
    ['Ask AI question', CREDIT_RATES.chat],
    ['Quick research', CREDIT_RATES.quick_research],
    ['Deep research', CREDIT_RATES.deep_research],
    ['PDF page read', CREDIT_RATES.pdf_extract]
  ];

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="work-modal billing-modal" role="dialog" aria-modal="true" aria-labelledby="credits-title">
        <div className="billing-head">
          <div>
            <h2 id="credits-title">Credits</h2>
            <p className="note-meta">{currentPlan.name} · {tierMaxCredits.toLocaleString()} a month</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <p className="billing-balance"><strong>{currentBalance.toLocaleString()}</strong> <span>credits left</span></p>

        <div className="view-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={activeTab === 'refill'} className={activeTab === 'refill' ? 'active' : ''} onClick={() => setActiveTab('refill')}>Top up and plans</button>
          <button type="button" role="tab" aria-selected={activeTab === 'history'} className={activeTab === 'history' ? 'active' : ''} onClick={handleSwitchToHistory}>History</button>
        </div>

        <div className="billing-body">
          {activeTab === 'refill' ? (
            <>
              <div className="billing-row">
                <div>
                  <strong>{refill.credits.toLocaleString()} credits</strong>
                  <span className="note-meta">Added right away. Your plan stays the same.</span>
                </div>
                <span className="billing-price">{usd(refill.priceUsd)}</span>
                <button type="button" className="line-button" onClick={handleRefillPack} disabled={Boolean(actionLoading)}>
                  {actionLoading === 'refill_500' ? 'Opening checkout…' : 'Top up'}
                </button>
              </div>

              <div className="plan-columns">
                {(['pro', 'team'] as const).map(id => {
                  const plan = SUBSCRIPTION_TIERS[id];
                  const isCurrent = subscriptionTier === id;
                  return (
                    <div key={id} className={`plan-column ${id === 'pro' ? 'is-recommended' : ''}`}>
                      <h3>{plan.name}</h3>
                      <p className="plan-price"><strong>{usd(plan.priceMonthlyUsd)}</strong> <span>{plan.perSeat ? 'per seat a month' : 'a month'}</span></p>
                      <p className="note-meta">{plan.creditsMonthly.toLocaleString()} credits a month</p>
                      <ul className="plan-features">
                        {plan.features.map(feature => <li key={feature}>{feature}</li>)}
                      </ul>
                      {isCurrent ? (
                        <p className="plan-current">Your plan</p>
                      ) : (
                        <button type="button" className={id === 'pro' ? 'ink-button' : 'line-button'} onClick={() => handleUpgradeTier(id)} disabled={Boolean(actionLoading)}>
                          {actionLoading === id ? 'Opening checkout…' : `Switch to ${plan.name}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="billing-rates">
                <h3>What things cost</h3>
                <dl>
                  {rates.map(([label, value]) => (
                    <div key={label}><dt>{label}</dt><dd>{value} {value === 1 ? 'credit' : 'credits'}</dd></div>
                  ))}
                </dl>
              </div>
            </>
          ) : loadingHistory ? (
            <p className="billing-empty">Loading your history…</p>
          ) : transactions.length === 0 ? (
            <p className="billing-empty">Nothing yet. Questions, research runs and top-ups show up here.</p>
          ) : (
            <div className="view-table-wrap">
              <table className="view-table">
                <thead>
                  <tr><th scope="col">Date</th><th scope="col">What</th><th scope="col" className="num">Credits</th><th scope="col" className="num">Balance</th></tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td>{new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <span className="billing-action">{tx.action.replace('_', ' ')}</span>
                        {tx.metadata && <span className="note-meta billing-tx-meta">{tx.metadata}</span>}
                      </td>
                      <td className="num">{tx.amount > 0 ? `+${tx.amount}` : tx.amount}</td>
                      <td className="num">{tx.balanceAfter.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="billing-foot">
          <span className="note-meta">Payments are handled by Stripe.</span>
          <button type="button" className="text-button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
};
