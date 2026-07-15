import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel =
  process.env.OPENAI_MODEL || "gpt-4.1-mini";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!openaiApiKey) {
  throw new Error("Missing OPENAI_API_KEY");
}

if (!supabaseUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL",
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY",
  );
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

type AnalyzeFoodRequest = {
  imageDataUrl?: string;
};

type UsageResult = {
  allowed: boolean;
  used: number;
  daily_limit: number;
  remaining: number;
};

const allowedImagePrefixes = [
  "data:image/jpeg;base64,",
  "data:image/jpg;base64,",
  "data:image/png;base64,",
  "data:image/webp;base64,",
];

function isAllowedImageDataUrl(value: string) {
  return allowedImagePrefixes.some((prefix) =>
    value.startsWith(prefix),
  );
}

function estimateBase64Bytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";

  return Math.ceil((base64.length * 3) / 4);
}

export async function POST(request: Request) {
  try {
    /*
     * 1. Verify the logged-in Supabase user.
     */
    const authorization =
      request.headers.get("authorization");

    const accessToken = authorization?.replace(
      /^Bearer\s+/i,
      "",
    );

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "You must be logged in to scan food.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      accessToken,
    );

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Your login session is invalid or expired.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * 2. Check whether the user has Zentro Pro.
     */
    const {
      data: subscription,
      error: subscriptionError,
    } = await supabaseAdmin
      .from("user_subscriptions")
      .select("plan_code, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      console.error(
        "Subscription check error:",
        subscriptionError,
      );

      return NextResponse.json(
        {
          error:
            "Could not verify your Zentro plan.",
        },
        {
          status: 500,
        },
      );
    }

    const hasPro =
      subscription?.plan_code === "pro" &&
      ["active", "trialing"].includes(
        subscription.status,
      );

    if (!hasPro) {
      return NextResponse.json(
        {
          error:
            "AI Food Scanner is available with Zentro Pro.",
          code: "PRO_REQUIRED",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * 3. Atomically consume one daily AI food scan.
     */
    const {
      data: usageData,
      error: usageError,
    } = await supabaseAdmin.rpc(
      "consume_ai_usage",
      {
        p_user_id: user.id,
        p_usage_type: "food_scan",
        p_daily_limit: 2,
      },
    );

    if (usageError) {
      console.error(
        "Food scanner usage error:",
        usageError,
      );

      return NextResponse.json(
        {
          error:
            "Could not verify your daily food scanner limit.",
        },
        {
          status: 500,
        },
      );
    }

    const usage = (
      Array.isArray(usageData)
        ? usageData[0]
        : usageData
    ) as UsageResult | null;

    if (!usage) {
      return NextResponse.json(
        {
          error:
            "Could not read your food scanner usage.",
        },
        {
          status: 500,
        },
      );
    }

    if (!usage.allowed) {
      return NextResponse.json(
        {
          error:
            "You have reached your daily limit of 2 AI food scans. Your limit resets tomorrow.",
          code: "DAILY_LIMIT_REACHED",
          usage: {
            used: usage.used,
            limit: usage.daily_limit,
            remaining: usage.remaining,
          },
        },
        {
          status: 429,
        },
      );
    }

    /*
     * 4. Validate the uploaded image.
     */
    const body =
      (await request.json()) as AnalyzeFoodRequest;

    const imageDataUrl = body.imageDataUrl?.trim();

    if (!imageDataUrl) {
      return NextResponse.json(
        {
          error: "No food image was provided.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isAllowedImageDataUrl(imageDataUrl)) {
      return NextResponse.json(
        {
          error:
            "Unsupported image format. Use JPG, PNG or WEBP.",
        },
        {
          status: 400,
        },
      );
    }

    const imageSizeBytes =
      estimateBase64Bytes(imageDataUrl);

    const maximumImageSizeBytes =
      10 * 1024 * 1024;

    if (imageSizeBytes > maximumImageSizeBytes) {
      return NextResponse.json(
        {
          error:
            "The image is too large. Maximum size is 10 MB.",
        },
        {
          status: 413,
        },
      );
    }

    /*
     * 5. Analyze the meal with an OpenAI vision model.
     */
    const response = await openai.responses.create({
      model: openaiModel,

      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
You are Zentro's professional AI nutrition analysis system.

Analyze the food or meal visible in the image.

Your task:
- Identify the most likely meal.
- Identify every visible food ingredient.
- Estimate the portion size of each ingredient.
- Estimate total calories.
- Estimate protein, carbohydrates, fat and fiber.
- Provide a realistic calorie range because image-only nutrition analysis is approximate.
- State assumptions such as hidden oil, sauces, dressings, cooking methods or ingredients that cannot be confirmed.
- Do not claim medical or laboratory accuracy.
- If the image does not clearly contain food, set is_food to false.
- Use grams where practical.
- Return numbers rounded to one decimal place.
- Do not invent ingredients that are not reasonably likely.
              `.trim(),
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],

      text: {
        format: {
          type: "json_schema",
          name: "zentro_food_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              is_food: {
                type: "boolean",
              },
              meal_name: {
                type: "string",
              },
              description: {
                type: "string",
              },
              portion_estimate: {
                type: "string",
              },
              total_calories: {
                type: "number",
              },
              calorie_range: {
                type: "object",
                additionalProperties: false,
                properties: {
                  minimum: {
                    type: "number",
                  },
                  maximum: {
                    type: "number",
                  },
                },
                required: [
                  "minimum",
                  "maximum",
                ],
              },
              macros: {
                type: "object",
                additionalProperties: false,
                properties: {
                  protein_g: {
                    type: "number",
                  },
                  carbohydrates_g: {
                    type: "number",
                  },
                  fat_g: {
                    type: "number",
                  },
                  fiber_g: {
                    type: "number",
                  },
                },
                required: [
                  "protein_g",
                  "carbohydrates_g",
                  "fat_g",
                  "fiber_g",
                ],
              },
              ingredients: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: {
                      type: "string",
                    },
                    estimated_amount: {
                      type: "string",
                    },
                    estimated_grams: {
                      type: "number",
                    },
                    estimated_calories: {
                      type: "number",
                    },
                  },
                  required: [
                    "name",
                    "estimated_amount",
                    "estimated_grams",
                    "estimated_calories",
                  ],
                },
              },
              confidence: {
                type: "string",
                enum: [
                  "low",
                  "medium",
                  "high",
                ],
              },
              assumptions: {
                type: "array",
                items: {
                  type: "string",
                },
              },
              warnings: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },
            required: [
              "is_food",
              "meal_name",
              "description",
              "portion_estimate",
              "total_calories",
              "calorie_range",
              "macros",
              "ingredients",
              "confidence",
              "assumptions",
              "warnings",
            ],
          },
        },
      },
    });

    if (!response.output_text) {
      return NextResponse.json(
        {
          error:
            "The AI could not analyze this image.",
        },
        {
          status: 502,
        },
      );
    }

    const analysis = JSON.parse(
      response.output_text,
    );

    if (!analysis.is_food) {
      return NextResponse.json(
        {
          error:
            "No recognizable food was found in the image.",
          analysis,
        },
        {
          status: 422,
        },
      );
    }

    return NextResponse.json({
      success: true,
      analysis,
      usage: {
        used: usage.used,
        limit: usage.daily_limit,
        remaining: usage.remaining,
      },
      disclaimer:
        "Nutrition values are estimates based on the visible image. Actual values can vary because portion weight, oils, sauces and ingredients may not be visible.",
    });
  } catch (error) {
    console.error(
      "AI food analysis error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Food analysis failed.",
      },
      {
        status: 500,
      },
    );
  }
}
