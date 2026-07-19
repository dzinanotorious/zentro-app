import { NextResponse } from "next/server";
import {
  requireAdmin,
  supabaseAdmin,
  writeAuditLog,
} from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { response } = await requireAdmin(request);

    if (response) {
      return response;
    }

    const { data, error } = await supabaseAdmin
      .from("community_comments")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      comments: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Server error",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, response } = await requireAdmin(request);

    if (response || !user) {
      return response;
    }

    const body = await request.json();
    const commentId = body.commentId;

    if (!commentId) {
      return NextResponse.json(
        {
          error: "Missing comment ID",
        },
        {
          status: 400,
        },
      );
    }

    const { error } = await supabaseAdmin
      .from("community_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        },
      );
    }

    await writeAuditLog({
      adminUserId: user.id,
      action: "delete_community_comment",
      details: {
        commentId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Server error",
      },
      {
        status: 500,
      },
    );
  }
}
