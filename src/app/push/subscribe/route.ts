import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL",
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY",
  );
}

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

type PushSubscriptionRequest = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

function getAccessToken(request: Request) {
  const authorization =
    request.headers.get("authorization");

  return authorization?.replace(
    /^Bearer\s+/i,
    "",
  );
}

async function getAuthenticatedUser(
  request: Request,
) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return {
      user: null,
      error: "Missing authorization token.",
    };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(
    accessToken,
  );

  if (error || !user) {
    return {
      user: null,
      error:
        "Your login session is invalid or expired.",
    };
  }

  return {
    user,
    error: null,
  };
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } =
      await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        {
          error: authError ?? "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    const body =
      (await request.json()) as PushSubscriptionRequest;

    const endpoint = body.endpoint?.trim();
    const p256dh = body.keys?.p256dh?.trim();
    const auth = body.keys?.auth?.trim();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        {
          error:
            "Invalid push subscription data.",
        },
        {
          status: 400,
        },
      );
    }

    try {
      const endpointUrl = new URL(endpoint);

      if (
        endpointUrl.protocol !== "https:"
      ) {
        throw new Error(
          "Push endpoint must use HTTPS.",
        );
      }
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid push subscription endpoint.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      endpoint.length > 4000 ||
      p256dh.length > 1000 ||
      auth.length > 1000
    ) {
      return NextResponse.json(
        {
          error:
            "Push subscription data is too large.",
        },
        {
          status: 400,
        },
      );
    }

    const { error: saveError } =
      await supabaseAdmin
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
          },
          {
            onConflict: "endpoint",
          },
        );

    if (saveError) {
      console.error(
        "Push subscription save error:",
        saveError,
      );

      return NextResponse.json(
        {
          error:
            "Could not save push subscription.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Push subscription saved successfully.",
    });
  } catch (error) {
    console.error(
      "Push subscribe API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Push subscription failed.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  request: Request,
) {
  try {
    const { user, error: authError } =
      await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        {
          error: authError ?? "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    const body =
      (await request.json()) as {
        endpoint?: string;
      };

    const endpoint = body.endpoint?.trim();

    if (!endpoint) {
      return NextResponse.json(
        {
          error:
            "Push subscription endpoint is required.",
        },
        {
          status: 400,
        },
      );
    }

    const { error: deleteError } =
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);

    if (deleteError) {
      console.error(
        "Push subscription delete error:",
        deleteError,
      );

      return NextResponse.json(
        {
          error:
            "Could not remove push subscription.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Push subscription removed.",
    });
  } catch (error) {
    console.error(
      "Push unsubscribe API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Push unsubscribe failed.",
      },
      {
        status: 500,
      },
    );
  }
}
