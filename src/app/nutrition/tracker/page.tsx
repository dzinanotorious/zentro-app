"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  daily_calories: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fat_grams: number | null;
};

type Food = {
  id: string;
  name: string;
  category: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type MealItem = {
  id: string;
  quantity: number;
  serving_size: number;
  serving_unit: string;
  food: Food;
};

type Meal = {
  id: string;
  name: string | null;
  meal_type: string;
  planned_time: string | null;
  completed: boolean;
  completed_at: string | null;
  meal_items: MealItem[];
};

type EditingItem = {
  itemId: string;
  mealId: string;
  foodName: string;
  grams: string;
} | null;

type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const mealSlots = [
  {
    type: "Breakfast",
    time: "08:00",
    icon: "01",
    description: "Start the day with energy and protein.",
  },
  {
    type: "Morning snack",
    time: "11:00",
    icon: "02",
    description: "A light meal to maintain energy.",
  },
  {
    type: "Lunch",
    time: "14:00",
    icon: "03",
    description: "Your main balanced daytime meal.",
  },
  {
    type: "Pre-workout",
    time: "16:30",
    icon: "04",
    description: "Fuel your upcoming training session.",
  },
  {
    type: "Post-workout",
    time: "18:30",
    icon: "05",
    description: "Support recovery after your workout.",
  },
  {
    type: "Dinner",
    time: "20:30",
    icon: "06",
    description: "Finish the day with a balanced meal.",
  },
  {
    type: "Evening snack",
    time: "22:00",
    icon: "07",
    description: "Optional final protein-focused snack.",
  },
];

function getLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateFromString(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function calculateMealTotals(meal: Meal | undefined): NutritionTotals {
  if (!meal) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
  }

  return meal.meal_items.reduce(
    (totals, item) => ({
      calories:
        totals.calories + Number(item.food.calories) * Number(item.quantity),
      protein:
        totals.protein + Number(item.food.protein) * Number(item.quantity),
      carbs: totals.carbs + Number(item.food.carbs) * Number(item.quantity),
      fat: totals.fat + Number(item.food.fat) * Number(item.quantity),
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    },
  );
}

function NutritionTrackerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );

  const [editingItem, setEditingItem] = useState<EditingItem>(null);

  const selectedDateString = getLocalDateString(selectedDate);
  const todayString = getLocalDateString(new Date());

  const loadTracker = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);

    const [
      { data: profileData, error: profileError },
      { data: mealsData, error: mealsError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("daily_calories, protein_grams, carbs_grams, fat_grams")
        .eq("id", user.id)
        .maybeSingle(),

      supabase
        .from("meals")
        .select(
          `
          id,
          name,
          meal_type,
          planned_time,
          completed,
          completed_at,
          meal_items (
            id,
            quantity,
            serving_size,
            serving_unit,
            food:foods (
              id,
              name,
              category,
              calories,
              protein,
              carbs,
              fat
            )
          )
        `,
        )
        .eq("user_id", user.id)
        .eq("meal_date", selectedDateString)
        .order("created_at", {
          ascending: true,
        }),
    ]);

    if (profileError) {
      setMessageType("error");
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    if (mealsError) {
      setMessageType("error");
      setMessage(mealsError.message);
      setLoading(false);
      return;
    }

    setProfile(profileData as Profile | null);
    setMeals((mealsData ?? []) as unknown as Meal[]);
    setLoading(false);
  }, [router, selectedDateString]);

  useEffect(() => {
    void loadTracker();
  }, [loadTracker]);

  useEffect(() => {
    async function importFoodFromLibrary() {
      if (!userId || loading) return;

      const raw = sessionStorage.getItem("zentro-selected-food");

      if (!raw) return;

      try {
        const selectedFood = JSON.parse(raw);

        const requestedMealType =
          selectedFood.mealType ?? searchParams.get("meal") ?? "Lunch";

        const validMealTypes = mealSlots.map((slot) => slot.type);
        const mealType = validMealTypes.includes(requestedMealType)
          ? requestedMealType
          : "Lunch";

        let mealId: string | null = null;

        const existingMeal = meals.find((meal) => meal.meal_type === mealType);

        if (existingMeal) {
          mealId = existingMeal.id;
        } else {
          const { data: createdMeal, error: mealError } = await supabase
            .from("meals")
            .insert({
              user_id: userId,
              meal_date: selectedDateString,
              meal_type: mealType,
              completed: false,
            })
            .select("id")
            .single();

          if (mealError) {
            console.error(mealError);
            return;
          }

          mealId = createdMeal.id;
        }

        const grams = Number(
          selectedFood.servingSize ?? selectedFood.serving_size ?? 100,
        );

        const foodId = selectedFood.id ?? selectedFood.food_id;

        if (!foodId || !mealId) {
          return;
        }

        const { error: itemError } = await supabase.from("meal_items").insert({
          meal_id: mealId,
          food_id: foodId,
          serving_size: grams,
          serving_unit: "g",
          quantity: grams / 100,
        });

        if (itemError) {
          console.error(itemError);
          return;
        }

        sessionStorage.removeItem("zentro-selected-food");

        await loadTracker();

        setMessageType("success");
        setMessage(`${selectedFood.name} was added successfully.`);
      } catch (error) {
        console.error("Food Library import failed:", error);
      }
    }

    void importFoodFromLibrary();
  }, [userId, loading, meals, loadTracker, selectedDateString, searchParams]);

  const totals = useMemo<NutritionTotals>(() => {
    return meals.reduce(
      (dayTotals, meal) => {
        const mealTotals = calculateMealTotals(meal);

        return {
          calories: dayTotals.calories + mealTotals.calories,
          protein: dayTotals.protein + mealTotals.protein,
          carbs: dayTotals.carbs + mealTotals.carbs,
          fat: dayTotals.fat + mealTotals.fat,
        };
      },
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
    );
  }, [meals]);

  const targets = useMemo(
    () => ({
      calories: Number(profile?.daily_calories ?? 0),
      protein: Number(profile?.protein_grams ?? 0),
      carbs: Number(profile?.carbs_grams ?? 0),
      fat: Number(profile?.fat_grams ?? 0),
    }),
    [profile],
  );

  const roundedTotals = useMemo(
    () => ({
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
    }),
    [totals],
  );

  /*
   * Автоматски го зачувува дневниот вкупен резултат
   * во nutrition_logs.
   */
  useEffect(() => {
    if (!userId || loading) return;

    const timeout = window.setTimeout(async () => {
      const { error } = await supabase.from("nutrition_logs").upsert(
        {
          user_id: userId,
          log_date: selectedDateString,
          calories: roundedTotals.calories,
          protein: roundedTotals.protein,
          carbs: roundedTotals.carbs,
          fats: roundedTotals.fat,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,log_date",
        },
      );

      if (error) {
        console.error("Nutrition log sync error:", error);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [userId, loading, selectedDateString, roundedTotals]);

  const caloriesRemaining = Math.round(
    targets.calories - roundedTotals.calories,
  );

  const completedMeals = meals.filter((meal) => meal.completed).length;

  const totalFoodItems = meals.reduce(
    (count, meal) => count + meal.meal_items.length,
    0,
  );

  function changeDate(numberOfDays: number) {
    const newDate = new Date(selectedDate);

    newDate.setDate(newDate.getDate() + numberOfDays);
    setSelectedDate(newDate);
  }

  function openDate(dateValue: string) {
    if (!dateValue) return;

    setSelectedDate(dateFromString(dateValue));
  }

  async function toggleMealCompleted(meal: Meal) {
    setSaving(true);
    setMessage("");

    const completed = !meal.completed;

    const { error } = await supabase
      .from("meals")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meal.id);

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessageType("success");
    setMessage(
      completed
        ? `${meal.meal_type} е означен како завршен.`
        : `${meal.meal_type} повторно е активен.`,
    );

    await loadTracker();
    setSaving(false);
  }

  async function deleteFoodItem(
    mealId: string,
    itemId: string,
    itemName: string,
    numberOfItems: number,
  ) {
    const confirmed = window.confirm(
      `Дали сакаш да го избришеш ${itemName} од оброкот?`,
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    const { error: itemError } = await supabase
      .from("meal_items")
      .delete()
      .eq("id", itemId);

    if (itemError) {
      setMessageType("error");
      setMessage(itemError.message);
      setSaving(false);
      return;
    }

    /*
     * Ако ова била последната намирница,
     * го бришеме и празниот оброк.
     */
    if (numberOfItems === 1) {
      const { error: mealError } = await supabase
        .from("meals")
        .delete()
        .eq("id", mealId);

      if (mealError) {
        setMessageType("error");
        setMessage(mealError.message);
        setSaving(false);
        return;
      }
    }

    setMessageType("success");
    setMessage(`${itemName} е избришан.`);

    await loadTracker();
    setSaving(false);
  }

  function startEditing(mealId: string, item: MealItem) {
    setEditingItem({
      itemId: item.id,
      mealId,
      foodName: item.food.name,
      grams: String(item.serving_size),
    });
  }

  async function saveEditedQuantity() {
    if (!editingItem) return;

    const grams = Number(editingItem.grams);

    if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) {
      setMessageType("error");
      setMessage("Внеси валидна количина меѓу 1 и 5000 грама.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("meal_items")
      .update({
        serving_size: grams,
        serving_unit: "g",
        quantity: grams / 100,
      })
      .eq("id", editingItem.itemId);

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setEditingItem(null);
    setMessageType("success");
    setMessage("Количината е успешно променета.");

    await loadTracker();
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

          <p className="mt-5 text-sm text-zinc-400">
            Loading your nutrition data...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[10%] top-[-350px] h-[750px] w-[750px] rounded-full bg-purple-700/20 blur-[180px]" />

        <div className="absolute -right-80 top-[35%] h-[700px] w-[700px] rounded-full bg-fuchsia-900/10 blur-[180px]" />

        <div className="absolute bottom-[-400px] left-[35%] h-[700px] w-[700px] rounded-full bg-violet-900/10 blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-[1550px] px-5 py-7 sm:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-6 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
              ZENTRO DAILY NUTRITION
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Track every calorie precisely.
            </h1>

            <p className="mt-3 max-w-2xl leading-7 text-zinc-500">
              Manage meals, food quantities and daily macros using real data
              saved securely in your account.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/nutrition"
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-purple-500/30"
            >
              Nutrition plan
            </Link>

            <Link
              href="/nutrition/foods?meal=Lunch"
              className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.2)] transition hover:scale-[1.02]"
            >
              + Add food
            </Link>
          </div>
        </header>

        {message && (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              messageType === "error"
                ? "border-red-500/20 bg-red-500/10 text-red-200"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {message}
          </div>
        )}

        {/* Date navigation */}
        <section className="mt-7 rounded-[30px] border border-white/[0.07] bg-[#0b0b10]/90 p-5">
          <div className="flex flex-col items-center justify-between gap-5 lg:flex-row">
            <button
              type="button"
              onClick={() => changeDate(-1)}
              className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-3 text-sm font-bold text-zinc-400 transition hover:border-purple-500/30 hover:text-white lg:w-auto"
            >
              ← Previous day
            </button>

            <div className="text-center">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <p className="text-lg font-black">
                  {formatLongDate(selectedDate)}
                </p>

                {selectedDateString === todayString && (
                  <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-[10px] font-bold text-purple-300">
                    TODAY
                  </span>
                )}
              </div>

              <input
                type="date"
                value={selectedDateString}
                onChange={(event) => openDate(event.target.value)}
                className="mt-3 rounded-xl border border-white/[0.08] bg-black/40 px-4 py-2 text-xs text-zinc-400 outline-none focus:border-purple-500/40"
              />
            </div>

            <div className="flex w-full gap-3 lg:w-auto">
              {selectedDateString !== todayString && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date())}
                  className="flex-1 rounded-2xl border border-purple-500/20 bg-purple-500/10 px-5 py-3 text-sm font-bold text-purple-300 lg:flex-none"
                >
                  Today
                </button>
              )}

              <button
                type="button"
                onClick={() => changeDate(1)}
                className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-3 text-sm font-bold text-zinc-400 transition hover:border-purple-500/30 hover:text-white lg:flex-none"
              >
                Next day →
              </button>
            </div>
          </div>
        </section>

        {/* Daily targets */}
        <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <ProgressCard
            label="Calories"
            value={roundedTotals.calories}
            target={targets.calories}
            unit="kcal"
            icon="◎"
          />

          <ProgressCard
            label="Protein"
            value={roundedTotals.protein}
            target={targets.protein}
            unit="g"
            icon="P"
          />

          <ProgressCard
            label="Carbohydrates"
            value={roundedTotals.carbs}
            target={targets.carbs}
            unit="g"
            icon="C"
          />

          <ProgressCard
            label="Fats"
            value={roundedTotals.fat}
            target={targets.fat}
            unit="g"
            icon="F"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          {/* Meal slots */}
          <div className="space-y-5">
            {mealSlots.map((slot) => {
              const meal = meals.find(
                (currentMeal) => currentMeal.meal_type === slot.type,
              );

              const mealTotals = calculateMealTotals(meal);
              const completed = meal?.completed ?? false;

              return (
                <article
                  key={slot.type}
                  className={`overflow-hidden rounded-[34px] border transition ${
                    completed
                      ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                      : "border-white/[0.07] bg-[#0b0b10]/90"
                  }`}
                >
                  <div className="p-6 sm:p-8">
                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${
                            completed
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                              : "border-purple-500/20 bg-purple-500/10 text-purple-300"
                          }`}
                        >
                          {completed ? "✓" : slot.icon}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-2xl font-black">{slot.type}</h2>

                            <span className="text-xs text-zinc-600">
                              {meal?.planned_time?.slice(0, 5) ?? slot.time}
                            </span>

                            {completed && (
                              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[9px] font-bold text-emerald-300">
                                COMPLETED
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm text-zinc-600">
                            {slot.description}
                          </p>
                        </div>
                      </div>

                      {meal ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void toggleMealCompleted(meal)}
                          className={`rounded-2xl px-5 py-3 text-sm font-bold transition disabled:opacity-50 ${
                            completed
                              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              : "bg-purple-600 text-white hover:bg-purple-500"
                          }`}
                        >
                          {completed ? "Mark incomplete" : "Complete meal"}
                        </button>
                      ) : (
                        <Link
                          href={`/nutrition/foods?meal=${encodeURIComponent(slot.type)}`}
                          className="rounded-2xl border border-purple-500/20 bg-purple-500/10 px-5 py-3 text-center text-sm font-bold text-purple-300 transition hover:bg-purple-500/15"
                        >
                          + Add food
                        </Link>
                      )}
                    </div>

                    {!meal || meal.meal_items.length === 0 ? (
                      <div className="mt-7 rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.015] p-7 text-center">
                        <p className="text-sm font-semibold text-zinc-500">
                          No foods added
                        </p>

                        <p className="mt-2 text-xs text-zinc-700">
                          Add a food from the Food Library to begin tracking
                          this meal.
                        </p>

                        <Link
                          href={`/nutrition/foods?meal=${encodeURIComponent(slot.type)}`}
                          className="mt-5 inline-block text-sm font-bold text-purple-400"
                        >
                          Open Food Library →
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-7 space-y-3">
                        {meal.meal_items.map((item) => {
                          const quantity = Number(item.quantity);

                          return (
                            <div
                              key={item.id}
                              className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 lg:flex-row lg:items-center"
                            >
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 font-black text-purple-300">
                                {item.food.name.charAt(0).toUpperCase()}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="font-bold">{item.food.name}</p>

                                <button
                                  type="button"
                                  onClick={() => startEditing(meal.id, item)}
                                  className="mt-1 text-left text-xs text-purple-400 transition hover:text-purple-300"
                                >
                                  {item.serving_size} {item.serving_unit} · Edit
                                  quantity
                                </button>
                              </div>

                              <div className="grid grid-cols-4 gap-2 lg:w-[330px]">
                                <MiniStat
                                  label="Kcal"
                                  value={Math.round(
                                    Number(item.food.calories) * quantity,
                                  )}
                                />

                                <MiniStat
                                  label="Protein"
                                  value={`${Math.round(
                                    Number(item.food.protein) * quantity,
                                  )}g`}
                                />

                                <MiniStat
                                  label="Carbs"
                                  value={`${Math.round(
                                    Number(item.food.carbs) * quantity,
                                  )}g`}
                                />

                                <MiniStat
                                  label="Fats"
                                  value={`${Math.round(
                                    Number(item.food.fat) * quantity,
                                  )}g`}
                                />
                              </div>

                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  void deleteFoodItem(
                                    meal.id,
                                    item.id,
                                    item.food.name,
                                    meal.meal_items.length,
                                  )
                                }
                                className="rounded-xl border border-red-500/15 px-4 py-3 text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {meal && meal.meal_items.length > 0 && (
                    <div className="grid grid-cols-4 gap-3 border-t border-white/[0.06] bg-black/20 p-5 sm:px-8">
                      <MiniStat
                        label="Calories"
                        value={Math.round(mealTotals.calories)}
                      />

                      <MiniStat
                        label="Protein"
                        value={`${Math.round(mealTotals.protein)}g`}
                      />

                      <MiniStat
                        label="Carbs"
                        value={`${Math.round(mealTotals.carbs)}g`}
                      />

                      <MiniStat
                        label="Fats"
                        value={`${Math.round(mealTotals.fat)}g`}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <article
              className={`rounded-[34px] border p-7 ${
                caloriesRemaining < 0
                  ? "border-red-500/20 bg-red-500/[0.05]"
                  : "border-purple-500/15 bg-gradient-to-br from-purple-600/15 to-transparent"
              }`}
            >
              <p
                className={`text-sm ${
                  caloriesRemaining < 0 ? "text-red-300" : "text-purple-300"
                }`}
              >
                {caloriesRemaining < 0
                  ? "Calories over target"
                  : "Calories remaining"}
              </p>

              <p className="mt-3 text-5xl font-black">
                {Math.abs(caloriesRemaining).toLocaleString()}
              </p>

              <p className="mt-2 text-sm text-zinc-600">
                {caloriesRemaining < 0
                  ? "kcal above your target"
                  : "kcal available today"}
              </p>

              <ProgressBar
                value={roundedTotals.calories}
                target={targets.calories}
              />

              <div className="mt-6 grid grid-cols-2 gap-3">
                <MiniStat
                  label="Consumed"
                  value={`${roundedTotals.calories} kcal`}
                />

                <MiniStat label="Target" value={`${targets.calories} kcal`} />
              </div>
            </article>

            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7">
              <p className="text-sm text-zinc-500">Daily summary</p>

              <h2 className="mt-2 text-2xl font-black">Your progress</h2>

              <div className="mt-7 space-y-4">
                <SummaryRow label="Logged meals" value={`${meals.length}`} />

                <SummaryRow
                  label="Completed meals"
                  value={`${completedMeals}`}
                />

                <SummaryRow label="Food items" value={`${totalFoodItems}`} />

                <SummaryRow
                  label="Daily status"
                  value={caloriesRemaining >= 0 ? "On track" : "Over target"}
                  highlight={caloriesRemaining >= 0}
                />

                <SummaryRow label="Database sync" value="Saved" highlight />
              </div>
            </article>

            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300">
                ✦
              </div>

              <h2 className="mt-5 text-xl font-black">Quick actions</h2>

              <div className="mt-5 space-y-3">
                <Link
                  href="/nutrition/foods?meal=Lunch"
                  className="block rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-4 text-center text-sm font-bold"
                >
                  Add another food
                </Link>

                <Link
                  href="/nutrition"
                  className="block rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-center text-sm font-bold text-zinc-300 transition hover:border-purple-500/30"
                >
                  Open meal plan
                </Link>

                <Link
                  href="/dashboard"
                  className="block rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-center text-sm font-bold text-zinc-300 transition hover:border-purple-500/30"
                >
                  Dashboard
                </Link>
              </div>
            </article>

            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7">
              <p className="text-sm font-bold text-purple-300">
                How tracking works
              </p>

              <ul className="mt-5 space-y-4 text-sm leading-6 text-zinc-600">
                <li>• Food quantities are stored in grams.</li>
                <li>• Calories and macros update automatically.</li>
                <li>• Each day has a separate nutrition log.</li>
                <li>• Completed meals remain saved in Supabase.</li>
              </ul>
            </article>
          </aside>
        </section>

        <footer className="mt-10 border-t border-white/[0.05] py-8 text-xs leading-6 text-zinc-700">
          Nutrition values are estimates intended for general fitness guidance.
          Medical conditions and dietary restrictions should be discussed with
          an appropriate healthcare professional.
        </footer>
      </div>

      {/* Edit quantity modal */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-5 backdrop-blur-md"
          onClick={() => setEditingItem(null)}
        >
          <section
            className="w-full max-w-md rounded-[34px] border border-white/10 bg-[#0b0b10] p-7 shadow-2xl sm:p-9"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-purple-400">
                  EDIT QUANTITY
                </p>

                <h2 className="mt-3 text-2xl font-black">
                  {editingItem.foodName}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-xl text-zinc-500"
              >
                ×
              </button>
            </div>

            <div className="mt-7">
              <label className="mb-2 block text-sm text-zinc-400">
                Quantity in grams
              </label>

              <div className="flex items-center rounded-2xl border border-white/10 bg-black/40 px-5 focus-within:border-purple-500/50">
                <input
                  type="number"
                  min="1"
                  max="5000"
                  step="1"
                  value={editingItem.grams}
                  onChange={(event) =>
                    setEditingItem({
                      ...editingItem,
                      grams: event.target.value,
                    })
                  }
                  className="min-w-0 flex-1 bg-transparent py-4 text-2xl font-black outline-none"
                />

                <span className="text-sm text-zinc-600">g</span>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-2xl border border-white/[0.08] px-5 py-4 font-bold text-zinc-400"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveEditedQuantity()}
                className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-4 font-bold disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save quantity"}
              </button>
            </div>
          </section>
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
              Loading nutrition tracker...
            </p>
          </div>
        </main>
      }
    >
      <NutritionTrackerContent />
    </Suspense>
  );
}


function ProgressCard({
  label,
  value,
  target,
  unit,
  icon,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  icon: string;
}) {
  const percentage =
    target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;

  const overTarget = value > target && target > 0;

  return (
    <article
      className={`rounded-3xl border p-6 transition hover:-translate-y-1 ${
        overTarget
          ? "border-red-500/20 bg-red-500/[0.04]"
          : "border-white/[0.07] bg-white/[0.025] hover:border-purple-500/25"
      }`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl font-black ${
            overTarget
              ? "bg-red-500/10 text-red-300"
              : "bg-purple-500/10 text-purple-300"
          }`}
        >
          {icon}
        </div>

        <span
          className={`text-xs font-bold ${
            overTarget ? "text-red-300" : "text-zinc-600"
          }`}
        >
          {target > 0 ? Math.round((value / target) * 100) : 0}%
        </span>
      </div>

      <p className="mt-6 text-sm text-zinc-500">{label}</p>

      <p className="mt-2 text-2xl font-black">
        {value.toLocaleString()}

        <span className="ml-2 text-xs font-normal text-zinc-600">
          / {target.toLocaleString()} {unit}
        </span>
      </p>

      <ProgressBar value={value} target={target} />
    </article>
  );
}

function ProgressBar({ value, target }: { value: number; target: number }) {
  const percentage =
    target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;

  const overTarget = value > target && target > 0;

  return (
    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          overTarget
            ? "bg-gradient-to-r from-red-600 to-orange-400"
            : "bg-gradient-to-r from-purple-600 to-violet-400"
        }`}
        style={{
          width: `${percentage}%`,
        }}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
      <p className="text-[10px] text-zinc-600">{label}</p>

      <p className="mt-1 truncate text-sm font-bold text-zinc-300">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] pb-4 text-sm last:border-none last:pb-0">
      <span className="text-zinc-600">{label}</span>

      <span
        className={
          highlight
            ? "font-semibold text-emerald-400"
            : "font-semibold text-zinc-300"
        }
      >
        {value}
      </span>
    </div>
  );
}
