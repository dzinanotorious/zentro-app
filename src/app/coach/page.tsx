"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isProUser } from "@/lib/subscription";

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};


type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type CoachPreferences = {
  coaching_style: "supportive" | "balanced" | "direct" | "intense";
  response_length: "short" | "detailed";
  language: string;
  include_workout_data: boolean;
  include_nutrition_data: boolean;
  include_progress_data: boolean;
};

const defaultPreferences: CoachPreferences = {
  coaching_style: "balanced",
  response_length: "detailed",
  language: "mk",
  include_workout_data: true,
  include_nutrition_data: true,
  include_progress_data: true,
};

const quickPrompts = [
  {
    title: "Analyze my workouts",
    description: "Review my recent training, volume and intensity.",
    prompt:
      "Анализирај ги моите последни тренинзи. Кажи ми што е добро, што треба да подобрам и како да го структурирам следниот тренинг.",
    icon: "W",
  },
  {
    title: "Check my nutrition",
    description: "Review calories, protein and macro consistency.",
    prompt:
      "Анализирај ја мојата исхрана во последните денови. Провери калории, протеини, јаглехидрати и масти и дај ми конкретни препораки.",
    icon: "N",
  },
  {
    title: "Review my progress",
    description: "Interpret weight and measurement trends.",
    prompt:
      "Анализирај го мојот физички прогрес, тежината и мерењата. Објасни дали трендот е добар и што треба да правам следно.",
    icon: "P",
  },
  {
    title: "Recovery check",
    description: "Evaluate fatigue, RPE and training balance.",
    prompt:
      "Направи recovery анализа според моите тренинзи, RPE и активност. Кажи ми дали треба да тренирам силно, полесно или да одморам.",
    icon: "R",
  },
  {
    title: "Build my next week",
    description: "Create a practical seven-day action plan.",
    prompt:
      "Направи ми конкретен план за следните 7 дена со тренинзи, исхрана, recovery и најважни приоритети.",
    icon: "7D",
  },
  {
    title: "Daily coaching",
    description: "Get the most important advice for today.",
    prompt:
      "Според моите податоци, која е најважната работа што треба да ја направам денес за подобар фитнес прогрес?",
    icon: "AI",
  },
];

