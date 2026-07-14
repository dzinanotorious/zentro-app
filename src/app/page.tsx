import Link from "next/link";

const features = [
  {
    icon: "✦",
    title: "AI Fitness Coach",
    text: "Добиј персонализирана поддршка, совети и насоки во секое време.",
  },
  {
    icon: "◈",
    title: "Smart Workouts",
    text: "Програми создадени според твојата цел, искуство и достапна опрема.",
  },
  {
    icon: "◎",
    title: "Nutrition Plans",
    text: "Структурирани планови за исхрана според калории и макронутриенти.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-250px] h-[650px] w-[650px] -translate-x-1/2 rounded-full bg-purple-700/25 blur-[140px]" />
        <div className="absolute -left-40 top-[500px] h-[500px] w-[500px] rounded-full bg-violet-900/20 blur-[150px]" />
        <div className="absolute -right-52 top-[700px] h-[500px] w-[500px] rounded-full bg-fuchsia-900/15 blur-[150px]" />
      </div>

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.25)]">
            <span className="text-xl font-black text-purple-400">Z</span>
          </div>

          <span className="text-xl font-black tracking-[0.25em]">
            ZENTRO
          </span>
        </div>

        <div className="hidden items-center gap-9 text-sm text-zinc-400 md:flex">
          <a className="transition hover:text-white" href="#features">
            Features
          </a>
          <a className="transition hover:text-white" href="#programs">
            Programs
          </a>
          <a className="transition hover:text-white" href="#nutrition">
            Nutrition
          </a>
          <a className="transition hover:text-white" href="/pricing">
            Pricing
          </a>
        </div>

        <Link
          href="/login"
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold backdrop-blur transition hover:border-purple-400/50 hover:bg-purple-500/10"
        >
          Sign in
        </Link>
      </nav>

      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 pb-24 pt-20 text-center lg:px-10 lg:pt-28">
        <div className="mb-7 flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-500/10 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.12)]">
          <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,1)]" />
          AI-POWERED FITNESS PLATFORM
        </div>

        <h1 className="max-w-5xl text-5xl font-black leading-[1.05] tracking-[-0.05em] sm:text-6xl lg:text-8xl">
          BUILD YOUR BEST
          <span className="block bg-gradient-to-r from-purple-300 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent">
            VERSION
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg">
          Personalized workout plans, smart nutrition and an AI coach that
          supports your progress 24/7.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/register"
            className="group rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-8 py-4 font-bold shadow-[0_0_40px_rgba(139,92,246,0.35)] transition hover:scale-[1.03] hover:shadow-[0_0_55px_rgba(139,92,246,0.5)]"
          >
            Start Your Journey
            <span className="ml-3 inline-block transition group-hover:translate-x-1">
              →
            </span>
          </Link>

          <Link
            href="/programs"
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-4 font-bold text-zinc-200 backdrop-blur transition hover:border-purple-400/40 hover:bg-white/[0.06]"
          >
            Explore Programs
          </Link>
        </div>

        <div className="relative mt-20 w-full max-w-5xl">
          <div className="absolute -inset-1 rounded-[32px] bg-gradient-to-r from-purple-600/40 via-violet-500/20 to-fuchsia-600/40 blur-xl" />

          <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0b10]/90 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/5 px-3 pb-4">
              <div className="flex gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400/70" />
                <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
                <span className="h-3 w-3 rounded-full bg-green-400/70" />
              </div>

              <div className="rounded-full border border-white/5 bg-white/[0.03] px-5 py-2 text-xs text-zinc-500">
                app.zentro.ai/dashboard
              </div>

              <div className="w-12" />
            </div>

            <div className="grid gap-4 p-2 pt-6 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-purple-950/60 to-black p-7 text-left">
                <p className="text-sm text-purple-300">
                  Welcome back, Leon
                </p>

                <h2 className="mt-3 text-3xl font-bold">
                  Today&apos;s Progress
                </h2>

                <div className="mt-8 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
                    <p className="text-xs text-zinc-500">Calories</p>
                    <p className="mt-2 text-xl font-bold">1,840</p>
                    <p className="mt-1 text-xs text-purple-400">of 2,400</p>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
                    <p className="text-xs text-zinc-500">Workout</p>
                    <p className="mt-2 text-xl font-bold">48 min</p>
                    <p className="mt-1 text-xs text-green-400">Completed</p>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
                    <p className="text-xs text-zinc-500">Protein</p>
                    <p className="mt-2 text-xl font-bold">132 g</p>
                    <p className="mt-1 text-xs text-purple-400">of 170 g</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-purple-500/15 bg-purple-500/[0.06] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-400">
                        Next workout
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        Upper Body Strength
                      </p>
                    </div>

                    <Link
                      href="/programs"
                      className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold"
                    >
                      Start
                    </Link>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/15 text-xl">
                      ✦
                    </div>
                    <div>
                      <p className="font-bold">Zentro AI Coach</p>
                      <p className="text-xs text-green-400">Online now</p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-purple-500/10 p-4 text-sm leading-6 text-zinc-300">
                    Based on your progress, today we&apos;ll slightly increase
                    your training intensity.
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-xl border border-white/5 bg-black/40 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-purple-500/40"
                      placeholder="Ask your AI coach..."
                    />

                    <button className="rounded-xl bg-purple-600 px-4">
                      →
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-violet-900/30 to-black p-6 text-left">
                  <p className="text-sm text-zinc-400">Weekly consistency</p>
                  <p className="mt-2 text-3xl font-black">86%</p>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500" />
                  </div>

                  <p className="mt-3 text-xs text-purple-300">
                    You are ahead of last week.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="relative z-10 mx-auto max-w-7xl px-6 py-24 lg:px-10"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold tracking-[0.2em] text-purple-400">
            EVERYTHING YOU NEED
          </p>

          <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            One platform. Total transformation.
          </h2>

          <p className="mt-5 leading-7 text-zinc-400">
            ZENTRO combines training, nutrition and intelligent support into
            one premium experience.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="group rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8 backdrop-blur transition duration-300 hover:-translate-y-2 hover:border-purple-500/30 hover:bg-purple-500/[0.05]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/10 text-2xl text-purple-300 shadow-[0_0_25px_rgba(168,85,247,0.12)]">
                {feature.icon}
              </div>

              <h3 className="mt-7 text-xl font-bold">{feature.title}</h3>

              <p className="mt-4 leading-7 text-zinc-400">{feature.text}</p>

              <Link
                href={
                  feature.title === "AI Fitness Coach"
                    ? "/coach"
                    : feature.title === "Smart Workouts"
                      ? "/programs"
                      : "/nutrition"
                }
                className="mt-7 inline-block text-sm font-bold text-purple-400 transition group-hover:text-purple-300"
              >
                Learn more →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-sm text-zinc-500 sm:flex-row">
          <p>© 2026 ZENTRO. All rights reserved.</p>
          <p>Train. Fuel. Evolve.</p>
        </div>
      </footer>
    </main>
  );
}
