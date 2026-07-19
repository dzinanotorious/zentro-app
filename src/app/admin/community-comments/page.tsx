"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export default function CommunityCommentsPage() {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadComments();
  }, []);

  async function loadComments() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/admin/community-comments", {
        cache: "no-store",
      });

      const contentType = response.headers.get("content-type");

      if (!contentType?.includes("application/json")) {
        throw new Error(
          "Admin comments API is missing or returned an invalid response.",
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load comments.");
      }

      setComments(data.comments ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load comments.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteComment(commentId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this comment?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingCommentId(commentId);
      setErrorMessage("");

      const response = await fetch("/api/admin/community-comments", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commentId,
        }),
      });

      const contentType = response.headers.get("content-type");

      if (!contentType?.includes("application/json")) {
        throw new Error(
          "Admin comments API returned an invalid response.",
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete comment.");
      }

      setComments((currentComments) =>
        currentComments.filter(
          (comment) => comment.id !== commentId,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete comment.",
      );
    } finally {
      setDeletingCommentId(null);
    }
  }

  return (
    <main className="min-h-dvh bg-[#050507] text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6 rounded-3xl border border-white/10 bg-[#0b0b10] p-5 sm:mb-8 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.22em] text-orange-400">
                COMMUNITY MODERATION
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Community Comments
              </h1>

              <p className="mt-3 text-sm leading-6 text-zinc-500 sm:text-base">
                Review, manage and remove community comments.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/community-posts"
                className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
              >
                Posts
              </Link>

              <Link
                href="/admin"
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5"
              >
                ← Back
              </Link>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#0b0b10] p-10 text-center">
            <p className="text-zinc-500">Loading comments...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#0b0b10] p-8 text-center sm:p-10">
            <h2 className="text-xl font-bold">No comments found</h2>

            <p className="mt-3 text-sm text-zinc-500 sm:text-base">
              Community comments will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {comments.map((comment) => (
              <article
                key={comment.id}
                className="rounded-3xl border border-white/10 bg-[#0b0b10] p-5 sm:p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-4 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span className="rounded-full bg-white/5 px-3 py-1.5">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-zinc-200 sm:text-base">
                      {comment.content || "Empty comment"}
                    </p>

                    <div className="mt-5 space-y-2 text-xs text-zinc-600">
                      <p className="break-all">
                        Comment ID: {comment.id}
                      </p>

                      <p className="break-all">
                        Post ID: {comment.post_id}
                      </p>

                      <p className="break-all">
                        User ID: {comment.user_id}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteComment(comment.id)}
                    disabled={deletingCommentId === comment.id}
                    className="min-h-12 w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 lg:w-48"
                  >
                    {deletingCommentId === comment.id
                      ? "Deleting..."
                      : "Delete Comment"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
