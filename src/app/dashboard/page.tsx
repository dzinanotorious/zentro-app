"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
  activity: string | null;
  goal: string | null;
  experience: string | null;
  training_days: number | null;
  daily_calories: number | null;
  protein_grams: number | null;
  fat_grams: number | null;
  carbs_grams: number | null;
  onboarding_completed: boolean | null;
};

type AIUsage = {
  coach_messages_used: number;
  food_scans_used: number;
};

type NutritionLog = {
  log_date: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

type MealSummary = {
  id: string;
  completed: boolean;
};

type LatestFoodScan = {
  id: string;
  meal_name: string;
  total_calories: number;
  scanned_at: string;
};

const navigation = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: "⌂",
    },
    {
      label: "Programs",
      href: "/programs",
      icon: "◈",
    },
    {
      label: "Nutrition",
      href: "/nutrition/history",
      icon: "◎",
    },
    {
      label: "Progress",
      href: "/progress",
      icon: "↗",
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "▦",
    },
    {
      label: "AI Coach",
      href: "/coach",
      icon: "✦",
    },
    {
      label: "Workout Builder",
      href: "/workout-builder",
      icon: "🏋️",
    },
    {
      label: "Community",
      href: "/community",
      icon: "👥",
    },
    {
      label: "Profile",
      href: "/profile",
      icon: "○",
    },
  ];

const weekDays = [
  { day: "Mon", completed: true },
  { day: "Tue", completed: true },
  { day: "Wed", completed: false },
  { day: "Thu", completed: true },
  { day: "Fri", completed: false },
  { day: "Sat", completed: false },
  { day: "Sun", completed: false },
];

function getLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatRelativeTime(value: string) {
  const difference = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(difference / 60000));

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

