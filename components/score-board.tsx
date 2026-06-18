import { Trophy, Gauge, Apple, Flame } from "lucide-react"

type StatProps = {
  icon: React.ReactNode
  label: string
  value: string | number
  accent?: boolean
}

function Stat({ icon, label, value, accent }: StatProps) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
          accent
            ? "bg-primary/15 text-primary"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-xl font-semibold leading-tight text-card-foreground tabular-nums">
          {value}
        </span>
      </div>
    </div>
  )
}

export function ScoreBoard({
  score,
  highScore,
  level,
  combo,
}: {
  score: number
  highScore: number
  level: number
  combo: number
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Stat
          icon={<Apple className="size-5" aria-hidden="true" />}
          label="Score"
          value={score}
          accent
        />
        <Stat
          icon={<Trophy className="size-5" aria-hidden="true" />}
          label="Best"
          value={highScore}
        />
        <Stat
          icon={<Gauge className="size-5" aria-hidden="true" />}
          label="Level"
          value={level}
        />
      </div>

      {/* Combo meter — appears once a streak is active */}
      <div
        className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2 transition-all duration-200 ${
          combo > 1
            ? "border-accent/50 bg-accent/10 text-accent opacity-100"
            : "border-border/50 bg-card/40 text-muted-foreground opacity-60"
        }`}
        aria-live="polite"
      >
        <Flame
          className={`size-4 ${combo > 1 ? "text-accent" : ""}`}
          aria-hidden="true"
        />
        <span className="font-mono text-xs font-semibold uppercase tracking-widest">
          {combo > 1 ? `Combo ×${combo}` : "Chain fruit for combos"}
        </span>
      </div>
    </div>
  )
}
