"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  type Difficulty,
  type Direction,
  type Point,
  type Status,
  GRID_COLS,
  GRID_ROWS,
  OPPOSITE,
  createSnake,
  hitsWall,
  intervalForLevel,
  isOnSnake,
  levelForFoods,
  nextHead,
  pointsEqual,
  spawnFood,
} from "@/lib/snake-engine"
import { ScoreBoard } from "@/components/score-board"
import { GameOverlay } from "@/components/game-overlay"
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Pause } from "lucide-react"

declare global {
  interface HTMLCanvasElement {
    __dpr?: number
  }
}

// Resolve a CSS custom property to an actual color string for canvas use.
function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)
  return v ? v.trim() : fallback
}

// Smooth ease for the segment interpolation.
function easeOutQuad(t: number) {
  return t * (2 - t)
}

const HIGH_SCORE_KEY = "neon-snake:high-score"

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // --- React state for the HUD only ---
  const [status, setStatus] = useState<Status>("idle")
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [highScore, setHighScore] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>("normal")

  // --- Mutable game state held in refs so the loop is stable ---
  const snakeRef = useRef<Point[]>(createSnake())
  const prevSnakeRef = useRef<Point[]>(createSnake())
  const foodRef = useRef<Point>({ x: 0, y: 0 })
  const prevFoodRef = useRef<Point>({ x: 0, y: 0 })
  const dirRef = useRef<Direction>("right")
  const queuedDirRef = useRef<Direction[]>([])
  const foodsEatenRef = useRef(0)
  const statusRef = useRef<Status>("idle")
  const difficultyRef = useRef<Difficulty>("normal")
  const levelRef = useRef(1)
  const accRef = useRef(0)
  const lastTimeRef = useRef(0)
  const stepIntervalRef = useRef(130)
  const popRef = useRef(0) // food-eaten pulse animation timer
  const rafRef = useRef(0)

  // Load persisted high score.
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(HIGH_SCORE_KEY))
      if (!Number.isNaN(stored) && stored > 0) setHighScore(stored)
    } catch {
      // ignore storage errors
    }
  }, [])

  const resetGame = useCallback(() => {
    const snake = createSnake()
    snakeRef.current = snake
    prevSnakeRef.current = snake.map((p) => ({ ...p }))
    dirRef.current = "right"
    queuedDirRef.current = []
    foodsEatenRef.current = 0
    levelRef.current = 1
    foodRef.current = spawnFood(snake)
    prevFoodRef.current = { ...foodRef.current }
    accRef.current = 0
    popRef.current = 0
    stepIntervalRef.current = intervalForLevel(difficultyRef.current, 1)
    setScore(0)
    setLevel(1)
    setIsNewBest(false)
  }, [])

  const startGame = useCallback(() => {
    resetGame()
    statusRef.current = "playing"
    lastTimeRef.current = performance.now()
    setStatus("playing")
  }, [resetGame])

  const resumeGame = useCallback(() => {
    statusRef.current = "playing"
    lastTimeRef.current = performance.now()
    setStatus("playing")
  }, [])

  const pauseGame = useCallback(() => {
    if (statusRef.current !== "playing") return
    statusRef.current = "paused"
    setStatus("paused")
  }, [])

  const endGame = useCallback(() => {
    statusRef.current = "over"
    setStatus("over")
    setScore((s) => {
      setHighScore((hs) => {
        if (s > hs) {
          setIsNewBest(true)
          try {
            localStorage.setItem(HIGH_SCORE_KEY, String(s))
          } catch {
            // ignore
          }
          return s
        }
        return hs
      })
      return s
    })
  }, [])

  // Apply a directional input, queueing so quick taps register in order.
  const steer = useCallback((dir: Direction) => {
    if (statusRef.current !== "playing") return
    const queue = queuedDirRef.current
    const last = queue.length ? queue[queue.length - 1] : dirRef.current
    if (dir === last || dir === OPPOSITE[last]) return
    queue.push(dir)
    if (queue.length > 2) queue.shift()
  }, [])

  // --- Advance the simulation by one grid step ---
  const stepSimulation = useCallback(() => {
    const snake = snakeRef.current
    prevSnakeRef.current = snake.map((p) => ({ ...p }))
    prevFoodRef.current = { ...foodRef.current }

    if (queuedDirRef.current.length) {
      const next = queuedDirRef.current.shift()!
      if (next !== OPPOSITE[dirRef.current]) dirRef.current = next
    }

    const head = nextHead(snake[0], dirRef.current)

    // Collision with wall.
    if (hitsWall(head)) {
      endGame()
      return
    }

    const willEat = pointsEqual(head, foodRef.current)
    // Body to check against: tail moves unless we eat.
    const body = willEat ? snake : snake.slice(0, -1)
    if (isOnSnake(body, head)) {
      endGame()
      return
    }

    const newSnake = [head, ...snake]
    if (!willEat) {
      newSnake.pop()
    } else {
      foodsEatenRef.current += 1
      popRef.current = 1
      foodRef.current = spawnFood(newSnake)
      const newLevel = levelForFoods(foodsEatenRef.current)
      if (newLevel !== levelRef.current) {
        levelRef.current = newLevel
        setLevel(newLevel)
      }
      stepIntervalRef.current = intervalForLevel(
        difficultyRef.current,
        levelRef.current,
      )
      setScore((s) => {
        const ns = s + 10 * levelRef.current
        setHighScore((hs) => (ns > hs ? ns : hs))
        return ns
      })
    }
    snakeRef.current = newSnake
  }, [endGame])

  // --- Render the board ---
  const draw = useCallback((interp: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = canvas.__dpr || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const cell = w / GRID_COLS

    const bg = cssVar("--card", "#1a1f2b")
    const gridLine = cssVar("--border", "#2a2f3b")
    const primary = cssVar("--primary", "#7bdc4f")
    const accent = cssVar("--accent", "#e0a040")

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Grid lines.
    ctx.strokeStyle = gridLine
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 1; x < GRID_COLS; x++) {
      ctx.moveTo(x * cell, 0)
      ctx.lineTo(x * cell, h)
    }
    for (let y = 1; y < GRID_ROWS; y++) {
      ctx.moveTo(0, y * cell)
      ctx.lineTo(w, y * cell)
    }
    ctx.stroke()
    ctx.globalAlpha = 1

    // --- Food (pulsing) ---
    const food = foodRef.current
    const pop = popRef.current
    const pulse = 1 + Math.sin(performance.now() / 220) * 0.08
    const fr = (cell / 2) * 0.7 * pulse
    const fcx = food.x * cell + cell / 2
    const fcy = food.y * cell + cell / 2
    ctx.save()
    ctx.shadowColor = accent
    ctx.shadowBlur = 14
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(fcx, fcy, fr, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // --- Snake (interpolated between previous and current positions) ---
    const snake = snakeRef.current
    const prev = prevSnakeRef.current
    const t = easeOutQuad(Math.min(1, interp))
    const gap = Math.max(1, cell * 0.08)
    const size = cell - gap * 2
    const radius = size * 0.32

    ctx.save()
    ctx.shadowColor = primary
    ctx.shadowBlur = 10
    for (let i = snake.length - 1; i >= 0; i--) {
      const cur = snake[i]
      const from = prev[i] ?? prev[prev.length - 1] ?? cur
      const ix = from.x + (cur.x - from.x) * t
      const iy = from.y + (cur.y - from.y) * t
      const px = ix * cell + gap
      const py = iy * cell + gap

      // Head brightest, body fades slightly toward the tail.
      const fade = 1 - (i / Math.max(1, snake.length)) * 0.45
      ctx.globalAlpha = fade
      ctx.fillStyle = primary
      roundRect(ctx, px, py, size, size, radius)
      ctx.fill()

      // Eyes on the head.
      if (i === 0) {
        ctx.globalAlpha = 1
        ctx.shadowBlur = 0
        ctx.fillStyle = bg
        const dir = dirRef.current
        const ex = px + size / 2
        const ey = py + size / 2
        const off = size * 0.22
        const er = Math.max(1.2, size * 0.1)
        let e1: [number, number] = [ex - off, ey - off]
        let e2: [number, number] = [ex + off, ey - off]
        if (dir === "left" || dir === "right") {
          const sx = dir === "right" ? off : -off
          e1 = [ex + sx, ey - off]
          e2 = [ex + sx, ey + off]
        } else if (dir === "down") {
          e1 = [ex - off, ey + off]
          e2 = [ex + off, ey + off]
        }
        ctx.beginPath()
        ctx.arc(e1[0], e1[1], er, 0, Math.PI * 2)
        ctx.arc(e2[0], e2[1], er, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowColor = primary
        ctx.shadowBlur = 10
      }
    }
    ctx.restore()
    ctx.globalAlpha = 1

    if (pop > 0) {
      popRef.current = Math.max(0, pop - 0.06)
    }
  }, [])

  // --- Main animation loop ---
  useEffect(() => {
    const loop = (time: number) => {
      const last = lastTimeRef.current || time
      const delta = time - last
      lastTimeRef.current = time

      if (statusRef.current === "playing") {
        accRef.current += delta
        while (accRef.current >= stepIntervalRef.current) {
          accRef.current -= stepIntervalRef.current
          stepSimulation()
          if (statusRef.current !== "playing") {
            accRef.current = 0
            break
          }
        }
      }

      const interp =
        statusRef.current === "playing"
          ? accRef.current / stepIntervalRef.current
          : 1
      draw(interp)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw, stepSimulation])

  // --- Canvas sizing (responsive + crisp via devicePixelRatio) ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const size = parent.clientWidth
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = size * dpr
      canvas.height = size * dpr
      canvas.style.height = `${size}px`
      canvas.__dpr = dpr
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [])

  // --- Keyboard controls ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const map: Record<string, Direction> = {
        arrowup: "up",
        arrowdown: "down",
        arrowleft: "left",
        arrowright: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      }
      if (map[key]) {
        e.preventDefault()
        if (statusRef.current === "idle" || statusRef.current === "over") {
          startGame()
          // apply the first direction immediately if valid
          steer(map[key])
        } else {
          steer(map[key])
        }
        return
      }
      if (key === " " || key === "p") {
        e.preventDefault()
        if (statusRef.current === "playing") pauseGame()
        else if (statusRef.current === "paused") resumeGame()
        else if (statusRef.current === "idle" || statusRef.current === "over")
          startGame()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pauseGame, resumeGame, startGame, steer])

  const changeDifficulty = useCallback((d: Difficulty) => {
    setDifficulty(d)
    difficultyRef.current = d
    stepIntervalRef.current = intervalForLevel(d, levelRef.current)
  }, [])

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <ScoreBoard score={score} highScore={highScore} level={level} />

      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <canvas ref={canvasRef} className="block w-full" aria-label="Snake game board" />
        <GameOverlay
          status={status}
          score={score}
          highScore={highScore}
          isNewBest={isNewBest}
          difficulty={difficulty}
          onChangeDifficulty={changeDifficulty}
          onStart={startGame}
          onResume={resumeGame}
        />
        {status === "playing" && (
          <button
            type="button"
            onClick={pauseGame}
            className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:text-card-foreground"
            aria-label="Pause game"
          >
            <Pause className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Touch / on-screen controls */}
      <TouchControls onSteer={steer} />

      <p className="text-center font-mono text-xs leading-relaxed text-muted-foreground">
        Arrow keys / WASD to move · Space to pause
      </p>
    </div>
  )
}

function TouchControls({ onSteer }: { onSteer: (d: Direction) => void }) {
  const btn =
    "flex size-14 items-center justify-center rounded-lg border border-border bg-card text-card-foreground active:bg-secondary transition-colors"
  return (
    <div className="mx-auto grid w-44 grid-cols-3 gap-2 sm:hidden" aria-hidden="false">
      <span />
      <button type="button" className={btn} onClick={() => onSteer("up")} aria-label="Move up">
        <ArrowUp className="size-5" />
      </button>
      <span />
      <button type="button" className={btn} onClick={() => onSteer("left")} aria-label="Move left">
        <ArrowLeft className="size-5" />
      </button>
      <button type="button" className={btn} onClick={() => onSteer("down")} aria-label="Move down">
        <ArrowDown className="size-5" />
      </button>
      <button type="button" className={btn} onClick={() => onSteer("right")} aria-label="Move right">
        <ArrowRight className="size-5" />
      </button>
    </div>
  )
}

// Rounded rectangle helper (older canvas API compatibility).
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
