import { Trophy, Gauge, Apple } from "lucide-react"

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
}: {
  score: number
  highScore: number
  level: number
}) {
  return (
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
  )
}
