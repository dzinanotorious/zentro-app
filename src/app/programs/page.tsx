"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isProUser } from "@/lib/subscription";

type WorkoutProgram = {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  difficulty: string;
  duration_weeks: number;
  days_per_week: number;
  is_premium: boolean;
  created_at: string;
};

type Profile = {
  goal: string | null;
  experience: string | null;
  training_days: number | null;
};

const difficultyFilters = [
  { value: "all", label: "All levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const goalFilters = [
  { value: "all", label: "All goals" },
  { value: "muscle_gain", label: "Muscle gain" },
  { value: "strength", label: "Strength" },
  { value: "fat_loss", label: "Fat loss" },
  { value: "general", label: "General fitness" },
];

function formatDifficulty(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatGoal(value: string) {
  if (value === "muscle_gain") return "Muscle Gain";
  if (value === "fat_loss") return "Fat Loss";
  if (value === "strength") return "Strength";

  return "General Fitness";
}

function getProgramIcon(program: WorkoutProgram) {
  const name = program.name.toLowerCase();

  if (name.includes("push") || name.includes("muscle")) return "M";
  if (name.includes("upper")) return "U";
  if (name.includes("fat")) return "F";
  if (name.includes("home")) return "H";
  if (name.includes("beginner")) return "B";

  return "Z";
}

function getProgramFeatures(program: WorkoutProgram) {
  const features = [
    `${program.days_per_week} structured workouts weekly`,
    `${program.duration_weeks}-week progression`,
    "Exercise tracking and workout history",
  ];

  if (program.goal === "muscle_gain") {
    features.push("Progressive overload for muscle growth");
  }

  if (program.goal === "strength") {
    features.push("Strength-focused compound movements");
  }

  if (program.goal === "fat_loss") {
    features.push("Strength and conditioning combination");
  }

  if (program.difficulty === "beginner") {
    features.push("Beginner-friendly exercise guidance");
  }

  if (program.is_premium) {
    features.push("Premium analytics and advanced progression");
  }

  return features;
}

function isRecommended(
  program: WorkoutProgram,
  profile: Profile | null,
) {
  if (!profile) return false;

  const profileGoal =
    profile.goal === "gain"
      ? "muscle_gain"
      : profile.goal === "lose"
        ? "fat_loss"
        : "general";

  const goalMatches =
    program.goal === profileGoal ||
    (profileGoal === "general" && program.goal === "strength");

  const difficultyMatches =
    !profile.experience ||
    program.difficulty === profile.experience;

  const daysMatch =
    !profile.training_days ||
    Math.abs(program.days_per_week - profile.training_days) <= 1;

  return goalMatches && (difficultyMatches || daysMatch);
}

export default function ProgramsPage() {
  const router = useRouter();

  const [programs, setPrograms] = useState<WorkoutProgram[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [goal, setGoal] = useState("all");
  const [premiumOnly, setPremiumOnly] = useState(false);

  const [selectedProgram, setSelectedProgram] =
    useState<WorkoutProgram | null>(null);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
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
    async function loadPrograms() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const [
        { data: programData, error: programError },
        { data: profileData },
      ] = await Promise.all([
        supabase
          .from("workout_programs")
          .select("*")
          .order("is_premium", { ascending: true })
          .order("difficulty", { ascending: true }),

        supabase
          .from("profiles")
          .select("goal, experience, training_days")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (programError) {
        setMessage(programError.message);
        setLoading(false);
        return;
      }

      setPrograms((programData ?? []) as WorkoutProgram[]);
      setProfile(profileData as Profile | null);
      setLoading(false);
    }

    void loadPrograms();
  }, [router]);

  const filteredPrograms = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return programs
      .filter((program) => {
        const matchesSearch =
          !normalizedSearch ||
          program.name.toLowerCase().includes(normalizedSearch) ||
          program.description
            ?.toLowerCase()
            .includes(normalizedSearch) ||
          program.goal.toLowerCase().includes(normalizedSearch);

        const matchesDifficulty =
          difficulty === "all" ||
          program.difficulty === difficulty;

        const matchesGoal =
          goal === "all" || program.goal === goal;

        const matchesPremium =
          !premiumOnly || program.is_premium;

        return (
          matchesSearch &&
          matchesDifficulty &&
          matchesGoal &&
          matchesPremium
        );
      })
      .sort((a, b) => {
        const aRecommended = isRecommended(a, profile);
        const bRecommended = isRecommended(b, profile);

        if (aRecommended && !bRecommended) return -1;
        if (!aRecommended && bRecommended) return 1;

        return a.name.localeCompare(b.name);
      });
  }, [
    programs,
    search,
    difficulty,
    goal,
    premiumOnly,
    profile,
  ]);

  const recommendedProgram =
    programs.find((program) =>
      isRecommended(program, profile),
    ) ?? null;

  async function startProgram(program: WorkoutProgram) {
    setStarting(true);
    setMessage("");

    /*
      Во следниот чекор ќе направиме табела user_programs.
      Засега ова копче го носи корисникот на деталната
      workout страница.
    */

    router.push(`/programs/${program.id}`);
  }

  if (checkingPlan || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

          <p className="mt-5 text-sm text-zinc-400">
            Loading workout programs...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[8%] top-[-380px] h-[800px] w-[800px] rounded-full bg-purple-700/20 blur-[180px]" />

        <div className="absolute -right-80 top-[35%] h-[700px] w-[700px] rounded-full bg-fuchsia-900/10 blur-[180px]" />

        <div className="absolute bottom-[-400px] left-[40%] h-[700px] w-[700px] rounded-full bg-violet-900/10 blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-[1550px] px-5 py-7 sm:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-7 border-b border-white/[0.06] pb-9 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
              ZENTRO TRAINING SYSTEM
            </p>

            <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Programs built for real progress.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-500">
              Choose a structured training system based on your
              experience, schedule and fitness goal.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-purple-500/30"
            >
              ← Dashboard
            </Link>

            <Link
              href="/workout/history"
              className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.2)] transition hover:scale-[1.02]"
            >
              Workout history
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {message}
          </div>
        )}

        {recommendedProgram && (
          <section className="relative mt-8 overflow-hidden rounded-[36px] border border-purple-500/20 bg-gradient-to-br from-purple-600/20 via-purple-950/15 to-black p-7 shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-10">
            <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-purple-500/20 blur-[90px]" />

            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-purple-400/25 bg-purple-500/15 px-4 py-2 text-[10px] font-bold tracking-[0.15em] text-purple-200">
                    RECOMMENDED FOR YOU
                  </span>

                  {recommendedProgram.is_premium && (
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-[10px] font-bold text-amber-200">
                      PRO PROGRAM
                    </span>
                  )}
                </div>

                <h2 className="mt-6 text-3xl font-black sm:text-5xl">
                  {recommendedProgram.name}
                </h2>

                <p className="mt-4 max-w-2xl leading-7 text-zinc-400">
                  {recommendedProgram.description}
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <ProgramPill
                    value={`${recommendedProgram.duration_weeks} weeks`}
                  />

                  <ProgramPill
                    value={`${recommendedProgram.days_per_week} days / week`}
                  />

                  <ProgramPill
                    value={formatDifficulty(
                      recommendedProgram.difficulty,
                    )}
                  />

                  <ProgramPill
                    value={formatGoal(
                      recommendedProgram.goal,
                    )}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedProgram(recommendedProgram)
                }
                className="rounded-2xl bg-white px-7 py-4 text-sm font-black text-black transition hover:scale-[1.03]"
              >
                Explore program →
              </button>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-5 sm:p-7">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search programs, goals or training styles..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none placeholder:text-zinc-700 focus:border-purple-500/50"
              />
            </div>

            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value)
              }
              className="rounded-2xl border border-white/10 bg-black px-5 py-4 text-sm text-zinc-300 outline-none focus:border-purple-500/50"
            >
              {difficultyFilters.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-5 py-4 text-sm text-zinc-300 outline-none focus:border-purple-500/50"
            >
              {goalFilters.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 flex flex-col justify-between gap-4 border-t border-white/[0.05] pt-5 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              {difficultyFilters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDifficulty(item.value)}
                  className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                    difficulty === item.value
                      ? "border-purple-500/35 bg-purple-500/15 text-purple-200"
                      : "border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-500">
              <input
                type="checkbox"
                checked={premiumOnly}
                onChange={(event) =>
                  setPremiumOnly(event.target.checked)
                }
                className="h-4 w-4 accent-purple-500"
              />

              Show premium only
            </label>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold tracking-[0.18em] text-purple-400">
                PROGRAM LIBRARY
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Choose your training path
              </h2>
            </div>

            <p className="text-sm text-zinc-600">
              {filteredPrograms.length} programs found
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPrograms.map((program) => {
              const recommended = isRecommended(
                program,
                profile,
              );

              return (
                <article
                  key={program.id}
                  className={`group relative overflow-hidden rounded-[32px] border p-6 transition duration-300 hover:-translate-y-1 ${
                    recommended
                      ? "border-purple-500/30 bg-gradient-to-br from-purple-600/12 to-white/[0.02]"
                      : "border-white/[0.07] bg-white/[0.025] hover:border-purple-500/25"
                  }`}
                >
                  <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-purple-600/10 blur-[70px]" />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 text-xl font-black text-purple-300">
                        {getProgramIcon(program)}
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        {recommended && (
                          <span className="rounded-full border border-purple-500/25 bg-purple-500/12 px-3 py-1.5 text-[9px] font-bold text-purple-200">
                            MATCH
                          </span>
                        )}

                        {program.is_premium && (
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[9px] font-bold text-amber-200">
                            {hasPro ? "PRO" : "PRO LOCKED"}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-purple-400">
                      {formatGoal(program.goal)}
                    </p>

                    <h3 className="mt-3 text-2xl font-black">
                      {program.name}
                    </h3>

                    <p className="mt-3 min-h-[72px] text-sm leading-6 text-zinc-600">
                      {program.description ||
                        "A structured training program designed for consistent progression."}
                    </p>

                    <div className="mt-6 grid grid-cols-3 gap-2">
                      <MiniStat
                        label="Duration"
                        value={`${program.duration_weeks} weeks`}
                      />

                      <MiniStat
                        label="Frequency"
                        value={`${program.days_per_week} days`}
                      />

                      <MiniStat
                        label="Level"
                        value={formatDifficulty(
                          program.difficulty,
                        )}
                      />
                    </div>

                    <div className="mt-6 space-y-3 border-t border-white/[0.05] pt-6">
                      {getProgramFeatures(program)
                        .slice(0, 3)
                        .map((feature) => (
                          <div
                            key={feature}
                            className="flex items-center gap-3 text-sm text-zinc-500"
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/10 text-[9px] font-bold text-purple-300">
                              ✓
                            </span>

                            {feature}
                          </div>
                        ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedProgram(program)}
                      className={`mt-7 w-full rounded-2xl px-5 py-4 text-sm font-bold transition ${
                        recommended
                          ? "bg-gradient-to-r from-purple-600 to-violet-500 shadow-[0_0_30px_rgba(139,92,246,0.18)]"
                          : "border border-white/[0.08] bg-white/[0.025] text-zinc-300 hover:border-purple-500/30 hover:bg-purple-500/[0.06]"
                      }`}
                    >
                      View program details
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredPrograms.length === 0 && (
            <div className="mt-6 rounded-[34px] border border-white/[0.07] bg-white/[0.025] p-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl text-purple-300">
                ?
              </div>

              <h2 className="mt-5 text-2xl font-black">
                No matching programs
              </h2>

              <p className="mt-3 text-zinc-500">
                Change your search or filters to explore more
                training options.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDifficulty("all");
                  setGoal("all");
                  setPremiumOnly(false);
                }}
                className="mt-6 rounded-2xl bg-purple-600 px-6 py-3 font-bold"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-3">
          <FeatureCard
            icon="01"
            title="Structured progression"
            description="Every program follows a clear weekly progression strategy."
          />

          <FeatureCard
            icon="02"
            title="Workout analytics"
            description="Track volume, strength, completed sessions and personal records."
          />

          <FeatureCard
            icon="03"
            title="Personalized guidance"
            description="Programs are matched with your goal, experience and weekly schedule."
          />
        </section>

        <footer className="mt-10 border-t border-white/[0.05] py-8 text-xs leading-6 text-zinc-700">
          Training programs should be adjusted to your ability,
          injury history and medical condition. Stop exercising if
          you experience unusual pain or symptoms.
        </footer>
      </div>

      {selectedProgram && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/85 px-5 py-10 backdrop-blur-md"
          onClick={() => setSelectedProgram(null)}
        >
          <section
            className="mx-auto w-full max-w-3xl rounded-[36px] border border-white/10 bg-[#0b0b10] p-7 shadow-2xl sm:p-10"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-[10px] font-bold text-purple-300">
                    {formatGoal(
                      selectedProgram.goal,
                    ).toUpperCase()}
                  </span>

                  {selectedProgram.is_premium && (
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[10px] font-bold text-amber-200">
                      PREMIUM
                    </span>
                  )}
                </div>

                <h2 className="mt-5 text-3xl font-black sm:text-5xl">
                  {selectedProgram.name}
                </h2>

                <p className="mt-4 max-w-2xl leading-7 text-zinc-500">
                  {selectedProgram.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProgram(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-xl text-zinc-500 transition hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat
                label="Duration"
                value={`${selectedProgram.duration_weeks} weeks`}
              />

              <MiniStat
                label="Weekly"
                value={`${selectedProgram.days_per_week} days`}
              />

              <MiniStat
                label="Difficulty"
                value={formatDifficulty(
                  selectedProgram.difficulty,
                )}
              />

              <MiniStat
                label="Access"
                value={
                  selectedProgram.is_premium
                    ? "Premium"
                    : "Free"
                }
              />
            </div>

            <div className="mt-8 rounded-3xl border border-white/[0.06] bg-white/[0.025] p-6">
              <h3 className="text-lg font-black">
                What this program includes
              </h3>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {getProgramFeatures(selectedProgram).map(
                  (feature) => (
                    <div
                      key={feature}
                      className="flex items-start gap-3 text-sm leading-6 text-zinc-400"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-[10px] font-bold text-purple-300">
                        ✓
                      </span>

                      {feature}
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedProgram(null)}
                className="rounded-2xl border border-white/[0.08] px-6 py-4 font-bold text-zinc-400"
              >
                Continue browsing
              </button>

              <button
                type="button"
                disabled={starting}
                onClick={() => {
                  if (selectedProgram.is_premium && !hasPro) {
                    router.push("/pricing");
                    return;
                  }

                  void startProgram(selectedProgram);
                }}
                className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 font-bold shadow-[0_0_30px_rgba(139,92,246,0.2)] disabled:opacity-50"
              >
                {selectedProgram.is_premium && !hasPro
                  ? "Upgrade to Zentro Pro"
                  : starting
                    ? "Opening program..."
                    : "Start this program →"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ProgramPill({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-zinc-300">
      {value}
    </span>
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
      <p className="text-[10px] text-zinc-600">{label}</p>

      <p className="mt-1 truncate text-sm font-bold text-zinc-300">
        {value}
      </p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-xs font-black text-purple-300">
        {icon}
      </div>

      <h3 className="mt-5 text-lg font-black">{title}</h3>

      <p className="mt-3 text-sm leading-6 text-zinc-600">
        {description}
      </p>
    </article>
  );
}
