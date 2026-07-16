import type { ControllerOptions, GameController, GameStatus, GameTheme } from '../types'

type Point = { x: number; y: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const random = (min: number, max: number) => min + Math.random() * (max - min)
const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

abstract class BaseController implements GameController {
  protected w = 390
  protected h = 844
  protected status: GameStatus = 'playing'
  protected score = 0
  protected elapsed = 0
  protected paused = false

  constructor(protected readonly theme: GameTheme, protected readonly options: ControllerOptions) {}

  resize(width: number, height: number) { this.w = width; this.h = height }
  update(dt: number) {
    if (this.paused || this.status === 'finished') return
    this.elapsed += dt
    this.tick(Math.min(dt, 0.033))
  }
  abstract tick(dt: number): void
  abstract render(ctx: CanvasRenderingContext2D): void
  pointerDown(_x: number, _y: number) {}
  pointerMove(_x: number, _y: number) {}
  pointerUp(_x: number, _y: number) {}
  swipe(_dx: number, _dy: number) {}
  autopilot(_elapsed?: number) {}
  pause() { this.paused = true; this.status = this.status === 'finished' ? 'finished' : 'paused' }
  resume() { this.paused = false; if (this.status === 'paused') this.status = 'playing' }
  restart() { this.score = 0; this.elapsed = 0; this.paused = false; this.status = 'playing'; this.reset() }
  abstract reset(): void
  destroy() { this.paused = true }
  getScore() { return this.score }
  getStatus() { return this.status }
  protected setScore(value: number) { this.score = value; this.options.onScore(value) }
  protected addScore(value = 1) { this.setScore(this.score + value); this.options.onImpact(value > 1 ? 'perfect' : 'score') }
  protected finish() {
    if (this.options.preview) { this.restart(); return }
    this.status = 'finished'; this.options.onImpact('fail'); this.options.onFinish(this.score)
  }
  protected paintBackdrop(ctx: CanvasRenderingContext2D, top = this.theme.background, bottom = this.theme.surface) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.h)
    gradient.addColorStop(0, top); gradient.addColorStop(1, bottom)
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.w, this.h)
  }
}

type Hoop = { x: number; y: number; passed: boolean; pulse: number; netSwing?: number; netVelocity?: number; netPunch?: number }
type HoopScoreEffect = { x: number; y: number; life: number; label: string; clean: boolean; streak: number }

class HoopFlightController extends BaseController {
  private ball = { x: 110, y: 400, vx: 0, vy: 0, r: 20, rotation: 0, kick: 0, collisionCooldown: 0 }
  private hoops: Hoop[] = []
  private speed = 138
  private autoClock = 0
  private readonly hoopImage: HTMLImageElement
  private cleanStreak = 0
  private scoreEffects: HoopScoreEffect[] = []
  private scoreFlash = 0
  private fireBurst = 0
  private capturedHoop: Hoop | null = null
  private captureTime = 0

