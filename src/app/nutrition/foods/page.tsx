"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type FoodItem = {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const CATEGORIES = [
  "All",
  "protein",
  "carbs",
  "dairy",
  "fruit",
  "vegetables",
  "supplement",
  "fats",
];

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function FoodLibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedMeal = searchParams.get("meal") ?? "Lunch";
  const validMeals = [
    "Breakfast",
    "Morning snack",
    "Lunch",
    "Pre-workout",
    "Post-workout",
    "Dinner",
    "Evening snack",
  ];
  const mealType = validMeals.includes(requestedMeal) ? requestedMeal : "Lunch";
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadFoods() {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("foods")
        .select("id, name, category, calories, protein, carbs, fat, image_url")
        .order("name", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      setFoods((data ?? []) as FoodItem[]);
      setLoading(false);
    }

    void loadFoods();
  }, []);

  const filteredFoods = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return foods.filter((food) => {
      const matchesCategory =
        category === "All" ||
        food.category?.toLowerCase() === category.toLowerCase();

      const matchesSearch =
        normalizedQuery.length === 0 ||
        food.name.toLowerCase().includes(normalizedQuery) ||
        (food.category ?? "").toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [category, foods, query]);

  function chooseFood(food: FoodItem) {
    setSelectedFood(food);
    setQuantity(1);
  }

  function continueToTracker() {
    if (!selectedFood) return;

    const selected = {
      ...selectedFood,
      food_id: selectedFood.id,
      quantity,
      servingSize: quantity * 100,
      serving_size: quantity * 100,
      mealType,
      totals: {
        calories: round(selectedFood.calories * quantity),
        protein: round(selectedFood.protein * quantity),
        carbs: round(selectedFood.carbs * quantity),
        fat: round(selectedFood.fat * quantity),
      },
    };

    sessionStorage.setItem("zentro-selected-food", JSON.stringify(selected));

    router.push(`/nutrition/tracker?meal=${encodeURIComponent(mealType)}`);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] px-4 pb-24 pt-6 text-white sm:px-8 lg:py-12">
      <div className="pointer-events-none fixed inset-0 hidden lg:block">
        <div className="absolute left-[8%] top-[-360px] h-[760px] w-[760px] rounded-full bg-purple-700/20 blur-[180px]" />
        <div className="absolute -right-72 bottom-[-260px] h-[650px] w-[650px] rounded-full bg-violet-900/10 blur-[170px]" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
              SMART NUTRITION
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
              Food Library
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-zinc-500">
              Choose food for {mealType}. Values are stored per 100 g and saved
              directly to your nutrition tracker.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/nutrition/tracker?meal=${encodeURIComponent(mealType)}`}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-purple-500/25 hover:text-white"
            >
              ← Nutrition tracker
            </Link>

            <Link
              href="/nutrition/scan"
              className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.18)] transition hover:scale-[1.02]"
            >
              Scan a meal
            </Link>
          </div>
        </header>

        <section className="mt-10 rounded-[30px] border border-white/[0.07] bg-white/[0.025] p-5">
          <label className="block text-sm font-bold text-zinc-300">
            Search food
          </label>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chicken, rice, banana..."
            className="mt-3 w-full rounded-2xl border border-white/[0.08] bg-[#0b0b10] px-5 py-4 text-white outline-none transition placeholder:text-zinc-700 focus:border-purple-500/40"
          />

          <div className="mt-5 flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                  category === item
                    ? "border-purple-500/40 bg-purple-500/15 text-purple-200"
                    : "border-white/[0.07] bg-white/[0.02] text-zinc-500 hover:text-white"
                }`}
              >
                {item === "All"
                  ? item
                  : item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {errorMessage && (
          <section className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
            {errorMessage}
          </section>
        )}

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          </div>
        ) : filteredFoods.length === 0 ? (
          <section className="mt-8 rounded-[30px] border border-dashed border-white/[0.1] bg-white/[0.02] p-10 text-center">
            <h2 className="text-2xl font-black">No foods found</h2>
            <p className="mt-3 text-zinc-500">
              Try another search or choose a different category.
            </p>
          </section>
        ) : (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredFoods.map((food) => (
              <article
                key={food.id}
                className="rounded-[28px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 transition hover:border-purple-500/25"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold tracking-[0.14em] text-purple-400">
                      {(food.category ?? "Other").toUpperCase()}
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{food.name}</h2>
                    <p className="mt-2 text-sm text-zinc-600">Per 100 g</p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-black text-purple-300">
                      {food.calories}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">kcal</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                  <Macro label="Protein" value={`${food.protein}g`} />
                  <Macro label="Carbs" value={`${food.carbs}g`} />
                  <Macro label="Fat" value={`${food.fat}g`} />
                </div>

                <button
                  type="button"
                  onClick={() => chooseFood(food)}
                  className="mt-6 w-full rounded-2xl border border-purple-500/25 bg-purple-500/10 px-5 py-3 font-bold text-purple-200 transition hover:bg-purple-500/15"
                >
                  Add to {mealType}
                </button>
              </article>
            ))}
          </section>
        )}
      </div>

      {selectedFood && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-5">
          <div className="mx-auto my-auto w-full max-w-md rounded-[30px] border border-white/[0.09] bg-[#0b0b10] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-purple-400">
                  ADD FOOD
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  {selectedFood.name}
                </h2>
                <p className="mt-2 text-sm text-zinc-500">1 serving = 100 g</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFood(null)}
                className="rounded-xl border border-white/[0.08] px-3 py-2 text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <label className="mt-7 block text-sm font-bold text-zinc-300">
              Number of 100 g servings
            </label>

            <input
              type="number"
              min="0.25"
              step="0.25"
              value={quantity}
              onChange={(event) =>
                setQuantity(Math.max(0.25, Number(event.target.value) || 1))
              }
              className="mt-3 w-full rounded-2xl border border-white/[0.08] bg-[#050507] px-5 py-4 text-white outline-none focus:border-purple-500/40"
            />

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Total
                label="Calories"
                value={`${round(selectedFood.calories * quantity)} kcal`}
              />
              <Total
                label="Protein"
                value={`${round(selectedFood.protein * quantity)} g`}
              />
              <Total
                label="Carbs"
                value={`${round(selectedFood.carbs * quantity)} g`}
              />
              <Total
                label="Fat"
                value={`${round(selectedFood.fat * quantity)} g`}
              />
            </div>

            <button
              type="button"
              onClick={continueToTracker}
              className="mt-7 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 font-bold"
            >
              Add food to tracker
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <p className="mt-5 text-sm text-zinc-400">
              Loading food library...
            </p>
          </div>
        </main>
      }
    >
      <FoodLibraryContent />
    </Suspense>
  );
}


function Macro({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-center">
      <p className="text-[10px] text-zinc-600">{label}</p>
      <p className="mt-2 text-sm font-black">{value}</p>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-2 font-black text-zinc-200">{value}</p>
    </div>
  );
}
