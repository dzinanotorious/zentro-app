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
      .from("community_posts")
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
      posts: data ?? [],
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
    const { user, response } =
      await requireAdmin(request);

    if (response || !user) {
      return response;
    }

    const body = await request.json();

    const postId = body.postId;

    if (!postId) {
      return NextResponse.json(
        {
          error: "Missing post ID",
        },
        {
          status: 400,
        },
      );
    }

    await supabaseAdmin
      .from("community_notifications")
      .delete()
      .eq("post_id", postId);

    const { error } = await supabaseAdmin
      .from("community_posts")
      .delete()
      .eq("id", postId);

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
      action: "delete_community_post",
      details: {
        postId,
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
