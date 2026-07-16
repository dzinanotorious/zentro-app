"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type EnergyLevel = "low" | "medium" | "high";

type WorkoutGoal =
  | "muscle_gain"
  | "fat_loss"
  | "strength"
  | "conditioning"
  | "mobility"
  | "general_fitness";

type WorkoutLocation =
  | "gym"
  | "home"
  | "hotel"
  | "outdoors"
  | "office";

type GeneratedExercise = {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  instructions: string;
  replacement: string | null;
};

type WorkoutSection = {
  name: string;
  duration_minutes: number;
  exercises: GeneratedExercise[];
};

type GeneratedWorkout = {
  id: string;
  created_at: string;
  title: string;
  summary: string;
  estimated_duration_minutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  safety_note: string;
  warmup: WorkoutSection;
  main_workout: WorkoutSection;
  cooldown: WorkoutSection;
};

type Usage = {
  used: number;
  limit: number;
  remaining: number;
};

type ApiResponse = {
  workout?: GeneratedWorkout;
  usage?: Usage;
  error?: string;
  code?: string;
};

const locationOptions: {
  value: WorkoutLocation;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "gym",
    label: "Gym",
    description: "Full gym equipment",
    icon: "◈",
  },
  {
    value: "home",
    label: "Home",
    description: "Train from home",
    icon: "⌂",
  },
  {
    value: "hotel",
    label: "Hotel",
    description: "Small-space workout",
    icon: "▣",
  },
  {
    value: "outdoors",
    label: "Outdoors",
    description: "Park or open space",
    icon: "◎",
  },
  {
    value: "office",
    label: "Office",
    description: "Quiet and practical",
    icon: "□",
  },
];

const energyOptions: {
  value: EnergyLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "low",
    label: "Low",
    description: "Keep it light",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Balanced session",
  },
  {
    value: "high",
    label: "High",
    description: "Ready to push",
  },
];

const goalOptions: {
  value: WorkoutGoal;
  label: string;
}[] = [
  {
    value: "muscle_gain",
    label: "Muscle gain",
  },
  {
    value: "fat_loss",
    label: "Fat loss",
  },
  {
    value: "strength",
    label: "Strength",
  },
  {
    value: "conditioning",
    label: "Conditioning",
  },
  {
    value: "mobility",
    label: "Mobility",
  },
  {
    value: "general_fitness",
    label: "General fitness",
  },
];

const equipmentOptions = [
  "Bodyweight",
  "Dumbbells",
  "Barbell",
  "Resistance bands",
  "Kettlebell",
  "Bench",
  "Pull-up bar",
  "Cable machine",
  "Treadmill",
  "Exercise bike",
  "Jump rope",
  "Yoga mat",
];

const limitationOptions = [
  "Avoid jumping",
  "Avoid running",
  "Sensitive knees",
  "Sensitive lower back",
  "Sensitive shoulders",
  "Sensitive wrists",
  "No floor exercises",
  "Low-impact only",
];

