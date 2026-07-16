import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DAILY_WORKOUT_LIMIT = 2;

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel =
  process.env.OPENAI_WORKOUT_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-4o-mini";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!openaiApiKey) throw new Error("Missing OPENAI_API_KEY.");
if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

const openai = new OpenAI({ apiKey: openaiApiKey });

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type WorkoutBuilderRequest = {
  durationMinutes?: number;
  location?: string;
  energyLevel?: string;
  goal?: string;
  equipment?: string[];
  limitations?: string[];
  additionalNotes?: string;
};

type UsageClaim = {
  allowed: boolean;
  used: number;
  remaining: number;
};

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
  title: string;
  summary: string;
  estimated_duration_minutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  safety_note: string;
  warmup: WorkoutSection;
  main_workout: WorkoutSection;
  cooldown: WorkoutSection;
};

const allowedLocations = [
  "gym",
  "home",
  "hotel",
  "outdoors",
  "office",
];

const allowedEnergyLevels = ["low", "medium", "high"];

const allowedGoals = [
  "muscle_gain",
  "fat_loss",
  "strength",
  "conditioning",
  "mobility",
  "general_fitness",
];

function getAccessToken(request: Request) {
  return request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
}

function cleanStringArray(value: unknown, maximumItems: number) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maximumItems);
}

function parseWorkoutJson(rawText: string): GeneratedWorkout {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(cleaned) as GeneratedWorkout;

  if (
    !parsed.title ||
    !parsed.summary ||
    !parsed.warmup ||
    !parsed.main_workout ||
    !parsed.cooldown ||
    !Array.isArray(parsed.warmup.exercises) ||
    !Array.isArray(parsed.main_workout.exercises) ||
    !Array.isArray(parsed.cooldown.exercises)
  ) {
    throw new Error("AI returned an incomplete workout.");
  }

  return parsed;
}

async function releaseReservedUsage(userId: string) {
  const { error } = await supabaseAdmin.rpc(
    "release_workout_builder_generation",
    { p_user_id: userId },
  );

  if (error) {
    console.error("Could not release workout usage:", error);
  }
}