  reset() {
    this.ball = { x: this.w * .27, y: this.h * .48, vx: 0, vy: 50, r: 20, rotation: -.15, kick: 0, collisionCooldown: 0 }
    this.speed = 138; this.autoClock = 0; this.cleanStreak = 0; this.scoreEffects = []; this.scoreFlash = 0; this.fireBurst = 0; this.capturedHoop = null; this.captureTime = 0
    this.hoops = [0, 1, 2].map((i) => ({ x: this.w * .86 + i * 255, y: random(this.h * .3, this.h * .67), passed: false, pulse: 0, netSwing: 0, netVelocity: 0, netPunch: 0 }))
  }
  constructor(theme: GameTheme, options: ControllerOptions) {
    super(theme, options)
    this.hoopImage = new Image()
    this.hoopImage.src = `${import.meta.env.BASE_URL}games/hoop-flight/hoop.png`
    this.reset()
  }
  pointerDown() {
    if (this.status === 'finished') return
    // A short positional kick plus a strong, short-lived impulse makes every tap
    // read immediately instead of easing the ball upward.
    this.ball.y -= 8
    this.ball.vy = -570
    this.ball.kick = 1
    this.ball.rotation -= .22
    this.captureTime = 0
    this.capturedHoop = null
    this.options.onImpact('tap')
  }
  autopilot() { if (this.ball.y > this.h * .47 || this.ball.vy > 210) this.pointerDown() }
  tick(dt: number) {
    if (this.options.preview) { this.autoClock += dt; if (this.autoClock > .42) { this.autoClock = 0; this.autopilot() } }
    const previousY = this.ball.y
    if (this.captureTime > 0 && this.capturedHoop) {
      const pull = Math.min(1, dt * 15)
      this.ball.x += (this.capturedHoop.x - this.ball.x) * pull
      this.ball.vx *= Math.pow(.04, dt)
      this.ball.vy += (330 - this.ball.vy) * Math.min(1, dt * 8)
      this.captureTime -= dt
      if (this.captureTime <= 0) this.capturedHoop = null
    }
    this.ball.vy = Math.min(760, this.ball.vy + 1850 * dt)
    const anchorX = this.w * .27
    this.ball.vx += (anchorX - this.ball.x) * 11 * dt
    this.ball.vx *= Math.pow(.16, dt)
    this.ball.x += this.ball.vx * dt
    this.ball.y += this.ball.vy * dt
    this.ball.kick = Math.max(0, this.ball.kick - dt * 7.5)
    this.ball.collisionCooldown = Math.max(0, this.ball.collisionCooldown - dt)
    this.scoreFlash = Math.max(0, this.scoreFlash - dt * 2.8)
    this.fireBurst = Math.max(0, this.fireBurst - dt * 1.45)
    this.scoreEffects.forEach((effect) => { effect.life -= dt; effect.x -= this.speed * dt })
    this.scoreEffects = this.scoreEffects.filter((effect) => effect.life > 0)
    this.ball.rotation += dt * (2.4 + Math.abs(this.ball.vy) * .002)
    this.speed = Math.min(235, 138 + this.elapsed * 1.65)
    let missedHoop = false
    for (const hoop of this.hoops) {
      hoop.x -= this.speed * dt; hoop.pulse = Math.max(0, hoop.pulse - dt)
      hoop.netVelocity = (hoop.netVelocity ?? 0) - (hoop.netSwing ?? 0) * 48 * dt
      hoop.netVelocity *= Math.pow(.018, dt)
      hoop.netSwing = (hoop.netSwing ?? 0) + hoop.netVelocity * dt
      hoop.netPunch = Math.max(0, (hoop.netPunch ?? 0) - dt * 2.7)
      const metrics = this.getHoopMetrics(hoop)
      this.collideWithHoop(metrics)
      const insideOpening = Math.abs(this.ball.x - hoop.x) < metrics.rimHalf - this.ball.r * .25
      const crossedRimPlane = previousY <= hoop.y && this.ball.y > hoop.y
      if (!hoop.passed && insideOpening && crossedRimPlane && this.ball.vy > 0) {
        hoop.passed = true; hoop.pulse = 1
        const clean = Math.abs(this.ball.x - hoop.x) < metrics.rimHalf * .42
        this.cleanStreak = clean ? this.cleanStreak + 1 : 0
        const points = clean ? (this.cleanStreak >= 3 ? 3 : this.cleanStreak === 2 ? 2 : 1) : 1
        const label = clean ? (this.cleanStreak >= 3 ? `FIRE ×${this.cleanStreak}` : this.cleanStreak === 2 ? 'PERFECT ×2' : 'CLEAN!') : 'SWISH!'
        this.setScore(this.score + points)
        this.options.onImpact(clean ? 'perfect' : 'score')
        hoop.netVelocity = clamp((this.ball.x - hoop.x) * 5.5 + 175, -220, 220)
        hoop.netPunch = 1
        this.capturedHoop = hoop
        this.captureTime = .3
        this.ball.vy = Math.min(this.ball.vy, 365)
        this.ball.kick = Math.max(this.ball.kick, .72)
        this.scoreEffects.push({ x: hoop.x, y: hoop.y, life: 1, label, clean, streak: this.cleanStreak })
        this.scoreFlash = clean ? .9 : .58
        if (this.cleanStreak >= 3) this.fireBurst = 1
      } else if (!hoop.passed && hoop.x + metrics.rimHalf < this.ball.x - this.ball.r) {
        missedHoop = true
        break
      }
      if (insideOpening && this.ball.y > hoop.y + 5 && this.ball.y < hoop.y + metrics.height * .68) {
        this.ball.vx *= Math.pow(.55, dt)
      }
    }
    if (missedHoop) { this.finish(); return }
    const last = this.hoops[this.hoops.length - 1]
    if (last.x < this.w - 180) this.hoops.push({ x: last.x + random(220, 295), y: random(this.h * .25, this.h * .68), passed: false, pulse: 0, netSwing: 0, netVelocity: 0, netPunch: 0 })
    this.hoops = this.hoops.filter((hoop) => hoop.x > -100)
    if (this.ball.y > this.h - 75 || this.ball.y < 42 || this.ball.x + this.ball.r < 0) this.finish()
  }
  render(ctx: CanvasRenderingContext2D) {
    const paper = ctx.createLinearGradient(0, 0, 0, this.h)
    paper.addColorStop(0, '#d6c9af'); paper.addColorStop(.5, '#c9b99a'); paper.addColorStop(1, '#b7a686')
    ctx.fillStyle = paper; ctx.fillRect(0, 0, this.w, this.h)
    this.drawPaperWall(ctx)
    ctx.fillStyle = '#15130f'; ctx.fillRect(0, 76, this.w, 9); ctx.fillRect(0, this.h - 71, this.w, 10)
    ctx.fillStyle = '#f2bd3f'; ctx.fillRect(0, this.h - 61, this.w, 61)
    ctx.fillStyle = 'rgba(82,72,54,.3)'; ctx.font = `900 ${Math.min(88, this.w * .2)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(this.score), this.w * .55, this.h * .52)
    for (const hoop of this.hoops) this.drawHoopLayer(ctx, hoop, false)
    ctx.save(); ctx.translate(this.ball.x, this.ball.y); ctx.scale(1 + this.ball.kick * .16, 1 - this.ball.kick * .1); drawBasketball(ctx, 0, 0, this.ball.r, this.ball.rotation, this.cleanStreak >= 3); ctx.restore()
    for (const hoop of this.hoops) this.drawHoopLayer(ctx, hoop, true)
    this.drawScoreEffects(ctx)
    if (this.fireBurst > 0) { ctx.strokeStyle = `rgba(255,75,25,${this.fireBurst * .7})`; ctx.lineWidth = 8 + this.fireBurst * 7; ctx.shadowColor = '#ff6a24'; ctx.shadowBlur = 28; ctx.strokeRect(4, 88, this.w - 8, this.h - 164); ctx.shadowBlur = 0 }
    if (this.scoreFlash > 0) { ctx.fillStyle = `rgba(255,248,170,${this.scoreFlash * .16})`; ctx.fillRect(0, 0, this.w, this.h) }
    drawGameLabel(ctx, 'TAP TO BOUNCE', `${Math.floor(this.elapsed * 10)}m`, this.w, this.h)
  }
  private drawPaperWall(ctx: CanvasRenderingContext2D) {
    const drift = (this.elapsed * this.speed * .045) % 120
    ctx.save(); ctx.strokeStyle = 'rgba(91,80,59,.28)'; ctx.lineWidth = 1.4
    for (let i = 0; i < 17; i++) {
      const width = 55 + (i % 4) * 9
      let x = (i * 91 + (i % 3) * 37 - drift) % (this.w + 150) - 80
      if (x < -100) x += this.w + 150
      const y = 105 + ((i * 83 + (i % 2) * 29) % Math.max(120, this.h - 235))
      roundedRect(ctx, x, y, width, 25 + (i % 2) * 3, 5); ctx.stroke()
      ctx.strokeStyle = 'rgba(255,248,226,.15)'; ctx.beginPath(); ctx.moveTo(x + 7, y + 5); ctx.lineTo(x + width - 8, y + 5); ctx.stroke(); ctx.strokeStyle = 'rgba(91,80,59,.28)'
    }
    ctx.fillStyle = 'rgba(87,73,50,.035)'
    for (let i = 0; i < 90; i++) ctx.fillRect((i * 47) % this.w, (i * 97) % this.h, 2, 2)
    ctx.restore()
  }
  private getHoopMetrics(hoop: Hoop) {
    const width = Math.min(104, this.w * .27)
    const height = width * (483 / 560)
    const left = hoop.x - width * .5
    const top = hoop.y - height * .135
    return { hoop, width, height, left, top, rimHalf: width * .43 }
  }
  private collideWithHoop(metrics: ReturnType<HoopFlightController['getHoopMetrics']>) {
    if (this.ball.collisionCooldown > 0) return
    const posts = [metrics.hoop.x - metrics.rimHalf, metrics.hoop.x + metrics.rimHalf]
    for (const postX of posts) {
      const dx = this.ball.x - postX, dy = this.ball.y - metrics.hoop.y
      const minDistance = this.ball.r + 6, length = Math.hypot(dx, dy)
      if (length >= minDistance || length === 0) continue
      const nx = dx / length, ny = dy / length, overlap = minDistance - length
      this.ball.x += nx * overlap; this.ball.y += ny * overlap
      const relativeX = this.ball.vx + this.speed
      const alongNormal = relativeX * nx + this.ball.vy * ny
      if (alongNormal < 0) {
        const bounce = 1.68 * alongNormal
        this.ball.vx = relativeX - bounce * nx - this.speed
        this.ball.vy -= bounce * ny
      }
      this.ball.vx = Math.min(this.ball.vx, -155)
      this.registerHoopImpact(); return
    }
  }
  private registerHoopImpact() {
    this.ball.collisionCooldown = .075
    this.ball.kick = Math.max(this.ball.kick, .5)
    this.options.onImpact('tap')
  }
  private drawHoopLayer(ctx: CanvasRenderingContext2D, hoop: Hoop, foreground: boolean) {
    if (!this.hoopImage.complete || !this.hoopImage.naturalWidth) return
    const { width, height, left, top } = this.getHoopMetrics(hoop)
    ctx.save()
    if (hoop.pulse > 0) { ctx.shadowColor = '#fff27b'; ctx.shadowBlur = 34 * hoop.pulse }
    if (!foreground) {
      const sourceHeight = this.hoopImage.naturalHeight * .24
      ctx.drawImage(this.hoopImage, 0, 0, this.hoopImage.naturalWidth, sourceHeight, left, top, width, height * .24)
    } else {
      const rimSourceY = this.hoopImage.naturalHeight * .105
      const netSourceY = this.hoopImage.naturalHeight * .22
      const rimSourceHeight = netSourceY - rimSourceY
      ctx.drawImage(this.hoopImage, 0, rimSourceY, this.hoopImage.naturalWidth, rimSourceHeight, left, top + height * .105, width, height * .115)
      ctx.translate(hoop.x, hoop.y)
      const punch = hoop.netPunch ?? 0
      const stretch = 1 + Math.sin((1 - punch) * Math.PI * 4 + .7) * punch * .18
      ctx.transform(1, 0, (hoop.netSwing ?? 0) / Math.max(1, height), stretch, 0, 0)
      ctx.translate(-hoop.x, -hoop.y)
      ctx.drawImage(this.hoopImage, 0, netSourceY, this.hoopImage.naturalWidth, this.hoopImage.naturalHeight - netSourceY, left, top + height * .22, width, height * .78)
    }
    ctx.restore()
  }
  private drawScoreEffects(ctx: CanvasRenderingContext2D) {
    for (const effect of this.scoreEffects) {
      const progress = 1 - effect.life, alpha = Math.min(1, effect.life * 2.5)
      ctx.save(); ctx.translate(effect.x, effect.y - 28 - progress * 48)
      const color = effect.streak >= 3 ? '#ff5b22' : effect.clean ? '#fff06a' : '#ffffff'
      ctx.strokeStyle = color; ctx.globalAlpha = alpha * .55; ctx.lineWidth = 4 - progress * 2; ctx.beginPath(); ctx.arc(0, 28 + progress * 8, 28 + progress * 64, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = effect.clean ? 22 : 10; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${effect.streak >= 3 ? 25 : 21}px system-ui`; ctx.fillText(effect.label, 0, 0)
      for (let i = 0; i < (effect.clean ? 12 : 7); i++) { const angle = i * 2.4 + effect.streak; const radius = 25 + progress * (42 + i * 2); ctx.fillStyle = i % 2 ? color : '#ef4934'; ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, 28 + Math.sin(angle) * radius * .62, 2.5 + (i % 3), 0, Math.PI * 2); ctx.fill() }
      if (effect.streak >= 3) { ctx.globalAlpha = alpha * .5; ctx.strokeStyle = '#ff4a20'; ctx.lineWidth = 7; for (let i = 0; i < 5; i++) { const x = (i - 2) * 18; ctx.beginPath(); ctx.moveTo(x, 52); ctx.quadraticCurveTo(x + 12, 25 - i * 3, x + 4, 8); ctx.stroke() } }
      ctx.restore()
    }
  }
}

