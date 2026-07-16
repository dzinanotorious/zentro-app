"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Usage = {
  used: number;
  limit: number;
  remaining: number;
};

type FoodIngredient = {
  name: string;
  estimated_amount: string;
  estimated_grams: number;
  estimated_calories: number;
};

type FoodAnalysis = {
  is_food: boolean;
  meal_name: string;
  description: string;
  portion_estimate: string;
  total_calories: number;
  calorie_range: {
    minimum: number;
    maximum: number;
  };
  macros: {
    protein_g: number;
    carbohydrates_g: number;
    fat_g: number;
    fiber_g: number;
  };
  ingredients: FoodIngredient[];
  confidence: "low" | "medium" | "high";
  assumptions: string[];
  warnings: string[];
};

type AnalyzeFoodResponse = {
  success?: boolean;
  analysis?: FoodAnalysis;
  scanId?: string | null;
  usage?: Usage;
  error?: string;
  code?: string;
};

const DAILY_SCAN_LIMIT = 2;
const MAX_FILE_SIZE_BYTES =
  10 * 1024 * 1024;

export default function NutritionScanPage() {
  const router = useRouter();

  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [imagePreview, setImagePreview] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [loadingUsage, setLoadingUsage] =
    useState(true);

  const [error, setError] =
    useState("");

  const [analysis, setAnalysis] =
    useState<FoodAnalysis | null>(
      null,
    );

  const [usage, setUsage] =
    useState<Usage>({
      used: 0,
      limit: DAILY_SCAN_LIMIT,
      remaining: DAILY_SCAN_LIMIT,
    });

  useEffect(() => {
    async function loadUsage() {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      /*
       * Supabase SQL uses current_date in UTC.
       * Keep this lookup on the same UTC date.
       */
      const today = new Date()
        .toISOString()
        .slice(0, 10);

      const {
        data,
        error: usageError,
      } = await supabase
        .from("user_ai_usage")
        .select("food_scans_used")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (usageError) {
        console.error(
          "Could not load food scan usage:",
          usageError,
        );
      }

      const used = Number(
        data?.food_scans_used ?? 0,
      );

      setUsage({
        used,
        limit: DAILY_SCAN_LIMIT,
        remaining: Math.max(
          DAILY_SCAN_LIMIT - used,
          0,
        ),
      });

      setLoadingUsage(false);
    }

    void loadUsage();
  }, [router]);

  async function handleFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setAnalysis(null);

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(file.type)
    ) {
      setError(
        "Unsupported image format. Use JPG, PNG or WEBP.",
      );

      event.target.value = "";
      return;
    }

    if (
      file.size >
      MAX_FILE_SIZE_BYTES
    ) {
      setError(
        "The image is too large. Maximum size is 10 MB.",
      );

      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (
        typeof reader.result ===
        "string"
      ) {
        setImagePreview(
          reader.result,
        );
      }
    };

    reader.onerror = () => {
      setError(
        "The image could not be read.",
      );
    };

    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImagePreview("");
    setAnalysis(null);
    setError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function analyzeFood() {
    if (
      loading ||
      usage.remaining <= 0
    ) {
      if (
        usage.remaining <= 0
      ) {
        setError(
          "You have reached today's limit of 2 AI food scans.",
        );
      }

      return;
    }

    if (!imagePreview) {
      setError(
        "Please select a meal photo first.",
      );
      return;
    }

    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        "/api/nutrition/analyze-food",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            imageDataUrl:
              imagePreview,
          }),
        },
      );

      const data =
        (await response.json()) as AnalyzeFoodResponse;

      /*
       * Update usage even when API returns 422 or 429.
       */
      if (data.usage) {
        setUsage(data.usage);
      }

      if (
        !response.ok ||
        !data.analysis
      ) {
        throw new Error(
          data.error ||
            "Food analysis failed.",
        );
      }

      setAnalysis(data.analysis);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  const limitReached =
    usage.remaining <= 0;

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-bold text-purple-400 transition hover:text-purple-300"
            >
              ← Back to dashboard
            </Link>

            <p className="mt-6 text-xs font-bold tracking-[0.2em] text-purple-400">
              ZENTRO PRO AI
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
              AI Food Scanner
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-zinc-400">
              Upload a clear photo of your meal and Zentro AI will estimate calories, macros, ingredients and portion size.
            </p>
          </div>

          <div className="rounded-3xl border border-purple-500/20 bg-purple-500/[0.07] px-6 py-5">
            <p className="text-xs font-bold tracking-[0.16em] text-purple-400">
              DAILY LIMIT
            </p>

            <p className="mt-2 text-3xl font-black">
              {loadingUsage
                ? "—"
                : `${usage.remaining}/${usage.limit}`}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              AI scans remaining
            </p>
          </div>
        </header>

        <section className="mt-9 rounded-[34px] border border-white/[0.08] bg-[#0b0b10] p-6 sm:p-8">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />

          {!imagePreview ? (
            <button
              type="button"
              onClick={() =>
                inputRef.current?.click()
              }
              disabled={
                loading ||
                limitReached
              }
              className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-[28px] border border-dashed border-purple-500/25 bg-purple-500/[0.04] p-8 text-center transition hover:border-purple-400/45 hover:bg-purple-500/[0.07] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-purple-500/12 text-3xl text-purple-300">
                ◉
              </span>

              <span className="mt-6 text-2xl font-black">
                Choose meal photo
              </span>

              <span className="mt-3 max-w-md text-sm leading-6 text-zinc-600">
                Use a clear image with the complete meal visible. JPG, PNG and WEBP are supported.
              </span>
            </button>
          ) : (
            <div>
              <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-black">
                {/* Native img is appropriate for a local Data URL preview. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Meal selected for AI analysis"
                  className="max-h-[620px] w-full object-contain"
                />

                <button
                  type="button"
                  onClick={clearImage}
                  disabled={loading}
                  className="absolute right-4 top-4 rounded-2xl border border-white/10 bg-black/75 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  Remove
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  inputRef.current?.click()
                }
                disabled={loading}
                className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-3 text-sm font-bold text-zinc-400 disabled:opacity-50"
              >
                Choose another photo
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              void analyzeFood()
            }
            disabled={
              loading ||
              !imagePreview ||
              limitReached ||
              loadingUsage
            }
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-5 font-black shadow-[0_0_30px_rgba(139,92,246,0.18)] transition hover:from-purple-500 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading
              ? "Analyzing meal..."
              : limitReached
                ? "Daily limit reached"
                : "Analyze with AI →"}
          </button>

          <p className="mt-4 text-center text-xs leading-5 text-zinc-600">
            A credit is used only when the AI successfully recognizes and saves a meal.
          </p>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-300">
              {error}

              {limitReached && (
                <p className="mt-2 text-xs text-red-200/70">
                  Your daily scan limit resets tomorrow.
                </p>
              )}
            </div>
          )}
        </section>

        {analysis && (
          <section className="mt-9 space-y-6">
            <article className="rounded-[34px] border border-purple-500/20 bg-gradient-to-br from-purple-600/12 via-[#0b0b10] to-[#0b0b10] p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-bold tracking-[0.18em] text-purple-400">
                    AI ANALYSIS
                  </p>

                  <h2 className="mt-3 text-3xl font-black sm:text-4xl">
                    {analysis.meal_name}
                  </h2>

                  <p className="mt-4 max-w-2xl leading-7 text-zinc-400">
                    {analysis.description}
                  </p>

                  <p className="mt-3 text-sm text-zinc-600">
                    Portion estimate: {analysis.portion_estimate}
                  </p>
                </div>

                <div className="rounded-3xl border border-purple-500/20 bg-purple-500/10 px-6 py-5 text-center">
                  <p className="text-4xl font-black text-purple-200">
                    {Math.round(
                      analysis.total_calories,
                    )}
                  </p>

                  <p className="mt-1 text-sm text-purple-300">
                    kcal
                  </p>

                  <p className="mt-2 text-xs text-zinc-600">
                    {Math.round(
                      analysis.calorie_range.minimum,
                    )}
                    –
                    {Math.round(
                      analysis.calorie_range.maximum,
                    )}{" "}
                    estimated range
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Protein"
                  value={`${roundNumber(
                    analysis.macros.protein_g,
                  )} g`}
                />

                <MetricCard
                  label="Carbs"
                  value={`${roundNumber(
                    analysis.macros.carbohydrates_g,
                  )} g`}
                />

                <MetricCard
                  label="Fat"
                  value={`${roundNumber(
                    analysis.macros.fat_g,
                  )} g`}
                />

                <MetricCard
                  label="Fiber"
                  value={`${roundNumber(
                    analysis.macros.fiber_g,
                  )} g`}
                />
              </div>
            </article>

            <article className="rounded-[34px] border border-white/[0.08] bg-[#0b0b10] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-xs font-bold tracking-[0.18em] text-zinc-600">
                    DETECTED INGREDIENTS
                  </p>

                  <h3 className="mt-2 text-2xl font-black">
                    Meal breakdown
                  </h3>
                </div>

                <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs font-bold text-zinc-400">
                  {analysis.confidence} confidence
                </span>
              </div>

              <div className="mt-7 grid gap-4 md:grid-cols-2">
                {analysis.ingredients.map(
                  (ingredient, index) => (
                    <div
                      key={`${ingredient.name}-${index}`}
                      className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-black">
                            {ingredient.name}
                          </p>

                          <p className="mt-2 text-sm text-zinc-600">
                            {ingredient.estimated_amount}
                          </p>

                          <p className="mt-1 text-xs text-zinc-700">
                            {roundNumber(
                              ingredient.estimated_grams,
                            )}{" "}
                            g estimated
                          </p>
                        </div>

                        <p className="text-lg font-black text-purple-300">
                          {Math.round(
                            ingredient.estimated_calories,
                          )}{" "}
                          kcal
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </article>

            {(analysis.assumptions.length > 0 ||
              analysis.warnings.length > 0) && (
              <div className="grid gap-6 lg:grid-cols-2">
                <InfoList
                  title="Assumptions"
                  items={
                    analysis.assumptions
                  }
                  tone="purple"
                />

                <InfoList
                  title="Important notes"
                  items={
                    analysis.warnings
                  }
                  tone="amber"
                />
              </div>
            )}

            <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 sm:flex-row sm:items-center">
              <div>
                <p className="font-black">
                  {usage.remaining}/{usage.limit} AI scans left today
                </p>

                <p className="mt-1 text-sm text-zinc-600">
                  This meal has been saved to your nutrition history.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/nutrition/history"
                  className="rounded-2xl border border-white/[0.08] px-5 py-4 text-center text-sm font-bold text-zinc-300"
                >
                  View history
                </Link>

                <button
                  type="button"
                  onClick={clearImage}
                  disabled={limitReached}
                  className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {limitReached
                    ? "Daily limit reached"
                    : "Scan another meal"}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function roundNumber(
  value: number,
) {
  return (
    Math.round(
      (Number(value) || 0) * 10,
    ) / 10
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p className="mt-3 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}

function InfoList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "purple" | "amber";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-500/15 bg-amber-500/[0.05]"
      : "border-purple-500/15 bg-purple-500/[0.05]";

  return (
    <article
      className={`rounded-[30px] border p-6 ${toneClass}`}
    >
      <h3 className="font-black">
        {title}
      </h3>

      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map(
            (item, index) => (
              <li
                key={`${item}-${index}`}
                className="flex gap-3 text-sm leading-6 text-zinc-500"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                {item}
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">
          No additional notes.
        </p>
      )}
    </article>
  );
}