export async function POST(request: Request) {
  let reservedUserId: string | null = null;

  try {
    const accessToken = getAccessToken(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "You must be logged in to generate a workout." },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your login session is invalid or expired." },
        { status: 401 },
      );
    }

    const userId = user.id;

    const { data: subscription, error: subscriptionError } =
      await supabaseAdmin
        .from("user_subscriptions")
        .select("plan_code, status")
        .eq("user_id", userId)
        .maybeSingle();

    if (subscriptionError) {
      console.error("Subscription check error:", subscriptionError);
      return NextResponse.json(
        { error: "Could not verify your Zentro plan." },
        { status: 500 },
      );
    }

    const hasPro =
      subscription?.plan_code === "pro" &&
      ["active", "trialing"].includes(subscription.status);

    if (!hasPro) {
      return NextResponse.json(
        {
          error:
            "Real-Life Workout Builder is available with Zentro Pro.",
          code: "PRO_REQUIRED",
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as WorkoutBuilderRequest;

    const durationMinutes = Number(body.durationMinutes);
    const location = body.location?.trim().toLowerCase();
    const energyLevel = body.energyLevel?.trim().toLowerCase();
    const goal = body.goal?.trim().toLowerCase();
    const equipment = cleanStringArray(body.equipment, 12);
    const limitations = cleanStringArray(body.limitations, 8);
    const additionalNotes = body.additionalNotes?.trim().slice(0, 500) ?? "";

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 10 ||
      durationMinutes > 120
    ) {
      return NextResponse.json(
        { error: "Workout duration must be between 10 and 120 minutes." },
        { status: 400 },
      );
    }

    if (!location || !allowedLocations.includes(location)) {
      return NextResponse.json(
        { error: "Invalid workout location." },
        { status: 400 },
      );
    }

    if (!energyLevel || !allowedEnergyLevels.includes(energyLevel)) {
      return NextResponse.json(
        { error: "Invalid energy level." },
        { status: 400 },
      );
    }

    if (!goal || !allowedGoals.includes(goal)) {
      return NextResponse.json(
        { error: "Invalid workout goal." },
        { status: 400 },
      );
    }

    const { data: claimData, error: claimError } =
      await supabaseAdmin.rpc("claim_workout_builder_generation", {
        p_user_id: userId,
        p_limit: DAILY_WORKOUT_LIMIT,
      });

    if (claimError) {
      console.error("Workout usage claim error:", claimError);
      return NextResponse.json(
        { error: "Could not verify your daily workout limit." },
        { status: 500 },
      );
    }

    const usage = Array.isArray(claimData)
      ? (claimData[0] as UsageClaim | undefined)
      : (claimData as UsageClaim | null);

    if (!usage) {
      return NextResponse.json(
        { error: "Workout usage information was not returned." },
        { status: 500 },
      );
    }

    if (!usage.allowed) {
      return NextResponse.json(
        {
          error:
            "You have reached today's Real-Life Workout Builder limit.",
          code: "DAILY_LIMIT_REACHED",
          usage: {
            used: usage.used,
            limit: DAILY_WORKOUT_LIMIT,
            remaining: 0,
          },
        },
        { status: 429 },
      );
    }

    reservedUserId = userId;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("age, gender, goal, experience, activity, training_days")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Profile load error:", profileError);
    }

    const instructions = `
You are Zentro Real-Life Workout Builder.

Create a practical workout that fits the user's exact real-life situation.

Safety rules:
- Do not diagnose injuries.
- Respect every limitation provided by the user.
- Do not recommend training through sharp pain.
- Avoid dangerous, extreme or medically inappropriate exercises.
- If a limitation sounds serious, recommend qualified medical guidance.
- Match volume and intensity to the user's energy and experience.
- The complete workout must fit within the requested duration.
- Include realistic rest times.
- Provide exercise replacements when appropriate.

Return ONLY valid JSON.
Do not use markdown.
Do not wrap the JSON in code fences.

Use exactly this structure:
{
  "title": "string",
  "summary": "string",
  "estimated_duration_minutes": 30,
  "difficulty": "beginner",
  "safety_note": "string",
  "warmup": {
    "name": "Warm-up",
    "duration_minutes": 5,
    "exercises": [
      {
        "name": "string",
        "sets": 1,
        "reps": "string",
        "rest_seconds": 0,
        "instructions": "string",
        "replacement": null
      }
    ]
  },
  "main_workout": {
    "name": "Main workout",
    "duration_minutes": 20,
    "exercises": [
      {
        "name": "string",
        "sets": 3,
        "reps": "8-12",
        "rest_seconds": 60,
        "instructions": "string",
        "replacement": "string or null"
      }
    ]
  },
  "cooldown": {
    "name": "Cooldown",
    "duration_minutes": 5,
    "exercises": [
      {
        "name": "string",
        "sets": 1,
        "reps": "string",
        "rest_seconds": 0,
        "instructions": "string",
        "replacement": null
      }
    ]
  }
}
    `.trim();

    const input = `
User profile:
- Age: ${profile?.age ?? "not provided"}
- Gender: ${profile?.gender ?? "not provided"}
- Existing profile goal: ${profile?.goal ?? "not provided"}
- Experience: ${profile?.experience ?? "beginner"}
- Activity level: ${profile?.activity ?? "not provided"}
- Training days: ${profile?.training_days ?? "not provided"}

Requested workout:
- Duration: ${durationMinutes} minutes
- Location: ${location}
- Energy level: ${energyLevel}
- Goal: ${goal}
- Equipment: ${equipment.length > 0 ? equipment.join(", ") : "bodyweight only"}
- Limitations: ${limitations.length > 0 ? limitations.join(", ") : "none provided"}
- Additional notes: ${additionalNotes || "none"}
    `.trim();

    const aiResponse = await openai.responses.create({
      model: openaiModel,
      instructions,
      input,
      max_output_tokens: 1800,
    });

    const rawAnswer = aiResponse.output_text?.trim();

    if (!rawAnswer) {
      throw new Error("Workout Builder did not return a workout.");
    }

    const workout = parseWorkoutJson(rawAnswer);

    const { data: savedWorkout, error: saveError } = await supabaseAdmin
      .from("generated_workouts")
      .insert({
        user_id: userId,
        title: workout.title,
        summary: workout.summary,
        duration_minutes: workout.estimated_duration_minutes,
        location,
        energy_level: energyLevel,
        goal,
        equipment,
        limitations,
        workout_data: workout,
      })
      .select("id, created_at")
      .single();

    if (saveError || !savedWorkout) {
      throw new Error(
        saveError?.message || "Could not save generated workout.",
      );
    }

    reservedUserId = null;

    return NextResponse.json({
      workout: {
        id: savedWorkout.id,
        created_at: savedWorkout.created_at,
        ...workout,
      },
      usage: {
        used: usage.used,
        limit: DAILY_WORKOUT_LIMIT,
        remaining: usage.remaining,
      },
    });
  } catch (error) {
    if (reservedUserId) {
      await releaseReservedUsage(reservedUserId);
    }

    console.error("Workout Builder API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Workout generation failed.",
      },
      { status: 500 },
    );
  }
}