class DunkClimbController extends BaseController {
  private ball = { x: 190, y: 660, vx: 0, vy: 0, r: 19, flying: false }
  private hoop: Hoop = { x: 200, y: 280, passed: false, pulse: 0 }
  private dragStart: Point | null = null
  private dragPoint: Point | null = null
  private bounces = 0
  private autoClock = 0
  private respawn = 0
  reset() { this.ball = { x: this.w * .5, y: this.h * .76, vx: 0, vy: 0, r: 19, flying: false }; this.hoop = { x: random(95, this.w - 95), y: this.h * .32, passed: false, pulse: 0 }; this.dragStart = null; this.dragPoint = null; this.bounces = 0; this.respawn = 0 }
  constructor(theme: GameTheme, options: ControllerOptions) { super(theme, options); this.reset() }
  pointerDown(x: number, y: number) { if (!this.ball.flying && distance({ x, y }, this.ball) < 80) { this.dragStart = { x: this.ball.x, y: this.ball.y }; this.dragPoint = { x, y } } }
  pointerMove(x: number, y: number) { if (this.dragStart) this.dragPoint = { x, y } }
  pointerUp(x: number, y: number) {
    if (!this.dragStart) return
    const dx = clamp(this.dragStart.x - x, -130, 130), dy = clamp(this.dragStart.y - y, -140, 140)
    this.ball.vx = dx * 4.4; this.ball.vy = dy * 4.4; if (Math.abs(this.ball.vy) < 180) this.ball.vy = -520
    this.ball.flying = true; this.dragStart = null; this.dragPoint = null; this.options.onImpact('tap')
  }
  autopilot() { if (!this.ball.flying) { const dx = (this.ball.x - this.hoop.x) * .25; this.pointerDown(this.ball.x, this.ball.y); this.pointerUp(this.ball.x + dx, this.ball.y + 130) } }
  tick(dt: number) {
    if (this.options.preview) { this.autoClock += dt; if (this.autoClock > 1.15) { this.autoClock = 0; this.autopilot() } }
    if (this.respawn > 0) {
      this.respawn -= dt
      if (this.respawn <= 0) { this.ball = { x: this.w * .5, y: this.h * .76, vx: 0, vy: 0, r: 19, flying: false }; this.hoop = { x: random(90, this.w - 90), y: random(this.h * .22, this.h * .38), passed: false, pulse: 0 }; this.bounces = 0 }
      return
    }
    if (!this.ball.flying) return
    const lastY = this.ball.y
    this.ball.vy += 740 * dt; this.ball.x += this.ball.vx * dt; this.ball.y += this.ball.vy * dt
    if (this.ball.x < this.ball.r || this.ball.x > this.w - this.ball.r) { this.ball.x = clamp(this.ball.x, this.ball.r, this.w - this.ball.r); this.ball.vx *= -.78; this.bounces++ }
    if (!this.hoop.passed && lastY < this.hoop.y && this.ball.y >= this.hoop.y && Math.abs(this.ball.x - this.hoop.x) < 47) {
      this.hoop.passed = true; this.hoop.pulse = 1; this.addScore(100 + this.bounces * 75)
      this.respawn = .42
    }
    this.hoop.pulse = Math.max(0, this.hoop.pulse - dt)
    if (this.ball.y > this.h + 50) this.finish()
  }
  render(ctx: CanvasRenderingContext2D) {
    this.paintBackdrop(ctx, '#f46236', '#2b1023')
    ctx.fillStyle = 'rgba(255,230,160,.13)'; for (let y = 100; y < this.h; y += 90) for (let x = 20; x < this.w; x += 54) ctx.fillRect(x, y, 32, 45)
    drawSideHoop(ctx, this.hoop.x, this.hoop.y, this.hoop.pulse, this.theme.accent)
    if (this.dragStart && this.dragPoint) {
      const dx = this.dragStart.x - this.dragPoint.x, dy = this.dragStart.y - this.dragPoint.y
      ctx.fillStyle = 'rgba(255,255,255,.55)'
      for (let i = 1; i < 6; i++) { const t = i * .11; const x = this.ball.x + dx * 4.4 * t; const y = this.ball.y + dy * 4.4 * t + 370 * t * t; ctx.beginPath(); ctx.arc(x, y, 4 - i * .35, 0, Math.PI * 2); ctx.fill() }
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(this.ball.x, this.ball.y); ctx.lineTo(this.dragPoint.x, this.dragPoint.y); ctx.stroke()
    }
    drawBasketball(ctx, this.ball.x, this.ball.y, this.ball.r, this.elapsed * 3, false)
    drawGameLabel(ctx, this.ball.flying ? 'FOLLOW THE ARC' : 'PULL • AIM • RELEASE', `${this.score} pts`, this.w, this.h)
  }
}

