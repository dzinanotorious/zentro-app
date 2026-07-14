"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  difficulty: string;
  instructions: string[] | null;
  image_url: string | null;
  video_url: string | null;
};

type WorkoutExercise = {
  id: string;
  exercise_order: number;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number;
  notes: string | null;
  superset_group: string | null;
  exercise: Exercise;
};

type WorkoutDay = {
  id: string;
  day_number: number;
  name: string;
  focus: string | null;
  workout_exercises: WorkoutExercise[];
};

type WorkoutProgram = {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  difficulty: string;
  duration_weeks: number;
  days_per_week: number;
  is_premium: boolean;
  workout_days: WorkoutDay[];
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Tab = "overview" | "schedule" | "exercises";

function formatGoal(value: string) {
  if (value === "muscle_gain") return "Muscle Gain";
  if (value === "fat_loss") return "Fat Loss";
  if (value === "strength") return "Strength";

  return "General Fitness";
}

function formatDifficulty(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRest(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) return `${minutes} min`;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")} min`;
}

function formatReps(exercise: WorkoutExercise) {
  if (
    exercise.reps_min !== null &&
    exercise.reps_max !== null &&
    exercise.reps_min !== exercise.reps_max
  ) {
    return `${exercise.reps_min}–${exercise.reps_max}`;
  }

  return String(exercise.reps_min ?? exercise.reps_max ?? "—");
}

export default function ProgramDetailsPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [program, setProgram] = useState<WorkoutProgram | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProgram() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("workout_programs")
        .select(`
          id,
          name,
          description,
          goal,
          difficulty,
          duration_weeks,
          days_per_week,
          is_premium,
          workout_days (
            id,
            day_number,
            name,
            focus,
            workout_exercises (
              id,
              exercise_order,
              sets,
              reps_min,
              reps_max,
              rest_seconds,
              notes,
              superset_group,
              exercise:exercises (
                id,
                name,
                muscle_group,
                equipment,
                difficulty,
                instructions,
                image_url,
                video_url
              )
            )
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setMessage("Program not found.");
        setLoading(false);
        return;
      }

      const parsedProgram = data as unknown as WorkoutProgram;

      parsedProgram.workout_days = [...parsedProgram.workout_days]
        .sort((a, b) => a.day_number - b.day_number)
        .map((day) => ({
          ...day,
          workout_exercises: [...day.workout_exercises].sort(
            (a, b) => a.exercise_order - b.exercise_order,
          ),
        }));

      setProgram(parsedProgram);

      if (parsedProgram.workout_days.length > 0) {
        setSelectedDayId(parsedProgram.workout_days[0].id);
      }

      setLoading(false);
    }

    void loadProgram();
  }, [id, router]);

  const selectedDay = useMemo(() => {
    if (!program) return null;

    return (
      program.workout_days.find((day) => day.id === selectedDayId) ??
      program.workout_days[0] ??
      null
    );
  }, [program, selectedDayId]);

  const totalExercises = useMemo(() => {
    if (!program) return 0;

    return program.workout_days.reduce(
      (total, day) => total + day.workout_exercises.length,
      0,
    );
  }, [program]);

  const estimatedDuration = useMemo(() => {
    if (!selectedDay) return 0;

    return Math.max(30, selectedDay.workout_exercises.length * 9);
  }, [selectedDay]);

  async function startWorkout() {
    if (!selectedDay) return;

    setStarting(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        workout_day_id: selectedDay.id,
        session_date: new Date().toISOString().slice(0, 10),
        started_at: new Date().toISOString(),
        completed: false,
      })
      .select("id")
      .single();

    if (error) {
      setMessage(error.message);
      setStarting(false);
      return;
    }

    router.push(`/workout/${data.id}`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="mt-5 text-sm text-zinc-400">
            Loading your training program...
          </p>
        </div>
      </main>
    );
  }

  if (!program) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] px-5 text-white">
        <section className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[#0b0b10] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-2xl text-red-300">
            !
          </div>

          <h1 className="mt-5 text-3xl font-black">
            Program unavailable
          </h1>

          <p className="mt-3 leading-7 text-zinc-500">
            {message || "We could not find this training program."}
          </p>

          <Link
            href="/programs"
            className="mt-7 inline-block rounded-2xl bg-purple-600 px-6 py-3 font-bold"
          >
            Back to programs
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[8%] top-[-380px] h-[800px] w-[800px] rounded-full bg-purple-700/20 blur-[180px]" />
        <div className="absolute -right-80 top-[30%] h-[700px] w-[700px] rounded-full bg-fuchsia-900/10 blur-[180px]" />
        <div className="absolute bottom-[-400px] left-[35%] h-[700px] w-[700px] rounded-full bg-violet-900/10 blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-[1550px] px-5 py-7 sm:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-6 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-center">
          <div>
            <Link
              href="/programs"
              className="text-sm font-bold text-zinc-500 transition hover:text-purple-300"
            >
              ← Back to programs
            </Link>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-[10px] font-bold tracking-[0.14em] text-purple-300">
                {formatGoal(program.goal).toUpperCase()}
              </span>

              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[10px] font-bold text-zinc-400">
                {formatDifficulty(program.difficulty).toUpperCase()}
              </span>

              {program.is_premium && (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-[10px] font-bold text-amber-200">
                  PREMIUM PROGRAM
                </span>
              )}
            </div>

            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              {program.name}
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-500">
              {program.description}
            </p>
          </div>

          <button
            type="button"
            disabled={!selectedDay || starting}
            onClick={() => void startWorkout()}
            className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-7 py-4 text-sm font-black shadow-[0_0_35px_rgba(139,92,246,0.22)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {starting ? "Starting workout..." : "Start selected workout →"}
          </button>
        </header>

        {message && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {message}
          </div>
        )}

        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Program duration"
            value={`${program.duration_weeks}`}
            unit="weeks"
            icon="01"
          />

          <StatCard
            label="Weekly frequency"
            value={`${program.days_per_week}`}
            unit="days"
            icon="02"
          />

          <StatCard
            label="Workout days"
            value={`${program.workout_days.length}`}
            unit="plans"
            icon="03"
          />

          <StatCard
            label="Total exercises"
            value={`${totalExercises}`}
            unit="movements"
            icon="04"
          />
        </section>

        <section className="mt-8">
          <div className="flex gap-2 overflow-x-auto border-b border-white/[0.06] pb-4">
            {[
              { value: "overview", label: "Overview" },
              { value: "schedule", label: "Weekly schedule" },
              { value: "exercises", label: "Exercise details" },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value as Tab)}
                className={`whitespace-nowrap rounded-2xl border px-5 py-3 text-sm font-bold transition ${
                  activeTab === tab.value
                    ? "border-purple-500/30 bg-purple-500/12 text-purple-200"
                    : "border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === "overview" && (
          <section className="mt-7 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
              <p className="text-sm text-zinc-500">
                Program structure
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Built for sustainable progression
              </h2>

              <p className="mt-4 max-w-2xl leading-7 text-zinc-500">
                Each training day combines compound lifts, accessory
                movements and controlled progression. Focus on technique,
                consistent effort and gradual increases in resistance.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <FeatureBlock
                  title="Progressive overload"
                  description="Increase reps or load gradually when all sets are completed with good form."
                  icon="↗"
                />

                <FeatureBlock
                  title="Balanced weekly volume"
                  description="Training stress is distributed across the week for better recovery."
                  icon="◎"
                />

                <FeatureBlock
                  title="Built-in rest periods"
                  description="Each exercise includes a recommended rest interval."
                  icon="⏱"
                />

                <FeatureBlock
                  title="Exercise logging"
                  description="Track weight, repetitions and completed sets during each session."
                  icon="✓"
                />
              </div>
            </article>

            <article className="rounded-[34px] border border-purple-500/15 bg-gradient-to-br from-purple-600/15 via-purple-950/10 to-transparent p-6 sm:p-8">
              <p className="text-sm text-purple-300">
                Selected workout
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {selectedDay?.name ?? "No workout selected"}
              </h2>

              <p className="mt-3 text-sm leading-7 text-zinc-500">
                {selectedDay?.focus ??
                  "Choose a training day from the weekly schedule."}
              </p>

              <div className="mt-8 space-y-4">
                <InfoRow
                  label="Exercises"
                  value={`${selectedDay?.workout_exercises.length ?? 0}`}
                />

                <InfoRow
                  label="Estimated time"
                  value={`${estimatedDuration} min`}
                />

                <InfoRow
                  label="Main focus"
                  value={selectedDay?.focus ?? "—"}
                />

                <InfoRow
                  label="Tracking"
                  value="Enabled"
                  positive
                />
              </div>

              <button
                type="button"
                disabled={!selectedDay || starting}
                onClick={() => void startWorkout()}
                className="mt-8 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 font-black shadow-[0_0_30px_rgba(139,92,246,0.18)] disabled:opacity-40"
              >
                {starting ? "Starting..." : "Begin this workout"}
              </button>
            </article>
          </section>
        )}

        {activeTab === "schedule" && (
          <section className="mt-7">
            <div className="grid gap-5 lg:grid-cols-3">
              {program.workout_days.map((day) => {
                const active = day.id === selectedDayId;

                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setSelectedDayId(day.id)}
                    className={`rounded-[30px] border p-6 text-left transition ${
                      active
                        ? "border-purple-500/35 bg-purple-500/12 shadow-[0_0_30px_rgba(139,92,246,0.1)]"
                        : "border-white/[0.07] bg-white/[0.025] hover:-translate-y-1 hover:border-purple-500/25"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${
                          active
                            ? "bg-purple-500/20 text-purple-200"
                            : "bg-white/[0.04] text-zinc-600"
                        }`}
                      >
                        {String(day.day_number).padStart(2, "0")}
                      </div>

                      {active && (
                        <span className="rounded-full bg-purple-500/15 px-3 py-1 text-[9px] font-bold text-purple-300">
                          SELECTED
                        </span>
                      )}
                    </div>

                    <h3 className="mt-5 text-2xl font-black">
                      {day.name}
                    </h3>

                    <p className="mt-3 min-h-[48px] text-sm leading-6 text-zinc-600">
                      {day.focus || "Structured training session"}
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <MiniStat
                        label="Exercises"
                        value={`${day.workout_exercises.length}`}
                      />

                      <MiniStat
                        label="Estimated"
                        value={`${Math.max(
                          30,
                          day.workout_exercises.length * 9,
                        )} min`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedDay && (
              <article className="mt-6 rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm text-zinc-500">
                      Selected training day
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                      {selectedDay.name}
                    </h2>

                    <p className="mt-3 text-sm text-zinc-600">
                      {selectedDay.focus}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => void startWorkout()}
                    className="rounded-2xl bg-purple-600 px-6 py-3 text-sm font-bold disabled:opacity-40"
                  >
                    Start workout
                  </button>
                </div>

                <div className="mt-8 space-y-3">
                  {selectedDay.workout_exercises.map((item) => (
                    <ExerciseRow key={item.id} item={item} />
                  ))}
                </div>
              </article>
            )}
          </section>
        )}

        {activeTab === "exercises" && (
          <section className="mt-7 grid gap-5 lg:grid-cols-2">
            {program.workout_days.flatMap((day) =>
              day.workout_exercises.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[30px] border border-white/[0.07] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-purple-500/25"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-lg font-black text-purple-300">
                      {item.exercise.name.charAt(0)}
                    </div>

                    <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[9px] font-bold text-zinc-500">
                      DAY {day.day_number}
                    </span>
                  </div>

                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-purple-400">
                    {item.exercise.muscle_group}
                  </p>

                  <h3 className="mt-2 text-2xl font-black">
                    {item.exercise.name}
                  </h3>

                  <p className="mt-2 text-sm text-zinc-600">
                    {item.exercise.equipment} ·{" "}
                    {formatDifficulty(item.exercise.difficulty)}
                  </p>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <MiniStat label="Sets" value={`${item.sets}`} />
                    <MiniStat label="Reps" value={formatReps(item)} />
                    <MiniStat
                      label="Rest"
                      value={formatRest(item.rest_seconds)}
                    />
                  </div>

                  {item.notes && (
                    <div className="mt-6 rounded-2xl border border-white/[0.05] bg-black/20 p-4">
                      <p className="text-xs font-bold text-zinc-400">
                        Coaching note
                      </p>

                      <p className="mt-2 text-sm leading-6 text-zinc-600">
                        {item.notes}
                      </p>
                    </div>
                  )}
                </article>
              )),
            )}
          </section>
        )}

        <footer className="mt-10 border-t border-white/[0.05] py-8 text-xs leading-6 text-zinc-700">
          Prioritize proper technique, appropriate resistance and adequate
          recovery. Training recommendations are general fitness guidance and
          should be adjusted for injuries or medical conditions.
        </footer>
      </div>
    </main>
  );
}

