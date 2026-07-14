"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Gender = "male" | "female";
type Activity =
  | "sedentary"
  | "light"
  | "moderate"
  | "high"
  | "very_high";
type Goal = "lose" | "maintain" | "gain";
type Experience = "beginner" | "intermediate" | "advanced";

const activityOptions = [
  {
    value: "sedentary",
    title: "Low activity",
    description: "Mostly sitting, little or no exercise",
    multiplier: 1.2,
  },
  {
    value: "light",
    title: "Light activity",
    description: "Training 1–3 days per week",
    multiplier: 1.375,
  },
  {
    value: "moderate",
    title: "Moderate activity",
    description: "Training 3–5 days per week",
    multiplier: 1.55,
  },
  {
    value: "high",
    title: "High activity",
    description: "Training 6–7 days per week",
    multiplier: 1.725,
  },
  {
    value: "very_high",
    title: "Very high activity",
    description: "Very intense training or physical job",
    multiplier: 1.9,
  },
] as const;

const goalOptions = [
  {
    value: "lose",
    icon: "↘",
    title: "Fat loss",
    description: "Lose body fat while maintaining muscle",
  },
  {
    value: "maintain",
    icon: "◎",
    title: "Maintain",
    description: "Maintain weight and improve overall fitness",
  },
  {
    value: "gain",
    icon: "↗",
    title: "Muscle gain",
    description: "Build muscle, strength and body mass",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState<Activity>("moderate");
  const [goal, setGoal] = useState<Goal>("maintain");
  const [experience, setExperience] =
    useState<Experience>("beginner");
  const [trainingDays, setTrainingDays] = useState(4);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setLoading(false);
    }

    void checkUser();
  }, [router]);

  const results = useMemo(() => {
    const ageNumber = Number(age);
    const heightNumber = Number(height);
    const weightNumber = Number(weight);

    if (!ageNumber || !heightNumber || !weightNumber) {
      return {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        bmr: 0,
      };
    }

    const genderAdjustment = gender === "male" ? 5 : -161;

    const bmr =
      10 * weightNumber +
      6.25 * heightNumber -
      5 * ageNumber +
      genderAdjustment;

    const multiplier =
      activityOptions.find((item) => item.value === activity)?.multiplier ??
      1.55;

    let calories = bmr * multiplier;

    if (goal === "lose") calories -= 400;
    if (goal === "gain") calories += 300;

    calories = Math.max(1200, Math.round(calories));

    const proteinMultiplier =
      goal === "gain" ? 2 : goal === "lose" ? 2.1 : 1.8;

    const protein = Math.round(weightNumber * proteinMultiplier);
    const fat = Math.round(weightNumber * 0.8);

    const proteinCalories = protein * 4;
    const fatCalories = fat * 9;
    const remainingCalories = Math.max(
      0,
      calories - proteinCalories - fatCalories,
    );

    const carbs = Math.round(remainingCalories / 4);

    return {
      calories,
      protein,
      fat,
      carbs,
      bmr: Math.round(bmr),
    };
  }, [age, height, weight, gender, activity, goal]);

  function validateStep() {
    setErrorMessage("");

    if (step === 1 && (!fullName.trim() || !age)) {
      setErrorMessage("Внеси име и возраст за да продолжиш.");
      return false;
    }

    if (
      step === 2 &&
      (!height ||
        !weight ||
        Number(height) < 120 ||
        Number(weight) < 35)
    ) {
      setErrorMessage("Внеси валидна висина и тежина.");
      return false;
    }

    return true;
  }

  function nextStep() {
    if (!validateStep()) return;
    setStep((current) => Math.min(5, current + 1));
  }

  function previousStep() {
    setErrorMessage("");
    setStep((current) => Math.max(1, current - 1));
  }

  async function finishOnboarding() {
    setSaving(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: fullName.trim(),
        age: Number(age),
        height_cm: Number(height),
        weight_kg: Number(weight),
        gender,
        activity,
        goal,
        experience,
        training_days: trainingDays,
        daily_calories: results.calories,
        protein_grams: results.protein,
        fat_grams: results.fat,
        carbs_grams: results.carbs,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      },
    );

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="mt-4 text-sm text-zinc-400">
            Preparing your experience...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050507] px-5 py-8 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-300px] h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-purple-700/20 blur-[150px]" />
        <div className="absolute -left-40 bottom-[-200px] h-[500px] w-[500px] rounded-full bg-violet-900/20 blur-[150px]" />
        <div className="absolute -right-40 top-1/3 h-[450px] w-[450px] rounded-full bg-fuchsia-900/10 blur-[150px]" />
      </div>

      <div className="relative mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-500/10 font-black text-purple-300">
              Z
            </div>

            <span className="font-black tracking-[0.25em]">ZENTRO</span>
          </a>

          <p className="text-sm text-zinc-500">
            Step {step} of 5
          </p>
        </header>

        <div className="mb-8">
          <div className="mb-3 flex justify-between text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <span>Personal setup</span>
            <span>{step * 20}% complete</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 via-violet-500 to-fuchsia-500 shadow-[0_0_20px_rgba(139,92,246,0.55)] transition-all duration-500"
              style={{ width: `${step * 20}%` }}
            />
          </div>
        </div>

        <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[#0b0b10]/90 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="grid min-h-[620px] lg:grid-cols-[0.7fr_1.3fr]">
            <aside className="hidden border-r border-white/[0.06] bg-gradient-to-b from-purple-950/40 to-black/20 p-10 lg:block">
              <p className="text-xs font-bold tracking-[0.25em] text-purple-400">
                PERSONALIZATION
              </p>

              <h2 className="mt-5 text-3xl font-black leading-tight">
                Your plan should fit your life.
              </h2>

              <p className="mt-5 leading-7 text-zinc-400">
                Zentro uses your measurements, activity and goals to create
                realistic daily targets.
              </p>

              <div className="mt-10 space-y-5">
                {[
                  "Personal calorie target",
                  "Custom macro distribution",
                  "Recommended training frequency",
                  "Goal-based fitness plan",
                ].map((item, index) => (
                  <div key={item} className="flex items-center gap-4">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm ${
                        step > index
                          ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
                          : "border-white/10 bg-white/[0.03] text-zinc-600"
                      }`}
                    >
                      {index + 1}
                    </div>

                    <p className="text-sm text-zinc-300">{item}</p>
                  </div>
                ))}
              </div>
            </aside>

            <div className="flex flex-col p-7 sm:p-10 lg:p-12">
              <div className="flex-1">
                {step === 1 && (
                  <div>
                    <p className="text-sm font-bold tracking-[0.22em] text-purple-400">
                      BASIC INFORMATION
                    </p>

                    <h1 className="mt-4 text-4xl font-black sm:text-5xl">
                      Let&apos;s get to know you.
                    </h1>

                    <p className="mt-4 max-w-xl leading-7 text-zinc-400">
                      Овие информации ни помагаат да направиме попрецизни
                      фитнес препораки.
                    </p>

                    <div className="mt-10 grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm text-zinc-300">
                          Full name
                        </label>

                        <input
                          value={fullName}
                          onChange={(event) =>
                            setFullName(event.target.value)
                          }
                          placeholder="Your name"
                          className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none transition placeholder:text-zinc-600 focus:border-purple-500/50 focus:bg-purple-500/[0.03]"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-zinc-300">
                          Age
                        </label>

                        <input
                          type="number"
                          min="14"
                          max="100"
                          value={age}
                          onChange={(event) => setAge(event.target.value)}
                          placeholder="24"
                          className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none transition placeholder:text-zinc-600 focus:border-purple-500/50"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-zinc-300">
                          Gender
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          {(["male", "female"] as Gender[]).map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setGender(item)}
                              className={`rounded-2xl border px-4 py-4 text-sm font-semibold capitalize transition ${
                                gender === item
                                  ? "border-purple-500/50 bg-purple-500/15 text-purple-200"
                                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20"
                              }`}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="text-sm font-bold tracking-[0.22em] text-purple-400">
                      BODY MEASUREMENTS
                    </p>

                    <h1 className="mt-4 text-4xl font-black sm:text-5xl">
                      Tell us about your body.
                    </h1>

                    <p className="mt-4 leading-7 text-zinc-400">
                      Овие податоци се користат за проценка на дневната
                      енергетска потреба.
                    </p>

                    <div className="mt-10 grid gap-5 sm:grid-cols-2">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                        <label className="text-sm text-zinc-400">
                          Height
                        </label>

                        <div className="mt-4 flex items-end gap-3">
                          <input
                            type="number"
                            min="120"
                            max="230"
                            value={height}
                            onChange={(event) =>
                              setHeight(event.target.value)
                            }
                            placeholder="180"
                            className="min-w-0 flex-1 bg-transparent text-4xl font-black outline-none placeholder:text-zinc-800"
                          />
                          <span className="pb-1 text-zinc-500">cm</span>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                        <label className="text-sm text-zinc-400">
                          Weight
                        </label>

                        <div className="mt-4 flex items-end gap-3">
                          <input
                            type="number"
                            min="35"
                            max="300"
                            step="0.1"
                            value={weight}
                            onChange={(event) =>
                              setWeight(event.target.value)
                            }
                            placeholder="80"
                            className="min-w-0 flex-1 bg-transparent text-4xl font-black outline-none placeholder:text-zinc-800"
                          />
                          <span className="pb-1 text-zinc-500">kg</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-amber-500/10 bg-amber-500/[0.05] p-4 text-sm leading-6 text-amber-100/70">
                      Ова е фитнес проценка, не медицинска дијагноза.
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <p className="text-sm font-bold tracking-[0.22em] text-purple-400">
                      ACTIVITY LEVEL
                    </p>

                    <h1 className="mt-4 text-4xl font-black sm:text-5xl">
                      How active are you?
                    </h1>

                    <div className="mt-9 space-y-3">
                      {activityOptions.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() =>
                            setActivity(item.value as Activity)
                          }
                          className={`flex w-full items-center justify-between rounded-2xl border p-5 text-left transition ${
                            activity === item.value
                              ? "border-purple-500/50 bg-purple-500/10 shadow-[0_0_25px_rgba(139,92,246,0.08)]"
                              : "border-white/10 bg-white/[0.025] hover:border-white/20"
                          }`}
                        >
                          <div>
                            <p className="font-bold">{item.title}</p>
                            <p className="mt-1 text-sm text-zinc-500">
                              {item.description}
                            </p>
                          </div>

                          <div
                            className={`h-5 w-5 rounded-full border ${
                              activity === item.value
                                ? "border-purple-400 bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.8)]"
                                : "border-zinc-700"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div>
                    <p className="text-sm font-bold tracking-[0.22em] text-purple-400">
                      FITNESS GOAL
                    </p>

                    <h1 className="mt-4 text-4xl font-black sm:text-5xl">
                      What do you want to achieve?
                    </h1>

                    <div className="mt-9 grid gap-4 sm:grid-cols-3">
                      {goalOptions.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setGoal(item.value as Goal)}
                          className={`rounded-3xl border p-6 text-left transition ${
                            goal === item.value
                              ? "border-purple-500/50 bg-purple-500/12 shadow-[0_0_30px_rgba(139,92,246,0.1)]"
                              : "border-white/10 bg-white/[0.025] hover:-translate-y-1 hover:border-white/20"
                          }`}
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl text-purple-300">
                            {item.icon}
                          </div>

                          <h3 className="mt-5 font-bold">{item.title}</h3>

                          <p className="mt-2 text-sm leading-6 text-zinc-500">
                            {item.description}
                          </p>
                        </button>
                      ))}
                    </div>

                    <div className="mt-8 grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-3 block text-sm text-zinc-300">
                          Experience level
                        </label>

                        <select
                          value={experience}
                          onChange={(event) =>
                            setExperience(
                              event.target.value as Experience,
                            )
                          }
                          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-4 outline-none focus:border-purple-500/50"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">
                            Intermediate
                          </option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-3 block text-sm text-zinc-300">
                          Training days: {trainingDays}
                        </label>

                        <input
                          type="range"
                          min="2"
                          max="7"
                          value={trainingDays}
                          onChange={(event) =>
                            setTrainingDays(Number(event.target.value))
                          }
                          className="mt-3 w-full accent-purple-500"
                        />

                        <div className="mt-2 flex justify-between text-xs text-zinc-600">
                          <span>2 days</span>
                          <span>7 days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div>
                    <p className="text-sm font-bold tracking-[0.22em] text-purple-400">
                      YOUR RESULTS
                    </p>

                    <h1 className="mt-4 text-4xl font-black sm:text-5xl">
                      Your plan is ready.
                    </h1>

                    <p className="mt-4 leading-7 text-zinc-400">
                      Ова се твоите почетни дневни цели. Подоцна ќе можеш да
                      ги приспособуваш според напредокот.
                    </p>

                    <div className="mt-9 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-600/20 to-black p-7 sm:col-span-2">
                        <p className="text-sm text-purple-300">
                          Daily calorie target
                        </p>

                        <div className="mt-3 flex items-end gap-3">
                          <p className="text-5xl font-black">
                            {results.calories.toLocaleString()}
                          </p>
                          <span className="pb-1 text-zinc-400">
                            kcal / day
                          </span>
                        </div>

                        <p className="mt-4 text-sm text-zinc-500">
                          Estimated resting metabolism: {results.bmr} kcal
                        </p>
                      </div>

                      {[
                        {
                          label: "Protein",
                          value: results.protein,
                          unit: "g",
                        },
                        {
                          label: "Carbohydrates",
                          value: results.carbs,
                          unit: "g",
                        },
                        {
                          label: "Fats",
                          value: results.fat,
                          unit: "g",
                        },
                        {
                          label: "Training",
                          value: trainingDays,
                          unit: "days / week",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-3xl border border-white/10 bg-white/[0.025] p-6"
                        >
                          <p className="text-sm text-zinc-500">
                            {item.label}
                          </p>
                          <p className="mt-3 text-3xl font-black">
                            {item.value}
                            <span className="ml-2 text-sm font-normal text-zinc-500">
                              {item.unit}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                      <p className="font-bold">
                        Recommended starting plan
                      </p>

                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {goal === "gain" &&
                          `${trainingDays}-day Muscle Gain program with progressive overload.`}

                        {goal === "lose" &&
                          `${trainingDays}-day Fat Loss program combining strength and cardio.`}

                        {goal === "maintain" &&
                          `${trainingDays}-day Balanced Fitness program for strength and conditioning.`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {errorMessage && (
                <p className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                  {errorMessage}
                </p>
              )}

              <div className="mt-10 flex items-center justify-between border-t border-white/[0.06] pt-7">
                <button
                  type="button"
                  onClick={previousStep}
                  disabled={step === 1 || saving}
                  className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-bold text-zinc-300 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Back
                </button>

                {step < 5 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-8 py-3 text-sm font-bold shadow-[0_0_35px_rgba(139,92,246,0.25)] transition hover:scale-[1.02]"
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={finishOnboarding}
                    disabled={saving}
                    className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-8 py-3 text-sm font-bold shadow-[0_0_35px_rgba(139,92,246,0.25)] transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    {saving ? "Creating your plan..." : "Open dashboard →"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