class LoopHoopsController extends BaseController {
  private ball = { x: 190, y: 530, vx: -105, vy: 0, r: 18 }
  private target = { side: -1, x: 62, y: 315 }
  private autoClock = 0
  private loops = 0
  reset() { this.ball = { x: this.w * .5, y: this.h * .62, vx: -115, vy: -40, r: 18 }; this.target = { side: -1, x: 62, y: random(this.h * .28, this.h * .52) }; this.loops = 0; this.autoClock = 0 }
  constructor(theme: GameTheme, options: ControllerOptions) { super(theme, options); this.reset() }
  pointerDown() { this.ball.vy = -390; this.ball.vx = this.target.side * (120 + Math.min(this.score * 6, 80)); this.options.onImpact('tap') }
  autopilot() { if (this.ball.y > this.target.y + 15 || this.ball.vy > 150) this.pointerDown() }
  tick(dt: number) {
    if (this.options.preview) { this.autoClock += dt; if (this.autoClock > .58) { this.autoClock = 0; this.autopilot() } }
    const prevY = this.ball.y; this.ball.vy += 760 * dt; this.ball.x += this.ball.vx * dt; this.ball.y += this.ball.vy * dt
    if (this.ball.x < -this.ball.r) { this.ball.x = this.w + this.ball.r; this.loops++ }
    if (this.ball.x > this.w + this.ball.r) { this.ball.x = -this.ball.r; this.loops++ }
    if (prevY < this.target.y && this.ball.y >= this.target.y && Math.abs(this.ball.x - this.target.x) < 50) {
      this.addScore(this.loops > 0 ? 2 : 1); this.loops = 0; this.target.side *= -1; this.target.x = this.target.side < 0 ? 62 : this.w - 62; this.target.y = random(this.h * .26, this.h * .52); this.ball.vx = this.target.side * 125
    }
    if (this.ball.y > this.h - 55 || this.ball.y < 25) this.finish()
  }
  render(ctx: CanvasRenderingContext2D) {
    this.paintBackdrop(ctx, '#0f91a0', '#042d3c')
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1
    for (let x = 24; x < this.w; x += 46) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.h); ctx.stroke() }
    drawSideHoop(ctx, this.target.x, this.target.y, .5, this.theme.accent)
    if (this.score >= 4) { ctx.strokeStyle = 'rgba(255,235,83,.35)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(this.ball.x - this.ball.vx * .12, this.ball.y - this.ball.vy * .05); ctx.lineTo(this.ball.x, this.ball.y); ctx.stroke() }
    drawBasketball(ctx, this.ball.x, this.ball.y, this.ball.r, this.elapsed * 4, this.score >= 4)
    drawGameLabel(ctx, this.target.side < 0 ? '◀ LEFT HOOP' : 'RIGHT HOOP ▶', `${this.score} loops`, this.w, this.h)
  }
}

