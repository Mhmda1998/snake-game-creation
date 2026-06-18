"use client"

import { Button } from "@/components/ui/button"
import { type Difficulty, DIFFICULTY } from "@/lib/snake-engine"
import type { GameStats } from "@/components/snake-game"
import { Apple, Clock, Flame, Gauge, Play, RotateCcw, Skull, Sparkles } from "lucide-react"

type Props = {
  status: "idle" | "playing" | "paused" | "over"
  score: number
  highScore: number
  isNewBest: boolean
  difficulty: Difficulty
  stats: GameStats
  onChangeDifficulty: (d: Difficulty) => void
  onStart: () => void
  onResume: () => void
}

const ORDER: Difficulty[] = ["easy", "normal", "hard"]

function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function GameOverlay({
  status,
  score,
  highScore,
  isNewBest,
  difficulty,
  stats,
  onChangeDifficulty,
  onStart,
  onResume,
}: Props) {
  if (status === "playing") return null

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-2xl">
        {status === "idle" && (
          <>
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="size-6" aria-hidden="true" />
            </div>
            <h2 className="text-balance font-mono text-2xl font-bold tracking-tight text-card-foreground">
              Ready to slither?
            </h2>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
              Use the arrow keys or WASD to steer. Eat fruit to grow and climb
              the levels — but don&apos;t hit the walls or yourself.
            </p>
          </>
        )}

        {status === "paused" && (
          <>
            <h2 className="font-mono text-2xl font-bold tracking-tight text-card-foreground">
              Paused
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Take a breath. Press resume or hit space to jump back in.
            </p>
          </>
        )}

        {status === "over" && (
          <>
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <Skull className="size-6" aria-hidden="true" />
            </div>
            <h2 className="font-mono text-2xl font-bold tracking-tight text-card-foreground">
              Game Over
            </h2>
            <div className="mt-4 flex items-center justify-center gap-6">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Score
                </span>
                <span className="font-mono text-3xl font-bold text-primary tabular-nums">
                  {score}
                </span>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Best
                </span>
                <span className="font-mono text-3xl font-bold text-card-foreground tabular-nums">
                  {highScore}
                </span>
              </div>
            </div>
            {isNewBest && score > 0 && (
              <p className="mt-3 font-mono text-xs font-semibold uppercase tracking-widest text-accent">
                New personal best!
              </p>
            )}

            {/* Detailed run stats */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <RunStat
                icon={<Apple className="size-4" aria-hidden="true" />}
                label="Fruit"
                value={stats.apples}
              />
              <RunStat
                icon={<Gauge className="size-4" aria-hidden="true" />}
                label="Level"
                value={stats.level}
              />
              <RunStat
                icon={<Clock className="size-4" aria-hidden="true" />}
                label="Time"
                value={formatDuration(stats.durationMs)}
              />
            </div>
            {stats.maxCombo > 1 && (
              <p className="mt-3 flex items-center justify-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-accent">
                <Flame className="size-3.5" aria-hidden="true" />
                Best combo ×{stats.maxCombo}
              </p>
            )}
          </>
        )}

        {/* Difficulty picker (hidden while paused) */}
        {status !== "paused" && (
          <div className="mt-6">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Difficulty
            </p>
            <div className="flex gap-2" role="group" aria-label="Select difficulty">
              {ORDER.map((d) => {
                const active = d === difficulty
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onChangeDifficulty(d)}
                    aria-pressed={active}
                    className={`flex-1 rounded-md border px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-muted-foreground hover:text-card-foreground"
                    }`}
                  >
                    {DIFFICULTY[d].label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-6">
          {status === "paused" ? (
            <Button onClick={onResume} size="lg" className="w-full font-mono">
              <Play className="size-4" aria-hidden="true" />
              Resume
            </Button>
          ) : (
            <Button onClick={onStart} size="lg" className="w-full font-mono">
              {status === "over" ? (
                <>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Play Again
                </>
              ) : (
                <>
                  <Play className="size-4" aria-hidden="true" />
                  Start Game
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function RunStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-secondary/40 px-2 py-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-mono text-lg font-bold leading-none text-card-foreground tabular-nums">
        {value}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  )
}
