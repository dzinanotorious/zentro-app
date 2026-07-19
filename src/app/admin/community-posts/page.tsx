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
      setErrorMessage("");

      const response = await fetch(
        "/api/admin/community-comments",
        {
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load comments.",
        );
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
      "Delete this comment?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingCommentId(commentId);

      const response = await fetch(
        "/api/admin/community-comments",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            commentId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to delete comment.",
        );
      }

      setComments((current) =>
        current.filter(
          (comment) => comment.id !== commentId,
        ),
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to delete comment.",
      );
    } finally {
      setDeletingCommentId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-3xl border border-white/10 bg-[#0b0b10] p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.25em] text-orange-400">
                COMMUNITY MODERATION
              </p>

              <h1 className="mt-3 text-3xl font-black sm:text-4xl">
                Community Comments
              </h1>

              <p className="mt-3 text-sm text-zinc-500 sm:text-base">
                Review, manage and remove comments.
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
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#0b0b10] p-10 text-center">
            <p className="text-zinc-500">
              Loading comments...
            </p>
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#0b0b10] p-10 text-center">
            <h2 className="text-xl font-bold">
              No comments found
            </h2>

            <p className="mt-3 text-zinc-500">
              Community comments will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {comments.map((comment) => (
              <article
                key={comment.id}
                className="rounded-3xl border border-white/10 bg-[#0b0b10] p-5"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-5 flex flex-wrap gap-3 text-xs text-zinc-500">
                      <span className="rounded-full bg-white/5 px-3 py-1">
                        {new Date(
                          comment.created_at,
                        ).toLocaleString()}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap break-words text-zinc-200">
                      {comment.content}
                    </p>

                    <p className="mt-5 break-all text-xs text-zinc-700">
                      Comment ID: {comment.id}
                    </p>

                    <p className="mt-2 break-all text-xs text-zinc-700">
                      Post ID: {comment.post_id}
                    </p>
                  </div>

                  <div className="lg:w-[180px]">
                    <button
                      type="button"
                      onClick={() =>
                        deleteComment(comment.id)
                      }
                      disabled={
                        deletingCommentId === comment.id
                      }
                      className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {deletingCommentId === comment.id
                        ? "Deleting..."
                        : "Delete Comment"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