type Vehicle = { lane: number; x: number; speed: number; width: number; color: string }
class CrossingRushController extends BaseController {
  private player = { col: 3, row: 1, drawCol: 3, drawRow: 1, hop: 0 }
  private vehicles: Vehicle[] = []
  private rows: ('grass' | 'road' | 'water')[] = []
  private moveClock = 0
  private cell = 54
  reset() {
    this.player = { col: 3, row: 1, drawCol: 3, drawRow: 1, hop: 0 }; this.moveClock = 0
    this.rows = Array.from({ length: 18 }, (_, i) => i < 3 || i % 6 === 0 ? 'grass' : i % 5 === 0 ? 'water' : 'road')
    this.vehicles = Array.from({ length: 18 }, (_, i) => ({ lane: 3 + i % 13, x: (i * 103) % 520 - 70, speed: (i % 2 ? 1 : -1) * random(65, 130), width: i % 3 ? 55 : 88, color: ['#ff695d', '#ffd951', '#5c8dff'][i % 3] }))
  }
  constructor(theme: GameTheme, options: ControllerOptions) { super(theme, options); this.reset() }
  swipe(dx: number, dy: number) {
    if (Math.abs(dx) > Math.abs(dy)) this.player.col = clamp(this.player.col + (dx > 0 ? 1 : -1), 0, 6)
    else this.player.row = Math.max(0, this.player.row + (dy < 0 ? 1 : -1))
    this.player.hop = 1; this.addScore(Math.max(0, this.player.row - this.score)); this.options.onImpact('tap')
  }
  pointerDown(x: number, y: number) { this.drag = { x, y } }
  private drag: Point | null = null
  pointerUp(x: number, y: number) { if (this.drag) { this.swipe(x - this.drag.x, y - this.drag.y); this.drag = null } }
  autopilot() { const r = Math.random(); this.swipe(r < .7 ? 0 : r < .85 ? -50 : 50, r < .7 ? -70 : 0) }
  tick(dt: number) {
    this.moveClock += dt; if (this.options.preview && this.moveClock > .72) { this.moveClock = 0; this.autopilot() }
    this.player.drawCol += (this.player.col - this.player.drawCol) * Math.min(1, dt * 14); this.player.drawRow += (this.player.row - this.player.drawRow) * Math.min(1, dt * 14); this.player.hop = Math.max(0, this.player.hop - dt * 4)
    for (const car of this.vehicles) { car.x += car.speed * dt; if (car.x > this.w + 100) car.x = -120; if (car.x < -130) car.x = this.w + 110 }
    const car = this.vehicles.find((v) => v.lane === this.player.row && Math.abs(v.x + v.width / 2 - (this.player.col + .5) * this.cell) < v.width / 2 + 17)
    if (car) this.finish()
    const rowType = this.rows[this.player.row % this.rows.length]
    if (rowType === 'water' && this.player.hop < .1) this.finish()
  }
  render(ctx: CanvasRenderingContext2D) {
    const visibleRows = Math.ceil(this.h / this.cell) + 2, camera = Math.max(0, this.player.drawRow - 3)
    ctx.fillStyle = '#6ba837'; ctx.fillRect(0, 0, this.w, this.h)
    for (let i = 0; i < visibleRows; i++) {
      const worldRow = Math.floor(camera) + i; const y = this.h - (worldRow - camera + 1) * this.cell; const type = this.rows[worldRow % this.rows.length]
      ctx.fillStyle = type === 'grass' ? (worldRow % 2 ? '#75b946' : '#83c94b') : type === 'road' ? '#3c4148' : '#2784a6'; ctx.fillRect(0, y, this.w, this.cell + 1)
      if (type === 'road') { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([16, 18]); ctx.beginPath(); ctx.moveTo(0, y + this.cell / 2); ctx.lineTo(this.w, y + this.cell / 2); ctx.stroke(); ctx.setLineDash([]) }
      if (type === 'grass' && worldRow % 4 === 0) { ctx.fillStyle = '#3e7b35'; ctx.beginPath(); ctx.arc(28 + (worldRow * 31) % (this.w - 56), y + 25, 12, 0, Math.PI * 2); ctx.fill() }
    }
    for (const car of this.vehicles) { const y = this.h - (car.lane - camera + 1) * this.cell + 8; if (y < -60 || y > this.h) continue; ctx.fillStyle = car.color; roundedRect(ctx, car.x, y, car.width, 38, 10); ctx.fill(); ctx.fillStyle = '#172033'; ctx.fillRect(car.x + 10, y + 7, car.width - 20, 12) }
    const px = (this.player.drawCol + .5) * this.cell, py = this.h - (this.player.drawRow - camera + .55) * this.cell - Math.sin(this.player.hop * Math.PI) * 16
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(px, py, 17, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#273b2a'; ctx.fillRect(px - 12, py - 3, 24, 17); ctx.fillStyle = '#fff'; ctx.fillRect(px - 9, py - 7, 6, 7); ctx.fillRect(px + 3, py - 7, 6, 7)
    drawGameLabel(ctx, 'SWIPE TO HOP', `${this.score}m`, this.w, this.h)
  }
}

const MAZE = [
  '1111111111', '1000000001', '1011011101', '1001000101', '1101010101', '1000010101', '1011110101', '1010000101', '1010111101', '1000000001', '1110110101', '1000100001', '1011101101', '1000000001', '1111111111',
]
class NeonEscapeController extends BaseController {
  private player = { col: 1, row: 13, x: 1, y: 13, tx: 1, ty: 13, moving: false }
  private monster = { x: 8, y: 1, phase: 0 }
  private coins = new Set(['3,13', '8,11', '5,9', '2,5', '7,3'])
  private drag: Point | null = null
  private autoClock = 0
  reset() { this.player = { col: 1, row: 13, x: 1, y: 13, tx: 1, ty: 13, moving: false }; this.monster = { x: 8, y: 1, phase: 0 }; this.coins = new Set(['3,13', '8,11', '5,9', '2,5', '7,3']); this.autoClock = 0 }
  constructor(theme: GameTheme, options: ControllerOptions) { super(theme, options); this.reset() }
  pointerDown(x: number, y: number) { this.drag = { x, y } }
  pointerUp(x: number, y: number) { if (this.drag) { this.swipe(x - this.drag.x, y - this.drag.y); this.drag = null } }
  swipe(dx: number, dy: number) {
    if (this.player.moving) return
    let sx = 0, sy = 0; if (Math.abs(dx) > Math.abs(dy)) sx = dx > 0 ? 1 : -1; else sy = dy > 0 ? 1 : -1
    let c = this.player.col, r = this.player.row
    while (MAZE[r + sy]?.[c + sx] === '0') { c += sx; r += sy }
    if (c !== this.player.col || r !== this.player.row) { this.player.tx = c; this.player.ty = r; this.player.moving = true; this.options.onImpact('tap') }
  }
  autopilot() { const dirs = [[70, 0], [-70, 0], [0, 70], [0, -70]].sort(() => Math.random() - .5); for (const [x, y] of dirs) { const before = `${this.player.tx},${this.player.ty}`; this.swipe(x, y); if (`${this.player.tx},${this.player.ty}` !== before) break } }
  tick(dt: number) {
    this.autoClock += dt; if (this.options.preview && this.autoClock > 1) { this.autoClock = 0; this.autopilot() }
    const speed = dt * 11; this.player.x += (this.player.tx - this.player.x) * Math.min(1, speed); this.player.y += (this.player.ty - this.player.y) * Math.min(1, speed)
    if (Math.hypot(this.player.tx - this.player.x, this.player.ty - this.player.y) < .025) {
      this.player.x = this.player.tx; this.player.y = this.player.ty; this.player.col = this.player.tx; this.player.row = this.player.ty; this.player.moving = false
      const key = `${this.player.col},${this.player.row}`; if (this.coins.delete(key)) this.addScore(10)
    }
    this.monster.phase += dt; this.monster.x = 7.5 + Math.sin(this.monster.phase * 1.25) * 1.1
    if (Math.hypot(this.player.x - this.monster.x, this.player.y - this.monster.y) < .55) this.finish()
    if (!this.options.preview && Math.floor(this.elapsed) > this.score / 10) this.setScore(Math.floor(this.elapsed) * 10 + (5 - this.coins.size) * 10)
  }
  render(ctx: CanvasRenderingContext2D) {
    this.paintBackdrop(ctx, '#080519', '#120829')
    const cell = Math.min(this.w / 10, (this.h - 150) / 15), ox = (this.w - cell * 10) / 2, oy = 74
    ctx.shadowBlur = 12; ctx.shadowColor = '#5538ff'
    for (let r = 0; r < MAZE.length; r++) for (let c = 0; c < 10; c++) if (MAZE[r][c] === '1') { ctx.fillStyle = '#24145c'; ctx.fillRect(ox + c * cell + 2, oy + r * cell + 2, cell - 4, cell - 4); ctx.strokeStyle = '#5c42e8'; ctx.strokeRect(ox + c * cell + 3, oy + r * cell + 3, cell - 6, cell - 6) }
    ctx.shadowBlur = 18; for (const key of this.coins) { const [c, r] = key.split(',').map(Number); ctx.fillStyle = '#ffe45f'; ctx.shadowColor = '#ffe45f'; ctx.beginPath(); ctx.arc(ox + (c + .5) * cell, oy + (r + .5) * cell, 6, 0, Math.PI * 2); ctx.fill() }
    const px = ox + (this.player.x + .5) * cell, py = oy + (this.player.y + .5) * cell; ctx.fillStyle = '#45ffe0'; ctx.shadowColor = '#45ffe0'; ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ff3ca6'; ctx.shadowColor = '#ff3ca6'; ctx.beginPath(); ctx.arc(ox + (this.monster.x + .5) * cell, oy + (this.monster.y + .5) * cell, 11, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
    drawGameLabel(ctx, 'SWIPE • SLIDE • SURVIVE', `${this.score} NEON`, this.w, this.h)
  }
}

type StackBlock = { x: number; y: number; width: number; color: string }
class PerfectStackController extends BaseController {
  private blocks: StackBlock[] = []
  private current = { x: 0, y: 0, width: 220, dir: 1, speed: 150 }
  private fragment: (StackBlock & { vy: number; rotation: number }) | null = null
  private perfect = 0
  private autoClock = 0
  reset() { this.blocks = [{ x: this.w / 2 - 110, y: this.h - 130, width: 220, color: '#fff1a8' }]; this.current = { x: 0, y: this.h - 176, width: 220, dir: 1, speed: 145 }; this.fragment = null; this.perfect = 0; this.autoClock = 0 }
  constructor(theme: GameTheme, options: ControllerOptions) { super(theme, options); this.reset() }
  pointerDown() {
    const base = this.blocks[this.blocks.length - 1], left = Math.max(this.current.x, base.x), right = Math.min(this.current.x + this.current.width, base.x + base.width), overlap = right - left
    if (overlap <= 0) { this.finish(); return }
    const diff = this.current.x - base.x, perfect = Math.abs(diff) <= base.width * .04
    const placedWidth = perfect ? Math.min(220, base.width + (this.perfect >= 1 ? 7 : 0)) : overlap, placedX = perfect ? base.x - Math.max(0, placedWidth - base.width) / 2 : left
    if (!perfect && Math.abs(diff) > 2) { const cutX = diff > 0 ? base.x + base.width : this.current.x; this.fragment = { x: cutX, y: this.current.y, width: this.current.width - overlap, color: this.color(), vy: 0, rotation: 0 } }
    this.perfect = perfect ? this.perfect + 1 : 0; this.blocks.push({ x: placedX, y: this.current.y, width: placedWidth, color: this.color() }); this.addScore(1)
    if (perfect) this.options.onImpact('perfect')
    this.current = { x: this.score % 2 ? 0 : this.w - placedWidth, y: this.current.y - 46, width: placedWidth, dir: this.score % 2 ? 1 : -1, speed: Math.min(270, 145 + this.score * 9) }
  }
  private color() { return `hsl(${235 + this.score * 13}, 82%, 72%)` }
  autopilot() { const base = this.blocks[this.blocks.length - 1]; if (Math.abs(this.current.x - base.x) < 12) this.pointerDown() }
  tick(dt: number) {
    this.current.x += this.current.speed * this.current.dir * dt; if (this.current.x < -20 || this.current.x + this.current.width > this.w + 20) this.current.dir *= -1
    if (this.fragment) { this.fragment.vy += 700 * dt; this.fragment.y += this.fragment.vy * dt; this.fragment.rotation += dt * 2; if (this.fragment.y > this.h + 100) this.fragment = null }
    if (this.options.preview) { this.autoClock += dt; if (this.autoClock > .2) { this.autoClock = 0; this.autopilot() } }
  }
  render(ctx: CanvasRenderingContext2D) {
    const hue = 225 + Math.min(80, this.score * 5), gradient = ctx.createLinearGradient(0, 0, 0, this.h); gradient.addColorStop(0, `hsl(${hue},75%,72%)`); gradient.addColorStop(1, '#313475'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.w, this.h)
    ctx.fillStyle = 'rgba(255,255,255,.22)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse((i * 91 + 30) % this.w, 120 + (i % 3) * 110, 55, 18, 0, 0, Math.PI * 2); ctx.fill() }
    const camera = Math.max(0, this.blocks.length * 46 - (this.h - 260))
    const drawBlock = (b: StackBlock) => { const y = b.y + camera; ctx.fillStyle = b.color; ctx.shadowColor = 'rgba(20,20,70,.25)'; ctx.shadowBlur = 16; roundedRect(ctx, b.x, y, b.width, 40, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.26)'; ctx.fillRect(b.x + 5, y + 4, b.width - 10, 5); ctx.shadowBlur = 0 }
    this.blocks.forEach(drawBlock); drawBlock({ x: this.current.x, y: this.current.y, width: this.current.width, color: '#ffda72' })
    if (this.fragment) { ctx.save(); ctx.translate(this.fragment.x + this.fragment.width / 2, this.fragment.y + camera); ctx.rotate(this.fragment.rotation); drawBlock({ ...this.fragment, x: -this.fragment.width / 2, y: -20 }); ctx.restore() }
    if (this.perfect > 0) { ctx.font = '800 26px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff8c9'; ctx.fillText(`PERFECT ×${this.perfect}`, this.w / 2, 140) }
    drawGameLabel(ctx, 'TAP TO DROP', `${this.score} floors`, this.w, this.h)
  }
}

class PinCoreController extends BaseController {
  private rotation = 0
  private speed = 1.1
  private pins: number[] = []
  private shot = 0
  private autoClock = 0
  reset() { this.rotation = 0; this.speed = 1.15; this.pins = [Math.PI * .45, Math.PI * 1.55]; this.shot = 0; this.autoClock = 0 }
  constructor(theme: GameTheme, options: ControllerOptions) { super(theme, options); this.reset() }
  pointerDown() {
    if (this.shot > 0) return
    const incoming = Math.PI / 2 - this.rotation
    const minGap = this.pins.length ? Math.min(...this.pins.map((p) => Math.abs(Math.atan2(Math.sin(p - incoming), Math.cos(p - incoming))))) : Math.PI
    if (minGap < .24) { this.shot = .01; setTimeout(() => this.finish(), 150); return }
    this.pins.push(incoming); this.shot = .01; this.addScore(1); if (minGap < .42) this.options.onImpact('perfect'); this.speed = (1.1 + this.score * .055) * (Math.floor(this.score / 7) % 2 ? -1 : 1)
  }
  autopilot() { const incoming = Math.PI / 2 - this.rotation; const gap = Math.min(...this.pins.map((p) => Math.abs(Math.atan2(Math.sin(p - incoming), Math.cos(p - incoming))))); if (gap > .5) this.pointerDown() }
  tick(dt: number) { this.rotation += this.speed * dt; this.shot = Math.max(0, this.shot - dt * 2.6); if (this.options.preview) { this.autoClock += dt; if (this.autoClock > .22) { this.autoClock = 0; this.autopilot() } } }
  render(ctx: CanvasRenderingContext2D) {
    this.paintBackdrop(ctx, '#24262b', '#08090b')
    const cx = this.w / 2, cy = this.h * .41, radius = Math.min(this.w * .24, 92)
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.rotation)
    for (const angle of this.pins) { ctx.save(); ctx.rotate(angle); ctx.strokeStyle = '#f5f2dc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(radius - 4, 0); ctx.lineTo(radius + 72, 0); ctx.stroke(); ctx.fillStyle = this.theme.accent; ctx.beginPath(); ctx.arc(radius + 76, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
    ctx.fillStyle = '#f7e744'; ctx.shadowColor = '#f7e744'; ctx.shadowBlur = 25; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#15161a'; ctx.font = '900 34px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.max(0, 12 - this.score % 12)), 0, 0); ctx.restore(); ctx.shadowBlur = 0
    const launchY = this.h - 150 - this.shot * 500; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, launchY + 55); ctx.lineTo(cx, launchY); ctx.stroke(); ctx.fillStyle = this.theme.accent; ctx.beginPath(); ctx.arc(cx, launchY + 60, 9, 0, Math.PI * 2); ctx.fill()
    drawGameLabel(ctx, 'TAP THE GAP', `${this.score} pins`, this.w, this.h)
  }
}

class PocketGolfController extends BaseController {
  private ball = { x: 195, y: 690, vx: 0, vy: 0, r: 11 }
  private hole = { x: 210, y: 190, r: 17 }
  private dragStart: Point | null = null
  private dragPoint: Point | null = null
  private strokes = 0
  private autoClock = 0
  reset() { this.ball = { x: this.w * .5, y: this.h * .78, vx: 0, vy: 0, r: 11 }; this.hole = { x: random(80, this.w - 80), y: random(145, this.h * .33), r: 17 }; this.dragStart = null; this.dragPoint = null; this.strokes = 0; this.autoClock = 0 }
  constructor(theme: GameTheme, options: ControllerOptions) { super(theme, options); this.reset() }
  pointerDown(x: number, y: number) { if (Math.hypot(this.ball.vx, this.ball.vy) < 8) { this.dragStart = { x: this.ball.x, y: this.ball.y }; this.dragPoint = { x, y } } }
  pointerMove(x: number, y: number) { if (this.dragStart) this.dragPoint = { x, y } }
  pointerUp(x: number, y: number) { if (!this.dragStart) return; const dx = clamp(this.dragStart.x - x, -150, 150), dy = clamp(this.dragStart.y - y, -150, 150); this.ball.vx = dx * 3.5; this.ball.vy = dy * 3.5; this.strokes++; this.dragStart = null; this.dragPoint = null; this.options.onImpact('tap') }
  autopilot() { if (Math.hypot(this.ball.vx, this.ball.vy) < 5) { const dx = (this.ball.x - this.hole.x) * .35, dy = (this.ball.y - this.hole.y) * .24; this.pointerDown(this.ball.x, this.ball.y); this.pointerUp(this.ball.x + dx, this.ball.y + dy) } }
  tick(dt: number) {
    this.ball.x += this.ball.vx * dt; this.ball.y += this.ball.vy * dt; const drag = Math.pow(.22, dt); this.ball.vx *= drag; this.ball.vy *= drag
    if (this.ball.x < 24 || this.ball.x > this.w - 24) { this.ball.x = clamp(this.ball.x, 24, this.w - 24); this.ball.vx *= -.72 }
    if (this.ball.y < 85 || this.ball.y > this.h - 80) { this.ball.y = clamp(this.ball.y, 85, this.h - 80); this.ball.vy *= -.72 }
    if (distance(this.ball, this.hole) < this.hole.r && Math.hypot(this.ball.vx, this.ball.vy) < 180) { this.addScore(1); this.ball = { x: this.w * .5, y: this.h * .78, vx: 0, vy: 0, r: 11 }; this.hole = { x: random(75, this.w - 75), y: random(140, this.h * .34), r: 17 }; this.strokes = 0 }
    if (this.options.preview) { this.autoClock += dt; if (this.autoClock > 1.6) { this.autoClock = 0; this.autopilot() } }
  }
  render(ctx: CanvasRenderingContext2D) {
    this.paintBackdrop(ctx, '#67bd78', '#27613f')
    ctx.fillStyle = '#7cca86'; roundedRect(ctx, 30, 78, this.w - 60, this.h - 150, 48); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 3; ctx.stroke()
    ctx.fillStyle = '#d3b46a'; ctx.beginPath(); ctx.ellipse(this.w * .25, this.h * .42, 48, 67, -.2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#195839'; ctx.beginPath(); ctx.ellipse(this.hole.x, this.hole.y, this.hole.r, this.hole.r * .45, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(this.hole.x, this.hole.y); ctx.lineTo(this.hole.x, this.hole.y - 72); ctx.stroke(); ctx.fillStyle = '#ff625b'; ctx.beginPath(); ctx.moveTo(this.hole.x, this.hole.y - 72); ctx.lineTo(this.hole.x + 38, this.hole.y - 58); ctx.lineTo(this.hole.x, this.hole.y - 46); ctx.fill()
    if (this.dragStart && this.dragPoint) { const dx = this.dragStart.x - this.dragPoint.x, dy = this.dragStart.y - this.dragPoint.y; ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(this.ball.x, this.ball.y); ctx.lineTo(this.ball.x + dx * 1.6, this.ball.y + dy * 1.6); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,242,122,.8)'; roundedRect(ctx, 45, this.h - 110, clamp(Math.hypot(dx, dy), 0, 150) / 150 * (this.w - 90), 9, 5); ctx.fill() }
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
    drawGameLabel(ctx, 'PULL • AIM • RELEASE', `${this.score} holes  ·  ${this.strokes} shots`, this.w, this.h)
  }
}

const drawBasketball = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rotation: number, fire: boolean) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); if (fire) { ctx.shadowColor = '#ffdb39'; ctx.shadowBlur = 28 }
  const gradient = ctx.createRadialGradient(-r * .3, -r * .35, 2, 0, 0, r); gradient.addColorStop(0, '#ffb340'); gradient.addColorStop(1, '#df5224'); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#6f271f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.bezierCurveTo(-r * .55, -r * .2, -r * .55, r * .2, 0, r); ctx.moveTo(0, -r); ctx.bezierCurveTo(r * .55, -r * .2, r * .55, r * .2, 0, r); ctx.stroke(); ctx.restore()
}

