"use client";

import Link from "next/link";

const plans = [
  {
    name: "Zentro Free",
    price: "€0",
    description: "Basic fitness experience.",
    features: [
      "1 workout program",
      "3 workouts per week",
      "Basic nutrition tracker",
      "7-day history",
      "Basic progress tracking",
    ],
    button: "Current plan",
    pro: false,
  },
  {
    name: "Zentro Pro",
    price: "€7.99",
    description: "Complete fitness experience.",
    features: [
      "Unlimited workouts",
      "AI Coach",
      "Advanced analytics",
      "Progress photos",
      "Achievements",
      "Premium notifications",
      "Unlimited nutrition tracking",
      "Priority updates",
    ],
    button: "Upgrade to Pro",
    pro: true,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#050507] px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm font-bold tracking-[0.25em] text-purple-400">
            PRICING
          </p>

          <h1 className="mt-4 text-5xl font-black">
            Choose your plan
          </h1>

          <p className="mt-5 text-zinc-500">
            Unlock your full potential with Zentro Pro.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-[32px] border p-8 ${
                plan.pro
                  ? "border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-black"
                  : "border-white/[0.08] bg-white/[0.02]"
              }`}
            >
              {plan.pro && (
                <div className="mb-5 inline-flex rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                  MOST POPULAR
                </div>
              )}

              <h2 className="text-3xl font-black">
                {plan.name}
              </h2>

              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl font-black">
                  {plan.price}
                </span>

                <span className="pb-2 text-zinc-500">
                  /month
                </span>
              </div>

              <p className="mt-5 text-zinc-400">
                {plan.description}
              </p>

              <ul className="mt-8 space-y-4">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-3"
                  >
                    <span className="text-purple-400">
                      ✓
                    </span>

                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.pro ? "/checkout" : "/dashboard"}
                className={`mt-10 block rounded-2xl px-6 py-4 text-center font-bold transition ${
                  plan.pro
                    ? "bg-gradient-to-r from-purple-600 to-violet-500"
                    : "border border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                {plan.button}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
