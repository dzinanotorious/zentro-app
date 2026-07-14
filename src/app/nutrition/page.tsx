"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Food = {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image_url: string | null;
};

const categories = [
  "all",
  "protein",
  "carbs",
  "fruit",
  "vegetables",
  "fats",
  "dairy",
  "supplement",
  "snacks",
  "other",
];

function categoryLabel(category: string) {
  if (category === "all") return "All foods";
  if (category === "carbs") return "Carbohydrates";

  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default function FoodLibraryPage() {
  const router = useRouter();

  const [foods, setFoods] = useState<Food[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [mealType, setMealType] = useState("Breakfast");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadFoodLibrary() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const [{ data: foodData, error: foodError }, { data: favoritesData }] =
        await Promise.all([
          supabase
            .from("foods")
            .select(
              "id, name, category, calories, protein, carbs, fat, image_url",
            )
            .order("name"),
          supabase
            .from("favorite_foods")
            .select("food_id")
            .eq("user_id", user.id),
        ]);

      if (foodError) {
        setMessage(foodError.message);
      } else {
        setFoods((foodData ?? []) as Food[]);
      }

      setFavoriteIds(
        (favoritesData ?? []).map((favorite) => favorite.food_id),
      );

      setLoading(false);
    }

    void loadFoodLibrary();
  }, [router]);

  const filteredFoods = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return foods.filter((food) => {
      const matchesSearch =
        !normalizedSearch ||
        food.name.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        category === "all" || food.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [foods, search, category]);

  const selectedMacros = useMemo(() => {
    if (!selectedFood) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      };
    }

    const multiplier = quantity / 100;

    return {
      calories: Math.round(selectedFood.calories * multiplier),
      protein: Math.round(selectedFood.protein * multiplier * 10) / 10,
      carbs: Math.round(selectedFood.carbs * multiplier * 10) / 10,
      fat: Math.round(selectedFood.fat * multiplier * 10) / 10,
    };
  }, [selectedFood, quantity]);

  async function toggleFavorite(foodId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const isFavorite = favoriteIds.includes(foodId);

    if (isFavorite) {
      const { error } = await supabase
        .from("favorite_foods")
        .delete()
        .eq("user_id", user.id)
        .eq("food_id", foodId);

      if (!error) {
        setFavoriteIds((current) =>
          current.filter((id) => id !== foodId),
        );
      }

      return;
    }

    const { error } = await supabase.from("favorite_foods").insert({
      user_id: user.id,
      food_id: foodId,
    });

    if (!error) {
      setFavoriteIds((current) => [...current, foodId]);
    }
  }

  async function addToMeal() {
    if (!selectedFood || quantity <= 0) return;

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const { data: existingMeal } = await supabase
      .from("meals")
      .select("id")
      .eq("user_id", user.id)
      .eq("meal_date", today)
      .eq("meal_type", mealType)
      .maybeSingle();

    let mealId = existingMeal?.id as string | undefined;

    if (!mealId) {
      const { data: createdMeal, error: mealError } = await supabase
        .from("meals")
        .insert({
          user_id: user.id,
          name: mealType,
          meal_type: mealType,
          meal_date: today,
        })
        .select("id")
        .single();

      if (mealError) {
        setMessage(mealError.message);
        setSaving(false);
        return;
      }

      mealId = createdMeal.id;
    }

    const { error: itemError } = await supabase
      .from("meal_items")
      .insert({
        meal_id: mealId,
        food_id: selectedFood.id,
        quantity: quantity / 100,
        serving_size: quantity,
        serving_unit: "g",
      });

    if (itemError) {
      setMessage(itemError.message);
      setSaving(false);
      return;
    }

    setMessage(`${selectedFood.name} was added to ${mealType}.`);
    setSelectedFood(null);
    setQuantity(100);
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

          <p className="mt-5 text-sm text-zinc-400">
            Loading food library...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[15%] top-[-350px] h-[700px] w-[700px] rounded-full bg-purple-700/20 blur-[170px]" />
        <div className="absolute -right-72 top-[40%] h-[650px] w-[650px] rounded-full bg-fuchsia-900/10 blur-[170px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-6 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
              ZENTRO FOOD DATABASE
            </p>

            <h1 className="mt-3 text-4xl font-black sm:text-5xl">
              Build every meal precisely.
            </h1>

            <p className="mt-3 max-w-2xl leading-7 text-zinc-500">
              Search foods, compare macros and add exact portions to your
              daily nutrition plan.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/nutrition"
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-purple-500/30"
            >
              ← Nutrition
            </Link>

            <Link
              href="/dashboard"
              className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 text-sm font-bold"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-6 rounded-2xl border border-purple-500/20 bg-purple-500/[0.08] p-4 text-sm text-purple-100">
            {message}
          </div>
        )}

        <section className="mt-7 rounded-[32px] border border-white/[0.07] bg-[#0b0b10]/90 p-5 sm:p-7">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chicken, rice, eggs, oats..."
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none placeholder:text-zinc-700 focus:border-purple-500/50"
            />

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4 text-sm text-zinc-500">
              {filteredFoods.length} foods found
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition ${
                  category === item
                    ? "border-purple-500/35 bg-purple-500/15 text-purple-200"
                    : "border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:text-white"
                }`}
              >
                {categoryLabel(item)}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredFoods.map((food) => {
            const favorite = favoriteIds.includes(food.id);

            return (
              <article
                key={food.id}
                className="group rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 transition hover:-translate-y-1 hover:border-purple-500/30 hover:bg-purple-500/[0.04]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-lg font-black text-purple-300">
                    {food.name.charAt(0).toUpperCase()}
                  </div>

                  <button
                    type="button"
                    onClick={() => void toggleFavorite(food.id)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                      favorite
                        ? "border-purple-500/30 bg-purple-500/15 text-purple-300"
                        : "border-white/[0.07] text-zinc-700 hover:text-purple-300"
                    }`}
                  >
                    {favorite ? "★" : "☆"}
                  </button>
                </div>

                <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-purple-400">
                  {categoryLabel(food.category)}
                </p>

                <h2 className="mt-2 text-lg font-black">{food.name}</h2>

                <p className="mt-2 text-xs text-zinc-600">
                  Nutrition values per 100 g
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Macro label="Calories" value={`${food.calories}`} />
                  <Macro label="Protein" value={`${food.protein} g`} />
                  <Macro label="Carbs" value={`${food.carbs} g`} />
                  <Macro label="Fat" value={`${food.fat} g`} />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFood(food);
                    setQuantity(100);
                    setMessage("");
                  }}
                  className="mt-5 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 text-sm font-bold transition hover:scale-[1.01]"
                >
                  Add to meal
                </button>
              </article>
            );
          })}
        </section>

        {filteredFoods.length === 0 && (
          <section className="mt-6 rounded-[32px] border border-white/[0.07] bg-white/[0.025] p-12 text-center">
            <p className="text-4xl">⌕</p>
            <h2 className="mt-5 text-2xl font-black">
              No matching foods
            </h2>
            <p className="mt-3 text-zinc-500">
              Try another search term or select a different category.
            </p>
          </section>
        )}
      </div>

      {selectedFood && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-5 backdrop-blur-md"
          onClick={() => setSelectedFood(null)}
        >
          <section
            className="w-full max-w-xl rounded-[34px] border border-white/10 bg-[#0b0b10] p-7 shadow-2xl sm:p-9"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-400">
                  Add food
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  {selectedFood.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFood(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-xl text-zinc-500"
              >
                ×
              </button>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Meal
                </label>

                <select
                  value={mealType}
                  onChange={(event) => setMealType(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-4 outline-none focus:border-purple-500/50"
                >
                  <option>Breakfast</option>
                  <option>Morning snack</option>
                  <option>Lunch</option>
                  <option>Pre-workout</option>
                  <option>Post-workout</option>
                  <option>Dinner</option>
                  <option>Evening snack</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Quantity (grams)
                </label>

                <input
                  type="number"
                  min="1"
                  max="2000"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Macro
                label="Calories"
                value={`${selectedMacros.calories}`}
              />
              <Macro
                label="Protein"
                value={`${selectedMacros.protein} g`}
              />
              <Macro
                label="Carbs"
                value={`${selectedMacros.carbs} g`}
              />
              <Macro
                label="Fat"
                value={`${selectedMacros.fat} g`}
              />
            </div>

            <button
              type="button"
              onClick={() => void addToMeal()}
              disabled={saving || quantity <= 0}
              className="mt-7 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 font-bold shadow-[0_0_30px_rgba(139,92,246,0.2)] disabled:opacity-50"
            >
              {saving ? "Adding food..." : `Add to ${mealType}`}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function Macro({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
      <p className="text-[10px] text-zinc-600">{label}</p>
      <p className="mt-1 text-sm font-bold text-zinc-300">{value}</p>
    </div>
  );
}
