"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  type Difficulty,
  type Direction,
  type Point,
  type Status,
  BASE_POINTS,
  BONUS_EVERY,
  BONUS_LIFETIME_MS,
  BONUS_POINTS,
  COMBO_WINDOW_MS,
  GRID_COLS,
  GRID_ROWS,
  MAX_COMBO,
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
import { playSfx, setMuted, unlockAudio } from "@/lib/sound"
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react"

declare global {
  interface HTMLCanvasElement {
    __dpr?: number
  }
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
}

export type GameStats = {
  apples: number
  level: number
  durationMs: number
  maxCombo: number
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
const MUTE_KEY = "neon-snake:muted"

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // --- React state for the HUD only ---
  const [status, setStatus] = useState<Status>("idle")
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [combo, setCombo] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>("normal")
  const [muted, setMutedState] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [stats, setStats] = useState<GameStats>({
    apples: 0,
    level: 1,
    durationMs: 0,
    maxCombo: 0,
  })

  // --- Mutable game state held in refs so the loop is stable ---
  const snakeRef = useRef<Point[]>(createSnake())
  const prevSnakeRef = useRef<Point[]>(createSnake())
  const foodRef = useRef<Point>({ x: 0, y: 0 })
  const prevFoodRef = useRef<Point>({ x: 0, y: 0 })
  const bonusRef = useRef<Point | null>(null)
  const bonusBornRef = useRef(0)
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
  const particlesRef = useRef<Particle[]>([])
  const shakeRef = useRef(0)
  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const lastEatRef = useRef(0)
  const startedAtRef = useRef(0)
  const elapsedRef = useRef(0)
  const floatersRef = useRef<
    { x: number; y: number; text: string; life: number; color: string }[]
  >([])

  // Load persisted high score + mute preference.
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(HIGH_SCORE_KEY))
      if (!Number.isNaN(stored) && stored > 0) setHighScore(stored)
      const m = localStorage.getItem(MUTE_KEY) === "1"
      setMutedState(m)
      setMuted(m)
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
    bonusRef.current = null
    bonusBornRef.current = 0
    accRef.current = 0
    popRef.current = 0
    particlesRef.current = []
    floatersRef.current = []
    shakeRef.current = 0
    comboRef.current = 0
    maxComboRef.current = 0
    lastEatRef.current = 0
    elapsedRef.current = 0
    stepIntervalRef.current = intervalForLevel(difficultyRef.current, 1)
    setScore(0)
    setLevel(1)
    setCombo(0)
    setIsNewBest(false)
  }, [])

  // Begin a fresh run with a 3-2-1 countdown.
  const startGame = useCallback(() => {
    unlockAudio()
    resetGame()
    statusRef.current = "paused" // frozen during countdown
    setStatus("playing")
    setCountdown(3)
    let n = 3
    playSfx("turn")
    const tick = () => {
      n -= 1
      if (n > 0) {
        setCountdown(n)
        playSfx("turn")
        window.setTimeout(tick, 700)
      } else {
        setCountdown(0)
        statusRef.current = "playing"
        startedAtRef.current = performance.now()
        lastTimeRef.current = performance.now()
        playSfx("start")
      }
    }
    window.setTimeout(tick, 700)
  }, [resetGame])

  const resumeGame = useCallback(() => {
    unlockAudio()
    statusRef.current = "playing"
    lastTimeRef.current = performance.now()
    setStatus("playing")
  }, [])

  const pauseGame = useCallback(() => {
    if (statusRef.current !== "playing") return
    statusRef.current = "paused"
    elapsedRef.current += performance.now() - startedAtRef.current
    setStatus("paused")
  }, [])

  const endGame = useCallback(() => {
    statusRef.current = "over"
    shakeRef.current = 1
    playSfx("over")
    elapsedRef.current += performance.now() - startedAtRef.current
    setStats({
      apples: foodsEatenRef.current,
      level: levelRef.current,
      durationMs: elapsedRef.current,
      maxCombo: maxComboRef.current,
    })
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

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      const next = !m
      setMuted(next)
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0")
      } catch {
        // ignore
      }
      return next
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
    playSfx("turn")
  }, [])

  // Spawn a burst of particles at a grid cell.
  const burst = useCallback((cell: Point, color: string, count: number) => {
    const list = particlesRef.current
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
      const speed = 0.04 + Math.random() * 0.08
      list.push({
        x: cell.x + 0.5,
        y: cell.y + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        max: 0.5 + Math.random() * 0.4,
        color,
        size: 0.1 + Math.random() * 0.12,
      })
    }
    if (list.length > 200) list.splice(0, list.length - 200)
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
    const willEatBonus = bonusRef.current && pointsEqual(head, bonusRef.current)
    // Body to check against: tail moves unless we eat.
    const body = willEat ? snake : snake.slice(0, -1)
    if (isOnSnake(body, head)) {
      endGame()
      return
    }

    const newSnake = [head, ...snake]

    // --- Bonus fruit pickup ---
    if (willEatBonus && bonusRef.current) {
      const bonusCell = bonusRef.current
      burst(bonusCell, cssVar("--chart-2", "#e0a040"), 22)
      floatersRef.current.push({
        x: bonusCell.x,
        y: bonusCell.y,
        text: `+${BONUS_POINTS}`,
        life: 1,
        color: cssVar("--chart-2", "#e0a040"),
      })
      bonusRef.current = null
      popRef.current = 1
      shakeRef.current = Math.min(1, shakeRef.current + 0.5)
      playSfx("bonus")
      setScore((s) => {
        const ns = s + BONUS_POINTS
        setHighScore((hs) => (ns > hs ? ns : hs))
        return ns
      })
    }

    if (!willEat) {
      newSnake.pop()
    } else {
      foodsEatenRef.current += 1
      popRef.current = 1

      // --- Combo handling ---
      const now = performance.now()
      if (now - lastEatRef.current <= COMBO_WINDOW_MS) {
        comboRef.current = Math.min(MAX_COMBO, comboRef.current + 1)
      } else {
        comboRef.current = 1
      }
      lastEatRef.current = now
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current)
      setCombo(comboRef.current)

      burst(foodRef.current, cssVar("--primary", "#7bdc4f"), 12)

      // --- Spawn a golden bonus fruit periodically ---
      if (foodsEatenRef.current % BONUS_EVERY === 0 && !bonusRef.current) {
        bonusRef.current = spawnFood(newSnake)
        bonusBornRef.current = now
      }

      foodRef.current = spawnFood(
        bonusRef.current ? [...newSnake, bonusRef.current] : newSnake,
      )

      const newLevel = levelForFoods(foodsEatenRef.current)
      if (newLevel !== levelRef.current) {
        levelRef.current = newLevel
        setLevel(newLevel)
        shakeRef.current = Math.min(1, shakeRef.current + 0.4)
        playSfx("levelup")
      } else {
        playSfx("eat")
      }
      stepIntervalRef.current = intervalForLevel(
        difficultyRef.current,
        levelRef.current,
      )

      const gained = BASE_POINTS * levelRef.current * comboRef.current
      floatersRef.current.push({
        x: head.x,
        y: head.y,
        text: `+${gained}`,
        life: 1,
        color: cssVar("--primary", "#7bdc4f"),
      })
      setScore((s) => {
        const ns = s + gained
        setHighScore((hs) => (ns > hs ? ns : hs))
        return ns
      })
    }
    snakeRef.current = newSnake
  }, [burst, endGame])

  // --- Render the board ---
  const draw = useCallback((interp: number, delta: number) => {
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
    const accent = cssVar("--chart-2", "#e0a040")
    const now = performance.now()

    // Screen shake offset.
    const shake = shakeRef.current
    let ox = 0
    let oy = 0
    if (shake > 0) {
      const mag = shake * cell * 0.5
      ox = (Math.random() - 0.5) * mag
      oy = (Math.random() - 0.5) * mag
      shakeRef.current = Math.max(0, shake - delta / 380)
    }

    ctx.save()
    ctx.translate(ox, oy)

    ctx.clearRect(-cell, -cell, w + cell * 2, h + cell * 2)
    ctx.fillStyle = bg
    ctx.fillRect(-cell, -cell, w + cell * 2, h + cell * 2)

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
    const pulse = 1 + Math.sin(now / 220) * 0.08
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

    // --- Bonus (golden) fruit with depleting timer ring ---
    const bonus = bonusRef.current
    if (bonus) {
      const age = now - bonusBornRef.current
      const remain = Math.max(0, 1 - age / BONUS_LIFETIME_MS)
      if (remain <= 0) {
        bonusRef.current = null
      } else {
        const bx = bonus.x * cell + cell / 2
        const by = bonus.y * cell + cell / 2
        const gold = cssVar("--accent", "#f5c451")
        const bpulse = 1 + Math.sin(now / 120) * 0.14
        const br = (cell / 2) * 0.78 * bpulse
        ctx.save()
        ctx.shadowColor = gold
        ctx.shadowBlur = 20
        ctx.fillStyle = gold
        ctx.beginPath()
        ctx.arc(bx, by, br, 0, Math.PI * 2)
        ctx.fill()
        // sparkle center
        ctx.shadowBlur = 0
        ctx.fillStyle = bg
        ctx.beginPath()
        ctx.arc(bx, by, br * 0.35, 0, Math.PI * 2)
        ctx.fill()
        // timer ring
        ctx.strokeStyle = gold
        ctx.lineWidth = Math.max(2, cell * 0.12)
        ctx.beginPath()
        ctx.arc(
          bx,
          by,
          cell * 0.62,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * remain,
        )
        ctx.stroke()
        ctx.restore()
      }
    }

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

    // --- Particles ---
    const particles = particlesRef.current
    if (particles.length) {
      ctx.save()
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life -= delta / 1000 / p.max
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        p.x += p.vx * (delta / 16)
        p.y += p.vy * (delta / 16)
        p.vx *= 0.96
        p.vy *= 0.96
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x * cell, p.y * cell, p.size * cell, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      ctx.globalAlpha = 1
    }

    // --- Floating score text ---
    const floaters = floatersRef.current
    if (floaters.length) {
      ctx.save()
      ctx.font = `600 ${Math.round(cell * 0.7)}px ui-monospace, monospace`
      ctx.textAlign = "center"
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i]
        f.life -= delta / 900
        if (f.life <= 0) {
          floaters.splice(i, 1)
          continue
        }
        ctx.globalAlpha = Math.max(0, f.life)
        ctx.fillStyle = f.color
        const rise = (1 - f.life) * cell * 1.6
        ctx.fillText(
          f.text,
          f.x * cell + cell / 2,
          f.y * cell + cell / 2 - rise,
        )
      }
      ctx.restore()
      ctx.globalAlpha = 1
    }

    ctx.restore() // shake translate

    if (popRef.current > 0) {
      popRef.current = Math.max(0, popRef.current - 0.06)
    }
  }, [])

  // --- Main animation loop ---
  useEffect(() => {
    const loop = (time: number) => {
      const last = lastTimeRef.current || time
      const delta = Math.min(64, time - last)
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
      draw(interp, delta)
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

  // --- Auto-pause when the tab loses focus ---
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && statusRef.current === "playing") {
        pauseGame()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [pauseGame])

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
        } else {
          steer(map[key])
        }
        return
      }
      if (key === " " || key === "p") {
        e.preventDefault()
        if (statusRef.current === "playing") pauseGame()
        else if (statusRef.current === "paused" && countdown === 0) resumeGame()
        else if (statusRef.current === "idle" || statusRef.current === "over")
          startGame()
      }
      if (key === "m") {
        e.preventDefault()
        toggleMute()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [countdown, pauseGame, resumeGame, startGame, steer, toggleMute])

  const changeDifficulty = useCallback((d: Difficulty) => {
    setDifficulty(d)
    difficultyRef.current = d
    stepIntervalRef.current = intervalForLevel(d, levelRef.current)
  }, [])

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <ScoreBoard
        score={score}
        highScore={highScore}
        level={level}
        combo={combo}
      />

      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <canvas
          ref={canvasRef}
          className="block w-full"
          aria-label="Snake game board"
        />

        <GameOverlay
          status={status}
          score={score}
          highScore={highScore}
          isNewBest={isNewBest}
          difficulty={difficulty}
          stats={stats}
          onChangeDifficulty={changeDifficulty}
          onStart={startGame}
          onResume={resumeGame}
        />

        {/* Countdown overlay */}
        {countdown > 0 && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
            <span
              key={countdown}
              className="animate-[ping_0.7s_ease-out] font-mono text-7xl font-bold text-primary"
            >
              {countdown}
            </span>
          </div>
        )}

        {/* In-game controls: pause + mute */}
        {status === "playing" && (
          <div className="absolute right-3 top-3 z-20 flex gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="flex size-9 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:text-card-foreground"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? (
                <VolumeX className="size-4" aria-hidden="true" />
              ) : (
                <Volume2 className="size-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={pauseGame}
              className="flex size-9 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:text-card-foreground"
              aria-label="Pause game"
            >
              <Pause className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Touch / on-screen controls */}
      <TouchControls onSteer={steer} />

      <div className="flex items-center justify-center gap-2">
        <p className="text-center font-mono text-xs leading-relaxed text-muted-foreground">
          Arrow keys / WASD to move · Space to pause · M to mute
        </p>
      </div>
    </div>
  )
}

function TouchControls({ onSteer }: { onSteer: (d: Direction) => void }) {
  const btn =
    "flex size-14 items-center justify-center rounded-lg border border-border bg-card text-card-foreground active:bg-secondary transition-colors"
  return (
    <div
      className="mx-auto grid w-44 grid-cols-3 gap-2 sm:hidden"
      aria-hidden="false"
    >
      <span />
      <button
        type="button"
        className={btn}
        onClick={() => onSteer("up")}
        aria-label="Move up"
      >
        <ArrowUp className="size-5" />
      </button>
      <span />
      <button
        type="button"
        className={btn}
        onClick={() => onSteer("left")}
        aria-label="Move left"
      >
        <ArrowLeft className="size-5" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => onSteer("down")}
        aria-label="Move down"
      >
        <ArrowDown className="size-5" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => onSteer("right")}
        aria-label="Move right"
      >
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
