import { SnakeGame } from "@/components/snake-game"

export default function Page() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-4 py-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          Arcade Classic
        </span>
        <h1 className="text-balance font-mono text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          NEON <span className="text-primary">SNAKE</span>
        </h1>
        <p className="max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
          Grow longer, score higher, and survive the rising speed.
        </p>
      </header>

      <SnakeGame />
    </main>
  )
}
