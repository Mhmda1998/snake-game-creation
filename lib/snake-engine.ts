export type Point = { x: number; y: number }
export type Direction = "up" | "down" | "left" | "right"
export type Status = "idle" | "playing" | "paused" | "over"
export type Difficulty = "easy" | "normal" | "hard"

export const GRID_COLS = 24
export const GRID_ROWS = 24

// Number of foods eaten before the level increases.
export const FOODS_PER_LEVEL = 4

// Base step interval (ms) per difficulty and how aggressively it speeds up.
export const DIFFICULTY: Record<
  Difficulty,
  { base: number; min: number; step: number; label: string }
> = {
  easy: { base: 170, min: 80, step: 8, label: "Easy" },
  normal: { base: 130, min: 60, step: 8, label: "Normal" },
  hard: { base: 95, min: 45, step: 6, label: "Hard" },
}

const DIRECTIONS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
}

export function createSnake(): Point[] {
  const cx = Math.floor(GRID_COLS / 2)
  const cy = Math.floor(GRID_ROWS / 2)
  // Head first, two trailing segments to the left.
  return [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ]
}

export function pointsEqual(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y
}

export function isOnSnake(snake: Point[], p: Point) {
  return snake.some((s) => pointsEqual(s, p))
}

export function spawnFood(snake: Point[]): Point {
  const free: Point[] = []
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const p = { x, y }
      if (!isOnSnake(snake, p)) free.push(p)
    }
  }
  if (free.length === 0) return { x: 0, y: 0 }
  return free[Math.floor(Math.random() * free.length)]
}

export function nextHead(head: Point, dir: Direction): Point {
  const d = DIRECTIONS[dir]
  return { x: head.x + d.x, y: head.y + d.y }
}

export function hitsWall(p: Point) {
  return p.x < 0 || p.y < 0 || p.x >= GRID_COLS || p.y >= GRID_ROWS
}

export function levelForFoods(foods: number) {
  return Math.floor(foods / FOODS_PER_LEVEL) + 1
}

export function intervalForLevel(difficulty: Difficulty, level: number) {
  const cfg = DIFFICULTY[difficulty]
  return Math.max(cfg.min, cfg.base - (level - 1) * cfg.step)
}
