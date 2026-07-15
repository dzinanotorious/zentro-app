import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export function getBearerToken(request: Request) {
  return request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
}

export async function requireAdmin(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Missing authorization token." },
        { status: 401 },
      ),
    };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json(
        {
          error:
            "Your login session is invalid or expired.",
        },
        { status: 401 },
      ),
    };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, is_disabled")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin || profile.is_disabled) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

export async function writeAuditLog({
  adminUserId,
  targetUserId,
  action,
  details = {},
}: {
  adminUserId: string;
  targetUserId?: string | null;
  action: string;
  details?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin
    .from("admin_audit_logs")
    .insert({
      admin_user_id: adminUserId,
      target_user_id: targetUserId ?? null,
      action,
      details,
    });

  if (error) {
    console.error("Admin audit log error:", error);
  }
}
