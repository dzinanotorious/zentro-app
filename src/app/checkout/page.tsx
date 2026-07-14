"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type BillingCycle = "monthly" | "yearly";

const planDetails = {
  monthly: {
    label: "Monthly",
    price: 7.99,
    billedText: "Billed every month",
  },
  yearly: {
    label: "Yearly",
    price: 69.99,
    billedText: "Billed once per year",
  },
};

const proFeatures = [
  "Unlimited workouts and full workout history",
  "AI Performance Coach",
  "Advanced progress and strength analytics",
  "Unlimited nutrition tracking",
  "Progress photos and body measurements",
  "All achievements, XP and ranks",
  "Premium workout programs",
  "Daily motivation and smart reminders",
];

export default function CheckoutPage() {
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>("yearly");
  const [redirecting, setRedirecting] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const selectedPlan = planDetails[billingCycle];

  const monthlyEquivalent = useMemo(() => {
    if (billingCycle === "monthly") {
      return selectedPlan.price;
    }

    return selectedPlan.price / 12;
  }, [billingCycle, selectedPlan.price]);

  const yearlySavings = useMemo(() => {
    const normalYearlyPrice = planDetails.monthly.price * 12;

    return normalYearlyPrice - planDetails.yearly.price;
  }, []);

  async function continueToPayment() {
    if (redirecting) return;

    setRedirecting(true);
    setPaymentError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login?redirect=/checkout";
        return;
      }

      const response = await fetch(
        "/api/stripe/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            billingCycle,
            userId: user.id,
            userEmail: user.email ?? "",
          }),
        },
      );

      const contentType =
        response.headers.get("content-type") ?? "";

      const data = contentType.includes("application/json")
        ? await response.json()
        : {
            error:
              "The payment server returned an invalid response.",
          };

      if (!response.ok || !data.url) {
        throw new Error(
          data.error ||
            "Could not create the Stripe checkout session.",
        );
      }

      window.location.assign(data.url);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not open Stripe checkout.";

      console.error("Checkout error:", error);
      setPaymentError(errorMessage);
      setRedirecting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050507] px-5 py-8 text-white sm:px-8 lg:py-12">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[8%] top-[-350px] h-[760px] w-[760px] rounded-full bg-purple-700/20 blur-[180px]" />
        <div className="absolute -right-72 bottom-[-260px] h-[650px] w-[650px] rounded-full bg-fuchsia-900/10 blur-[170px]" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 border-b border-white/[0.06] pb-7 sm:flex-row sm:items-center">
          <Link
            href="/pricing"
            className="text-sm font-bold text-zinc-500 transition hover:text-purple-300"
          >
            ← Back to pricing
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-400/25 bg-purple-500/10 font-black text-purple-300">
              Z
            </div>

            <div>
              <p className="font-black tracking-[0.2em]">
                ZENTRO
              </p>

              <p className="mt-1 text-[9px] tracking-[0.16em] text-zinc-600">
                SECURE CHECKOUT
              </p>
            </div>
          </div>
        </header>

        <section className="mt-10 grid gap-8 xl:grid-cols-[1fr_430px]">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
              UPGRADE YOUR EXPERIENCE
            </p>

            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
              Unlock everything with Zentro Pro.
            </h1>

            <p className="mt-5 max-w-2xl leading-8 text-zinc-500">
              Get the complete Zentro experience with advanced
              training, nutrition, progress and AI features.
            </p>

            <article className="mt-9 rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm text-zinc-500">
                    Select billing
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Choose your plan
                  </h2>
                </div>

                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300">
                  Cancel anytime
                </span>
              </div>

              <div className="mt-7 grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`relative rounded-3xl border p-6 text-left transition ${
                    billingCycle === "monthly"
                      ? "border-purple-500/35 bg-purple-500/10"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-purple-500/20"
                  }`}
                >
                  <p className="text-sm font-bold text-zinc-400">
                    Monthly
                  </p>

                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-4xl font-black">
                      €7.99
                    </span>

                    <span className="pb-1 text-sm text-zinc-600">
                      / month
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-zinc-600">
                    Flexible monthly billing with no long-term
                    commitment.
                  </p>

                  {billingCycle === "monthly" && (
                    <span className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-xs font-bold">
                      ✓
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  className={`relative rounded-3xl border p-6 text-left transition ${
                    billingCycle === "yearly"
                      ? "border-purple-500/35 bg-purple-500/10"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-purple-500/20"
                  }`}
                >
                  <span className="absolute right-5 top-5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[9px] font-bold text-amber-200">
                    BEST VALUE
                  </span>

                  <p className="text-sm font-bold text-zinc-400">
                    Yearly
                  </p>

                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-4xl font-black">
                      €69.99
                    </span>

                    <span className="pb-1 text-sm text-zinc-600">
                      / year
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-zinc-600">
                    Save €{yearlySavings.toFixed(2)} compared with
                    monthly billing.
                  </p>

                  {billingCycle === "yearly" && (
                    <span className="absolute bottom-5 right-5 flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-xs font-bold">
                      ✓
                    </span>
                  )}
                </button>
              </div>
            </article>

            <article className="mt-6 rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
              <p className="text-sm text-zinc-500">
                Included with Zentro Pro
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Everything you need to progress
              </h2>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {proFeatures.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-start gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/12 text-xs font-bold text-purple-300">
                      ✓
                    </span>

                    <p className="text-sm leading-6 text-zinc-400">
                      {feature}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <aside className="xl:sticky xl:top-8 xl:self-start">
            <article className="overflow-hidden rounded-[34px] border border-purple-500/20 bg-gradient-to-br from-purple-600/15 via-purple-950/10 to-[#0b0b10] p-7 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-purple-300">
                    Order summary
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Zentro Pro
                  </h2>
                </div>

                <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-[10px] font-bold text-purple-300">
                  {selectedPlan.label.toUpperCase()}
                </span>
              </div>

              <div className="mt-7 rounded-3xl border border-white/[0.07] bg-black/25 p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-zinc-500">
                      Total today
                    </p>

                    <p className="mt-2 text-4xl font-black">
                      €{selectedPlan.price.toFixed(2)}
                    </p>
                  </div>

                  <p className="text-right text-xs leading-5 text-zinc-600">
                    {selectedPlan.billedText}
                  </p>
                </div>

                {billingCycle === "yearly" && (
                  <div className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
                    <p className="text-sm font-bold text-emerald-300">
                      Only €{monthlyEquivalent.toFixed(2)} per month
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      You save €{yearlySavings.toFixed(2)} every year.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-4 border-y border-white/[0.06] py-6 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">
                    Subscription
                  </span>

                  <span className="font-semibold">
                    Zentro Pro
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">
                    Billing cycle
                  </span>

                  <span className="font-semibold">
                    {selectedPlan.label}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">
                    Renewal
                  </span>

                  <span className="font-semibold">
                    Automatic
                  </span>
                </div>
              </div>

              {paymentError && (
                <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
                  {paymentError}
                </div>
              )}

              <button
                type="button"
                onClick={continueToPayment}
                disabled={redirecting}
                className="mt-7 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 font-black shadow-[0_0_35px_rgba(139,92,246,0.2)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {redirecting
                  ? "Opening secure payment..."
                  : "Continue to secure payment"}
              </button>

              <p className="mt-5 text-center text-[10px] leading-5 text-zinc-700">
                By continuing, you agree to the Zentro Terms and
                Privacy Policy. Payments will be processed securely
                through Stripe.
              </p>
            </article>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <TrustCard value="SSL" label="Secure" />
              <TrustCard value="7D" label="Trial ready" />
              <TrustCard value="24/7" label="Access" />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function TrustCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-center">
      <p className="font-black text-purple-300">
        {value}
      </p>

      <p className="mt-1 text-[10px] text-zinc-600">
        {label}
      </p>
    </div>
  );
}
