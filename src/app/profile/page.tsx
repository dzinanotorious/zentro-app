"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
  activity: string | null;
  goal: string | null;
  experience: string | null;
  training_days: number | null;
};

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "Z";
}

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [gender, setGender] = useState("");
  const [activity, setActivity] = useState("");
  const [goal, setGoal] = useState("");
  const [experience, setExperience] = useState("");
  const [trainingDays, setTrainingDays] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );

  useEffect(() => {
    async function loadProfile() {
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

      setEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, username, avatar_url, age, height_cm, weight_kg, gender, activity, goal, experience, training_days",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Could not load profile:", error);
        setMessageType("error");
        setMessage("Ne mozhevme da go vchitame profilot.");
        setLoading(false);
        return;
      }

      const loadedProfile = data as Profile | null;

      setProfile(loadedProfile);
      setFullName(loadedProfile?.full_name ?? "");
      setUsername(loadedProfile?.username ?? "");
      setAge(
        loadedProfile?.age !== null && loadedProfile?.age !== undefined
          ? String(loadedProfile.age)
          : "",
      );
      setHeightCm(
        loadedProfile?.height_cm !== null &&
          loadedProfile?.height_cm !== undefined
          ? String(loadedProfile.height_cm)
          : "",
      );
      setWeightKg(
        loadedProfile?.weight_kg !== null &&
          loadedProfile?.weight_kg !== undefined
          ? String(loadedProfile.weight_kg)
          : "",
      );
      setGender(loadedProfile?.gender ?? "");
      setActivity(loadedProfile?.activity ?? "");
      setGoal(loadedProfile?.goal ?? "");
      setExperience(loadedProfile?.experience ?? "");
      setTrainingDays(
        loadedProfile?.training_days !== null &&
          loadedProfile?.training_days !== undefined
          ? String(loadedProfile.training_days)
          : "",
      );

      setLoading(false);
    }

    void loadProfile();
  }, [router]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile?.id) return;

    const cleanUsername = username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

    if (!fullName.trim()) {
      setMessageType("error");
      setMessage("Vnesi go tvoeto ime.");
      return;
    }

    if (!cleanUsername) {
      setMessageType("error");
      setMessage("Vnesi validno username.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        username: cleanUsername,
        age: age ? Number(age) : null,
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        gender: gender || null,
        activity: activity || null,
        goal: goal || null,
        experience: experience || null,
        training_days: trainingDays ? Number(trainingDays) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      console.error("Could not update profile:", error);
      setMessageType("error");

      if (error.code === "23505") {
        setMessage("Ova username vekje se koristi. Izberi drugo.");
      } else {
        setMessage("Profilot ne beshe zachuvan. Obidi se povtorno.");
      }

      setSaving(false);
      return;
    }

    setUsername(cleanUsername);
    setMessageType("success");
    setMessage("Profilot e uspesno zachuvan.");
    setSaving(false);
    router.refresh();
  }

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
          <p className="mt-5 text-sm text-zinc-500">
            Loading profile...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-6 text-white sm:px-6 lg:py-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[15%] top-[-320px] h-[650px] w-[650px] rounded-full bg-purple-700/20 blur-[170px]" />
        <div className="absolute -right-72 top-[35%] h-[620px] w-[620px] rounded-full bg-fuchsia-900/10 blur-[170px]" />
      </div>

      <div className="relative mx-auto max-w-5xl">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-bold text-purple-400 transition hover:text-purple-300"
            >
              ← Back to dashboard
            </Link>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Profile
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Manage your Zentro account and fitness information.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-5 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </header>

        {message && (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              messageType === "success"
                ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-200"
                : "border-red-500/20 bg-red-500/[0.07] text-red-200"
            }`}
          >
            {message}
          </div>
        )}

        <section className="mt-7 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-[30px] border border-white/[0.07] bg-[#0b0b10]/90 p-6">
            <div className="flex flex-col items-center text-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={fullName || "Profile"}
                  className="h-28 w-28 rounded-[30px] object-cover"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-[30px] bg-gradient-to-br from-purple-600 to-violet-500 text-4xl font-black shadow-[0_0_40px_rgba(139,92,246,0.25)]">
                  {getInitial(fullName)}
                </div>
              )}

              <h2 className="mt-5 text-xl font-black">
                {fullName || "Zentro Athlete"}
              </h2>

              <p className="mt-1 text-sm text-purple-400">
                @{username || "zentro_user"}
              </p>

              <p className="mt-2 break-all text-xs text-zinc-600">
                {email}
              </p>
            </div>

            <div className="mt-7 space-y-3">
              <ProfileSummary
                label="Goal"
                value={
                  goal === "gain"
                    ? "Muscle Gain"
                    : goal === "lose"
                      ? "Fat Loss"
                      : goal
                        ? "Balanced Fitness"
                        : "Not selected"
                }
              />

              <ProfileSummary
                label="Experience"
                value={
                  experience
                    ? experience.charAt(0).toUpperCase() +
                      experience.slice(1)
                    : "Not selected"
                }
              />

              <ProfileSummary
                label="Training"
                value={
                  trainingDays
                    ? `${trainingDays} days / week`
                    : "Not selected"
                }
              />
            </div>
          </aside>

          <form
            onSubmit={handleSave}
            className="rounded-[30px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8"
          >
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-purple-400">
                ACCOUNT DETAILS
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Personal information
              </h2>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <Field
                label="Full name"
                value={fullName}
                onChange={setFullName}
                placeholder="Your full name"
                required
              />

              <Field
                label="Username"
                value={username}
                onChange={setUsername}
                placeholder="username"
                prefix="@"
                required
              />

              <Field
                label="Age"
                value={age}
                onChange={setAge}
                type="number"
                placeholder="25"
                min="13"
                max="100"
              />

              <Field
                label="Height"
                value={heightCm}
                onChange={setHeightCm}
                type="number"
                placeholder="180"
                suffix="cm"
                min="100"
                max="250"
              />

              <Field
                label="Weight"
                value={weightKg}
                onChange={setWeightKg}
                type="number"
                placeholder="80"
                suffix="kg"
                min="30"
                max="400"
                step="0.1"
              />

              <SelectField
                label="Gender"
                value={gender}
                onChange={setGender}
                options={[
                  { value: "", label: "Select gender" },
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
              />

              <SelectField
                label="Activity"
                value={activity}
                onChange={setActivity}
                options={[
                  { value: "", label: "Select activity" },
                  { value: "sedentary", label: "Low activity" },
                  { value: "light", label: "Light activity" },
                  { value: "moderate", label: "Moderate activity" },
                  { value: "high", label: "High activity" },
                  { value: "very_high", label: "Very high activity" },
                ]}
              />

              <SelectField
                label="Goal"
                value={goal}
                onChange={setGoal}
                options={[
                  { value: "", label: "Select goal" },
                  { value: "lose", label: "Fat loss" },
                  { value: "maintain", label: "Balanced fitness" },
                  { value: "gain", label: "Muscle gain" },
                ]}
              />

              <SelectField
                label="Experience"
                value={experience}
                onChange={setExperience}
                options={[
                  { value: "", label: "Select experience" },
                  { value: "beginner", label: "Beginner" },
                  { value: "intermediate", label: "Intermediate" },
                  { value: "advanced", label: "Advanced" },
                ]}
              />

              <SelectField
                label="Training days"
                value={trainingDays}
                onChange={setTrainingDays}
                options={[
                  { value: "", label: "Select days" },
                  { value: "1", label: "1 day / week" },
                  { value: "2", label: "2 days / week" },
                  { value: "3", label: "3 days / week" },
                  { value: "4", label: "4 days / week" },
                  { value: "5", label: "5 days / week" },
                  { value: "6", label: "6 days / week" },
                  { value: "7", label: "7 days / week" },
                ]}
              />
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-zinc-600">
                Your changes will also appear in Zentro-Community.
              </p>

              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-3.5 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.2)] transition hover:scale-[1.02] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  prefix,
  suffix,
  required,
  min,
  max,
  step,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-300">
        {label}
      </span>

      <div className="flex items-center rounded-2xl border border-white/[0.08] bg-black/30 focus-within:border-purple-500/40">
        {prefix && (
          <span className="pl-4 text-sm font-bold text-purple-400">
            {prefix}
          </span>
        )}

        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          min={min}
          max={max}
          step={step}
          className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-zinc-700"
        />

        {suffix && (
          <span className="pr-4 text-xs text-zinc-600">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
};

function SelectField({
  label,
  value,
  onChange,
  options,
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-300">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3.5 text-sm outline-none focus:border-purple-500/40"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-[#0b0b10]"
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProfileSummary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] pb-3 text-sm last:border-none last:pb-0">
      <span className="text-zinc-600">{label}</span>
      <span className="font-semibold text-zinc-300">{value}</span>
    </div>
  );
}
