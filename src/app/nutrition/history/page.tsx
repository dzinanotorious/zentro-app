"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type FoodScan = {
  id: string;
  meal_name: string;
  description: string | null;
  total_calories: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fiber_g: number;
  portion_estimate: string | null;
  confidence: string | null;
  ingredients: Array<{
    name?: string;
    estimated_amount?: string;
    estimated_grams?: number;
    estimated_calories?: number;
  }>;
  assumptions: string[];
  warnings: string[];
  scanned_at: string;
};

type DailyGroup = {
  dateKey: string;
  label: string;
  scans: FoodScan[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
};

function round(value: number) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export default function NutritionHistoryPage() {
  const router = useRouter();

  const [scans, setScans] = useState<FoodScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error: historyError } = await supabase
        .from("food_scan_history")
        .select(`
          id,
          meal_name,
          description,
          total_calories,
          protein_g,
          carbohydrates_g,
          fat_g,
          fiber_g,
          portion_estimate,
          confidence,
          ingredients,
          assumptions,
          warnings,
          scanned_at
        `)
        .eq("user_id", user.id)
        .order("scanned_at", {
          ascending: false,
        });

      if (historyError) {
        setError(historyError.message);
        setLoading(false);
        return;
      }

      setScans((data ?? []) as FoodScan[]);
      setLoading(false);
    }

    void loadHistory();
  }, [router]);

  const groups = useMemo<DailyGroup[]>(() => {
    const grouped = new Map<string, FoodScan[]>();

    scans.forEach((scan) => {
      const dateKey = new Date(scan.scanned_at)
        .toISOString()
        .slice(0, 10);

      const existing = grouped.get(dateKey) ?? [];
      grouped.set(dateKey, [...existing, scan]);
    });

    return Array.from(grouped.entries()).map(
      ([dateKey, dailyScans]) => ({
        dateKey,
        label: formatDateLabel(dateKey),
        scans: dailyScans,
        totals: dailyScans.reduce(
          (sum, scan) => ({
            calories:
              sum.calories +
              Number(scan.total_calories || 0),
            protein:
              sum.protein +
              Number(scan.protein_g || 0),
            carbs:
              sum.carbs +
              Number(scan.carbohydrates_g || 0),
            fat:
              sum.fat +
              Number(scan.fat_g || 0),
            fiber:
              sum.fiber +
              Number(scan.fiber_g || 0),
          }),
          {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
          },
        ),
      }),
    );
  }, [scans]);

  const today = groups.find(
    (group) =>
      group.dateKey ===
      new Date().toISOString().slice(0, 10),
  );

  async function deleteScan(scanId: string) {
    const confirmed = window.confirm(
      "Delete this scanned meal from your history?",
    );

    if (!confirmed) return;

    setDeletingId(scanId);
    setError("");

    const { error: deleteError } = await supabase
      .from("food_scan_history")
      .delete()
      .eq("id", scanId);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingId("");
      return;
    }

    setScans((current) =>
      current.filter((scan) => scan.id !== scanId),
    );

    setDeletingId("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

          <p className="mt-5 text-sm text-zinc-400">
            Loading nutrition history...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] px-5 py-8 text-white sm:px-8 lg:py-12">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[10%] top-[-350px] h-[760px] w-[760px] rounded-full bg-purple-700/20 blur-[180px]" />
        <div className="absolute -right-72 bottom-[-260px] h-[650px] w-[650px] rounded-full bg-emerald-900/10 blur-[170px]" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
              SMART NUTRITION
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
              Nutrition history
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-zinc-500">
              Review every AI-scanned meal, your daily calorie totals
              and macro intake.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-3 text-sm font-bold text-zinc-400 transition hover:border-purple-500/25 hover:text-white"
            >
              ← Dashboard
            </Link>

            <Link
              href="/nutrition/scan"
              className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.18)] transition hover:scale-[1.02]"
            >
              Scan new meal
            </Link>
          </div>
        </header>

        {error && (
          <div className="mt-7 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Today"
            value={`${round(
              today?.totals.calories ?? 0,
            )} kcal`}
            helper={`${today?.scans.length ?? 0} meals`}
          />

          <SummaryCard
            label="Protein"
            value={`${round(
              today?.totals.protein ?? 0,
            )} g`}
            helper="today"
          />

          <SummaryCard
            label="Carbs"
            value={`${round(
              today?.totals.carbs ?? 0,
            )} g`}
            helper="today"
          />

          <SummaryCard
            label="Fat"
            value={`${round(
              today?.totals.fat ?? 0,
            )} g`}
            helper="today"
          />

          <SummaryCard
            label="Fiber"
            value={`${round(
              today?.totals.fiber ?? 0,
            )} g`}
            helper="today"
          />
        </section>

        {groups.length === 0 ? (
          <section className="mt-10 rounded-[34px] border border-dashed border-white/[0.1] bg-white/[0.02] p-10 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-purple-500/10 text-3xl text-purple-300">
              ◉
            </div>

            <h2 className="mt-6 text-3xl font-black">
              No scanned meals yet
            </h2>

            <p className="mx-auto mt-4 max-w-xl leading-7 text-zinc-500">
              Scan your first meal and Zentro will automatically save
              calories, macros and ingredients here.
            </p>

            <Link
              href="/nutrition/scan"
              className="mt-7 inline-block rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-7 py-4 font-bold"
            >
              Scan your first meal
            </Link>
          </section>
        ) : (
          <div className="mt-10 space-y-8">
            {groups.map((group) => (
              <section key={group.dateKey}>
                <div className="flex flex-col justify-between gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-bold tracking-[0.18em] text-purple-400">
                      {group.dateKey}
                    </p>

                    <h2 className="mt-2 text-2xl font-black">
                      {group.label}
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <DailyTotal
                      label="Calories"
                      value={`${round(
                        group.totals.calories,
                      )} kcal`}
                    />

                    <DailyTotal
                      label="Protein"
                      value={`${round(
                        group.totals.protein,
                      )} g`}
                    />

                    <DailyTotal
                      label="Carbs"
                      value={`${round(
                        group.totals.carbs,
                      )} g`}
                    />

                    <DailyTotal
                      label="Fat"
                      value={`${round(
                        group.totals.fat,
                      )} g`}
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  {group.scans.map((scan) => (
                    <article
                      key={scan.id}
                      className="rounded-[30px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 transition hover:border-purple-500/20"
                    >
                      <div className="flex items-start justify-between gap-5">
                        <div>
                          <p className="text-xs font-bold tracking-[0.14em] text-zinc-600">
                            {formatTime(scan.scanned_at)}
                          </p>

                          <h3 className="mt-2 text-2xl font-black">
                            {scan.meal_name}
                          </h3>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-black text-purple-300">
                            {round(scan.total_calories)}
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">
                            kcal
                          </p>
                        </div>
                      </div>

                      {scan.description && (
                        <p className="mt-4 text-sm leading-6 text-zinc-500">
                          {scan.description}
                        </p>
                      )}

                      <div className="mt-6 grid grid-cols-4 gap-2">
                        <MiniMacro
                          label="Protein"
                          value={`${round(scan.protein_g)}g`}
                        />

                        <MiniMacro
                          label="Carbs"
                          value={`${round(
                            scan.carbohydrates_g,
                          )}g`}
                        />

                        <MiniMacro
                          label="Fat"
                          value={`${round(scan.fat_g)}g`}
                        />

                        <MiniMacro
                          label="Fiber"
                          value={`${round(scan.fiber_g)}g`}
                        />
                      </div>

                      {scan.ingredients?.length > 0 && (
                        <div className="mt-6">
                          <p className="text-xs font-bold tracking-[0.14em] text-zinc-600">
                            INGREDIENTS
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {scan.ingredients
                              .slice(0, 6)
                              .map((ingredient, index) => (
                                <span
                                  key={`${scan.id}-${ingredient.name}-${index}`}
                                  className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400"
                                >
                                  {ingredient.name ||
                                    "Ingredient"}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              scan.confidence === "high"
                                ? "bg-emerald-400"
                                : scan.confidence ===
                                    "medium"
                                  ? "bg-amber-400"
                                  : "bg-red-400"
                            }`}
                          />

                          <span className="text-xs text-zinc-600">
                            {scan.confidence || "unknown"} confidence
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={deletingId === scan.id}
                          onClick={() =>
                            void deleteScan(scan.id)
                          }
                          className="rounded-xl border border-red-500/15 bg-red-500/[0.05] px-4 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {deletingId === scan.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
      <p className="text-sm text-zinc-500">{label}</p>

      <p className="mt-3 text-2xl font-black">{value}</p>

      <p className="mt-2 text-xs text-zinc-700">{helper}</p>
    </article>
  );
}

function DailyTotal({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-2">
      <span className="text-zinc-600">{label}: </span>
      <span className="font-bold text-zinc-300">{value}</span>
    </div>
  );
}

function MiniMacro({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-center">
      <p className="text-[10px] text-zinc-600">{label}</p>

      <p className="mt-2 text-sm font-black">{value}</p>
    </div>
  );
}
