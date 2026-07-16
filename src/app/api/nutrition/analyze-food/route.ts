import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DAILY_FOOD_SCAN_LIMIT = 2;

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel =
  process.env.OPENAI_FOOD_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-4.1-mini";

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
  remaining: number;
};

const allowedImagePrefixes = [
  "data:image/jpeg;base64,",
  "data:image/jpg;base64,",
  "data:image/png;base64,",
  "data:image/webp;base64,",
];

function isAllowedImageDataUrl(
  value: string,
) {
  return allowedImagePrefixes.some(
    (prefix) => value.startsWith(prefix),
  );
}

function estimateBase64Bytes(
  dataUrl: string,
) {
  const base64 =
    dataUrl.split(",")[1] ?? "";

  return Math.ceil(
    (base64.length * 3) / 4,
  );
}

function getAccessToken(
  request: Request,
) {
  const authorization =
    request.headers.get("authorization");

  return authorization?.replace(
    /^Bearer\s+/i,
    "",
  );
}

async function releaseReservedUsage(
  userId: string,
) {
  const { error } =
    await supabaseAdmin.rpc(
      "release_food_scan",
      {
        p_user_id: userId,
      },
    );

  if (error) {
    console.error(
      "Could not release food scan usage:",
      error,
    );
  }
}

export async function POST(
  request: Request,
) {
  let reservedUserId: string | null =
    null;

  try {
    /*
     * 1. Verify logged-in user.
     */
    const accessToken =
      getAccessToken(request);

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
    } =
      await supabaseAdmin.auth.getUser(
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

    const userId = user.id;

    /*
     * 2. Verify Zentro Pro.
     */
    const {
      data: subscription,
      error: subscriptionError,
    } = await supabaseAdmin
      .from("user_subscriptions")
      .select("plan_code, status")
      .eq("user_id", userId)
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
     * 3. Validate image before consuming a credit.
     */
    const body =
      (await request.json()) as AnalyzeFoodRequest;

    const imageDataUrl =
      body.imageDataUrl?.trim();

    if (!imageDataUrl) {
      return NextResponse.json(
        {
          error:
            "No food image was provided.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !isAllowedImageDataUrl(
        imageDataUrl,
      )
    ) {
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
      estimateBase64Bytes(
        imageDataUrl,
      );

    const maximumImageSizeBytes =
      10 * 1024 * 1024;

    if (
      imageSizeBytes >
      maximumImageSizeBytes
    ) {
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
     * 4. Atomically reserve one daily scan.
     */
    const {
      data: claimData,
      error: claimError,
    } = await supabaseAdmin.rpc(
      "claim_food_scan",
      {
        p_user_id: userId,
        p_limit:
          DAILY_FOOD_SCAN_LIMIT,
      },
    );

    if (claimError) {
      console.error(
        "Food scan usage claim error:",
        claimError,
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

    const usage = Array.isArray(
      claimData,
    )
      ? (claimData[0] as
          | UsageResult
          | undefined)
      : (claimData as
          | UsageResult
          | null);

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
          code:
            "DAILY_LIMIT_REACHED",
          usage: {
            used: usage.used,
            limit:
              DAILY_FOOD_SCAN_LIMIT,
            remaining: 0,
          },
        },
        {
          status: 429,
        },
      );
    }

    reservedUserId = userId;

    /*
     * 5. Analyze meal.
     */
    const response =
      await openai.responses.create({
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
                image_url:
                  imageDataUrl,
                detail: "high",
              },
            ],
          },
        ],

        text: {
          format: {
            type: "json_schema",
            name:
              "zentro_food_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties:
                false,
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
                  additionalProperties:
                    false,
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
                  additionalProperties:
                    false,
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
                    additionalProperties:
                      false,
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

        max_output_tokens: 1400,
      });

    const outputText =
      response.output_text?.trim();

    if (!outputText) {
      throw new Error(
        "The AI could not analyze this image.",
      );
    }

    const analysis =
      JSON.parse(outputText);

    if (!analysis.is_food) {
      await releaseReservedUsage(
        userId,
      );

      reservedUserId = null;

      return NextResponse.json(
        {
          error:
            "No recognizable food was found in the image.",
          code: "NO_FOOD_FOUND",
          analysis,
          usage: {
            used: Math.max(
              usage.used - 1,
              0,
            ),
            limit:
              DAILY_FOOD_SCAN_LIMIT,
            remaining: Math.min(
              usage.remaining + 1,
              DAILY_FOOD_SCAN_LIMIT,
            ),
          },
        },
        {
          status: 422,
        },
      );
    }

    /*
     * 6. Save successful scan.
     */
    const {
      data: savedScan,
      error: saveError,
    } = await supabaseAdmin
      .from("food_scan_history")
      .insert({
        user_id: userId,
        meal_name:
          analysis.meal_name,
        description:
          analysis.description,
        total_calories:
          analysis.total_calories,
        protein_g:
          analysis.macros.protein_g,
        carbohydrates_g:
          analysis.macros
            .carbohydrates_g,
        fat_g:
          analysis.macros.fat_g,
        fiber_g:
          analysis.macros.fiber_g,
        portion_estimate:
          analysis.portion_estimate,
        confidence:
          analysis.confidence,
        ingredients:
          analysis.ingredients,
        assumptions:
          analysis.assumptions,
        warnings:
          analysis.warnings,
        scanned_at:
          new Date().toISOString(),
      })
      .select("id")
      .single();

    if (saveError || !savedScan) {
      throw new Error(
        saveError?.message ||
          "Could not save scan.",
      );
    }

    reservedUserId = null;

    return NextResponse.json({
      success: true,
      analysis,
      scanId: savedScan.id,
      usage: {
        used: usage.used,
        limit:
          DAILY_FOOD_SCAN_LIMIT,
        remaining:
          usage.remaining,
      },
      disclaimer:
        "Nutrition values are estimates based on the visible image. Actual values can vary because portion weight, oils, sauces and ingredients may not be visible.",
    });
  } catch (error) {
    if (reservedUserId) {
      await releaseReservedUsage(
        reservedUserId,
      );
    }

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
