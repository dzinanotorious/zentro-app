"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AdminOverview = {
  generatedAt: string;
  totals: {
    users: number;
    proUsers: number;
    freeUsers: number;
    activeSubscriptions: number;
    monthlySubscribers: number;
    yearlySubscribers: number;
    estimatedMrrEur: number;
    estimatedArrEur: number;
    aiCoachMessagesToday: number;
    foodScansToday: number;
    foodScansAllTime: number;
    pushSubscriptions: number;
    nutritionLogsToday: number;
    conversationsAllTime: number;
  };
  recentUsers: Array<{
    id: string;
    email: string | null;
    fullName: string | null;
    createdAt: string | null;
    isAdmin: boolean;
    planCode: string;
    subscriptionStatus: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: "coach" | "food_scan" | "subscription";
    title: string;
    description: string;
    createdAt: string;
  }>;
};

type ApiError = {
  error?: string;
};

const EMPTY_OVERVIEW: AdminOverview = {
  generatedAt: new Date(0).toISOString(),
  totals: {
    users: 0,
    proUsers: 0,
    freeUsers: 0,
    activeSubscriptions: 0,
    monthlySubscribers: 0,
    yearlySubscribers: 0,
    estimatedMrrEur: 0,
    estimatedArrEur: 0,
    aiCoachMessagesToday: 0,
    foodScansToday: 0,
    foodScansAllTime: 0,
    pushSubscriptions: 0,
    nutritionLogsToday: 0,
    conversationsAllTime: 0,
  },
  recentUsers: [],
  recentActivity: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function activityIcon(type: AdminOverview["recentActivity"][number]["type"]) {
  if (type === "coach") return "AI";
  if (type === "food_scan") return "◉";
  return "€";
}

export default function AdminPage() {
  const router = useRouter();

  const [overview, setOverview] =
    useState<AdminOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOverview = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          router.replace("/login");
          return;
        }

        const response = await fetch("/api/admin/overview", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        const contentType =
          response.headers.get("content-type") ?? "";

        const result = contentType.includes("application/json")
          ? ((await response.json()) as AdminOverview & ApiError)
          : ({
              error: `Server returned ${response.status}.`,
            } as ApiError);

        if (response.status === 403) {
          router.replace("/dashboard");
          return;
        }

        if (!response.ok || "error" in result) {
          throw new Error(
            result.error || "Could not load admin overview.",
          );
        }

        setOverview(result as AdminOverview);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load admin overview.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const proConversion = useMemo(() => {
    if (overview.totals.users === 0) return 0;

    return Math.round(
      (overview.totals.proUsers / overview.totals.users) * 100,
    );
  }, [overview.totals.proUsers, overview.totals.users]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="mt-5 text-sm text-zinc-400">
            Loading Zentro admin...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[8%] top-[-380px] h-[800px] w-[800px] rounded-full bg-purple-700/20 blur-[190px]" />
        <div className="absolute -right-80 top-[30%] h-[720px] w-[720px] rounded-full bg-fuchsia-900/10 blur-[180px]" />
        <div className="absolute bottom-[-350px] left-[35%] h-[650px] w-[650px] rounded-full bg-emerald-900/10 blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-6 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
              ZENTRO CONTROL CENTER
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
              Admin dashboard
            </h1>

            <p className="mt-4 max-w-3xl leading-7 text-zinc-500">
              Monitor users, subscriptions, revenue, AI usage,
              nutrition activity and push delivery from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadOverview(true)}
              disabled={refreshing}
              className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.18)] disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh data"}
            </button>

            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-bold text-zinc-300"
            >
              ← User dashboard
            </Link>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total users"
            value={overview.totals.users.toLocaleString()}
            helper={`${overview.totals.freeUsers} free users`}
            icon="U"
          />

          <MetricCard
            label="Active Pro users"
            value={overview.totals.proUsers.toLocaleString()}
            helper={`${proConversion}% conversion`}
            icon="P"
            accent
          />

          <MetricCard
            label="Estimated MRR"
            value={formatCurrency(
              overview.totals.estimatedMrrEur,
            )}
            helper={`${overview.totals.activeSubscriptions} active subscriptions`}
            icon="€"
            accent
          />

          <MetricCard
            label="Estimated ARR"
            value={formatCurrency(
              overview.totals.estimatedArrEur,
            )}
            helper="Based on current active plans"
            icon="↗"
          />
        </section>

        <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="AI Coach today"
            value={overview.totals.aiCoachMessagesToday.toLocaleString()}
            helper="Messages consumed today"
            icon="AI"
          />

          <MetricCard
            label="Food scans today"
            value={overview.totals.foodScansToday.toLocaleString()}
            helper={`${overview.totals.foodScansAllTime} all time`}
            icon="◉"
          />

          <MetricCard
            label="Push subscriptions"
            value={overview.totals.pushSubscriptions.toLocaleString()}
            helper="Connected browser devices"
            icon="N"
          />

          <MetricCard
            label="Nutrition logs today"
            value={overview.totals.nutritionLogsToday.toLocaleString()}
            helper={`${overview.totals.conversationsAllTime} AI conversations total`}
            icon="◎"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <article className="rounded-[34px] border border-purple-500/15 bg-gradient-to-br from-purple-600/15 via-purple-950/10 to-[#0b0b10] p-7 sm:p-9">
            <p className="text-xs font-bold tracking-[0.18em] text-purple-400">
              SUBSCRIPTION HEALTH
            </p>

            <h2 className="mt-3 text-2xl font-black">
              Revenue mix
            </h2>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <SmallMetric
                label="Monthly plans"
                value={`${overview.totals.monthlySubscribers}`}
              />

              <SmallMetric
                label="Yearly plans"
                value={`${overview.totals.yearlySubscribers}`}
              />

              <SmallMetric
                label="Active subscriptions"
                value={`${overview.totals.activeSubscriptions}`}
              />

              <SmallMetric
                label="Free users"
                value={`${overview.totals.freeUsers}`}
              />
            </div>

            <div className="mt-8 rounded-3xl border border-white/[0.07] bg-black/20 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">
                  Pro conversion rate
                </span>
                <span className="font-black text-purple-300">
                  {proConversion}%
                </span>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-400"
                  style={{
                    width: `${Math.min(proConversion, 100)}%`,
                  }}
                />
              </div>
            </div>

            <p className="mt-6 text-xs leading-6 text-zinc-700">
              Revenue values are estimates based on €9.99 monthly and
              €99.99 yearly subscriptions. Stripe remains the source of
              truth for payouts, refunds and fees.
            </p>
          </article>

          <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7 sm:p-9">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-sm text-zinc-500">
                  Platform activity
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Recent events
                </h2>
              </div>

              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-300">
                LIVE DATA
              </span>
            </div>

            <div className="mt-7 space-y-3">
              {overview.recentActivity.map((activity) => (
                <div
                  key={`${activity.type}-${activity.id}`}
                  className="flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-xs font-black text-purple-300">
                    {activityIcon(activity.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{activity.title}</p>
                    <p className="mt-1 truncate text-sm text-zinc-600">
                      {activity.description}
                    </p>
                  </div>

                  <p className="shrink-0 text-[10px] text-zinc-700">
                    {formatDateTime(activity.createdAt)}
                  </p>
                </div>
              ))}

              {overview.recentActivity.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center text-sm text-zinc-600">
                  No recent activity yet.
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="mt-6 rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7 sm:p-9">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm text-zinc-500">
                New registrations
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Recent users
              </h2>
            </div>

            <p className="text-xs text-zinc-700">
              Updated {formatDateTime(overview.generatedAt)}
            </p>
          </div>

          <div className="mt-7 overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07] text-xs text-zinc-600">
                  <th className="px-4 py-4 font-semibold">User</th>
                  <th className="px-4 py-4 font-semibold">Email</th>
                  <th className="px-4 py-4 font-semibold">Plan</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">
                    Registered
                  </th>
                  <th className="px-4 py-4 font-semibold">Role</th>
                </tr>
              </thead>

              <tbody>
                {overview.recentUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-white/[0.05] text-sm last:border-none"
                  >
                    <td className="px-4 py-5 font-bold text-zinc-300">
                      {user.fullName || "Zentro Athlete"}
                    </td>

                    <td className="px-4 py-5 text-zinc-500">
                      {user.email || "No email"}
                    </td>

                    <td className="px-4 py-5">
                      <StatusBadge
                        value={user.planCode.toUpperCase()}
                        positive={user.planCode === "pro"}
                      />
                    </td>

                    <td className="px-4 py-5">
                      <StatusBadge
                        value={user.subscriptionStatus}
                        positive={["active", "trialing"].includes(
                          user.subscriptionStatus,
                        )}
                      />
                    </td>

                    <td className="px-4 py-5 text-zinc-600">
                      {formatDateTime(user.createdAt)}
                    </td>

                    <td className="px-4 py-5">
                      <StatusBadge
                        value={user.isAdmin ? "ADMIN" : "USER"}
                        positive={user.isAdmin}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {overview.recentUsers.length === 0 && (
              <div className="py-12 text-center text-sm text-zinc-600">
                No users found.
              </div>
            )}
          </div>
        </section>

        <footer className="mt-10 flex flex-col justify-between gap-4 border-t border-white/[0.05] py-7 text-xs text-zinc-700 sm:flex-row">
          <p>© 2026 ZENTRO Admin Control Center.</p>
          <p>
            Admin data is server-protected and never exposed through
            the public client key.
          </p>
        </footer>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  helper: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border p-6 ${
        accent
          ? "border-purple-500/20 bg-gradient-to-br from-purple-600/15 to-transparent"
          : "border-white/[0.07] bg-white/[0.025]"
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-sm font-black text-purple-300">
        {icon}
      </div>

      <p className="mt-6 text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-3 text-xs text-zinc-700">{helper}</p>
    </article>
  );
}

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-5">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function StatusBadge({
  value,
  positive,
}: {
  value: string;
  positive: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold ${
        positive
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border-white/[0.08] bg-white/[0.03] text-zinc-500"
      }`}
    >
      {value}
    </span>
  );
}
