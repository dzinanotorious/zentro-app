"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NutritionScanPage() {
  const inputRef = useRef<HTMLInputElement | null>(
    null,
  );

  const [imagePreview, setImagePreview] =
    useState<string>("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [analysis, setAnalysis] =
    useState<any>(null);

  async function handleFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setImagePreview(
        reader.result as string,
      );
    };

    reader.readAsDataURL(file);
  }

  async function analyzeFood() {
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
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(
          "You must be logged in.",
        );
      }

      const response = await fetch(
        "/api/nutrition/analyze-food",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            imageDataUrl:
              imagePreview,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Food analysis failed.",
        );
      }

      setAnalysis(data.analysis);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-5xl font-black">
          AI Food Scanner
        </h1>

        <p className="mt-4 text-zinc-500">
          Take a photo of your meal and
          Zentro AI will estimate
          calories and macros.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-[#0b0b10] p-8">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />

          <button
            onClick={() =>
              inputRef.current?.click()
            }
            className="rounded-2xl bg-purple-600 px-6 py-4 font-bold"
          >
            Choose meal photo
          </button>

          {imagePreview && (
            <img
              src={imagePreview}
              alt="Meal preview"
              className="mt-6 w-full rounded-3xl border border-white/10"
            />
          )}

          <button
            onClick={analyzeFood}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-5 font-black"
          >
            {loading
              ? "Analyzing meal..."
              : "Analyze with AI"}
          </button>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          )}
        </div>

        {analysis && (
          <div className="mt-10 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-[#0b0b10] p-8">
              <h2 className="text-3xl font-black">
                {analysis.meal_name}
              </h2>

              <p className="mt-3 text-zinc-400">
                {
                  analysis.description
                }
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-4">
                <MetricCard
                  label="Calories"
                  value={`${analysis.total_calories} kcal`}
                />

                <MetricCard
                  label="Protein"
                  value={`${analysis.macros.protein_g} g`}
                />

                <MetricCard
                  label="Carbs"
                  value={`${analysis.macros.carbohydrates_g} g`}
                />

                <MetricCard
                  label="Fat"
                  value={`${analysis.macros.fat_g} g`}
                />
              </div>

              <div className="mt-8">
                <h3 className="text-xl font-bold">
                  Ingredients
                </h3>

                <div className="mt-4 space-y-3">
                  {analysis.ingredients.map(
                    (
                      ingredient: any,
                    ) => (
                      <div
                        key={
                          ingredient.name
                        }
                        className="rounded-2xl border border-white/10 p-4"
                      >
                        <p className="font-bold">
                          {
                            ingredient.name
                          }
                        </p>

                        <p className="text-zinc-500">
                          {
                            ingredient.estimated_amount
                          }
                        </p>

                        <p className="text-zinc-400">
                          {
                            ingredient.estimated_calories
                          }{" "}
                          kcal
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}