function formatConversationDate(value: string) {
  const date = new Date(value);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export default function CoachPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [userId, setUserId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [preferences, setPreferences] =
    useState<CoachPreferences>(defaultPreferences);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasPro, setHasPro] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(true);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );

  const loadConversations = useCallback(
    async (selectFirstConversation = false) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const [{ data: conversationData, error }, { data: preferenceData }] =
        await Promise.all([
          supabase
            .from("coach_conversations")
            .select("id, title, created_at, updated_at")
            .eq("user_id", user.id)
            .order("updated_at", {
              ascending: false,
            }),

          supabase
            .from("coach_preferences")
            .select(`
              coaching_style,
              response_length,
              language,
              include_workout_data,
              include_nutrition_data,
              include_progress_data
            `)
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

      if (error) {
        setMessageType("error");
        setMessage(error.message);
        setLoading(false);
        return;
      }

      const loadedConversations =
        (conversationData ?? []) as Conversation[];

      setConversations(loadedConversations);

      if (preferenceData) {
        setPreferences({
          coaching_style:
            preferenceData.coaching_style ?? "balanced",
          response_length:
            preferenceData.response_length ?? "detailed",
          language: preferenceData.language ?? "mk",
          include_workout_data:
            preferenceData.include_workout_data ?? true,
          include_nutrition_data:
            preferenceData.include_nutrition_data ?? true,
          include_progress_data:
            preferenceData.include_progress_data ?? true,
        });
      }

      if (
        selectFirstConversation &&
        loadedConversations.length > 0
      ) {
        setActiveConversationId(loadedConversations[0].id);
      }

      setLoading(false);
    },
    [router],
  );

  useEffect(() => {
    async function checkSubscription() {
      const pro = await isProUser();

      setHasPro(pro);
      setCheckingPlan(false);
    }

    void checkSubscription();
  }, []);

  useEffect(() => {
    if (checkingPlan || !hasPro) return;

    void loadConversations(true);
  }, [checkingPlan, hasPro, loadConversations]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      setLoadingMessages(true);
      setMessage("");

      const { data, error } = await supabase
        .from("coach_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        setMessageType("error");
        setMessage(error.message);
        setLoadingMessages(false);
        return;
      }

      setMessages((data ?? []) as Message[]);
      setLoadingMessages(false);
    },
    [userId],
  );

  useEffect(() => {
    if (!activeConversationId || !userId) {
      setMessages([]);
      return;
    }

    void loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, sending]);

  function createNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setMessage("");
    setSidebarOpen(false);
  }

  async function sendMessage(
    event?: FormEvent<HTMLFormElement>,
    customPrompt?: string,
  ) {
    event?.preventDefault();

    const content = (customPrompt ?? input).trim();

    if (!content || sending) return;

    setSending(true);
    setMessage("");
    setInput("");

    const temporaryUserMessage: Message = {
      id: `temporary-user-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [
      ...current,
      temporaryUserMessage,
    ]);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      setMessageType("error");
      setMessage("Твојата сесија е истечена. Најави се повторно.");
      setSending(false);
      return;
    }

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: content,
          conversationId: activeConversationId,
        }),
      });

      const result = (await response.json()) as {
        answer?: string;
        conversationId?: string;
        error?: string;
      };

      if (!response.ok || !result.answer) {
        throw new Error(
          result.error ||
            "AI Coach не можеше да подготви одговор.",
        );
      }

      const returnedConversationId =
        result.conversationId ?? activeConversationId;

      if (returnedConversationId) {
        setActiveConversationId(returnedConversationId);
      }

      const assistantMessage: Message = {
        id: `temporary-assistant-${Date.now()}`,
        role: "assistant",
        content: result.answer,
        created_at: new Date().toISOString(),
      };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);

      await loadConversations(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Се појави непозната грешка.";

      setMessageType("error");
      setMessage(errorMessage);

      setMessages((current) =>
        current.filter(
          (item) => item.id !== temporaryUserMessage.id,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  async function deleteConversation(
    conversationId: string,
  ) {
    const confirmed = window.confirm(
      "Дали сакаш да го избришеш овој разговор?",
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("coach_conversations")
      .delete()
      .eq("id", conversationId)
      .eq("user_id", userId);

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      return;
    }

    if (activeConversationId === conversationId) {
      createNewChat();
    }

    await loadConversations(false);
  }

  async function savePreferences() {
    if (!userId) return;

    setSavingPreferences(true);
    setMessage("");

    const { error } = await supabase
      .from("coach_preferences")
      .upsert(
        {
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setSavingPreferences(false);
      return;
    }

    setMessageType("success");
    setMessage("AI Coach preferences successfully saved.");
    setShowSettings(false);
    setSavingPreferences(false);
  }

  function updatePreference<
    Key extends keyof CoachPreferences,
  >(key: Key, value: CoachPreferences[Key]) {
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  }

  if (checkingPlan || (hasPro && loading)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

          <p className="mt-5 text-sm text-zinc-400">
            Preparing your AI Coach...
          </p>
        </div>
      </main>
    );
  }

  if (checkingPlan) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

          <p className="mt-5 text-sm text-zinc-400">
            Checking your Zentro plan...
          </p>
        </div>
      </main>
    );
  }

  if (!hasPro) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050507] px-5 py-10 text-white">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute left-[10%] top-[-320px] h-[720px] w-[720px] rounded-full bg-purple-700/20 blur-[180px]" />
          <div className="absolute -right-72 bottom-[-280px] h-[650px] w-[650px] rounded-full bg-fuchsia-900/10 blur-[170px]" />
        </div>

        <section className="relative w-full max-w-2xl overflow-hidden rounded-[38px] border border-purple-500/20 bg-gradient-to-br from-purple-600/15 via-purple-950/10 to-[#0b0b10] p-7 text-center shadow-2xl sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-purple-500/15 blur-[80px]" />

          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-purple-500/25 bg-purple-500/15 text-3xl text-purple-300 shadow-[0_0_45px_rgba(139,92,246,0.18)]">
              ✦
            </div>

            <p className="mt-7 text-xs font-bold tracking-[0.22em] text-purple-400">
              ZENTRO PRO
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Unlock AI Performance Coach
            </h1>

            <p className="mx-auto mt-5 max-w-xl leading-7 text-zinc-500">
              Get personalized workout, nutrition, recovery and progress
              analysis based on your real Zentro data.
            </p>

            <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
              {[
                "AI workout and volume analysis",
                "Personalized nutrition guidance",
                "Recovery and fatigue recommendations",
                "Weekly action plans",
                "Progress and plateau detection",
                "Priority access to new AI features",
              ].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-sm text-zinc-300"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/12 text-xs font-bold text-purple-300">
                    ✓
                  </span>

                  {feature}
                </div>
              ))}
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              <Link
                href="/dashboard"
                className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-6 py-4 font-bold text-zinc-400 transition hover:border-purple-500/25 hover:text-white"
              >
                Back to dashboard
              </Link>

              <Link
                href="/pricing"
                className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 font-bold shadow-[0_0_35px_rgba(139,92,246,0.2)] transition hover:scale-[1.02]"
              >
                Upgrade to Zentro Pro
              </Link>
            </div>

            <p className="mt-5 text-xs text-zinc-700">
              Zentro Pro starts at €9.99 per month.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[8%] top-[-400px] h-[850px] w-[850px] rounded-full bg-purple-700/20 blur-[190px]" />
        <div className="absolute -right-80 top-[35%] h-[700px] w-[700px] rounded-full bg-fuchsia-900/10 blur-[180px]" />
      </div>

      <div className="relative flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[310px] border-r border-white/[0.06] bg-[#08080c]/95 p-5 backdrop-blur-xl transition-transform lg:static lg:translate-x-0 ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="text-xl font-black tracking-tight"
            >
              ZENTRO
              <span className="text-purple-400">.</span>
            </Link>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-zinc-500 lg:hidden"
            >
              ×
            </button>
          </div>

          <button
            type="button"
            onClick={createNewChat}
            className="mt-7 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-4 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.16)]"
          >
            + New coaching chat
          </button>

          <div className="mt-7">
            <p className="px-2 text-[10px] font-bold tracking-[0.18em] text-zinc-700">
              RECENT CONVERSATIONS
            </p>

            <div className="mt-3 max-h-[calc(100vh-300px)] space-y-2 overflow-y-auto pr-1">
              {conversations.map((conversation) => {
                const active =
                  conversation.id === activeConversationId;

                return (
                  <div
                    key={conversation.id}
                    className={`group flex items-center rounded-2xl border transition ${
                      active
                        ? "border-purple-500/25 bg-purple-500/10"
                        : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.025]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveConversationId(
                          conversation.id,
                        );
                        setSidebarOpen(false);
                      }}
                      className="min-w-0 flex-1 px-4 py-4 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-zinc-300">
                        {conversation.title}
                      </p>

                      <p className="mt-1 text-[10px] text-zinc-700">
                        {formatConversationDate(
                          conversation.updated_at,
                        )}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteConversation(
                          conversation.id,
                        )
                      }
                      className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-700 opacity-0 transition hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {conversations.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/[0.07] p-5 text-center">
                  <p className="text-xs leading-5 text-zinc-700">
                    Your coaching conversations will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-5 left-5 right-5 space-y-2">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-left text-sm font-bold text-zinc-400"
            >
              Coach settings
            </button>

            <Link
              href="/dashboard"
              className="block rounded-2xl border border-white/[0.07] px-4 py-3 text-center text-sm font-bold text-zinc-500"
            >
              ← Dashboard
            </Link>
          </div>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          />
        )}

        <section className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-8">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] text-zinc-400 lg:hidden"
              >
                ☰
              </button>

              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-purple-400">
                  ZENTRO INTELLIGENCE
                </p>

                <h1 className="mt-1 text-lg font-black sm:text-xl">
                  AI Performance Coach
                </h1>
              </div>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

              <span className="text-xs font-bold text-zinc-500">
                Coach online
              </span>
            </div>
          </header>

          {message && (
            <div
              className={`mx-5 mt-5 rounded-2xl border p-4 text-sm sm:mx-8 ${
                messageType === "error"
                  ? "border-red-500/20 bg-red-500/10 text-red-200"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {message}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-7 sm:px-8">
            <div className="mx-auto max-w-5xl">
              {!activeConversationId &&
                messages.length === 0 && (
                  <section className="pb-10 pt-5 text-center sm:pt-12">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-purple-500/25 bg-purple-500/12 text-2xl font-black text-purple-300 shadow-[0_0_50px_rgba(139,92,246,0.16)]">
                      AI
                    </div>

                    <p className="mt-7 text-xs font-bold tracking-[0.22em] text-purple-400">
                      PERSONAL FITNESS INTELLIGENCE
                    </p>

                    <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
                      Ask about your real progress.
                    </h2>

                    <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-zinc-500 sm:text-base">
                      Zentro analyzes your workouts, nutrition,
                      measurements, records and consistency to give
                      practical personalized guidance.
                    </p>

                    <div className="mt-10 grid gap-4 text-left md:grid-cols-2 xl:grid-cols-3">
                      {quickPrompts.map((item) => (
                        <button
                          key={item.title}
                          type="button"
                          disabled={sending}
                          onClick={() =>
                            void sendMessage(
                              undefined,
                              item.prompt,
                            )
                          }
                          className="group rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-5 transition hover:-translate-y-1 hover:border-purple-500/25 hover:bg-purple-500/[0.05]"
                        >
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-xs font-black text-purple-300">
                            {item.icon}
                          </div>

                          <h3 className="mt-5 font-black">
                            {item.title}
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-zinc-600">
                            {item.description}
                          </p>

                          <p className="mt-4 text-xs font-bold text-purple-400">
                            Ask coach →
                          </p>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

              {loadingMessages && (
                <div className="flex min-h-[400px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

                    <p className="mt-4 text-sm text-zinc-600">
                      Loading conversation...
                    </p>
                  </div>
                </div>
              )}

              {!loadingMessages &&
                messages.length > 0 && (
                  <div className="space-y-6 pb-5">
                    {messages.map((chatMessage) => (
                      <article
                        key={chatMessage.id}
                        className={`flex gap-4 ${
                          chatMessage.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        {chatMessage.role === "assistant" && (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-500/12 text-xs font-black text-purple-300">
                            AI
                          </div>
                        )}

                        <div
                          className={`max-w-[88%] rounded-[26px] px-5 py-4 sm:max-w-[78%] sm:px-6 ${
                            chatMessage.role === "user"
                              ? "rounded-br-md bg-gradient-to-r from-purple-600 to-violet-500 text-white"
                              : "rounded-bl-md border border-white/[0.07] bg-[#0b0b10]/90 text-zinc-300"
                          }`}
                        >
                          <div className="whitespace-pre-wrap text-sm leading-7">
                            {chatMessage.content}
                          </div>
                        </div>
                      </article>
                    ))}

                    {sending && (
                      <article className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-500/12 text-xs font-black text-purple-300">
                          AI
                        </div>

                        <div className="rounded-[26px] rounded-bl-md border border-white/[0.07] bg-[#0b0b10]/90 px-6 py-5">
                          <div className="flex gap-1.5">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.3s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.15s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400" />
                          </div>
                        </div>
                      </article>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
            </div>
          </div>

          <div className="border-t border-white/[0.06] bg-[#07070a]/90 px-5 py-5 backdrop-blur-xl sm:px-8">
            <form
              onSubmit={(event) => void sendMessage(event)}
              className="mx-auto max-w-5xl"
            >
              <div className="flex items-end gap-3 rounded-[26px] border border-white/[0.09] bg-white/[0.035] p-3 focus-within:border-purple-500/35">
                <textarea
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={1}
                  maxLength={4000}
                  placeholder="Ask about your workouts, nutrition, progress or recovery..."
                  className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 outline-none placeholder:text-zinc-700"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="flex h-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {sending ? "..." : "Send"}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 px-2">
                <p className="text-[10px] leading-5 text-zinc-700">
                  Zentro AI provides general fitness guidance and does
                  not replace qualified medical care.
                </p>

                <p className="shrink-0 text-[10px] text-zinc-700">
                  {input.length}/4000
                </p>
              </div>
            </form>
          </div>
        </section>
      </div>

      {showSettings && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/85 px-5 py-10 backdrop-blur-md"
          onClick={() => setShowSettings(false)}
        >
          <section
            className="mx-auto w-full max-w-2xl rounded-[34px] border border-white/10 bg-[#0b0b10] p-7 shadow-2xl sm:p-9"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-purple-400">
                  COACH SETTINGS
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Personalize your AI Coach
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-xl text-zinc-500"
              >
                ×
              </button>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Coaching style
                </label>

                <select
                  value={preferences.coaching_style}
                  onChange={(event) =>
                    updatePreference(
                      "coaching_style",
                      event.target
                        .value as CoachPreferences["coaching_style"],
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-purple-500/50"
                >
                  <option value="supportive">Supportive</option>
                  <option value="balanced">Balanced</option>
                  <option value="direct">Direct</option>
                  <option value="intense">Intense</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Response length
                </label>

                <select
                  value={preferences.response_length}
                  onChange={(event) =>
                    updatePreference(
                      "response_length",
                      event.target
                        .value as CoachPreferences["response_length"],
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-purple-500/50"
                >
                  <option value="short">Short</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
            </div>

            <div className="mt-7 space-y-4">
              <SettingsToggle
                title="Workout information"
                description="Allow the coach to analyze workouts, sets, RPE and personal records."
                checked={preferences.include_workout_data}
                onChange={(value) =>
                  updatePreference(
                    "include_workout_data",
                    value,
                  )
                }
              />

              <SettingsToggle
                title="Nutrition information"
                description="Allow analysis of calories, macros and nutrition consistency."
                checked={preferences.include_nutrition_data}
                onChange={(value) =>
                  updatePreference(
                    "include_nutrition_data",
                    value,
                  )
                }
              />

              <SettingsToggle
                title="Progress information"
                description="Allow analysis of body weight and measurement trends."
                checked={preferences.include_progress_data}
                onChange={(value) =>
                  updatePreference(
                    "include_progress_data",
                    value,
                  )
                }
              />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-2xl border border-white/[0.08] px-6 py-4 font-bold text-zinc-400"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingPreferences}
                onClick={() => void savePreferences()}
                className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 font-bold disabled:opacity-50"
              >
                {savingPreferences
                  ? "Saving..."
                  : "Save settings"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function SettingsToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div>
        <p className="font-bold">{title}</p>

        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-purple-600" : "bg-zinc-800"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
