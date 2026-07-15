import { NextResponse } from "next/server";
import {
  requireAdmin,
  supabaseAdmin,
  writeAuditLog,
} from "@/lib/admin-server";

export const runtime = "nodejs";

type ActionRequest =
  | {
      action: "set_plan";
      value: "free" | "pro";
    }
  | {
      action: "set_admin";
      value: boolean;
    }
  | {
      action: "set_disabled";
      value: boolean;
    };

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      userId: string;
    }>;
  },
) {
  try {
    const { user: admin, response } =
      await requireAdmin(request);

    if (response || !admin) {
      return response;
    }

    const { userId } = await context.params;
    const body = (await request.json()) as ActionRequest;

    if (!userId) {
      return NextResponse.json(
        { error: "Target user is required." },
        { status: 400 },
      );
    }

    if (
      body.action === "set_admin" &&
      userId === admin.id &&
      body.value === false
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot remove your own admin access.",
        },
        { status: 400 },
      );
    }

    if (
      body.action === "set_disabled" &&
      userId === admin.id &&
      body.value === true
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot disable your own account.",
        },
        { status: 400 },
      );
    }

    if (body.action === "set_plan") {
      if (
        body.value !== "free" &&
        body.value !== "pro"
      ) {
        return NextResponse.json(
          { error: "Invalid plan." },
          { status: 400 },
        );
      }

      const isPro = body.value === "pro";

      const { error } = await supabaseAdmin
        .from("user_subscriptions")
        .upsert(
          {
            user_id: userId,
            plan_code: body.value,
            status: isPro ? "active" : "inactive",
            billing_period: isPro
              ? "monthly"
              : null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          },
        );

      if (error) throw error;

      await writeAuditLog({
        adminUserId: admin.id,
        targetUserId: userId,
        action: "set_user_plan",
        details: {
          plan: body.value,
          note:
            "Manual admin override. Stripe webhook may update this later.",
        },
      });

      return NextResponse.json({
        success: true,
        message: `User plan changed to ${body.value.toUpperCase()}.`,
      });
    }

    if (body.action === "set_admin") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          is_admin: Boolean(body.value),
        })
        .eq("id", userId);

      if (error) throw error;

      await writeAuditLog({
        adminUserId: admin.id,
        targetUserId: userId,
        action: body.value
          ? "grant_admin"
          : "remove_admin",
      });

      return NextResponse.json({
        success: true,
        message: body.value
          ? "Admin access granted."
          : "Admin access removed.",
      });
    }

    if (body.action === "set_disabled") {
      const disabled = Boolean(body.value);

      const [
        profileResult,
        authResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .update({
            is_disabled: disabled,
          })
          .eq("id", userId),

        supabaseAdmin.auth.admin.updateUserById(
          userId,
          {
            ban_duration: disabled
              ? "876000h"
              : "none",
          },
        ),
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (authResult.error) {
        throw authResult.error;
      }

      await writeAuditLog({
        adminUserId: admin.id,
        targetUserId: userId,
        action: disabled
          ? "disable_user"
          : "enable_user",
      });

      return NextResponse.json({
        success: true,
        message: disabled
          ? "User disabled and banned from authentication."
          : "User enabled and authentication ban removed.",
      });
    }

    return NextResponse.json(
      { error: "Unsupported admin action." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Admin user action error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Admin action failed.",
      },
      { status: 500 },
    );
  }
}