function calculateNutritionStreak(logs: NutritionLog[]) {
  const loggedDates = new Set(
    logs
      .filter((log) => Number(log.calories) > 0)
      .map((log) => log.log_date),
  );

  let streak = 0;
  const current = new Date();

  while (loggedDates.has(getLocalDateString(current))) {
    streak += 1;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

function getGoalName(goal?: string | null) {
  if (goal === "gain") return "Muscle Gain";
  if (goal === "lose") return "Fat Loss";
  return "Balanced Fitness";
}

function getGoalDescription(goal?: string | null) {
  if (goal === "gain") {
    return "Build muscle with progressive strength training.";
  }

  if (goal === "lose") {
    return "Reduce body fat while maintaining muscle and strength.";
  }

  return "Improve strength, conditioning and overall fitness.";
}

function getWorkoutName(goal?: string | null) {
  if (goal === "gain") return "Upper Body Hypertrophy";
  if (goal === "lose") return "Full Body Metabolic";
  return "Full Body Strength";
}

function getActivityName(activity?: string | null) {
  if (activity === "sedentary") return "Low activity";
  if (activity === "light") return "Light activity";
  if (activity === "moderate") return "Moderate activity";
  if (activity === "high") return "High activity";
  if (activity === "very_high") return "Very high activity";

  return "Not selected";
}

function getFirstName(profile: Profile | null) {
  const name = profile?.full_name?.trim();

  if (!name) return "Athlete";

  return name.split(" ")[0];
}

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiUsage, setAiUsage] = useState<AIUsage>({
    coach_messages_used: 0,
    food_scans_used: 0,
  });
  const [nutritionLog, setNutritionLog] =
    useState<NutritionLog | null>(null);
  const [weeklyNutritionLogs, setWeeklyNutritionLogs] = useState<
    NutritionLog[]
  >([]);
  const [todayMeals, setTodayMeals] = useState<MealSummary[]>([]);
  const [latestFoodScan, setLatestFoodScan] =
    useState<LatestFoodScan | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      const today = getLocalDateString(new Date());
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 6);
      const thirtyDaysAgoString = getLocalDateString(thirtyDaysAgo);

      const [
        { data: profileData, error: profileError },
        { data: usageData, error: usageError },
        { data: nutritionData, error: nutritionError },
        { data: mealsData, error: mealsError },
        { data: recentNutritionData, error: recentNutritionError },
        { data: latestScanData, error: latestScanError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("user_ai_usage")
          .select("coach_messages_used, food_scans_used")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle(),

        supabase
          .from("nutrition_logs")
          .select("log_date, calories, protein, carbs, fats")
          .eq("user_id", user.id)
          .eq("log_date", today)
          .maybeSingle(),

        supabase
          .from("meals")
          .select("id, completed")
          .eq("user_id", user.id)
          .eq("meal_date", today),

        supabase
          .from("nutrition_logs")
          .select("log_date, calories, protein, carbs, fats")
          .eq("user_id", user.id)
          .gte("log_date", thirtyDaysAgoString)
          .lte("log_date", today)
          .order("log_date", {
            ascending: true,
          }),

        supabase
          .from("food_scan_history")
          .select("id, meal_name, total_calories, scanned_at")
          .eq("user_id", user.id)
          .order("scanned_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle(),
      ]);

      if (profileError) {
        setErrorMessage(
          "Не можевме да ги вчитаме твоите податоци. Обиди се повторно.",
        );
        setLoading(false);
        return;
      }

      if (usageError) {
        console.error("Could not load AI usage:", usageError);
      }

      if (nutritionError) {
        console.error("Could not load nutrition log:", nutritionError);
      }

      if (mealsError) {
        console.error("Could not load today's meals:", mealsError);
      }

      if (recentNutritionError) {
        console.error(
          "Could not load weekly nutrition:",
          recentNutritionError,
        );
      }

      if (latestScanError) {
        console.error(
          "Could not load latest food scan:",
          latestScanError,
        );
      }

      if (!profileData?.onboarding_completed) {
        router.replace("/onboarding");
        return;
      }

      setProfile(profileData as Profile);
      setAiUsage({
        coach_messages_used:
          usageData?.coach_messages_used ?? 0,
        food_scans_used:
          usageData?.food_scans_used ?? 0,
      });
      setNutritionLog(
        nutritionData
          ? (nutritionData as NutritionLog)
          : null,
      );
      setTodayMeals(
        (mealsData ?? []) as MealSummary[],
      );
      setWeeklyNutritionLogs(
        (recentNutritionData ?? []) as NutritionLog[],
      );
      setLatestFoodScan(
        latestScanData
          ? (latestScanData as LatestFoodScan)
          : null,
      );
      setLoading(false);
    }

    void loadDashboard();
  }, [router]);

  const calorieTarget = profile?.daily_calories ?? 0;
  const proteinTarget = profile?.protein_grams ?? 0;
  const carbsTarget = profile?.carbs_grams ?? 0;
  const fatTarget = profile?.fat_grams ?? 0;

  const consumedCalories = Math.round(
    Number(nutritionLog?.calories ?? 0),
  );
  const consumedProtein = Math.round(
    Number(nutritionLog?.protein ?? 0),
  );
  const consumedCarbs = Math.round(
    Number(nutritionLog?.carbs ?? 0),
  );
  const consumedFat = Math.round(
    Number(nutritionLog?.fats ?? 0),
  );

  const completedMealsToday = todayMeals.filter(
    (meal) => meal.completed,
  ).length;

  const nutritionStreak = useMemo(
    () => calculateNutritionStreak(weeklyNutritionLogs),
    [weeklyNutritionLogs],
  );

  const lastSevenDays = useMemo(() => {
    const byDate = new Map(
      weeklyNutritionLogs.map((log) => [
        log.log_date,
        log,
      ]),
    );

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));

      const dateKey = getLocalDateString(date);
      const log = byDate.get(dateKey);

      return {
        dateKey,
        label: new Intl.DateTimeFormat("en", {
          weekday: "short",
        }).format(date),
        calories: Math.round(
          Number(log?.calories ?? 0),
        ),
      };
    });
  }, [weeklyNutritionLogs]);

  const maximumWeeklyCalories = Math.max(
    calorieTarget,
    ...lastSevenDays.map((day) => day.calories),
    1,
  );

  const caloriePercentage = useMemo(() => {
    if (!calorieTarget) return 0;

    return Math.min(
      100,
      Math.round((consumedCalories / calorieTarget) * 100),
    );
  }, [calorieTarget, consumedCalories]);

  const coachMessagesRemaining = Math.max(
    15 - aiUsage.coach_messages_used,
    0,
  );

  const foodScansRemaining = Math.max(
    2 - aiUsage.food_scans_used,
    0,
  );

  const completedWorkouts = weekDays.filter(
    (item) => item.completed,
  ).length;

  async function handleLogout() {
    setLoggingOut(true);

    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

          <p className="mt-5 text-sm text-zinc-400">
            Preparing your dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] px-5 text-white">
        <section className="w-full max-w-md rounded-3xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-2xl">
            !
          </div>

          <h1 className="mt-5 text-2xl font-black">
            Something went wrong
          </h1>

          <p className="mt-3 leading-7 text-zinc-400">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-7 rounded-2xl bg-purple-600 px-6 py-3 font-bold transition hover:bg-purple-500"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 hidden md:block">
        <div className="absolute left-[15%] top-[-350px] h-[700px] w-[700px] rounded-full bg-purple-700/20 blur-[90px]" />

        <div className="absolute -right-72 top-[35%] h-[650px] w-[650px] rounded-full bg-fuchsia-900/10 blur-[90px]" />

        <div className="absolute bottom-[-350px] left-[35%] h-[650px] w-[650px] rounded-full bg-violet-900/10 blur-[90px]" />
      </div>

      <div className="relative flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/[0.06] bg-[#08080c]/90 p-6 backdrop-blur-xl lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-3 px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/25 bg-purple-500/10 text-xl font-black text-purple-300 shadow-[0_0_30px_rgba(139,92,246,0.16)]">
              Z
            </div>

            <div>
              <p className="font-black tracking-[0.25em]">
                ZENTRO
              </p>

              <p className="mt-1 text-[10px] tracking-[0.18em] text-zinc-600">
                FITNESS INTELLIGENCE
              </p>
            </div>
          </Link>

          <nav className="mt-12 space-y-2">
            {navigation.map((item, index) => {
              const active = index === 0;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group flex items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                    active
                      ? "border border-purple-500/20 bg-purple-500/10 text-white shadow-[0_0_25px_rgba(139,92,246,0.08)]"
                      : "border border-transparent text-zinc-500 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${
                      active
                        ? "bg-purple-500/15 text-purple-300"
                        : "bg-white/[0.03] text-zinc-600 group-hover:text-purple-300"
                    }`}
                  >
                    {item.icon}
                  </span>

                  {item.label}

                  {item.label === "AI Coach" && (
                    <span className="ml-auto rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[9px] font-bold text-purple-300">
                      PRO
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto">
            <Link
              href="/pricing"
              className="group block overflow-hidden rounded-3xl border border-purple-500/25 bg-gradient-to-br from-purple-700/30 via-violet-700/20 to-transparent p-5 transition duration-300 md:hover:scale-[1.02] hover:border-purple-400/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 text-xl text-purple-300 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                ✦
              </div>

              <h3 className="mt-4 text-lg font-black text-white">
                Unlock Zentro Pro
              </h3>

              <p className="mt-2 text-xs leading-6 text-zinc-400">
                Unlock AI Coach, meal scanner, premium workout plans and advanced progress insights.
              </p>

              <div className="mt-5 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-4 py-3 text-center text-sm font-bold text-white transition group-hover:from-purple-500 group-hover:to-violet-400">
                Upgrade now →
              </div>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-4 flex w-full items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-sm font-semibold text-zinc-500 transition hover:border-red-500/20 hover:bg-red-500/[0.05] hover:text-red-300 disabled:opacity-50"
            >
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>

        </aside>

        <div className="w-full lg:pl-72">
          {/* Mobile header */}
          <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#08080c] px-4 py-4 lg:hidden">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">
                  Good morning 👋
                </p>

                <h1 className="truncate text-2xl font-black">
                  {getFirstName(profile)}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]"
                >
                  ☰
                </button>

                <Link
                  href="/profile"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15 font-black text-purple-300"
                >
                  {getFirstName(profile).charAt(0).toUpperCase()}
                </Link>
              </div>
            </div>
          </header>

          {/* Mobile navigation drawer */}
          {mobileMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden"
              />

              <aside className="fixed inset-y-0 left-0 z-50 flex h-screen w-[86%] max-w-[340px] flex-col overflow-y-auto border-r border-white/[0.08] bg-[#08080c] p-5 shadow-2xl lg:hidden">
                <div className="flex items-center justify-between">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-400/25 bg-purple-500/10 text-lg font-black text-purple-300">
                      Z
                    </div>

                    <div>
                      <p className="font-black tracking-[0.2em]">ZENTRO</p>
                      <p className="mt-1 text-[9px] tracking-[0.16em] text-zinc-600">
                        FITNESS INTELLIGENCE
                      </p>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close navigation menu"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-xl text-zinc-500"
                  >
                    ×
                  </button>
                </div>

                <nav className="mt-8 flex-1 space-y-2 overflow-y-auto pb-10">
                  {navigation.map((item, index) => {
                    const active = index === 0;

                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group flex items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                          active
                            ? "border border-purple-500/20 bg-purple-500/10 text-white"
                            : "border border-transparent text-zinc-500 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-white"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${
                            active
                              ? "bg-purple-500/15 text-purple-300"
                              : "bg-white/[0.03] text-zinc-600 group-hover:text-purple-300"
                          }`}
                        >
                          {item.icon}
                        </span>

                        {item.label}

                        {item.label === "AI Coach" && (
                          <span className="ml-auto rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[9px] font-bold text-purple-300">
                            PRO
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>

                <div className="mt-auto space-y-3">
                  <Link
                    href="/pricing"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-4 text-center text-sm font-bold"
                  >
                    Upgrade to Zentro Pro
                  </Link>

                  <button
                    type="button"
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await handleLogout();
                    }}
                    disabled={loggingOut}
                    className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-sm font-bold text-zinc-400 disabled:opacity-50"
                  >
                    {loggingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              </aside>
            </>
          )}

          
          <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#08080c]/95 px-2 py-2 backdrop-blur-lg lg:hidden">
            <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
              <Link href="/dashboard" className="rounded-xl px-2 py-2 text-center text-[10px] font-bold text-purple-300">
                <div className="text-lg">⌂</div>
                Home
              </Link>

              <Link href="/programs" className="rounded-xl px-2 py-2 text-center text-[10px] text-zinc-500">
                <div className="text-lg">◈</div>
                Train
              </Link>

              <Link href="/nutrition/history" className="rounded-xl px-2 py-2 text-center text-[10px] text-zinc-500">
                <div className="text-lg">◎</div>
                Food
              </Link>

              <Link href="/coach" className="rounded-xl px-2 py-2 text-center text-[10px] text-zinc-500">
                <div className="text-lg">✦</div>
                Coach
              </Link>

              <Link href="/profile" className="rounded-xl px-2 py-2 text-center text-[10px] text-zinc-500">
                <div className="text-lg">○</div>
                Profile
              </Link>
            </div>
          </nav>

