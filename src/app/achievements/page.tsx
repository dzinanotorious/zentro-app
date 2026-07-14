"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isProUser } from "@/lib/subscription";

type UserLevel = {
  total_xp: number;
  current_level: number;
  current_rank: string;
  updated_at: string;
};

type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  xp_reward: number;
  requirement_value: number;
  icon: string;
  is_premium: boolean;
};

type UserAchievement = {
  achievement_id: string;
  unlocked_at: string;
};

type XpTransaction = {
  id: string;
  amount: number;
  reason: string;
  source_type: string | null;
  created_at: string;
};

const categoryFilters = [
  { value: "all", label: "All achievements" },
  { value: "workout", label: "Workouts" },
  { value: "streak", label: "Streaks" },
  { value: "progress", label: "Progress" },
  { value: "nutrition", label: "Nutrition" },
  { value: "strength", label: "Strength" },
];

const rankLevels = [
  {
    rank: "Rookie",
    minimumLevel: 1,
    description: "Your fitness journey has started.",
  },
  {
    rank: "Athlete",
    minimumLevel: 5,
    description: "Consistency is becoming part of your lifestyle.",
  },
  {
    rank: "Warrior",
    minimumLevel: 10,
    description: "You have built serious training discipline.",
  },
  {
    rank: "Champion",
    minimumLevel: 15,
    description: "Your commitment separates you from the average.",
  },
  {
    rank: "Elite",
    minimumLevel: 20,
    description: "You have reached the highest Zentro rank.",
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCategory(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function AchievementsPage() {
  const router = useRouter();

  const [level, setLevel] = useState<UserLevel | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<UserAchievement[]>([]);
  const [transactions, setTransactions] = useState<XpTransaction[]>([]);

  const [category, setCategory] = useState("all");
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [hasPro, setHasPro] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(true);

  useEffect(() => {
    async function checkSubscription() {
      const pro = await isProUser();

      setHasPro(pro);
      setCheckingPlan(false);
    }

    void checkSubscription();
  }, []);

  useEffect(() => {
    async function loadRewards() {
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

      /*
       * Синхронизира achievements и XP пред вчитување.
       * Ако нема нов achievement, функцијата нема да додаде дупликат.
       */
      const { error: rewardError } = await supabase.rpc(
        "update_user_rewards",
      );

      if (rewardError) {
        console.error("Reward synchronization failed:", rewardError);
      }

      const [
        { data: levelData, error: levelError },
        { data: achievementData, error: achievementError },
        { data: unlockedData, error: unlockedError },
        { data: transactionData, error: transactionError },
      ] = await Promise.all([
        supabase
          .from("user_levels")
          .select(
            "total_xp, current_level, current_rank, updated_at",
          )
          .eq("user_id", user.id)
          .maybeSingle(),

        supabase
          .from("achievements")
          .select(
            "id, code, title, description, category, xp_reward, requirement_value, icon, is_premium",
          )
          .eq("active", true)
          .order("xp_reward", {
            ascending: true,
          }),

        supabase
          .from("user_achievements")
          .select("achievement_id, unlocked_at")
          .eq("user_id", user.id),

        supabase
          .from("xp_transactions")
          .select(
            "id, amount, reason, source_type, created_at",
          )
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(20),
      ]);

      const firstError =
        levelError ||
        achievementError ||
        unlockedError ||
        transactionError;

      if (firstError) {
        setMessage(firstError.message);
        setLoading(false);
        return;
      }

      setLevel(
        (levelData as UserLevel | null) ?? {
          total_xp: 0,
          current_level: 1,
          current_rank: "Rookie",
          updated_at: new Date().toISOString(),
        },
      );

      setAchievements(
        (achievementData ?? []) as Achievement[],
      );

      setUnlocked(
        (unlockedData ?? []) as UserAchievement[],
      );

      setTransactions(
        (transactionData ?? []) as XpTransaction[],
      );

      setLoading(false);
    }

    void loadRewards();
  }, [router]);

  const unlockedMap = useMemo(() => {
    return new Map(
      unlocked.map((item) => [
        item.achievement_id,
        item.unlocked_at,
      ]),
    );
  }, [unlocked]);

  const filteredAchievements = useMemo(() => {
    return achievements.filter((achievement) => {
      const matchesCategory =
        category === "all" ||
        achievement.category === category;

      const matchesUnlocked =
        !showUnlockedOnly ||
        unlockedMap.has(achievement.id);

      return matchesCategory && matchesUnlocked;
    });
  }, [
    achievements,
    category,
    showUnlockedOnly,
    unlockedMap,
  ]);

  const totalXp = Number(level?.total_xp ?? 0);
  const currentLevel = Number(level?.current_level ?? 1);

  const xpPerLevel = 500;
  const xpInsideLevel = totalXp % xpPerLevel;
  const xpUntilNextLevel =
    xpInsideLevel === 0 && totalXp > 0
      ? xpPerLevel
      : xpPerLevel - xpInsideLevel;

  const levelProgress =
    totalXp === 0
      ? 0
      : xpInsideLevel === 0
        ? 0
        : Math.round((xpInsideLevel / xpPerLevel) * 100);

  const unlockedXp = achievements
    .filter((achievement) => unlockedMap.has(achievement.id))
    .reduce(
      (total, achievement) =>
        total + Number(achievement.xp_reward),
      0,
    );

  const completionPercentage =
    achievements.length > 0
      ? Math.round(
          (unlocked.length / achievements.length) * 100,
        )
      : 0;

  const nextLockedAchievement =
    achievements.find(
      (achievement) => !unlockedMap.has(achievement.id),
    ) ?? null;

  if (checkingPlan) {
    return null;
  }

  if (!hasPro) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-white">
        <div className="max-w-2xl rounded-[34px] border border-purple-500/20 bg-gradient-to-br from-purple-600/15 to-black p-8 text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-purple-400">
            ZENTRO PRO
          </p>

          <h1 className="mt-4 text-4xl font-black">
            Premium Achievements
          </h1>

          <p className="mt-5 text-zinc-500">
            Unlock all badges, premium rewards, exclusive XP bonuses and advanced ranks with Zentro Pro.
          </p>

          <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
            {[
              'Exclusive achievements',
              'Premium XP rewards',
              'Advanced ranks',
              'Special badges',
            ].map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-sm"
              >
                ✓ {feature}
              </div>
            ))}
          </div>

          <Link
            href="/pricing"
            className="mt-8 inline-block rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-8 py-4 font-bold"
          >
            Upgrade to Zentro Pro
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

          <p className="mt-5 text-sm text-zinc-400">
            Loading your rewards...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[8%] top-[-380px] h-[800px] w-[800px] rounded-full bg-purple-700/20 blur-[180px]" />

        <div className="absolute -right-80 top-[35%] h-[700px] w-[700px] rounded-full bg-amber-700/10 blur-[180px]" />

        <div className="absolute bottom-[-400px] left-[35%] h-[700px] w-[700px] rounded-full bg-violet-900/10 blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-[1550px] px-5 py-7 sm:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-6 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
              ZENTRO REWARDS
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Earn every achievement.
            </h1>

            <p className="mt-4 max-w-2xl leading-8 text-zinc-500">
              Build your rank through workouts, streaks,
              nutrition consistency, progress tracking and new
              personal records.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/calendar"
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-purple-500/30"
            >
              Calendar
            </Link>

            <Link
              href="/dashboard"
              className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.2)]"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {message}
          </div>
        )}

        <section className="relative mt-8 overflow-hidden rounded-[38px] border border-purple-500/20 bg-gradient-to-br from-purple-600/20 via-purple-950/15 to-black p-7 sm:p-10">
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-purple-500/20 blur-[100px]" />

          <div className="relative grid gap-10 xl:grid-cols-[auto_1fr_auto] xl:items-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-[36px] border border-purple-400/25 bg-purple-500/15 text-center shadow-[0_0_50px_rgba(139,92,246,0.18)]">
              <div>
                <p className="text-xs font-bold tracking-[0.15em] text-purple-300">
                  LEVEL
                </p>

                <p className="mt-1 text-5xl font-black">
                  {currentLevel}
                </p>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-purple-400/25 bg-purple-500/15 px-4 py-2 text-[10px] font-bold tracking-[0.15em] text-purple-200">
                  CURRENT RANK
                </span>

                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-[10px] font-bold text-amber-200">
                  {level?.current_rank ?? "Rookie"}
                </span>
              </div>

              <h2 className="mt-5 text-3xl font-black sm:text-5xl">
                {totalXp.toLocaleString()} XP earned
              </h2>

              <p className="mt-3 text-sm text-zinc-500">
                {xpUntilNextLevel.toLocaleString()} XP remaining
                until Level {currentLevel + 1}
              </p>

              <div className="mt-6 h-3 max-w-3xl overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 via-violet-400 to-amber-300 transition-all duration-700"
                  style={{
                    width: `${levelProgress}%`,
                  }}
                />
              </div>

              <div className="mt-3 flex max-w-3xl justify-between text-xs text-zinc-600">
                <span>
                  {xpInsideLevel.toLocaleString()} XP
                </span>

                <span>{xpPerLevel} XP</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:w-[330px]">
              <MiniStat
                label="Unlocked"
                value={`${unlocked.length}`}
              />

              <MiniStat
                label="Completion"
                value={`${completionPercentage}%`}
              />

              <MiniStat
                label="Reward XP"
                value={`${unlockedXp}`}
              />

              <MiniStat
                label="Total badges"
                value={`${achievements.length}`}
              />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total XP"
            value={totalXp.toLocaleString()}
            description="Lifetime experience points"
            icon="XP"
          />

          <StatCard
            label="Current level"
            value={`${currentLevel}`}
            description={`Rank: ${level?.current_rank ?? "Rookie"}`}
            icon="LV"
          />

          <StatCard
            label="Achievements"
            value={`${unlocked.length}/${achievements.length}`}
            description={`${completionPercentage}% completed`}
            icon="✓"
          />

          <StatCard
            label="Next reward"
            value={
              nextLockedAchievement
                ? `+${nextLockedAchievement.xp_reward}`
                : "Complete"
            }
            description={
              nextLockedAchievement?.title ??
              "All achievements unlocked"
            }
            icon="★"
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_380px]">
          <div>
            <div className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                <div>
                  <p className="text-sm font-bold tracking-[0.18em] text-purple-400">
                    ACHIEVEMENT LIBRARY
                  </p>

                  <h2 className="mt-2 text-3xl font-black">
                    Your badge collection
                  </h2>
                </div>

                <label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-500">
                  <input
                    type="checkbox"
                    checked={showUnlockedOnly}
                    onChange={(event) =>
                      setShowUnlockedOnly(
                        event.target.checked,
                      )
                    }
                    className="h-4 w-4 accent-purple-500"
                  />

                  Show unlocked only
                </label>
              </div>

              <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
                {categoryFilters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(item.value)}
                    className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition ${
                      category === item.value
                        ? "border-purple-500/35 bg-purple-500/15 text-purple-200"
                        : "border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {filteredAchievements.map((achievement) => {
                const unlockedAt = unlockedMap.get(
                  achievement.id,
                );

                const isUnlocked = Boolean(unlockedAt);

                return (
                  <article
                    key={achievement.id}
                    className={`relative overflow-hidden rounded-[32px] border p-6 transition ${
                      isUnlocked
                        ? "border-purple-500/30 bg-gradient-to-br from-purple-600/12 to-white/[0.025] hover:-translate-y-1"
                        : "border-white/[0.06] bg-white/[0.015] opacity-65"
                    }`}
                  >
                    <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-purple-600/10 blur-[65px]" />

                    <div className="relative">
                      <div className="flex items-start justify-between gap-4">
                        <div
                          className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-xl font-black ${
                            isUnlocked
                              ? "border-purple-500/25 bg-purple-500/15 text-purple-200"
                              : "border-white/[0.07] bg-black/20 text-zinc-700"
                          }`}
                        >
                          {isUnlocked ? achievement.icon : "🔒"}
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          {isUnlocked && (
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[9px] font-bold text-emerald-300">
                              UNLOCKED
                            </span>
                          )}

                          {achievement.is_premium && (
                            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[9px] font-bold text-amber-200">
                              PRO
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-purple-400">
                        {formatCategory(
                          achievement.category,
                        )}
                      </p>

                      <h3 className="mt-2 text-2xl font-black">
                        {achievement.title}
                      </h3>

                      <p className="mt-3 min-h-[48px] text-sm leading-6 text-zinc-600">
                        {achievement.description}
                      </p>

                      <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-5">
                        <div>
                          <p className="text-[10px] text-zinc-600">
                            Reward
                          </p>

                          <p className="mt-1 font-black text-purple-300">
                            +{achievement.xp_reward} XP
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-zinc-600">
                            Status
                          </p>

                          <p
                            className={`mt-1 text-sm font-bold ${
                              isUnlocked
                                ? "text-emerald-400"
                                : "text-zinc-600"
                            }`}
                          >
                            {isUnlocked && unlockedAt
                              ? formatDate(unlockedAt)
                              : "Locked"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {filteredAchievements.length === 0 && (
              <div className="mt-5 rounded-[34px] border border-white/[0.07] bg-white/[0.025] p-12 text-center">
                <h3 className="text-2xl font-black">
                  No achievements found
                </h3>

                <p className="mt-3 text-zinc-500">
                  Change the category or disable the unlocked
                  filter.
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7">
              <p className="text-sm text-zinc-500">
                Rank progression
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Road to Elite
              </h2>

              <div className="mt-7 space-y-3">
                {rankLevels.map((rank) => {
                  const reached =
                    currentLevel >= rank.minimumLevel;

                  return (
                    <div
                      key={rank.rank}
                      className={`rounded-2xl border p-4 ${
                        reached
                          ? "border-purple-500/20 bg-purple-500/[0.07]"
                          : "border-white/[0.05] bg-white/[0.015]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p
                            className={`font-bold ${
                              reached
                                ? "text-purple-200"
                                : "text-zinc-600"
                            }`}
                          >
                            {rank.rank}
                          </p>

                          <p className="mt-1 text-xs text-zinc-700">
                            Level {rank.minimumLevel}+
                          </p>
                        </div>

                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                            reached
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "bg-white/[0.03] text-zinc-700"
                          }`}
                        >
                          {reached ? "✓" : "•"}
                        </span>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-zinc-600">
                        {rank.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7">
              <p className="text-sm text-zinc-500">
                Recent XP activity
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Experience history
              </h2>

              <div className="mt-7 space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-xs font-black text-purple-300">
                      +{transaction.amount}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {transaction.reason}
                      </p>

                      <p className="mt-1 text-xs text-zinc-700">
                        {formatDate(transaction.created_at)}
                      </p>
                    </div>
                  </div>
                ))}

                {transactions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] p-7 text-center">
                    <p className="text-sm text-zinc-600">
                      Complete a workout to earn your first XP.
                    </p>
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-[34px] border border-purple-500/15 bg-gradient-to-br from-purple-600/15 to-transparent p-7">
              <p className="text-sm font-bold text-purple-300">
                Earn more XP
              </p>

              <div className="mt-5 space-y-3">
                <Link
                  href="/programs"
                  className="block rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-4 text-center text-sm font-bold"
                >
                  Start a workout
                </Link>

                <Link
                  href="/nutrition/tracker"
                  className="block rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-center text-sm font-bold text-zinc-300"
                >
                  Track nutrition
                </Link>

                <Link
                  href="/progress"
                  className="block rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-center text-sm font-bold text-zinc-300"
                >
                  Add progress entry
                </Link>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: string;
}) {
  return (
    <article className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-purple-500/25">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-xs font-black text-purple-300">
        {icon}
      </div>

      <p className="mt-6 text-sm text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>

      <p className="mt-2 text-xs text-zinc-600">
        {description}
      </p>
    </article>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
      <p className="text-[10px] text-zinc-600">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-bold text-zinc-300">
        {value}
      </p>
    </div>
  );
}