export default function WorkoutBuilderPage() {
  const router = useRouter();

  const [durationMinutes, setDurationMinutes] =
    useState(30);

  const [location, setLocation] =
    useState<WorkoutLocation>("home");

  const [energyLevel, setEnergyLevel] =
    useState<EnergyLevel>("medium");

  const [goal, setGoal] =
    useState<WorkoutGoal>("general_fitness");

  const [equipment, setEquipment] = useState<string[]>([
    "Bodyweight",
  ]);

  const [limitations, setLimitations] = useState<string[]>(
    [],
  );

  const [additionalNotes, setAdditionalNotes] =
    useState("");

  const [workout, setWorkout] =
    useState<GeneratedWorkout | null>(null);

  const [usage, setUsage] = useState<Usage>({
    used: 0,
    limit: 2,
    remaining: 2,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [proRequired, setProRequired] = useState(false);

  function toggleEquipment(item: string) {
    setEquipment((current) => {
      if (current.includes(item)) {
        return current.filter(
          (equipmentItem) => equipmentItem !== item,
        );
      }

      return [...current, item];
    });
  }

  function toggleLimitation(item: string) {
    setLimitations((current) => {
      if (current.includes(item)) {
        return current.filter(
          (limitation) => limitation !== item,
        );
      }

      return [...current, item];
    });
  }

  async function generateWorkout() {
    setError("");
    setProRequired(false);
    setWorkout(null);

    if (durationMinutes < 10 || durationMinutes > 120) {
      setError(
        "Workout duration must be between 10 and 120 minutes.",
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        "/api/workout-builder",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            durationMinutes,
            location,
            energyLevel,
            goal,
            equipment,
            limitations,
            additionalNotes,
          }),
        },
      );

      const data =
        (await response.json()) as ApiResponse;

      if (data.usage) {
        setUsage(data.usage);
      }

      if (!response.ok) {
        if (data.code === "PRO_REQUIRED") {
          setProRequired(true);
        }

        throw new Error(
          data.error ||
            "Workout generation failed.",
        );
      }

      if (!data.workout) {
        throw new Error(
          "The AI did not return a workout.",
        );
      }

      setWorkout(data.workout);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
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

  function resetBuilder() {
    setWorkout(null);
    setError("");
    setProRequired(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
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

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Real-Life Workout Builder
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-zinc-400">
              Tell Zentro what time, energy, equipment and
              space you have. AI will create a workout that
              fits your real situation.
            </p>
          </div>

          <div className="rounded-3xl border border-purple-500/20 bg-purple-500/[0.07] px-6 py-5">
            <p className="text-xs font-bold tracking-[0.16em] text-purple-400">
              DAILY LIMIT
            </p>

            <p className="mt-2 text-3xl font-black">
              {usage.remaining}/{usage.limit}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              AI workouts remaining
            </p>
          </div>
        </header>

        {workout ? (
          <WorkoutResult
            workout={workout}
            usage={usage}
            onReset={resetBuilder}
          />
        ) : (
          <section className="mt-10 grid gap-7 xl:grid-cols-[1fr_0.42fr]">
            <div className="space-y-6">
              <BuilderCard
                number="01"
                title="How much time do you have?"
                description="The complete workout will fit inside this time."
              >
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <input
                    type="range"
                    min={10}
                    max={120}
                    step={5}
                    value={durationMinutes}
                    onChange={(event) =>
                      setDurationMinutes(
                        Number(event.target.value),
                      )
                    }
                    className="w-full accent-purple-500"
                  />

                  <div className="min-w-28 rounded-2xl border border-purple-500/20 bg-purple-500/10 px-5 py-4 text-center">
                    <p className="text-2xl font-black">
                      {durationMinutes}
                    </p>

                    <p className="text-xs text-purple-300">
                      minutes
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex justify-between text-xs text-zinc-600">
                  <span>10 min</span>
                  <span>120 min</span>
                </div>
              </BuilderCard>

              <BuilderCard
                number="02"
                title="Where are you training?"
                description="Zentro will choose exercises suitable for the location."
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {locationOptions.map((option) => {
                    const active =
                      location === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setLocation(option.value)
                        }
                        className={`rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-purple-500/40 bg-purple-500/10"
                            : "border-white/[0.07] bg-white/[0.025] hover:border-purple-500/25"
                        }`}
                      >
                        <span
                          className={`text-2xl ${
                            active
                              ? "text-purple-300"
                              : "text-zinc-600"
                          }`}
                        >
                          {option.icon}
                        </span>

                        <p className="mt-3 font-bold">
                          {option.label}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-zinc-600">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </BuilderCard>

              <BuilderCard
                number="03"
                title="How is your energy?"
                description="The AI will adjust volume, intensity and exercise difficulty."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  {energyOptions.map((option) => {
                    const active =
                      energyLevel === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setEnergyLevel(option.value)
                        }
                        className={`rounded-2xl border p-5 text-left transition ${
                          active
                            ? "border-purple-500/40 bg-purple-500/10"
                            : "border-white/[0.07] bg-white/[0.025] hover:border-purple-500/25"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-black">
                            {option.label}
                          </p>

                          <span
                            className={`h-3 w-3 rounded-full ${
                              active
                                ? "bg-purple-400"
                                : "bg-zinc-800"
                            }`}
                          />
                        </div>

                        <p className="mt-2 text-sm text-zinc-600">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </BuilderCard>

              <BuilderCard
                number="04"
                title="What is today's goal?"
                description="Choose the main purpose of this session."
              >
                <div className="flex flex-wrap gap-3">
                  {goalOptions.map((option) => {
                    const active =
                      goal === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setGoal(option.value)
                        }
                        className={`rounded-2xl border px-5 py-3 text-sm font-bold transition ${
                          active
                            ? "border-purple-500/40 bg-purple-600 text-white"
                            : "border-white/[0.08] bg-white/[0.025] text-zinc-400 hover:border-purple-500/25 hover:text-white"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </BuilderCard>

              <BuilderCard
                number="05"
                title="What equipment is available?"
                description="Select everything you can use today."
              >
                <div className="flex flex-wrap gap-3">
                  {equipmentOptions.map((item) => {
                    const active =
                      equipment.includes(item);

                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          toggleEquipment(item)
                        }
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          active
                            ? "border-purple-500/40 bg-purple-500/10 text-purple-200"
                            : "border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:border-purple-500/25"
                        }`}
                      >
                        {active ? "✓ " : ""}
                        {item}
                      </button>
                    );
                  })}
                </div>
              </BuilderCard>

              <BuilderCard
                number="06"
                title="Any limitations today?"
                description="This is not a medical diagnosis. Select anything the workout should avoid."
              >
                <div className="flex flex-wrap gap-3">
                  {limitationOptions.map((item) => {
                    const active =
                      limitations.includes(item);

                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          toggleLimitation(item)
                        }
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          active
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                            : "border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:border-amber-500/25"
                        }`}
                      >
                        {active ? "✓ " : ""}
                        {item}
                      </button>
                    );
                  })}
                </div>
              </BuilderCard>

              <BuilderCard
                number="07"
                title="Anything else Zentro should know?"
                description="Optional notes about preferences, available weights or exercises you dislike."
              >
                <textarea
                  value={additionalNotes}
                  onChange={(event) =>
                    setAdditionalNotes(
                      event.target.value.slice(0, 500),
                    )
                  }
                  rows={5}
                  placeholder="Example: I have one pair of 10 kg dumbbells and I prefer quiet exercises..."
                  className="w-full resize-none rounded-2xl border border-white/[0.08] bg-black/30 px-5 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-zinc-700 focus:border-purple-500/40"
                />

                <p className="mt-2 text-right text-xs text-zinc-700">
                  {additionalNotes.length}/500
                </p>
              </BuilderCard>
            </div>

            <aside className="xl:sticky xl:top-8 xl:self-start">
              <div className="rounded-[32px] border border-purple-500/20 bg-gradient-to-br from-purple-600/15 via-purple-950/10 to-[#0b0b10] p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/15 text-2xl text-purple-300">
                    ✦
                  </div>

                  <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-[10px] font-bold text-purple-300">
                    PRO
                  </span>
                </div>

                <h2 className="mt-6 text-2xl font-black">
                  Workout summary
                </h2>

                <div className="mt-6 space-y-4">
                  <SummaryRow
                    label="Duration"
                    value={`${durationMinutes} min`}
                  />

                  <SummaryRow
                    label="Location"
                    value={formatLabel(location)}
                  />

                  <SummaryRow
                    label="Energy"
                    value={formatLabel(energyLevel)}
                  />

                  <SummaryRow
                    label="Goal"
                    value={formatLabel(goal)}
                  />

                  <SummaryRow
                    label="Equipment"
                    value={
                      equipment.length > 0
                        ? `${equipment.length} selected`
                        : "Bodyweight"
                    }
                  />

                  <SummaryRow
                    label="Limitations"
                    value={
                      limitations.length > 0
                        ? `${limitations.length} selected`
                        : "None"
                    }
                  />
                </div>

                <button
                  type="button"
                  onClick={generateWorkout}
                  disabled={
                    loading || usage.remaining === 0
                  }
                  className="mt-8 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-5 text-sm font-black shadow-[0_0_30px_rgba(139,92,246,0.2)] transition hover:from-purple-500 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "Building your workout..."
                    : usage.remaining === 0
                      ? "Daily limit reached"
                      : "Generate AI workout →"}
                </button>

                <p className="mt-4 text-center text-xs leading-5 text-zinc-600">
                  One successful workout generation uses one
                  of your daily credits.
                </p>

                {error && (
                  <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-300">
                    <p>{error}</p>

                    {proRequired && (
                      <Link
                        href="/pricing"
                        className="mt-4 block rounded-xl bg-purple-600 px-4 py-3 text-center font-bold text-white"
                      >
                        Upgrade to Zentro Pro
                      </Link>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6">
                <p className="text-sm font-bold">
                  Safety first
                </p>

                <p className="mt-3 text-xs leading-6 text-zinc-600">
                  Stop if you feel sharp pain, dizziness or
                  unusual discomfort. AI workouts are general
                  fitness guidance and are not medical advice.
                </p>
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}

function BuilderCard({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[32px] border border-white/[0.07] bg-[#0b0b10] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 text-xs font-black text-purple-300">
          {number}
        </span>

        <div>
          <h2 className="text-xl font-black">
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-7">{children}</div>
    </article>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 text-sm last:border-none last:pb-0">
      <span className="text-zinc-600">
        {label}
      </span>

      <span className="max-w-[55%] text-right font-bold text-zinc-300">
        {value}
      </span>
    </div>
  );
}

function WorkoutResult({
  workout,
  usage,
  onReset,
}: {
  workout: GeneratedWorkout;
  usage: Usage;
  onReset: () => void;
}) {
  return (
    <section className="mt-10">
      <div className="rounded-[36px] border border-purple-500/20 bg-gradient-to-br from-purple-600/15 via-[#0b0b10] to-[#0b0b10] p-6 sm:p-9">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-purple-400">
              YOUR AI WORKOUT
            </p>

            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              {workout.title}
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-zinc-400">
              {workout.summary}
            </p>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-3">
            <ResultMetric
              label="Duration"
              value={`${workout.estimated_duration_minutes} min`}
            />

            <ResultMetric
              label="Difficulty"
              value={formatLabel(workout.difficulty)}
            />
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-5">
          <p className="text-xs font-bold tracking-[0.16em] text-amber-400">
            SAFETY NOTE
          </p>

          <p className="mt-2 text-sm leading-6 text-amber-100/70">
            {workout.safety_note}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <WorkoutSectionCard
          section={workout.warmup}
          accent="purple"
        />

        <WorkoutSectionCard
          section={workout.main_workout}
          accent="violet"
        />

        <WorkoutSectionCard
          section={workout.cooldown}
          accent="emerald"
        />
      </div>

      <div className="mt-8 flex flex-col justify-between gap-4 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 sm:flex-row sm:items-center">
        <div>
          <p className="font-black">
            {usage.remaining}/{usage.limit} AI workouts left
            today
          </p>

          <p className="mt-1 text-sm text-zinc-600">
            This workout has been saved to your account.
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          disabled={usage.remaining === 0}
          className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {usage.remaining > 0
            ? "Build another workout"
            : "Daily limit reached"}
        </button>
      </div>
    </section>
  );
}

function ResultMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-32 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <p className="text-[10px] text-zinc-600">
        {label}
      </p>

      <p className="mt-2 text-sm font-black">
        {value}
      </p>
    </div>
  );
}

function WorkoutSectionCard({
  section,
  accent,
}: {
  section: WorkoutSection;
  accent: "purple" | "violet" | "emerald";
}) {
  const accentClass =
    accent === "emerald"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : accent === "violet"
        ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
        : "border-purple-500/20 bg-purple-500/10 text-purple-300";

  return (
    <article className="rounded-[32px] border border-white/[0.07] bg-[#0b0b10] p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black">
            {section.name}
          </h3>

          <p className="mt-2 text-sm text-zinc-600">
            {section.exercises.length} exercises
          </p>
        </div>

        <span
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${accentClass}`}
        >
          {section.duration_minutes} min
        </span>
      </div>

      <div className="mt-7 space-y-4">
        {section.exercises.map(
          (exercise, index) => (
            <div
              key={`${exercise.name}-${index}`}
              className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-sm font-black text-purple-300">
                    {index + 1}
                  </span>

                  <div>
                    <h4 className="font-black">
                      {exercise.name}
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {exercise.instructions}
                    </p>
                  </div>
                </div>

                <div className="grid shrink-0 grid-cols-3 gap-2">
                  <ExerciseMetric
                    label="Sets"
                    value={`${exercise.sets}`}
                  />

                  <ExerciseMetric
                    label="Reps"
                    value={exercise.reps}
                  />

                  <ExerciseMetric
                    label="Rest"
                    value={
                      exercise.rest_seconds > 0
                        ? `${exercise.rest_seconds}s`
                        : "—"
                    }
                  />
                </div>
              </div>

              {exercise.replacement && (
                <div className="mt-5 rounded-2xl border border-purple-500/15 bg-purple-500/[0.06] p-4">
                  <p className="text-xs font-bold text-purple-300">
                    Alternative
                  </p>

                  <p className="mt-1 text-sm text-zinc-500">
                    {exercise.replacement}
                  </p>
                </div>
              )}
            </div>
          ),
        )}
      </div>
    </article>
  );
}

function ExerciseMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-16 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-center">
      <p className="text-[9px] text-zinc-700">
        {label}
      </p>

      <p className="mt-1 text-xs font-bold text-zinc-300">
        {value}
      </p>
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}