function ExerciseRow({ item }: { item: WorkoutExercise }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5 lg:flex-row lg:items-center">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-sm font-black text-purple-300">
        {String(item.exercise_order).padStart(2, "0")}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-bold">{item.exercise.name}</p>

        <p className="mt-1 text-xs text-zinc-600">
          {item.exercise.muscle_group} · {item.exercise.equipment}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 lg:w-[320px]">
        <MiniStat label="Sets" value={`${item.sets}`} />
        <MiniStat label="Reps" value={formatReps(item)} />
        <MiniStat
          label="Rest"
          value={formatRest(item.rest_seconds)}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  icon: string;
}) {
  return (
    <article className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-purple-500/25">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-xs font-black text-purple-300">
        {icon}
      </div>

      <p className="mt-6 text-sm text-zinc-500">{label}</p>

      <p className="mt-2 text-3xl font-black">
        {value}
        <span className="ml-2 text-sm font-normal text-zinc-600">
          {unit}
        </span>
      </p>
    </article>
  );
}

function FeatureBlock({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <article className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300">
        {icon}
      </div>

      <h3 className="mt-4 font-black">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-zinc-600">
        {description}
      </p>
    </article>
  );
}

function InfoRow({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] pb-4 text-sm last:border-none last:pb-0">
      <span className="text-zinc-600">{label}</span>

      <span
        className={
          positive
            ? "font-semibold text-emerald-400"
            : "max-w-[60%] text-right font-semibold text-zinc-300"
        }
      >
        {value}
      </span>
    </div>
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
