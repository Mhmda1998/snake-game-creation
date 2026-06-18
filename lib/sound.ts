// Lightweight synthesized sound effects using the Web Audio API.
// No external assets required. All sounds are generated on the fly.

type SfxName = "eat" | "bonus" | "levelup" | "over" | "turn" | "start"

let ctx: AudioContext | null = null
let muted = false

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

// Some browsers start the context in a "suspended" state until a user
// gesture occurs. Call this from a click/keydown handler to unlock audio.
export function unlockAudio() {
  const c = getCtx()
  if (c && c.state === "suspended") {
    void c.resume()
  }
}

export function setMuted(value: boolean) {
  muted = value
}

export function isMuted() {
  return muted
}

// Play a simple oscillator tone with an envelope.
function tone(
  c: AudioContext,
  opts: {
    freq: number
    to?: number
    type?: OscillatorType
    duration: number
    gain?: number
    delay?: number
  },
) {
  const { freq, to, type = "square", duration, gain = 0.06, delay = 0 } = opts
  const start = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (to && to !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration)
  }
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

export function playSfx(name: SfxName) {
  if (muted) return
  const c = getCtx()
  if (!c) return
  if (c.state === "suspended") void c.resume()

  switch (name) {
    case "eat":
      tone(c, { freq: 440, to: 760, type: "square", duration: 0.09, gain: 0.05 })
      break
    case "bonus":
      tone(c, { freq: 660, to: 990, type: "triangle", duration: 0.1, gain: 0.06 })
      tone(c, { freq: 990, to: 1320, type: "triangle", duration: 0.12, gain: 0.05, delay: 0.08 })
      break
    case "levelup":
      tone(c, { freq: 523, type: "square", duration: 0.1, gain: 0.05 })
      tone(c, { freq: 659, type: "square", duration: 0.1, gain: 0.05, delay: 0.09 })
      tone(c, { freq: 784, type: "square", duration: 0.16, gain: 0.05, delay: 0.18 })
      break
    case "turn":
      tone(c, { freq: 300, type: "sine", duration: 0.04, gain: 0.02 })
      break
    case "start":
      tone(c, { freq: 392, to: 523, type: "triangle", duration: 0.16, gain: 0.05 })
      break
    case "over":
      tone(c, { freq: 400, to: 80, type: "sawtooth", duration: 0.5, gain: 0.07 })
      tone(c, { freq: 200, to: 50, type: "square", duration: 0.55, gain: 0.05, delay: 0.06 })
      break
  }
}