<div className="mx-auto max-w-[1500px] px-4 py-7 pb-28 sm:px-8 lg:px-10 lg:py-10">
            {/* Top header */}
            <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
                  PERSONAL DASHBOARD
                </p>

                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  Welcome back, {getFirstName(profile)}
                </h1>

                <p className="mt-2 text-sm text-zinc-500">
                  Your plan is ready. Stay consistent and keep moving.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/onboarding"
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:border-purple-500/30 hover:bg-purple-500/[0.06]"
                >
                  Edit plan
                </Link>

                <Link
                  href="/programs"
                  className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.2)] transition md:hover:scale-[1.02]"
                >
                  Start workout
                </Link>
              </div>
            </header>

            {/* Main stats */}
            <section className="mt-9 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <article className="group rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-600/15 via-purple-950/10 to-transparent p-6 transition md:hover:-translate-y-1 hover:border-purple-500/35">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-300">
                    ◎
                  </div>

                  <span className="rounded-full bg-purple-500/10 px-3 py-1 text-[10px] font-bold text-purple-300">
                    DAILY TARGET
                  </span>
                </div>

                <p className="mt-6 text-sm text-zinc-500">
                  Calories
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <p className="text-3xl font-black">
                    {calorieTarget.toLocaleString()}
                  </p>

                  <span className="pb-1 text-sm text-zinc-500">
                    kcal
                  </span>
                </div>

                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500"
                    style={{
                      width: `${caloriePercentage}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs text-zinc-600">
                  {consumedCalories.toLocaleString()} consumed today
                </p>
              </article>

              <article className="group rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 transition md:hover:-translate-y-1 hover:border-purple-500/25">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
                  ◈
                </div>

                <p className="mt-6 text-sm text-zinc-500">
                  Current goal
                </p>

                <p className="mt-2 text-2xl font-black">
                  {getGoalName(profile?.goal)}
                </p>

                <p className="mt-3 text-xs leading-5 text-zinc-600">
                  {getGoalDescription(profile?.goal)}
                </p>
              </article>

              <article className="group rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 transition md:hover:-translate-y-1 hover:border-purple-500/25">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-300">
                  ↗
                </div>

                <p className="mt-6 text-sm text-zinc-500">
                  Training frequency
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <p className="text-3xl font-black">
                    {profile?.training_days ?? 0}
                  </p>

                  <span className="pb-1 text-sm text-zinc-500">
                    days / week
                  </span>
                </div>

                <p className="mt-3 text-xs text-zinc-600">
                  {profile?.experience ?? "Beginner"} level
                </p>
              </article>

              <article className="group rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 transition md:hover:-translate-y-1 hover:border-purple-500/25">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                  ✓
                </div>

                <p className="mt-6 text-sm text-zinc-500">
                  Weekly completion
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <p className="text-3xl font-black">
                    {completedWorkouts}
                  </p>

                  <span className="pb-1 text-sm text-zinc-500">
                    workouts
                  </span>
                </div>

                <p className="mt-3 text-xs text-emerald-400">
                  Great consistency this week
                </p>
              </article>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              {/* Today's workout */}
              <article className="relative overflow-hidden rounded-[32px] border border-purple-500/15 bg-[#0b0b10]/90 p-6 sm:p-8">
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-purple-600/15 blur-[80px]" />

                <div className="relative">
                  <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-purple-300">
                          TODAY&apos;S WORKOUT
                        </span>

                        <span className="flex items-center gap-2 text-xs text-zinc-500">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          Ready
                        </span>
                      </div>

                      <h2 className="mt-5 text-3xl font-black sm:text-4xl">
                        {getWorkoutName(profile?.goal)}
                      </h2>

                      <p className="mt-3 max-w-xl leading-7 text-zinc-400">
                        A focused session personalized to your current
                        goal and experience level.
                      </p>
                    </div>

                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-purple-400/20 bg-purple-500/10 text-3xl text-purple-300 shadow-[0_0_35px_rgba(139,92,246,0.15)]">
                      ◈
                    </div>
                  </div>

                  <div className="mt-8 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <p className="text-xs text-zinc-600">
                        Duration
                      </p>

                      <p className="mt-2 font-bold">50 min</p>
                    </div>

                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <p className="text-xs text-zinc-600">
                        Exercises
                      </p>

                      <p className="mt-2 font-bold">7</p>
                    </div>

                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <p className="text-xs text-zinc-600">
                        Intensity
                      </p>

                      <p className="mt-2 font-bold">Moderate</p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/programs"
                      className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-7 py-4 text-center text-sm font-bold shadow-[0_0_35px_rgba(139,92,246,0.2)] transition md:hover:scale-[1.02]"
                    >
                      Start workout →
                    </Link>

                    <Link
                      href="/programs"
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-7 py-4 text-center text-sm font-bold text-zinc-300 transition hover:border-purple-500/30"
                    >
                      View exercises
                    </Link>
                  </div>
                </div>
              </article>

              {/* Weekly activity */}
              <article className="rounded-[32px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">
                      Weekly activity
                    </p>

                    <h2 className="mt-2 text-2xl font-black">
                      {completedWorkouts} sessions
                    </h2>
                  </div>

                  <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-300">
                    ON TRACK
                  </span>
                </div>

                <div className="mt-8 flex justify-between gap-2">
                  {weekDays.map((item) => (
                    <div
                      key={item.day}
                      className="flex flex-1 flex-col items-center gap-3"
                    >
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xs font-bold ${
                          item.completed
                            ? "border-purple-500/35 bg-purple-500/15 text-purple-200 shadow-[0_0_15px_rgba(139,92,246,0.12)]"
                            : "border-white/[0.06] bg-white/[0.02] text-zinc-700"
                        }`}
                      >
                        {item.completed ? "✓" : "·"}
                      </div>

                      <span className="text-[10px] text-zinc-600">
                        {item.day}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">
                      Weekly target
                    </span>

                    <span className="font-bold text-purple-300">
                      {completedWorkouts}/
                      {profile?.training_days ?? 4}
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-400"
                      style={{
                        width: `${Math.min(
                          100,
                          (completedWorkouts /
                            Math.max(
                              profile?.training_days ?? 4,
                              1,
                            )) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </article>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.75fr]">
              {/* Nutrition */}
              <article className="rounded-[32px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm text-zinc-500">
                      Today&apos;s nutrition
                    </p>

                    <h2 className="mt-2 text-2xl font-black">
                      Macro targets
                    </h2>
                  </div>

                  <Link
                    href="/nutrition/tracker"
                    className="text-sm font-bold text-purple-400 transition hover:text-purple-300"
                  >
                    Open nutrition →
                  </Link>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  <MacroCard
                    label="Protein"
                    consumed={consumedProtein}
                    target={proteinTarget}
                    unit="g"
                    icon="P"
                  />

                  <MacroCard
                    label="Carbs"
                    consumed={consumedCarbs}
                    target={carbsTarget}
                    unit="g"
                    icon="C"
                  />

                  <MacroCard
                    label="Fats"
                    consumed={consumedFat}
                    target={fatTarget}
                    unit="g"
                    icon="F"
                  />
                </div>
              </article>

              {/* Profile overview */}
              <article className="rounded-[32px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-violet-500 text-xl font-black shadow-[0_0_30px_rgba(139,92,246,0.2)]">
                    {getFirstName(profile).charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">
                      {profile?.full_name || "Zentro Athlete"}
                    </p>

                    <p className="truncate text-sm text-zinc-500">
                      {email}
                    </p>
                  </div>
                </div>

                <div className="mt-7 space-y-4">
                  <ProfileRow
                    label="Weight"
                    value={`${profile?.weight_kg ?? "—"} kg`}
                  />

                  <ProfileRow
                    label="Height"
                    value={`${profile?.height_cm ?? "—"} cm`}
                  />

                  <ProfileRow
                    label="Activity"
                    value={getActivityName(profile?.activity)}
                  />

                  <ProfileRow
                    label="Experience"
                    value={
                      profile?.experience
                        ? profile.experience.charAt(0).toUpperCase() +
                          profile.experience.slice(1)
                        : "Not selected"
                    }
                  />
                </div>

                <Link
                  href="/profile"
                  className="mt-7 block rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-3 text-center text-sm font-bold text-zinc-300 transition hover:border-purple-500/30 hover:bg-purple-500/[0.05]"
                >
                  Manage profile
                </Link>
              </article>
            </section>

            {/* Real nutrition insights */}
            <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.85fr]">
              <article className="rounded-[32px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm text-zinc-500">
                      Last 7 days
                    </p>

                    <h2 className="mt-2 text-2xl font-black">
                      Calorie activity
                    </h2>
                  </div>

                  <Link
                    href="/nutrition/tracker"
                    className="text-sm font-bold text-purple-400 transition hover:text-purple-300"
                  >
                    Open tracker →
                  </Link>
                </div>

                <div className="mt-8 flex h-48 items-end gap-3">
                  {lastSevenDays.map((day) => {
                    const height = Math.max(
                      6,
                      Math.round(
                        (day.calories /
                          maximumWeeklyCalories) *
                          100,
                      ),
                    );

                    return (
                      <div
                        key={day.dateKey}
                        className="flex min-w-0 flex-1 flex-col items-center gap-3"
                      >
                        <div className="flex h-36 w-full items-end rounded-2xl bg-white/[0.025] p-1.5">
                          <div
                            className="w-full rounded-xl bg-gradient-to-t from-purple-600 to-violet-400 transition-all duration-500"
                            style={{
                              height: `${height}%`,
                            }}
                          />
                        </div>

                        <div className="text-center">
                          <p className="text-[10px] font-bold text-zinc-500">
                            {day.label}
                          </p>

                          <p className="mt-1 text-[9px] text-zinc-700">
                            {day.calories}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="rounded-[32px] border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.06] to-[#0b0b10] p-6 sm:p-8">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold tracking-[0.18em] text-emerald-400">
                      TODAY&apos;S PROGRESS
                    </p>

                    <h2 className="mt-3 text-2xl font-black">
                      Real nutrition stats
                    </h2>
                  </div>

                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-300">
                    LIVE
                  </span>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  <DashboardStat
                    label="Meals logged"
                    value={`${todayMeals.length}`}
                  />

                  <DashboardStat
                    label="Completed"
                    value={`${completedMealsToday}`}
                  />

                  <DashboardStat
                    label="Calories left"
                    value={`${Math.max(
                      calorieTarget - consumedCalories,
                      0,
                    )} kcal`}
                  />

                  <DashboardStat
                    label="Nutrition streak"
                    value={`${nutritionStreak} days`}
                  />
                </div>

                <div className="mt-6 border-t border-white/[0.06] pt-6">
                  {latestFoodScan ? (
                    <Link
                      href="/nutrition/history"
                      className="group block rounded-2xl border border-white/[0.06] bg-black/20 p-5 transition hover:border-emerald-500/20"
                    >
                      <p className="text-xs font-bold tracking-[0.14em] text-zinc-600">
                        LATEST AI FOOD SCAN
                      </p>

                      <div className="mt-3 flex items-end justify-between gap-5">
                        <div>
                          <p className="text-lg font-black">
                            {latestFoodScan.meal_name}
                          </p>

                          <p className="mt-2 text-xs text-zinc-600">
                            {formatRelativeTime(
                              latestFoodScan.scanned_at,
                            )}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xl font-black text-emerald-300">
                            {Math.round(
                              Number(
                                latestFoodScan.total_calories,
                              ),
                            )}
                          </p>

                          <p className="text-xs text-zinc-600">
                            kcal
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 text-sm font-bold text-emerald-400 transition md:group-hover:translate-x-1">
                        View details →
                      </p>
                    </Link>
                  ) : (
                    <Link
                      href="/nutrition/scan"
                      className="block rounded-2xl border border-dashed border-white/[0.08] p-5 text-center text-sm font-bold text-purple-400"
                    >
                      Scan your first meal →
                    </Link>
                  )}
                </div>
              </article>
            </section>

            {/* AI usage and meal scanner */}
            <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <article className="rounded-[32px] border border-purple-500/20 bg-gradient-to-br from-purple-600/15 via-purple-950/10 to-[#0b0b10] p-6 sm:p-8">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold tracking-[0.18em] text-purple-400">
                      ZENTRO PRO AI
                    </p>

                    <h2 className="mt-3 text-2xl font-black">
                      Daily AI allowance
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-zinc-500">
                      Your limits reset automatically every day.
                    </p>
                  </div>

                  <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-[10px] font-bold text-purple-300">
                    PRO
                  </span>
                </div>

                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <AIUsageCard
                    label="AI Coach"
                    used={aiUsage.coach_messages_used}
                    limit={15}
                    remaining={coachMessagesRemaining}
                    href="/coach"
                    icon="✦"
                  />

                  <AIUsageCard
                    label="Food scans"
                    used={aiUsage.food_scans_used}
                    limit={2}
                    remaining={foodScansRemaining}
                    href="/nutrition/scan"
                    icon="◎"
                  />
                </div>
              </article>

              <Link
                href="/nutrition/scan"
                className="group relative overflow-hidden rounded-[32px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-[#0b0b10] to-[#0b0b10] p-6 transition md:hover:-translate-y-1 hover:border-emerald-400/35 sm:p-8"
              >
                <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-[70px]" />

                <div className="relative flex h-full flex-col justify-between gap-8">
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-2xl text-emerald-300">
                      ◉
                    </div>

                    <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-[10px] font-bold text-purple-300">
                      AI POWERED
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold tracking-[0.18em] text-emerald-400">
                      SMART NUTRITION
                    </p>

                    <h2 className="mt-3 text-3xl font-black">
                      Scan your meal
                    </h2>

                    <p className="mt-4 max-w-xl leading-7 text-zinc-500">
                      Take a photo of your food and get an instant estimate
                      of calories, protein, carbs, fats and ingredients.
                    </p>

                    <div className="mt-6 flex items-center justify-between gap-4">
                      <span className="text-sm font-bold text-emerald-300">
                        {foodScansRemaining}/2 scans remaining today
                      </span>

                      <span className="text-sm font-bold text-white transition md:group-hover:translate-x-1">
                        Open scanner →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </section>

            {/* Quick actions */}
            <section className="mt-6">
              <div className="mb-5">
                <p className="text-sm font-bold tracking-[0.18em] text-purple-400">
                  QUICK ACTIONS
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Continue your journey
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <QuickAction
                  href="/programs"
                  icon="◈"
                  title="Browse workouts"
                  description="Explore structured fitness programs."
                />

                <QuickAction
                  href="/nutrition/tracker"
                  icon="◎"
                  title="Nutrition plan"
                  description="View meals and daily macro targets."
                />

                <QuickAction
                  href="/progress"
                  icon="↗"
                  title="Track progress"
                  description="Record weight and body measurements."
                />

                <QuickAction
                  href="/coach"
                  icon="✦"
                  title="Ask AI Coach"
                  description="Get guidance based on your goal."
                  pro
                />

                <QuickAction
                  href="/workout-builder"
                  icon="🏋️"
                  title="Workout Builder"
                  description="Create personalized workouts based on your goals, experience and equipment."
                  pro
                />

                <QuickAction
                  href="/community"
                  icon="👥"
                  title="Zentro Community"
                  description="Share posts, photos and progress with other Zentro athletes."
                />

                <QuickAction
                  href="/nutrition/scan"
                  icon="◉"
                  title="Scan your meal"
                  description="Estimate calories and macros from a photo."
                  pro
                />

                <QuickAction
                  href="/nutrition/history"
                  icon="◌"
                  title="Nutrition history"
                  description="View your scanned meals and calorie history."
                  pro
                />
              </div>
            </section>

            <footer className="mt-10 flex flex-col justify-between gap-4 border-t border-white/[0.05] py-7 text-xs text-zinc-700 sm:flex-row">
              <p>© 2026 ZENTRO. Train. Fuel. Evolve.</p>

              <p>
                Fitness estimates are informational and not medical advice.
              </p>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}

function DashboardStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <p className="text-[10px] text-zinc-600">
        {label}
      </p>

      <p className="mt-2 text-lg font-black">
        {value}
      </p>
    </div>
  );
}

type AIUsageCardProps = {
  label: string;
  used: number;
  limit: number;
  remaining: number;
  href: string;
  icon: string;
};

function AIUsageCard({
  label,
  used,
  limit,
  remaining,
  href,
  icon,
}: AIUsageCardProps) {
  const percentage = Math.min(
    100,
    Math.round((used / Math.max(limit, 1)) * 100),
  );

  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/[0.07] bg-black/20 p-5 transition hover:border-purple-500/30 hover:bg-purple-500/[0.04]"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 font-black text-purple-300">
          {icon}
        </div>

        <span className="text-xs font-bold text-zinc-500">
          {remaining} left
        </span>
      </div>

      <p className="mt-5 font-bold">{label}</p>

      <p className="mt-2 text-sm text-zinc-600">
        {used}/{limit} used today
      </p>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-400"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </Link>
  );
}

type MacroCardProps = {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  icon: string;
};

function MacroCard({
  label,
  consumed,
  target,
  unit,
  icon,
}: MacroCardProps) {
  const percentage =
    target > 0
      ? Math.min(100, Math.round((consumed / target) * 100))
      : 0;

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-sm font-black text-purple-300">
          {icon}
        </div>

        <span className="text-xs font-bold text-zinc-600">
          {percentage}%
        </span>
      </div>

      <p className="mt-5 text-sm text-zinc-500">{label}</p>

      <p className="mt-2 text-xl font-black">
        {consumed}
        <span className="ml-1 text-xs font-normal text-zinc-600">
          / {target} {unit}
        </span>
      </p>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-400"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

type ProfileRowProps = {
  label: string;
  value: string;
};

function ProfileRow({ label, value }: ProfileRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] pb-4 text-sm last:border-none last:pb-0">
      <span className="text-zinc-600">{label}</span>
      <span className="font-semibold text-zinc-300">{value}</span>
    </div>
  );
}

type QuickActionProps = {
  href: string;
  icon: string;
  title: string;
  description: string;
  pro?: boolean;
};

function QuickAction({
  href,
  icon,
  title,
  description,
  pro = false,
}: QuickActionProps) {
  return (
    <Link
      href={href}
      className="group relative rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 transition duration-300 md:hover:-translate-y-1 hover:border-purple-500/30 hover:bg-purple-500/[0.04]"
    >
      {pro && (
        <span className="absolute right-5 top-5 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[9px] font-bold text-purple-300">
          PRO
        </span>
      )}

      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-xl text-purple-300 transition group-hover:bg-purple-500/15">
        {icon}
      </div>

      <h3 className="mt-5 font-bold">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-zinc-600">
        {description}
      </p>

      <p className="mt-5 text-sm font-bold text-purple-400">
        Open →
      </p>
    </Link>
  );
}
