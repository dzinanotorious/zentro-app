"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type FeedMode = "all" | "following";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type CommunityPostRow = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  likes_count: number | null;
  comments_count: number | null;
  created_at: string;
  updated_at: string | null;
};

type CommunityCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type PostItem = CommunityPostRow & {
  author: Profile | null;
  likedByCurrentUser: boolean;
  likesTotal: number;
  commentsTotal: number;
};

type CommentItem = CommunityCommentRow & {
  author: Profile | null;
};

const MAX_IMAGE_SIZE = 500 * 1024;
const POSTS_PER_PAGE = 20;

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const difference = Date.now() - timestamp;

  if (!Number.isFinite(timestamp)) return "";

  const seconds = Math.max(1, Math.floor(difference / 1000));

  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days}d`;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function getDisplayName(profile: Profile | null) {
  return profile?.full_name?.trim() || "Zentro Athlete";
}

function getUsername(profile: Profile | null) {
  const username = profile?.username?.trim();

  return username || "zentro_user";
}

function getInitial(profile: Profile | null) {
  return getDisplayName(profile).charAt(0).toUpperCase();
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractStoragePath(publicUrl: string) {
  const marker = "/storage/v1/object/public/community-images/";
  const index = publicUrl.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

export default function CommunityPage() {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [currentUserId, setCurrentUserId] = useState("");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  const [feedMode, setFeedMode] = useState<FeedMode>("all");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [actionPostId, setActionPostId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [creatingPost, setCreatingPost] = useState(false);

  const [commentsOpenFor, setCommentsOpenFor] = useState("");
  const [comments, setComments] = useState<Record<string, CommentItem[]>>({});
  const [commentsLoadingFor, setCommentsLoadingFor] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmittingFor, setCommentSubmittingFor] = useState("");

  const [followActionUserId, setFollowActionUserId] = useState("");

  const visiblePosts = useMemo(() => {
    if (feedMode === "all") return posts;

    return posts.filter(
      (post) =>
        post.user_id === currentUserId ||
        followingIds.includes(post.user_id),
    );
  }, [currentUserId, feedMode, followingIds, posts]);

  const loadFeed = useCallback(
    async (userId: string) => {
      setFeedLoading(true);
      setErrorMessage("");

      try {
        const { data: postRows, error: postsError } = await supabase
          .from("community_posts")
          .select(
            "id, user_id, content, image_url, likes_count, comments_count, created_at, updated_at",
          )
          .order("created_at", { ascending: false })
          .limit(POSTS_PER_PAGE);

        if (postsError) throw postsError;

        const typedPosts = (postRows ?? []) as CommunityPostRow[];
        const postIds = typedPosts.map((post) => post.id);
        const authorIds = uniqueValues(typedPosts.map((post) => post.user_id));

        const [
          { data: profileRows, error: profilesError },
          { data: likeRows, error: likesError },
          { data: currentUserLikes, error: currentLikesError },
          { data: commentRows, error: commentsError },
        ] = await Promise.all([
          authorIds.length
            ? supabase
                .from("profiles")
                .select("id, full_name, username, avatar_url")
                .in("id", authorIds)
            : Promise.resolve({ data: [], error: null }),

          postIds.length
            ? supabase
                .from("community_likes")
                .select("post_id")
                .in("post_id", postIds)
            : Promise.resolve({ data: [], error: null }),

          postIds.length
            ? supabase
                .from("community_likes")
                .select("post_id")
                .eq("user_id", userId)
                .in("post_id", postIds)
            : Promise.resolve({ data: [], error: null }),

          postIds.length
            ? supabase
                .from("community_comments")
                .select("post_id")
                .in("post_id", postIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (profilesError) throw profilesError;
        if (likesError) throw likesError;
        if (currentLikesError) throw currentLikesError;
        if (commentsError) throw commentsError;

        const profilesById = new Map(
          ((profileRows ?? []) as Profile[]).map((profile) => [
            profile.id,
            profile,
          ]),
        );

        const likesByPost = new Map<string, number>();

        for (const like of (likeRows ?? []) as { post_id: string }[]) {
          likesByPost.set(
            like.post_id,
            (likesByPost.get(like.post_id) ?? 0) + 1,
          );
        }

        const commentsByPost = new Map<string, number>();

        for (const comment of (commentRows ?? []) as { post_id: string }[]) {
          commentsByPost.set(
            comment.post_id,
            (commentsByPost.get(comment.post_id) ?? 0) + 1,
          );
        }

        const likedPostIds = new Set(
          ((currentUserLikes ?? []) as { post_id: string }[]).map(
            (like) => like.post_id,
          ),
        );

        setPosts(
          typedPosts.map((post) => ({
            ...post,
            author: profilesById.get(post.user_id) ?? null,
            likedByCurrentUser: likedPostIds.has(post.id),
            likesTotal:
              likesByPost.get(post.id) ??
              Number(post.likes_count ?? 0),
            commentsTotal:
              commentsByPost.get(post.id) ??
              Number(post.comments_count ?? 0),
          })),
        );
      } catch (error) {
        console.error("Could not load community feed:", error);
        setErrorMessage(
          "Ne mozhevme da go vchitame community feedot. Obidi se povtorno.",
        );
      } finally {
        setFeedLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    async function initializeCommunity() {
      setPageLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);

      const [
        { data: profileData, error: profileError },
        { data: followsData, error: followsError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("community_followers")
          .select("following_id")
          .eq("follower_id", user.id),
      ]);

      if (profileError) {
        console.error("Could not load current profile:", profileError);
      }

      if (followsError) {
        console.error("Could not load following list:", followsError);
      }

      setCurrentProfile((profileData as Profile | null) ?? null);
      setFollowingIds(
        ((followsData ?? []) as { following_id: string }[]).map(
          (item) => item.following_id,
        ),
      );

      await loadFeed(user.id);
      setPageLoading(false);
    }

    void initializeCommunity();
  }, [loadFeed, router]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  function closeCreateModal() {
    if (creatingPost) return;

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setCreateModalOpen(false);
    setPostContent("");
    setSelectedImage(null);
    setImagePreviewUrl("");

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setErrorMessage("");

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Dozvoleni se samo JPG, PNG i WEBP sliki.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setErrorMessage("Slikata mora da bide pomala od 500 KB.");
      event.target.value = "";
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = postContent.trim();

    if (!content && !selectedImage) {
      setErrorMessage("Dodadi tekst ili slika pred da objavish.");
      return;
    }

    if (!currentUserId) return;

    setCreatingPost(true);
    setErrorMessage("");

    let uploadedStoragePath = "";
    let publicImageUrl: string | null = null;

    try {
      if (selectedImage) {
        const extension =
          selectedImage.name.split(".").pop()?.toLowerCase() || "jpg";
        uploadedStoragePath = `${currentUserId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("community-images")
          .upload(uploadedStoragePath, selectedImage, {
            cacheControl: "3600",
            upsert: false,
            contentType: selectedImage.type,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("community-images")
          .getPublicUrl(uploadedStoragePath);

        publicImageUrl = publicUrlData.publicUrl;
      }

      const { error: insertError } = await supabase
        .from("community_posts")
        .insert({
          user_id: currentUserId,
          content,
          image_url: publicImageUrl,
          likes_count: 0,
          comments_count: 0,
        });

      if (insertError) throw insertError;

      closeCreateModal();
      await loadFeed(currentUserId);
    } catch (error) {
      console.error("Could not create post:", error);

      if (uploadedStoragePath) {
        await supabase.storage
          .from("community-images")
          .remove([uploadedStoragePath]);
      }

      setErrorMessage(
        "Postot ne beshe objaven. Proveri ja slikata i obidi se povtorno.",
      );
    } finally {
      setCreatingPost(false);
    }
  }

  async function toggleLike(post: PostItem) {
    if (!currentUserId || actionPostId) return;

    setActionPostId(post.id);
    setErrorMessage("");

    const nextLikedState = !post.likedByCurrentUser;
    const nextLikesTotal = Math.max(
      post.likesTotal + (nextLikedState ? 1 : -1),
      0,
    );

    setPosts((currentPosts) =>
      currentPosts.map((item) =>
        item.id === post.id
          ? {
              ...item,
              likedByCurrentUser: nextLikedState,
              likesTotal: nextLikesTotal,
            }
          : item,
      ),
    );

    try {
      if (nextLikedState) {
        const { error } = await supabase.from("community_likes").insert({
          post_id: post.id,
          user_id: currentUserId,
        });

        if (error) throw error;

        if (post.user_id !== currentUserId) {
          void supabase.from("community_notifications").insert({
            user_id: post.user_id,
            actor_id: currentUserId,
            type: "like",
            post_id: post.id,
            is_read: false,
          });
        }
      } else {
        const { error } = await supabase
          .from("community_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);

        if (error) throw error;
      }

      const { error: counterError } = await supabase
        .from("community_posts")
        .update({ likes_count: nextLikesTotal })
        .eq("id", post.id);

      if (counterError) {
        console.error("Could not update cached like count:", counterError);
      }
    } catch (error) {
      console.error("Could not toggle like:", error);

      setPosts((currentPosts) =>
        currentPosts.map((item) =>
          item.id === post.id ? post : item,
        ),
      );

      setErrorMessage("Like akcijata ne uspea. Obidi se povtorno.");
    } finally {
      setActionPostId("");
    }
  }

  async function loadComments(postId: string) {
    if (comments[postId]) {
      setCommentsOpenFor((current) =>
        current === postId ? "" : postId,
      );
      return;
    }

    setCommentsOpenFor(postId);
    setCommentsLoadingFor(postId);
    setErrorMessage("");

    try {
      const { data: commentRows, error: commentsError } = await supabase
        .from("community_comments")
        .select("id, post_id, user_id, content, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;

      const typedComments = (commentRows ?? []) as CommunityCommentRow[];
      const userIds = uniqueValues(
        typedComments.map((comment) => comment.user_id),
      );

      const { data: profileRows, error: profilesError } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, username, avatar_url")
            .in("id", userIds)
        : { data: [], error: null };

      if (profilesError) throw profilesError;

      const profilesById = new Map(
        ((profileRows ?? []) as Profile[]).map((profile) => [
          profile.id,
          profile,
        ]),
      );

      setComments((current) => ({
        ...current,
        [postId]: typedComments.map((comment) => ({
          ...comment,
          author: profilesById.get(comment.user_id) ?? null,
        })),
      }));
    } catch (error) {
      console.error("Could not load comments:", error);
      setErrorMessage("Komentarite ne mozhea da se vchitaat.");
    } finally {
      setCommentsLoadingFor("");
    }
  }

  async function submitComment(
    event: FormEvent<HTMLFormElement>,
    post: PostItem,
  ) {
    event.preventDefault();

    const content = (commentDrafts[post.id] ?? "").trim();

    if (!content || !currentUserId || commentSubmittingFor) return;

    setCommentSubmittingFor(post.id);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("community_comments")
        .insert({
          post_id: post.id,
          user_id: currentUserId,
          content,
        })
        .select("id, post_id, user_id, content, created_at")
        .single();

      if (error) throw error;

      const newComment: CommentItem = {
        ...(data as CommunityCommentRow),
        author: currentProfile,
      };

      setComments((current) => ({
        ...current,
        [post.id]: [...(current[post.id] ?? []), newComment],
      }));

      setCommentDrafts((current) => ({
        ...current,
        [post.id]: "",
      }));

      const nextCommentsTotal = post.commentsTotal + 1;

      setPosts((currentPosts) =>
        currentPosts.map((item) =>
          item.id === post.id
            ? {
                ...item,
                commentsTotal: nextCommentsTotal,
              }
            : item,
        ),
      );

      const { error: counterError } = await supabase
        .from("community_posts")
        .update({ comments_count: nextCommentsTotal })
        .eq("id", post.id);

      if (counterError) {
        console.error(
          "Could not update cached comment count:",
          counterError,
        );
      }

      if (post.user_id !== currentUserId) {
        void supabase.from("community_notifications").insert({
          user_id: post.user_id,
          actor_id: currentUserId,
          type: "comment",
          post_id: post.id,
          is_read: false,
        });
      }
    } catch (error) {
      console.error("Could not submit comment:", error);
      setErrorMessage("Komentarot ne beshe objaven.");
    } finally {
      setCommentSubmittingFor("");
    }
  }

  async function toggleFollow(authorId: string) {
    if (
      !currentUserId ||
      authorId === currentUserId ||
      followActionUserId
    ) {
      return;
    }

    const alreadyFollowing = followingIds.includes(authorId);

    setFollowActionUserId(authorId);
    setErrorMessage("");

    setFollowingIds((current) =>
      alreadyFollowing
        ? current.filter((id) => id !== authorId)
        : [...current, authorId],
    );

    try {
      if (alreadyFollowing) {
        const { error } = await supabase
          .from("community_followers")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", authorId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("community_followers")
          .insert({
            follower_id: currentUserId,
            following_id: authorId,
          });

        if (error) throw error;

        void supabase.from("community_notifications").insert({
          user_id: authorId,
          actor_id: currentUserId,
          type: "follow",
          post_id: null,
          is_read: false,
        });
      }
    } catch (error) {
      console.error("Could not toggle follow:", error);

      setFollowingIds((current) =>
        alreadyFollowing
          ? [...current, authorId]
          : current.filter((id) => id !== authorId),
      );

      setErrorMessage("Follow akcijata ne uspea.");
    } finally {
      setFollowActionUserId("");
    }
  }

  async function deletePost(post: PostItem) {
    if (post.user_id !== currentUserId || actionPostId) return;

    const confirmed = window.confirm(
      "Dali si siguren deka sakash da go izbrishesh postot?",
    );

    if (!confirmed) return;

    setActionPostId(post.id);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("community_posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", currentUserId);

      if (error) throw error;

      if (post.image_url) {
        const storagePath = extractStoragePath(post.image_url);

        if (storagePath) {
          const { error: storageError } = await supabase.storage
            .from("community-images")
            .remove([storagePath]);

          if (storageError) {
            console.error(
              "Post deleted, but image cleanup failed:",
              storageError,
            );
          }
        }
      }

      setPosts((currentPosts) =>
        currentPosts.filter((item) => item.id !== post.id),
      );
    } catch (error) {
      console.error("Could not delete post:", error);
      setErrorMessage("Postot ne mozheshe da se izbrishe.");
    } finally {
      setActionPostId("");
    }
  }

  if (pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

          <p className="mt-5 text-sm text-zinc-500">
            Loading Zentro-Community...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-[-320px] h-[650px] w-[650px] rounded-full bg-purple-700/20 blur-[170px]" />
        <div className="absolute -right-72 top-[35%] h-[600px] w-[600px] rounded-full bg-fuchsia-900/10 blur-[170px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07070b]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/dashboard"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-500/25 bg-purple-500/10 font-black text-purple-300"
            >
              Z
            </Link>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-black sm:text-xl">
                Zentro-Community
              </h1>

              <p className="truncate text-xs text-zinc-600">
                Train together. Grow together.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-4 py-3 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.2)] transition hover:scale-[1.02] sm:px-5"
          >
            + Create post
          </button>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0">
          {errorMessage && (
            <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-4 text-sm text-red-200">
              <p>{errorMessage}</p>

              <button
                type="button"
                onClick={() => setErrorMessage("")}
                className="shrink-0 text-lg text-red-300"
              >
                ×
              </button>
            </div>
          )}

          <div className="mb-5 grid grid-cols-2 rounded-2xl border border-white/[0.07] bg-[#0b0b10]/90 p-1.5">
            <button
              type="button"
              onClick={() => setFeedMode("all")}
              className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                feedMode === "all"
                  ? "bg-purple-500/15 text-purple-200"
                  : "text-zinc-600 hover:text-white"
              }`}
            >
              All
            </button>

            <button
              type="button"
              onClick={() => setFeedMode("following")}
              className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                feedMode === "following"
                  ? "bg-purple-500/15 text-purple-200"
                  : "text-zinc-600 hover:text-white"
              }`}
            >
              Following
            </button>
          </div>

          {feedLoading ? (
            <div className="rounded-[30px] border border-white/[0.07] bg-[#0b0b10]/90 p-10 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

              <p className="mt-4 text-sm text-zinc-600">
                Loading posts...
              </p>
            </div>
          ) : visiblePosts.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-white/[0.1] bg-[#0b0b10]/80 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-purple-500/10 text-2xl text-purple-300">
                ◉
              </div>

              <h2 className="mt-5 text-xl font-black">
                {feedMode === "following"
                  ? "Your following feed is empty"
                  : "Be the first to post"}
              </h2>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-600">
                {feedMode === "following"
                  ? "Follow athletes from the All feed and their posts will appear here."
                  : "Share a workout, progress photo, milestone or motivation with the Zentro community."}
              </p>

              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="mt-6 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-bold"
              >
                Create post
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {visiblePosts.map((post) => {
                const isOwnPost = post.user_id === currentUserId;
                const isFollowing = followingIds.includes(post.user_id);
                const postComments = comments[post.id] ?? [];
                const commentsAreOpen = commentsOpenFor === post.id;

                return (
                  <article
                    key={post.id}
                    className="overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#0b0b10]/95 shadow-2xl"
                  >
                    <div className="flex items-center gap-3 p-5">
                      {post.author?.avatar_url ? (
                        <img
                          src={post.author.avatar_url}
                          alt={getDisplayName(post.author)}
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-violet-500 font-black">
                          {getInitial(post.author)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">
                          {getDisplayName(post.author)}
                        </p>

                        <p className="truncate text-xs text-zinc-600">
                          @{getUsername(post.author)} ·{" "}
                          {formatRelativeTime(post.created_at)}
                        </p>
                      </div>

                      {!isOwnPost ? (
                        <button
                          type="button"
                          disabled={followActionUserId === post.user_id}
                          onClick={() => void toggleFollow(post.user_id)}
                          className={`rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                            isFollowing
                              ? "border border-white/[0.08] bg-white/[0.03] text-zinc-400"
                              : "bg-purple-500/15 text-purple-300"
                          }`}
                        >
                          {isFollowing ? "Following" : "Follow"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionPostId === post.id}
                          onClick={() => void deletePost(post)}
                          className="rounded-xl px-3 py-2 text-xs font-bold text-zinc-700 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    {post.image_url && (
                      <div className="border-y border-white/[0.05] bg-black">
                        <img
                          src={post.image_url}
                          alt="Community post"
                          className="max-h-[720px] w-full object-contain"
                        />
                      </div>
                    )}

                    <div className="p-5">
                      {post.content && (
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-zinc-200">
                          <span className="mr-2 font-bold text-white">
                            @{getUsername(post.author)}
                          </span>
                          {post.content}
                        </p>
                      )}

                      <div className="mt-5 flex items-center gap-2 border-t border-white/[0.05] pt-4">
                        <button
                          type="button"
                          disabled={actionPostId === post.id}
                          onClick={() => void toggleLike(post)}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition disabled:opacity-50 ${
                            post.likedByCurrentUser
                              ? "bg-pink-500/10 text-pink-300"
                              : "text-zinc-500 hover:bg-white/[0.04] hover:text-white"
                          }`}
                        >
                          <span className="text-lg">
                            {post.likedByCurrentUser ? "♥" : "♡"}
                          </span>
                          {post.likesTotal}
                        </button>

                        <button
                          type="button"
                          onClick={() => void loadComments(post.id)}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-zinc-500 transition hover:bg-white/[0.04] hover:text-white"
                        >
                          <span className="text-lg">◌</span>
                          {post.commentsTotal}
                        </button>
                      </div>

                      {commentsAreOpen && (
                        <div className="mt-4 border-t border-white/[0.05] pt-4">
                          {commentsLoadingFor === post.id ? (
                            <p className="py-4 text-center text-sm text-zinc-600">
                              Loading comments...
                            </p>
                          ) : postComments.length === 0 ? (
                            <p className="py-3 text-sm text-zinc-700">
                              No comments yet. Start the conversation.
                            </p>
                          ) : (
                            <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
                              {postComments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="flex items-start gap-3"
                                >
                                  {comment.author?.avatar_url ? (
                                    <img
                                      src={comment.author.avatar_url}
                                      alt={getDisplayName(comment.author)}
                                      className="h-9 w-9 rounded-xl object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-xs font-black text-purple-300">
                                      {getInitial(comment.author)}
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.035] px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span className="text-xs font-bold text-purple-300">
                                        @{getUsername(comment.author)}
                                      </span>

                                      <span className="text-[10px] text-zinc-700">
                                        {formatRelativeTime(
                                          comment.created_at,
                                        )}
                                      </span>
                                    </div>

                                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
                                      {comment.content}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <form
                            onSubmit={(event) =>
                              void submitComment(event, post)
                            }
                            className="mt-4 flex items-center gap-2"
                          >
                            <input
                              type="text"
                              value={commentDrafts[post.id] ?? ""}
                              onChange={(event) =>
                                setCommentDrafts((current) => ({
                                  ...current,
                                  [post.id]: event.target.value,
                                }))
                              }
                              maxLength={500}
                              placeholder="Add a comment..."
                              className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-zinc-700 focus:border-purple-500/40"
                            />

                            <button
                              type="submit"
                              disabled={
                                !commentDrafts[post.id]?.trim() ||
                                commentSubmittingFor === post.id
                              }
                              className="rounded-2xl bg-purple-600 px-4 py-3 text-sm font-bold disabled:opacity-40"
                            >
                              {commentSubmittingFor === post.id
                                ? "..."
                                : "Post"}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-5">
            <section className="rounded-[28px] border border-white/[0.07] bg-[#0b0b10]/90 p-5">
              <div className="flex items-center gap-3">
                {currentProfile?.avatar_url ? (
                  <img
                    src={currentProfile.avatar_url}
                    alt={getDisplayName(currentProfile)}
                    className="h-12 w-12 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-violet-500 font-black">
                    {getInitial(currentProfile)}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {getDisplayName(currentProfile)}
                  </p>

                  <p className="truncate text-xs text-zinc-600">
                    @{getUsername(currentProfile)}
                  </p>
                </div>
              </div>

              <Link
                href="/profile"
                className="mt-4 block rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-center text-sm font-bold text-zinc-400 transition hover:border-purple-500/30 hover:text-white"
              >
                Edit profile
              </Link>
            </section>

            <section className="rounded-[28px] border border-purple-500/15 bg-gradient-to-br from-purple-600/10 to-[#0b0b10] p-5">
              <p className="text-xs font-bold tracking-[0.16em] text-purple-400">
                COMMUNITY GUIDELINES
              </p>

              <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-500">
                <p>Be supportive and respectful.</p>
                <p>Share real fitness progress.</p>
                <p>No spam or harmful advice.</p>
              </div>
            </section>

            <Link
              href="/dashboard"
              className="block rounded-2xl border border-white/[0.07] px-4 py-3 text-center text-sm font-bold text-zinc-500 transition hover:text-white"
            >
              ← Back to dashboard
            </Link>
          </div>
        </aside>
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <button
            type="button"
            aria-label="Close create post modal"
            onClick={closeCreateModal}
            className="absolute inset-0"
          />

          <section className="relative z-10 w-full max-w-xl rounded-t-[30px] border border-white/[0.08] bg-[#0b0b10] p-5 shadow-2xl sm:rounded-[30px] sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-purple-400">
                  NEW POST
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Share with Zentro
                </h2>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creatingPost}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] text-xl text-zinc-500 disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <form onSubmit={createPost} className="mt-6">
              <textarea
                value={postContent}
                onChange={(event) => setPostContent(event.target.value)}
                maxLength={1500}
                rows={5}
                placeholder="Share your workout, progress or motivation..."
                className="w-full resize-none rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-4 text-sm leading-7 outline-none placeholder:text-zinc-700 focus:border-purple-500/40"
              />

              <div className="mt-2 text-right text-[11px] text-zinc-700">
                {postContent.length}/1500
              </div>

              {imagePreviewUrl && (
                <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
                  <img
                    src={imagePreviewUrl}
                    alt="Selected post preview"
                    className="max-h-80 w-full object-contain"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(imagePreviewUrl);
                      setSelectedImage(null);
                      setImagePreviewUrl("");

                      if (imageInputRef.current) {
                        imageInputRef.current.value = "";
                      }
                    }}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-black/75 text-xl"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-sm font-bold text-zinc-400 transition hover:border-purple-500/30 hover:text-white"
                  >
                    ◉ Add image
                  </button>

                  <p className="mt-2 text-[10px] text-zinc-700">
                    JPG, PNG or WEBP · max 500 KB
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={
                    creatingPost ||
                    (!postContent.trim() && !selectedImage)
                  }
                  className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-3.5 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.2)] disabled:opacity-40"
                >
                  {creatingPost ? "Publishing..." : "Publish post"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
