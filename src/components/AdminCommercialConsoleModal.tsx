import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Server, Sparkles, AlertTriangle, Receipt, Building2, CheckCircle2, Check } from 'lucide-react';
import { apiFetchWithAuth, fetchBillingInvoices } from '../services/workspaceService';

export interface AdminCommercialConsoleModalProps {
  isOpen: boolean;
  subscriptionTier: 'free' | 'pro' | 'institute';
  subscriptionStatus: string;
  paymentsConfigured: boolean;
  billingError: string | null;
  billingCycle: 'monthly' | 'annual';
  onChangeBillingCycle: (cycle: 'monthly' | 'annual') => void;
  onStartCheckout: (planId?: 'pro_aspirant' | 'institute_cohort') => Promise<void> | void;
  onClose: () => void;
}

export const AdminCommercialConsoleModal: React.FC<
  AdminCommercialConsoleModalProps
> = ({
  isOpen,
  subscriptionTier,
  subscriptionStatus,
  paymentsConfigured,
  billingError,
  billingCycle,
  onChangeBillingCycle,
  onStartCheckout,
  onClose,
}) => {
  const [submittingPlan, setSubmittingPlan] = useState<'pro_aspirant' | 'institute_cohort' | null>(null);
  const [waitlistJoined, setWaitlistJoined] = useState<Record<string, boolean>>({});
  const [waitlistBanner, setWaitlistBanner] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<
    {
      invoiceId: string;
      planId: string;
      amountInr: number;
      currency: string;
      status: string;
      createdAtIso: string;
    }[]
  >([]);

  useEffect(() => {
    if (!isOpen) return;
    fetchBillingInvoices()
      .then((res) => {
        if (res.ok && res.data?.invoices) {
          setInvoices(res.data.invoices);
        }
      })
      .catch(() => {});
  }, [isOpen, subscriptionTier]);

  if (!isOpen) return null;

  const triggerCheckout = async (planId: 'pro_aspirant' | 'institute_cohort') => {
    setSubmittingPlan(planId);
    try {
      if (!paymentsConfigured) {
        const res = await apiFetchWithAuth('/api/commercial/waitlist', {
          planId,
          billingCycle,
        });
        setWaitlistJoined((prev) => ({ ...prev, [planId]: true }));
        setWaitlistBanner(
          res.ok
            ? 'You are on the LearnMate Pro Early Access waitlist! We will notify you as soon as online plans launch.'
            : 'Early Access interest recorded locally — sign in with Google or Email to reserve priority launch pricing.'
        );
        return;
      }
      await onStartCheckout(planId);
    } finally {
      setSubmittingPlan(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="LearnMate Plans and Billing"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-2xl w-full max-w-4xl p-6 space-y-5 text-zinc-900 dark:text-zinc-100 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.07] pb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-600 dark:text-amber-400 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {paymentsConfigured ? 'Plans & Billing' : 'Early Access Preview'}
            </div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] mt-1">
              LearnMate JEE Plans · <span className="font-mono text-sm uppercase">{subscriptionTier}</span> ({subscriptionStatus})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Pro Modal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-zinc-50 dark:bg-[#18181b] p-3 rounded-xl border border-zinc-200 dark:border-white/[0.07]">
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Plan Availability:{' '}
              <strong className={paymentsConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'}>
                {paymentsConfigured
                  ? 'Live Checkout Ready'
                  : 'Early Access Preview · Pro Launching Soon'}
              </strong>
            </span>
          </div>
          <div className="inline-flex rounded-xl bg-white dark:bg-[#111113] p-1 border border-zinc-200 dark:border-white/[0.07] text-xs font-medium">
            <button
              type="button"
              onClick={() => onChangeBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-[#1C1917] text-[#FAF8F5] dark:bg-[#F5F0E6] dark:text-[#09090B] font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => onChangeBillingCycle('annual')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                billingCycle === 'annual'
                  ? 'bg-[#1C1917] text-[#FAF8F5] dark:bg-[#F5F0E6] dark:text-[#09090B] font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Annual Exam Pass (Save 50%)
            </button>
          </div>
        </div>

        {waitlistBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Early Access Waitlist Confirmed</div>
              <p className="mt-0.5">{waitlistBanner}</p>
            </div>
          </div>
        )}

        {paymentsConfigured && billingError && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Billing Notice</div>
              <p className="mt-0.5">{billingError}</p>
            </div>
          </div>
        )}

        {/* Free vs Pro vs Institute Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-5 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Free Aspirant</span>
                <span className="font-mono tabular-nums font-bold text-base text-zinc-800 dark:text-zinc-100">
                  ₹0
                </span>
              </div>
              <ul className="space-y-2 text-zinc-600 dark:text-zinc-300">
                <li>· 20 AI Tutor queries / day</li>
                <li>· Official PYQ Bank &amp; Notes</li>
                <li>· 2 Full CBT Mock Tests / mo</li>
                <li>· Local Storage &amp; Mistake Book</li>
              </ul>
            </div>
            <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.07] text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {subscriptionTier === 'free' ? 'Current Active Tier' : 'Included in account'}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-zinc-900 dark:border-white/25 bg-zinc-100/80 dark:bg-[#18181b] obsidian-sheen space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-zinc-900 dark:text-white">
                  Pro Aspirant
                </span>
                <span className="font-mono tabular-nums font-bold text-base text-zinc-900 dark:text-white">
                  {billingCycle === 'annual' ? '₹2,999 / yr' : '₹499 / mo'}
                </span>
              </div>
              <ul className="space-y-2 text-zinc-700 dark:text-zinc-200 font-medium">
                <li>· 250 AI Tutor queries / day · 60+ pg PDFs</li>
                <li>· Unlimited Proctored CBT Mocks</li>
                <li>· Live Voice AI Tutor</li>
                <li>· 2D Vector Diagram &amp; 3D WebGL Lab</li>
              </ul>
            </div>
            {subscriptionTier === 'pro' ? (
              <div className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-center font-semibold inline-flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Pro Aspirant Active
              </div>
            ) : !paymentsConfigured ? (
              <button
                type="button"
                disabled={submittingPlan !== null || waitlistJoined.pro_aspirant}
                onClick={() => triggerCheckout('pro_aspirant')}
                className={`w-full py-2.5 px-3 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-75 inline-flex items-center justify-center gap-1.5 ${
                  waitlistJoined.pro_aspirant
                    ? 'bg-emerald-600 text-white'
                    : 'btn-terracotta'
                }`}
              >
                {submittingPlan === 'pro_aspirant' ? (
                  'Joining Waitlist...'
                ) : waitlistJoined.pro_aspirant ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Joined Early Access Waitlist
                  </>
                ) : (
                  'Join Early Access'
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={submittingPlan !== null}
                onClick={() => triggerCheckout('pro_aspirant')}
                className="w-full py-2.5 rounded-lg btn-terracotta disabled:opacity-60 font-semibold transition-colors cursor-pointer"
              >
                {submittingPlan === 'pro_aspirant'
                  ? 'Contacting Billing Server...'
                  : 'Continue to Pro Checkout'}
              </button>
            )}
          </div>

          <div className="p-5 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  Institute Seat
                </span>
                <span className="font-mono tabular-nums font-bold text-base text-zinc-900 dark:text-white">
                  {billingCycle === 'annual' ? '₹14,999 / yr' : '₹1,999 / mo'}
                </span>
              </div>
              <ul className="space-y-2 text-zinc-600 dark:text-zinc-300">
                <li>· 1,000 AI queries / day per seat</li>
                <li>· Multi-batch analytics &amp; shared banks</li>
                <li>· Priority ingestion queue &amp; exports</li>
              </ul>
            </div>
            {subscriptionTier === 'institute' ? (
              <div className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-center font-semibold inline-flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Institute Seat Active
              </div>
            ) : !paymentsConfigured ? (
              <button
                type="button"
                disabled={submittingPlan !== null || waitlistJoined.institute_cohort}
                onClick={() => triggerCheckout('institute_cohort')}
                className={`w-full py-2.5 px-3 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-75 inline-flex items-center justify-center gap-1.5 ${
                  waitlistJoined.institute_cohort
                    ? 'bg-emerald-600 text-white'
                    : 'border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#111113] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] text-zinc-900 dark:text-white'
                }`}
              >
                {submittingPlan === 'institute_cohort' ? (
                  'Joining Waitlist...'
                ) : waitlistJoined.institute_cohort ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Institute Waitlist Joined
                  </>
                ) : (
                  'Join Early Access'
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={submittingPlan !== null}
                onClick={() => triggerCheckout('institute_cohort')}
                className="w-full py-2.5 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#111113] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] disabled:opacity-60 text-zinc-900 dark:text-white font-semibold transition-colors cursor-pointer"
              >
                {submittingPlan === 'institute_cohort'
                  ? 'Contacting Billing Server...'
                  : 'Institute Checkout'}
              </button>
            )}
          </div>
        </div>

        {/* Verified Invoices */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] space-y-2 text-xs">
          <div className="font-semibold flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
            <Receipt className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>Invoices ({invoices.length})</span>
          </div>
          {invoices.length === 0 ? (
            <div className="text-zinc-500 dark:text-zinc-400">
              No paid invoices on file yet.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-white/[0.07]">
              {invoices.map((inv) => (
                <div key={inv.invoiceId} className="py-1.5 flex items-center justify-between">
                  <span className="font-mono font-semibold">{inv.invoiceId}</span>
                  <span className="font-mono tabular-nums">
                    {inv.planId} · ₹{inv.amountInr} ({inv.status})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Server className="w-3.5 h-3.5 text-zinc-400" />
            Protected by Firebase Auth &amp; Verified Account Entitlements
          </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-200">LearnMate JEE</span>
        </div>
      </div>
    </div>
  );
};