const drawSideHoop = (ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number, accent: string) => {
  ctx.save(); if (pulse > 0) { ctx.shadowColor = accent; ctx.shadowBlur = 28 }
  ctx.strokeStyle = '#ff563b'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x - 48, y); ctx.lineTo(x + 48, y); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2
  for (let i = -36; i < 40; i += 14) { ctx.beginPath(); ctx.moveTo(x + i, y + 3); ctx.lineTo(x + i * .55, y + 43); ctx.stroke() }
  ctx.restore()
}

const drawGameLabel = (ctx: CanvasRenderingContext2D, hint: string, metric: string, w: number, h: number) => {
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.76)'; ctx.font = '700 11px system-ui'; ctx.letterSpacing = '2px'; ctx.fillText(hint, w / 2, h - 108); ctx.fillStyle = '#fff'; ctx.font = '800 18px system-ui'; ctx.fillText(metric, w / 2, h - 80); ctx.restore()
}

export function createController(id: string, theme: GameTheme, options: ControllerOptions): GameController {
  switch (id) {
    case 'hoop-flight': return new HoopFlightController(theme, options)
    case 'dunk-climb': return new DunkClimbController(theme, options)
    case 'loop-hoops': return new LoopHoopsController(theme, options)
    case 'crossing-rush': return new CrossingRushController(theme, options)
    case 'neon-escape': return new NeonEscapeController(theme, options)
    case 'perfect-stack': return new PerfectStackController(theme, options)
    case 'pin-core': return new PinCoreController(theme, options)
    case 'pocket-golf': return new PocketGolfController(theme, options)
    default: throw new Error(`Unknown FlickPlay game: ${id}`)
  }
}
