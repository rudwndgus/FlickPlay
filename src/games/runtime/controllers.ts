import type { ControllerOptions, GameController, GameStatus, GameTheme } from '../types'
import { NeonVaultController } from './NeonVaultController'

type Point = { x: number; y: number }
const FIRE_STREAK = 3
const MAX_CLEAN_COMBO = 5
const MAX_PHYSICS_STEP = 1 / 120
const LOOP_RIM_HALF = 36
const LOOP_RIM_TUBE_RADIUS = 4
const LOOP_WRAP_TRAVEL_SPEED_LIMIT = 280
export const PIN_CORE_FLIGHT_SECONDS = .085
const PIN_CORE_MAX_RADIUS = 92
const PIN_CORE_RADIUS_RATIO = .24
const PIN_SHAFT_INSET = 4
const PIN_SHAFT_LENGTH = 72
const PIN_ATTACHED_SHAFT_WIDTH = 4
const PIN_FLYING_SHAFT_WIDTH = 5
const PIN_ATTACHED_HEAD_RADIUS = 8
const PIN_FLYING_HEAD_RADIUS = 9
const PIN_HITBOX_INSET = 1

export const getPinCoreVisibleHitAngle = (width: number) => {
  const coreRadius = Math.min(width * PIN_CORE_RADIUS_RATIO, PIN_CORE_MAX_RADIUS)
  const headCenterRadius = coreRadius + PIN_SHAFT_LENGTH + PIN_SHAFT_INSET
  const visibleHeadOverlap = PIN_ATTACHED_HEAD_RADIUS + PIN_FLYING_HEAD_RADIUS - PIN_HITBOX_INSET
  const visibleShaftOverlap = (PIN_ATTACHED_SHAFT_WIDTH + PIN_FLYING_SHAFT_WIDTH) / 2 - PIN_HITBOX_INSET
  const headAngle = 2 * Math.asin(visibleHeadOverlap / (2 * headCenterRadius))
  const shaftAngle = 2 * Math.asin(visibleShaftOverlap / (2 * (coreRadius - PIN_SHAFT_INSET)))
  return Math.max(headAngle, shaftAngle)
}

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
    this.tick(Math.min(dt, 1 / 30))
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

type Hoop = { x: number; y: number; passed: boolean; pulse: number; netSwing?: number; netVelocity?: number; netPunch?: number; rimTouched?: boolean }
type HoopScoreEffect = { x: number; y: number; life: number; label: string; clean: boolean; streak: number }
type LoopScoreEffect = { x: number; y: number; life: number; label: string; points: number; clean: boolean; streak: number }

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

  reset() {
    this.ball = { x: this.w * .27, y: this.h * .48, vx: 0, vy: 50, r: 20, rotation: -.15, kick: 0, collisionCooldown: 0 }
    this.speed = 138; this.autoClock = 0; this.cleanStreak = 0; this.scoreEffects = []; this.scoreFlash = 0; this.fireBurst = 0
    this.hoops = [0, 1, 2].map((i) => ({ x: this.w * .86 + i * 255, y: random(this.h * .3, this.h * .67), passed: false, pulse: 0, netSwing: 0, netVelocity: 0, netPunch: 0 }))
  }
  constructor(theme: GameTheme, options: ControllerOptions) {
    super(theme, options)
    this.hoopImage = new Image()
    this.hoopImage.src = `${import.meta.env.BASE_URL}games/hoop-flight/hoop-arcade.png`
    this.reset()
  }
  pointerDown() {
    if (this.status === 'finished') return
    this.ball.vy = -570
    this.ball.kick = 1
    this.ball.rotation -= .22
    this.options.onImpact('tap')
  }
  autopilot() { if (this.ball.y > this.h * .47 || this.ball.vy > 210) this.pointerDown() }
  tick(dt: number) {
    if (this.options.preview) { this.autoClock += dt; if (this.autoClock > .42) { this.autoClock = 0; this.autopilot() } }
    this.ball.kick = Math.max(0, this.ball.kick - dt * 7.5)
    this.scoreFlash = Math.max(0, this.scoreFlash - dt * 2.8)
    this.fireBurst = Math.max(0, this.fireBurst - dt * 1.45)
    this.scoreEffects.forEach((effect) => { effect.life -= dt; effect.x -= this.speed * dt })
    this.scoreEffects = this.scoreEffects.filter((effect) => effect.life > 0)
    this.ball.rotation += dt * (2.4 + Math.abs(this.ball.vy) * .002)
    this.speed = Math.min(235, 138 + this.elapsed * 1.65)

    const steps = Math.max(1, Math.ceil(dt / MAX_PHYSICS_STEP)), step = dt / steps
    for (let index = 0; index < steps && this.status !== 'finished'; index++) this.stepPhysics(step)
    if (this.status === 'finished') return

    const last = this.hoops[this.hoops.length - 1]
    if (last.x < this.w - 180) this.hoops.push({ x: last.x + random(220, 295), y: random(this.h * .25, this.h * .68), passed: false, pulse: 0, netSwing: 0, netVelocity: 0, netPunch: 0 })
    this.hoops = this.hoops.filter((hoop) => hoop.x > -100)
  }
  private stepPhysics(dt: number) {
    const previous = { x: this.ball.x, y: this.ball.y }
    this.ball.collisionCooldown = Math.max(0, this.ball.collisionCooldown - dt)
    this.ball.vy = Math.min(760, this.ball.vy + 1850 * dt)
    const anchorX = this.w * .27
    const horizontalAcceleration = (anchorX - this.ball.x) * 20 - this.ball.vx * 9
    this.ball.vx = clamp(this.ball.vx + horizontalAcceleration * dt, -520, 360)
    this.ball.x += this.ball.vx * dt
    this.ball.y += this.ball.vy * dt

    let missedHoop = false
    for (const hoop of this.hoops) {
      const previousHoopX = hoop.x
      hoop.x -= this.speed * dt; hoop.pulse = Math.max(0, hoop.pulse - dt)
      hoop.netVelocity = (hoop.netVelocity ?? 0) - (hoop.netSwing ?? 0) * 48 * dt
      hoop.netVelocity *= Math.pow(.018, dt)
      hoop.netSwing = (hoop.netSwing ?? 0) + hoop.netVelocity * dt
      hoop.netPunch = Math.max(0, (hoop.netPunch ?? 0) - dt * 2.7)
      const metrics = this.getHoopMetrics(hoop)
      this.collideWithHoop(metrics)
      const travelY = this.ball.y - previous.y
      const crossedRimPlane = travelY > 0 && previous.y <= hoop.y && this.ball.y > hoop.y
      const crossingTime = crossedRimPlane ? clamp((hoop.y - previous.y) / travelY, 0, 1) : 0
      const crossingBallX = previous.x + (this.ball.x - previous.x) * crossingTime
      const crossingHoopX = previousHoopX + (hoop.x - previousHoopX) * crossingTime
      const insideOpening = Math.abs(crossingBallX - crossingHoopX) < metrics.rimHalf - this.ball.r * .25
      if (!hoop.passed && insideOpening && crossedRimPlane && this.ball.vy > 0) {
        hoop.passed = true; hoop.pulse = 1
        const clean = !hoop.rimTouched && Math.abs(this.ball.x - hoop.x) < metrics.rimHalf * .42
        this.cleanStreak = clean ? this.cleanStreak + 1 : 0
        const points = clean ? Math.min(MAX_CLEAN_COMBO, this.cleanStreak) : 1
        const label = clean ? (this.cleanStreak >= FIRE_STREAK ? `FIRE ×${this.cleanStreak}  +${points}` : this.cleanStreak === 2 ? 'PERFECT ×2  +2' : 'CLEAN!  +1') : 'SWISH!  +1'
        this.setScore(this.score + points)
        this.options.onImpact(clean ? 'perfect' : 'score')
        hoop.netVelocity = clamp((this.ball.x - hoop.x) * 5.5 + 175, -220, 220)
        hoop.netPunch = 1
        this.ball.kick = Math.max(this.ball.kick, .72)
        this.scoreEffects.push({ x: hoop.x, y: hoop.y, life: 1, label, clean, streak: this.cleanStreak })
        this.scoreFlash = clean ? .9 : .58
        if (this.cleanStreak >= FIRE_STREAK) this.fireBurst = 1
      } else if (!hoop.passed && hoop.x + metrics.rimHalf < this.ball.x - this.ball.r) {
        missedHoop = true
        break
      }
      const insideNet = Math.abs(this.ball.x - hoop.x) < metrics.rimHalf - this.ball.r * .25
      if (hoop.passed && insideNet && this.ball.y > hoop.y + 5 && this.ball.y < hoop.y + metrics.height * .68) {
        this.ball.vx *= Math.pow(.72, dt)
        this.ball.vy *= Math.pow(.88, dt)
      }
    }
    if (missedHoop) { this.finish(); return }
    if (this.ball.y > this.h - 75 || this.ball.x + this.ball.r < 0) this.finish()
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
    ctx.save(); ctx.translate(this.ball.x, this.ball.y); ctx.scale(1 + this.ball.kick * .16, 1 - this.ball.kick * .1); drawBasketball(ctx, 0, 0, this.ball.r, this.ball.rotation, this.cleanStreak >= FIRE_STREAK); ctx.restore()
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
    const width = Math.min(128, this.w * .32)
    const height = width
    const left = hoop.x - width * .5
    const top = hoop.y - height * .28
    return { hoop, width, height, left, top, rimHalf: width * .36 }
  }
  private collideWithHoop(metrics: ReturnType<HoopFlightController['getHoopMetrics']>) {
    const canRegisterImpact = this.ball.collisionCooldown <= 0
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
        const bounce = (canRegisterImpact ? 1.68 : 1.15) * alongNormal
        this.ball.vx = relativeX - bounce * nx - this.speed
        this.ball.vy -= bounce * ny
      }
      const relativeSpeed = Math.hypot(this.ball.vx + this.speed, this.ball.vy)
      if (relativeSpeed > 780) {
        const scale = 780 / relativeSpeed
        this.ball.vx = (this.ball.vx + this.speed) * scale - this.speed
        this.ball.vy *= scale
      }
      metrics.hoop.rimTouched = true
      this.cleanStreak = 0
      if (canRegisterImpact) this.registerHoopImpact(metrics.hoop)
      return
    }
  }
  private registerHoopImpact(hoop: Hoop) {
    hoop.rimTouched = true
    this.cleanStreak = 0
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
      const sourceHeight = this.hoopImage.naturalHeight * .39
      ctx.drawImage(this.hoopImage, 0, 0, this.hoopImage.naturalWidth, sourceHeight, left, top, width, height * .39)
    } else {
      const rimSourceY = this.hoopImage.naturalHeight * .27
      const netSourceY = this.hoopImage.naturalHeight * .39
      const rimSourceHeight = netSourceY - rimSourceY
      ctx.drawImage(this.hoopImage, 0, rimSourceY, this.hoopImage.naturalWidth, rimSourceHeight, left, top + height * .27, width, height * .12)
      ctx.translate(hoop.x, hoop.y)
      const punch = hoop.netPunch ?? 0
      const stretch = 1 + Math.sin((1 - punch) * Math.PI * 4 + .7) * punch * .18
      ctx.transform(1, 0, (hoop.netSwing ?? 0) / Math.max(1, height), stretch, 0, 0)
      ctx.translate(-hoop.x, -hoop.y)
      ctx.drawImage(this.hoopImage, 0, netSourceY, this.hoopImage.naturalWidth, this.hoopImage.naturalHeight - netSourceY, left, top + height * .39, width, height * .61)
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
  private ball = { x: 190, y: 660, vx: 0, vy: 0, r: 19, flying: false, rotation: 0, collisionCooldown: 0 }
  private launchHoop: Hoop = { x: 190, y: 650, passed: true, pulse: 0, netSwing: 0, netPunch: 0 }
  private targetHoop: Hoop = { x: 220, y: 290, passed: false, pulse: 0, netSwing: 0, netPunch: 0 }
  private dragStart: Point | null = null
  private dragPoint: Point | null = null
  private wallBounces = 0
  private rimHits = 0
  private autoClock = 0
  private transitionDelay = 0
  private rescueDelay = 0
  private climbRemaining = 0
  private cleanStreak = 0
  private trail: Array<Point & { life: number }> = []
  private scoreEffect = 0
  private scoreLabel = 'SWISH  +1'
  private lastShotPoints = 1
  private rescueEffect = 0
  private launchRimArmed = false
  private readonly hoopImage: HTMLImageElement
  private readonly gravity = 900
  private readonly shotPower = 6.8

  reset() {
    const launchY = this.h * .74
    this.launchHoop = { x: this.w * .5, y: launchY, passed: true, pulse: 0, netSwing: 0, netPunch: 0 }
    this.targetHoop = this.createTarget(launchY - this.h * .27)
    this.ball = { x: this.launchHoop.x, y: this.launchHoop.y - 14, vx: 0, vy: 0, r: 19, flying: false, rotation: 0, collisionCooldown: 0 }
    this.dragStart = null; this.dragPoint = null; this.wallBounces = 0; this.rimHits = 0; this.autoClock = 0
    this.transitionDelay = 0; this.rescueDelay = 0; this.climbRemaining = 0; this.cleanStreak = 0; this.trail = []; this.scoreEffect = 0; this.scoreLabel = 'SWISH  +1'; this.lastShotPoints = 1; this.rescueEffect = 0; this.launchRimArmed = false
  }
  constructor(theme: GameTheme, options: ControllerOptions) {
    super(theme, options)
    this.hoopImage = new Image()
    this.hoopImage.src = `${import.meta.env.BASE_URL}games/dunk-climb/hoop.png`
    this.reset()
  }
  pointerDown(x: number, y: number) {
    if (!this.ball.flying && this.transitionDelay <= 0 && this.rescueDelay <= 0 && this.climbRemaining <= 0 && distance({ x, y }, this.ball) < 90) {
      this.dragStart = { x: this.launchHoop.x, y: this.launchHoop.y - 14 }
      this.dragPoint = { x: this.ball.x, y: this.ball.y }
    }
  }
  pointerMove(x: number, y: number) {
    if (!this.dragStart) return
    const dx = x - this.dragStart.x, dy = y - this.dragStart.y
    const length = Math.hypot(dx, dy), scale = length > 150 ? 150 / length : 1
    this.dragPoint = { x: this.dragStart.x + dx * scale, y: this.dragStart.y + dy * scale }
    this.ball.x = this.dragPoint.x; this.ball.y = this.dragPoint.y
  }
  pointerUp(x: number, y: number) {
    if (!this.dragStart) return
    this.pointerMove(x, y)
    const release = this.dragPoint ?? this.dragStart
    const dx = this.dragStart.x - release.x, dy = this.dragStart.y - release.y
    if (Math.hypot(dx, dy) < 18) {
      this.ball.x = this.dragStart.x; this.ball.y = this.dragStart.y
      this.dragStart = null; this.dragPoint = null
      return
    }
    this.ball.vx = dx * this.shotPower; this.ball.vy = dy * this.shotPower
    this.ball.flying = true; this.ball.collisionCooldown = .08; this.launchRimArmed = false
    this.wallBounces = 0; this.rimHits = 0
    this.launchHoop.netPunch = 1; this.launchHoop.netSwing = clamp(-dx * .38, -28, 28)
    this.dragStart = null; this.dragPoint = null; this.trail = []; this.options.onImpact('tap')
  }
  autopilot() {
    if (this.ball.flying || this.transitionDelay > 0 || this.rescueDelay > 0 || this.climbRemaining > 0) return
    const anchor = { x: this.launchHoop.x, y: this.launchHoop.y - 14 }
    const pullX = clamp((anchor.x - this.targetHoop.x) / 9.1, -48, 48)
    this.pointerDown(anchor.x, anchor.y); this.pointerMove(anchor.x + pullX, anchor.y + 118); this.pointerUp(anchor.x + pullX, anchor.y + 118)
  }
  tick(dt: number) {
    if (this.options.preview) { this.autoClock += dt; if (this.autoClock > 1.35) { this.autoClock = 0; this.autopilot() } }
    this.scoreEffect = Math.max(0, this.scoreEffect - dt * 1.7)
    this.rescueEffect = Math.max(0, this.rescueEffect - dt * 1.35)
    this.ball.collisionCooldown = Math.max(0, this.ball.collisionCooldown - dt)
    for (const hoop of [this.launchHoop, this.targetHoop]) {
      hoop.pulse = Math.max(0, hoop.pulse - dt * 2.2)
      hoop.netPunch = Math.max(0, (hoop.netPunch ?? 0) - dt * 2.8)
      hoop.netSwing = (hoop.netSwing ?? 0) * Math.pow(.045, dt)
    }
    this.trail.forEach((point) => { point.life -= dt }); this.trail = this.trail.filter((point) => point.life > 0)
    if (this.rescueDelay > 0) {
      this.rescueDelay -= dt
      this.ball.x += (this.launchHoop.x - this.ball.x) * Math.min(1, dt * 14)
      this.ball.y += (this.launchHoop.y + 20 - this.ball.y) * Math.min(1, dt * 12)
      this.ball.rotation += dt * 3
      if (this.rescueDelay <= 0) {
        this.ball.x = this.launchHoop.x; this.ball.y = this.launchHoop.y - 14
        this.ball.vx = 0; this.ball.vy = 0; this.ball.flying = false; this.wallBounces = 0; this.rimHits = 0; this.trail = []; this.launchRimArmed = false
      }
      return
    }
    if (this.transitionDelay > 0) {
      this.transitionDelay -= dt
      this.ball.x += (this.targetHoop.x - this.ball.x) * Math.min(1, dt * 13)
      this.ball.y += (this.targetHoop.y + 27 - this.ball.y) * Math.min(1, dt * 10)
      this.ball.rotation += dt * 4
      if (this.transitionDelay <= 0) this.climbRemaining = this.h * .27
      return
    }
    if (this.climbRemaining > 0) {
      const step = Math.min(this.climbRemaining, Math.max(5, this.climbRemaining * 8 * dt))
      this.launchHoop.y += step; this.targetHoop.y += step; this.ball.y += step; this.climbRemaining -= step
      if (this.climbRemaining <= .5) this.completeClimb()
      return
    }
    if (!this.ball.flying) return
    const lastPoint = { x: this.ball.x, y: this.ball.y }
    this.ball.vy += this.gravity * dt; this.ball.x += this.ball.vx * dt; this.ball.y += this.ball.vy * dt
    this.ball.rotation += dt * (4 + Math.abs(this.ball.vx) * .009)
    this.trail.unshift({ x: this.ball.x, y: this.ball.y, life: .38 }); if (this.trail.length > 14) this.trail.pop()
    if (this.ball.x < this.ball.r || this.ball.x > this.w - this.ball.r) {
      this.ball.x = clamp(this.ball.x, this.ball.r, this.w - this.ball.r); this.ball.vx *= -.76; this.wallBounces++; this.options.onImpact('tap')
    }
    const launchRim = this.getRimGeometry(this.launchHoop), targetRim = this.getRimGeometry(this.targetHoop)
    const launchClearance = this.signedRimDistance(this.ball, launchRim)
    if (!this.launchRimArmed && (launchClearance < -(this.ball.r + launchRim.tubeRadius + 2) || (this.ball.vy > 0 && launchClearance < 0))) this.launchRimArmed = true
    if (this.launchRimArmed && this.ball.vy > 0) this.collideWithRims(this.launchHoop, launchRim)
    this.collideWithRims(this.targetHoop, targetRim)
    const insideOpening = this.isInsideRimOpening(this.ball, targetRim)
    if (!this.targetHoop.passed && this.crossedRimPlane(lastPoint, this.ball, targetRim) && this.ball.vy > 0 && insideOpening) {
      this.targetHoop.passed = true; this.targetHoop.pulse = 1; this.targetHoop.netPunch = 1
      this.targetHoop.netSwing = clamp((this.ball.x - this.targetHoop.x) * .7, -18, 18)
      const clean = this.rimHits === 0
      const wallShot = this.wallBounces > 0
      this.cleanStreak = clean ? this.cleanStreak + 1 : 0
      const cleanBonus = clean ? Math.min(MAX_CLEAN_COMBO, this.cleanStreak) : 0
      const points = 1 + cleanBonus + (wallShot ? 1 : 0)
      this.lastShotPoints = points
      this.scoreLabel = clean && this.cleanStreak >= FIRE_STREAK
        ? `FIRE ×${this.cleanStreak}  +${points}`
        : wallShot && clean ? `WALL + CLEAN  +${points}` : wallShot ? 'BANK SHOT  +2' : clean ? `CLEAN ×${this.cleanStreak}  +${points}` : 'SWISH  +1'
      this.setScore(this.score + points); this.options.onImpact(points > 1 ? 'perfect' : 'score')
      this.scoreEffect = 1; this.transitionDelay = .34; this.ball.flying = false
    }
    const returnedToLaunch = this.launchRimArmed && !this.targetHoop.passed && this.crossedRimPlane(lastPoint, this.ball, launchRim) && this.ball.vy > 0 && this.isInsideRimOpening(this.ball, launchRim)
    if (returnedToLaunch) {
      this.launchHoop.netPunch = 1; this.launchHoop.netSwing = clamp((this.ball.x - this.launchHoop.x) * .7, -18, 18)
      this.ball.flying = false; this.rescueDelay = .38; this.rescueEffect = 1; this.options.onImpact('perfect')
    }
    if (this.ball.y > this.h + 50) this.finish()
  }
  render(ctx: CanvasRenderingContext2D) {
    this.paintBackdrop(ctx, '#f1f1f2', '#e5e5e7')
    ctx.fillStyle = 'rgba(105,105,112,.13)'; ctx.font = `900 ${Math.min(132, this.w * .29)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(this.score), this.w * .5, this.h * .43)
    ctx.fillStyle = 'rgba(80,80,86,.45)'; ctx.font = '900 17px system-ui'; ctx.fillText('DUNK CLIMB', this.w * .5, 62)
    this.drawHoopLayer(ctx, this.launchHoop, false); this.drawHoopLayer(ctx, this.targetHoop, false)
    if (this.dragStart && this.dragPoint) this.drawAimGuide(ctx)
    this.drawTrail(ctx); drawBasketball(ctx, this.ball.x, this.ball.y, this.ball.r, this.ball.rotation, this.cleanStreak >= FIRE_STREAK)
    this.drawHoopLayer(ctx, this.launchHoop, true); this.drawHoopLayer(ctx, this.targetHoop, true)
    if (this.scoreEffect > 0) this.drawScoreEffect(ctx)
    if (this.rescueEffect > 0) this.drawRescueEffect(ctx)
    if (!this.ball.flying && this.transitionDelay <= 0 && this.rescueDelay <= 0 && this.climbRemaining <= 0) {
      ctx.fillStyle = 'rgba(85,85,91,.64)'; ctx.font = '800 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('DRAG  •  AIM  •  RELEASE', this.w * .5, this.h - 42)
      ctx.strokeStyle = 'rgba(100,100,106,.28)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(this.launchHoop.x, this.launchHoop.y + 74); ctx.lineTo(this.launchHoop.x, this.launchHoop.y + 102); ctx.stroke(); ctx.beginPath(); ctx.moveTo(this.launchHoop.x - 7, this.launchHoop.y + 94); ctx.lineTo(this.launchHoop.x, this.launchHoop.y + 102); ctx.lineTo(this.launchHoop.x + 7, this.launchHoop.y + 94); ctx.stroke()
    }
  }
  private createTarget(y: number): Hoop { return { x: random(76, this.w - 76), y, passed: false, pulse: 0, netSwing: 0, netPunch: 0 } }
  private completeClimb() {
    this.launchHoop = { ...this.targetHoop, passed: true, pulse: 0, netPunch: 0 }
    this.targetHoop = this.createTarget(this.launchHoop.y - this.h * .27)
    this.ball = { x: this.launchHoop.x, y: this.launchHoop.y - 14, vx: 0, vy: 0, r: 19, flying: false, rotation: this.ball.rotation, collisionCooldown: 0 }
    this.wallBounces = 0; this.rimHits = 0; this.trail = []; this.climbRemaining = 0; this.launchRimArmed = false
  }
  private hoopWidth() { return Math.min(112, this.w * .29) }
  private getHoopPose(hoop: Hoop) {
    const direction = hoop === this.launchHoop ? Math.sign(this.targetHoop.x - hoop.x) || (hoop.x < this.w * .5 ? -1 : 1) : Math.sign(hoop.x - this.w * .5) || 1
    let angle = direction * .055 + (hoop.netSwing ?? 0) * .012
    let stretch = 1 + Math.sin((hoop.netPunch ?? 0) * Math.PI) * (hoop.netPunch ?? 0) * .12
    let followX = 0, followY = 0
    if (hoop === this.launchHoop && this.dragStart && this.dragPoint) {
      const pullX = this.dragPoint.x - this.dragStart.x, pullY = this.dragPoint.y - this.dragStart.y
      const pullLength = Math.hypot(pullX, pullY)
      angle = clamp(Math.atan2(pullY, pullX) - Math.PI * .5, -.58, .58)
      stretch = 1 + clamp(pullLength / 150, 0, 1) * .4
      followX = pullX * .2; followY = pullY * .12
    }
    return { direction, angle, stretch, followX, followY }
  }
  private getRimGeometry(hoop: Hoop) {
    const size = this.hoopWidth(), pose = this.getHoopPose(hoop)
    const transform = (x: number, y: number) => {
      const sx = x * pose.direction, sy = y * pose.stretch
      return { x: hoop.x + pose.followX + sx * Math.cos(pose.angle) - sy * Math.sin(pose.angle), y: hoop.y + pose.followY + sx * Math.sin(pose.angle) + sy * Math.cos(pose.angle) }
    }
    const first = transform(-size * .3, -size * .08), second = transform(size * .3, size * .05)
    return first.x <= second.x ? { left: first, right: second, tubeRadius: size * .027 } : { left: second, right: first, tubeRadius: size * .027 }
  }
  private crossedRimPlane(previous: Point, current: Point, rim: ReturnType<DunkClimbController['getRimGeometry']>) {
    return this.signedRimDistance(previous, rim) <= 0 && this.signedRimDistance(current, rim) > 0
  }
  private signedRimDistance(point: Point, rim: ReturnType<DunkClimbController['getRimGeometry']>) {
    const dx = rim.right.x - rim.left.x, dy = rim.right.y - rim.left.y, length = Math.max(.001, Math.hypot(dx, dy))
    return (dx * (point.y - rim.left.y) - dy * (point.x - rim.left.x)) / length
  }
  private isInsideRimOpening(point: Point, rim: ReturnType<DunkClimbController['getRimGeometry']>) {
    const dx = rim.right.x - rim.left.x, dy = rim.right.y - rim.left.y, length = Math.hypot(dx, dy)
    const centerX = (rim.left.x + rim.right.x) * .5, centerY = (rim.left.y + rim.right.y) * .5
    const along = Math.abs((point.x - centerX) * dx / length + (point.y - centerY) * dy / length)
    return along < length * .5 - this.ball.r * .6
  }
  private collideWithRims(hoop: Hoop, rim = this.getRimGeometry(hoop)) {
    if (this.ball.collisionCooldown > 0) return
    for (const post of [rim.left, rim.right]) {
      const dx = this.ball.x - post.x, dy = this.ball.y - post.y, length = Math.hypot(dx, dy), minDistance = this.ball.r + rim.tubeRadius
      if (length === 0 || length >= minDistance) continue
      const nx = dx / length, ny = dy / length, overlap = minDistance - length
      this.ball.x += nx * overlap; this.ball.y += ny * overlap
      const impact = this.ball.vx * nx + this.ball.vy * ny
      if (impact < 0) { this.ball.vx -= 1.72 * impact * nx; this.ball.vy -= 1.72 * impact * ny }
      this.ball.collisionCooldown = .065
      if (hoop === this.targetHoop) { this.rimHits++; this.cleanStreak = 0 }
      hoop.netSwing = clamp(this.ball.vx * .035, -24, 24); this.options.onImpact('tap'); return
    }
  }
  private drawAimGuide(ctx: CanvasRenderingContext2D) {
    if (!this.dragStart || !this.dragPoint) return
    const trajectory = this.getAimTrajectory()
    ctx.strokeStyle = 'rgba(134,134,139,.28)'; ctx.lineWidth = 2; ctx.setLineDash([3, 7]); ctx.beginPath(); ctx.moveTo(this.ball.x, this.ball.y)
    for (const point of trajectory) ctx.lineTo(point.x, point.y)
    ctx.stroke(); ctx.setLineDash([])
    trajectory.filter((_, index) => (index + 1) % 9 === 0).forEach((point, index) => {
      if (point.y < 82 || point.y > this.h - 70) return
      ctx.fillStyle = `rgba(134,134,139,${.72 - (index + 1) * .035})`; ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(2.2, 4.8 - index * .2), 0, Math.PI * 2); ctx.fill()
    })
    ctx.strokeStyle = 'rgba(242,146,40,.42)'; ctx.lineWidth = 3; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.moveTo(this.dragStart.x, this.dragStart.y); ctx.lineTo(this.dragPoint.x, this.dragPoint.y); ctx.stroke(); ctx.setLineDash([])
  }
  private getAimTrajectory() {
    if (!this.dragStart || !this.dragPoint) return []
    let x = this.ball.x, y = this.ball.y
    let vx = (this.dragStart.x - this.dragPoint.x) * this.shotPower
    let vy = (this.dragStart.y - this.dragPoint.y) * this.shotPower
    const points: Point[] = [], simulationStep = MAX_PHYSICS_STEP, totalSteps = 12 * 9
    for (let step = 0; step < totalSteps; step++) {
      vy += this.gravity * simulationStep; x += vx * simulationStep; y += vy * simulationStep
      if (x < this.ball.r || x > this.w - this.ball.r) {
        x = clamp(x, this.ball.r, this.w - this.ball.r)
        vx *= -.76
      }
      points.push({ x, y })
    }
    return points
  }
  private drawHoopLayer(ctx: CanvasRenderingContext2D, hoop: Hoop, foreground: boolean) {
    if (!this.hoopImage.complete || !this.hoopImage.naturalWidth) return
    const size = this.hoopWidth(), left = hoop.x - size * .53, top = hoop.y - size * .32
    const { direction, angle, stretch, followX, followY } = this.getHoopPose(hoop)
    ctx.save()
    if (hoop.pulse > 0) { ctx.shadowColor = '#ffb52e'; ctx.shadowBlur = 30 * hoop.pulse }
    ctx.translate(hoop.x + followX, hoop.y + followY); ctx.rotate(angle); ctx.scale(direction, stretch); ctx.translate(-hoop.x, -hoop.y)
    if (!foreground) {
      ctx.drawImage(this.hoopImage, left, top, size, size)
    } else {
      const sourceY = this.hoopImage.naturalHeight * .27
      ctx.drawImage(this.hoopImage, 0, sourceY, this.hoopImage.naturalWidth, this.hoopImage.naturalHeight - sourceY, left, top + size * .27, size, size * .73)
    }
    ctx.restore()
  }
  private drawTrail(ctx: CanvasRenderingContext2D) {
    if (!this.ball.flying) return
    this.trail.forEach((point, index) => {
      const alpha = point.life / .38 * .22, fire = this.cleanStreak >= FIRE_STREAK
      ctx.fillStyle = fire ? (index < 4 ? `rgba(255,238,45,${alpha * 3.2})` : index < 9 ? `rgba(255,91,24,${alpha * 2.5})` : `rgba(180,25,16,${alpha * 1.7})`) : `rgba(115,115,120,${alpha})`
      ctx.shadowColor = fire ? (index < 5 ? '#ffe82d' : '#ff4d1c') : 'transparent'; ctx.shadowBlur = fire ? 18 : 0
      ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(3, this.ball.r - index * .85), 0, Math.PI * 2); ctx.fill()
    })
    ctx.shadowBlur = 0
  }
  private drawScoreEffect(ctx: CanvasRenderingContext2D) {
    const alpha = Math.min(1, this.scoreEffect * 1.8), rise = (1 - this.scoreEffect) * 52
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = this.lastShotPoints >= 3 ? '#ff5a22' : '#f19a2b'; ctx.shadowColor = '#ffb22d'; ctx.shadowBlur = 20
    ctx.font = `900 ${this.lastShotPoints >= 3 ? 28 : 24}px system-ui`; ctx.fillText(this.scoreLabel, this.targetHoop.x, this.targetHoop.y - 58 - rise)
    ctx.restore()
  }
  private drawRescueEffect(ctx: CanvasRenderingContext2D) {
    const alpha = Math.min(1, this.rescueEffect * 2), rise = (1 - this.rescueEffect) * 34
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#45a7ff'; ctx.shadowColor = '#7ec7ff'; ctx.shadowBlur = 18
    ctx.font = '900 24px system-ui'; ctx.fillText('SAVED!  RE-SHOOT', this.launchHoop.x, this.launchHoop.y - 64 - rise)
    ctx.restore()
  }
}

class LoopHoopsController extends BaseController {
  private ball = { x: 240, y: 530, vx: -175, vy: -80, r: 18, rotation: 0, kick: 0, collisionCooldown: 0 }
  private target = { side: -1 as -1 | 1, x: 82, y: 330, pulse: 0, netPunch: 0 }
  private timeLeft = 1
  private cleanStreak = 0
  private rimHits = 0
  private touchedSurface = false
  private wrapGraceSide: -1 | 1 | null = null
  private wrapApproachSide: -1 | 1 | null = null
  private autoClock = 0
  private trail: Array<Point & { life: number }> = []
  private scoreEffect: LoopScoreEffect = { x: 0, y: 0, life: 0, label: '', points: 0, clean: false, streak: 0 }
  private readonly hoopImage: HTMLImageElement

  resize(width: number, height: number) {
    super.resize(width, height)
    this.target.x = this.sideHoopAnchorX(this.target.side)
  }
  reset() {
    this.ball = { x: this.w * .62, y: this.h * .63, vx: -175, vy: -80, r: 18, rotation: 0, kick: 0, collisionCooldown: 0 }
    this.target = { side: -1, x: this.sideHoopAnchorX(-1), y: this.h * .4, pulse: 0, netPunch: 0 }
    this.timeLeft = 1; this.cleanStreak = 0; this.rimHits = 0; this.touchedSurface = false; this.wrapGraceSide = null; this.wrapApproachSide = null; this.autoClock = 0; this.trail = []; this.scoreEffect = { x: 0, y: 0, life: 0, label: '', points: 0, clean: false, streak: 0 }
  }
  constructor(theme: GameTheme, options: ControllerOptions) {
    super(theme, options)
    this.hoopImage = new Image()
    this.hoopImage.src = `${import.meta.env.BASE_URL}games/loop-hoops/side-hoop.png`
    this.reset()
  }
  pointerDown() {
    if (this.status === 'finished') return
    this.ball.vy = -570
    this.ball.vx = this.target.side * Math.min(245, 175 + this.score * 2.5)
    this.ball.kick = 1
    this.options.onImpact('tap')
  }
  autopilot() { if (this.ball.y > this.target.y + 24 || this.ball.vy > 230) this.pointerDown() }
  tick(dt: number) {
    if (this.options.preview) { this.autoClock += dt; if (this.autoClock > .38) { this.autoClock = 0; this.autopilot() } }
    const drainRate = Math.min(.32, .078 + this.elapsed * .0017 + this.score * .009)
    this.timeLeft = Math.max(0, this.timeLeft - drainRate * dt)
    if (this.timeLeft <= 0) { this.finish(); return }

    this.ball.rotation += dt * (4 + Math.abs(this.ball.vx) * .012)
    this.ball.kick = Math.max(0, this.ball.kick - dt * 7.5)
    this.target.pulse = Math.max(0, this.target.pulse - dt * 2.4)
    this.target.netPunch = Math.max(0, this.target.netPunch - dt * 3)
    this.scoreEffect.life = Math.max(0, this.scoreEffect.life - dt * 1.35)
    this.trail.forEach((point) => { point.life -= dt }); this.trail = this.trail.filter((point) => point.life > 0)

    const steps = Math.max(1, Math.ceil(dt / MAX_PHYSICS_STEP)), step = dt / steps
    for (let index = 0; index < steps && this.status !== 'finished'; index++) this.stepPhysics(step)
    this.trail.unshift({ x: this.ball.x, y: this.ball.y, life: this.cleanStreak >= FIRE_STREAK ? .62 : .3 })
    if (this.trail.length > (this.cleanStreak >= FIRE_STREAK ? 22 : 11)) this.trail.pop()
  }
  private stepPhysics(dt: number) {
    const previous = { x: this.ball.x, y: this.ball.y }
    this.ball.collisionCooldown = Math.max(0, this.ball.collisionCooldown - dt)
    this.ball.vy = Math.min(900, this.ball.vy + 1850 * dt)
    this.ball.x += this.ball.vx * dt
    this.ball.y += this.ball.vy * dt
    const wrapped = this.wrapAcrossSideEdges()
    if (!wrapped) { this.beginWrapApproachBeforeHardware(); this.clearWrapApproachAfterHardware(); this.clearWrapGraceAfterHardware() }
    const ceiling = 104 + this.ball.r, floor = this.h - 74 - this.ball.r
    if (this.ball.y < ceiling) { this.ball.y = ceiling; this.ball.vy = Math.abs(this.ball.vy) * .72; this.touchedSurface = true; this.cleanStreak = 0 }
    if (this.ball.y > floor) {
      this.ball.y = floor; this.ball.vy = -Math.max(350, Math.abs(this.ball.vy) * .72); this.ball.kick = .55; this.touchedSurface = true; this.cleanStreak = 0; this.options.onImpact('tap')
    }

    const emergingPastBoundaryHardware = this.wrapGraceSide === this.target.side
    const approachingBoundaryConnector = this.wrapApproachSide === this.target.side
    const hitObstacle = !wrapped && (this.collideWithRimUnderside(previous)
      || (!emergingPastBoundaryHardware && !approachingBoundaryConnector && this.collideWithHoopConnector())
      || (!emergingPastBoundaryHardware && this.collideWithBackboard(previous))
      || this.collideWithRim(previous))
    if (!wrapped && !hitObstacle && this.crossedInsideRim(previous)) this.scoreGoal()
    if (hitObstacle) this.limitLoopBallSpeed()
  }
  render(ctx: CanvasRenderingContext2D) {
    const backdrop = ctx.createRadialGradient(this.w * .5, this.h * .48, 40, this.w * .5, this.h * .48, this.h * .72)
    backdrop.addColorStop(0, '#6d574a'); backdrop.addColorStop(.52, '#584236'); backdrop.addColorStop(1, '#3b281f')
    ctx.fillStyle = backdrop; ctx.fillRect(0, 0, this.w, this.h)
    ctx.fillStyle = 'rgba(255,205,155,.035)'; for (let i = 0; i < 42; i++) { ctx.beginPath(); ctx.arc((i * 83) % this.w, (i * 137) % this.h, 2 + i % 3, 0, Math.PI * 2); ctx.fill() }
    this.drawTimer(ctx)
    this.drawSideHoopImage(ctx, false)
    this.drawBallTrail(ctx)
    for (const offset of this.wrappedRenderOffsets(this.ball.x, this.ball.r)) {
      ctx.fillStyle = 'rgba(20,10,6,.34)'; ctx.beginPath(); ctx.ellipse(this.ball.x + offset, this.h - 70, 22 + Math.abs(this.ball.y - (this.h - 70)) * .015, 7, 0, 0, Math.PI * 2); ctx.fill()
      ctx.save(); ctx.translate(this.ball.x + offset, this.ball.y); ctx.scale(1 + this.ball.kick * .16, 1 - this.ball.kick * .1); drawBasketball(ctx, 0, 0, this.ball.r, this.ball.rotation, this.cleanStreak >= FIRE_STREAK); ctx.restore()
    }
    this.drawSideHoopImage(ctx, true)
    this.drawScoreEffect(ctx)
    ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = '800 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TAP TO BOUNCE  •  BEAT THE CLOCK', this.w * .5, this.h - 38)
  }
  private scoreGoal() {
    const scoredAt = { x: this.target.x, y: this.target.y }
    const clean = this.rimHits === 0 && !this.touchedSurface
    this.cleanStreak = clean ? this.cleanStreak + 1 : 0
    const points = clean ? Math.min(MAX_CLEAN_COMBO, this.cleanStreak) : 1
    this.setScore(this.score + points); this.options.onImpact(clean ? 'perfect' : 'score')
    this.scoreEffect = { ...scoredAt, life: 1, label: clean ? (this.cleanStreak >= FIRE_STREAK ? `FIRE ×${this.cleanStreak}  +${points}` : this.cleanStreak === 2 ? 'PERFECT ×2  +2' : 'CLEAN!  +1') : 'SCORE!  +1', points, clean, streak: this.cleanStreak }
    this.timeLeft = 1
    this.target.side = this.target.side === -1 ? 1 : -1
    this.target.x = this.sideHoopAnchorX(this.target.side)
    this.target.y = random(this.h * .27, this.h * .55)
    this.target.pulse = 1; this.target.netPunch = 1
    this.ball.vx = this.target.side * Math.min(245, 178 + this.score * 2.5)
    this.rimHits = 0; this.touchedSurface = false
  }
  private crossedInsideRim(previous: Point) {
    if (this.ball.vy <= 0 || previous.y > this.target.y || this.ball.y <= this.target.y) return false
    const travelY = this.ball.y - previous.y
    if (travelY <= 0) return false
    const crossingTime = clamp((this.target.y - previous.y) / travelY, 0, 1)
    const crossingX = previous.x + (this.ball.x - previous.x) * crossingTime
    const openingHalf = LOOP_RIM_HALF - this.ball.r - LOOP_RIM_TUBE_RADIUS
    return openingHalf > 0 && Math.abs(crossingX - this.target.x) <= openingHalf
  }
  private collideWithBackboard(previous: Point) {
    const size = this.sideHoopSize()
    const centerX = this.target.x + this.target.side * size * .29
    const halfWidth = size * .025, top = this.target.y - size * .48, bottom = this.target.y + size * .25
    const innerFace = centerX - this.target.side * halfWidth
    const crossedInnerFace = this.target.side < 0
      ? previous.x - this.ball.r >= innerFace && this.ball.x - this.ball.r < innerFace
      : previous.x + this.ball.r <= innerFace && this.ball.x + this.ball.r > innerFace
    const overlapsVisibleBoard = this.ball.y + this.ball.r >= top && this.ball.y - this.ball.r <= bottom
    if (!crossedInnerFace || !overlapsVisibleBoard) return false

    const nx = -this.target.side
    this.ball.x = innerFace + nx * (this.ball.r + .5)
    const impact = this.ball.vx * nx
    if (impact < 0) {
      this.ball.vx -= 1.68 * impact * nx
      this.ball.vx *= .96
    }
    this.stabilizeBallAfterImpact(false)
    return true
  }
  private wrapAcrossSideEdges() {
    if (this.ball.x < 0) { this.ball.x += this.w; this.wrapGraceSide = 1; this.wrapApproachSide = null; return true }
    if (this.ball.x >= this.w) { this.ball.x -= this.w; this.wrapGraceSide = -1; this.wrapApproachSide = null; return true }
    return false
  }
  private clearWrapGraceAfterHardware() {
    if (this.wrapGraceSide === null) return
    const side = this.wrapGraceSide
    const movingIntoCourt = side === -1 ? this.ball.vx > 0 : this.ball.vx < 0
    if (!movingIntoCourt) return
    const outerRimX = this.sideHoopAnchorX(side) + side * LOOP_RIM_HALF
    const clearance = this.ball.r + this.sideHoopSize() * .024 + .5
    const cleared = side === -1 ? this.ball.x >= outerRimX + clearance : this.ball.x <= outerRimX - clearance
    if (cleared) this.wrapGraceSide = null
  }
  private beginWrapApproachBeforeHardware() {
    if (this.wrapGraceSide !== null || this.wrapApproachSide !== null || Math.abs(this.ball.vx) > LOOP_WRAP_TRAVEL_SPEED_LIMIT) return
    const side = this.target.side
    const movingTowardEdge = side === -1 ? this.ball.vx < 0 : this.ball.vx > 0
    if (!movingTowardEdge) return
    const outerRimX = this.target.x + side * LOOP_RIM_HALF
    const clearance = this.ball.r + this.sideHoopSize() * .024 + .5
    const enteringHardware = side === -1 ? this.ball.x <= outerRimX + clearance : this.ball.x >= outerRimX - clearance
    if (enteringHardware) this.wrapApproachSide = side
  }
  private clearWrapApproachAfterHardware() {
    if (this.wrapApproachSide === null) return
    const side = this.wrapApproachSide
    const movingIntoCourt = side === -1 ? this.ball.vx > 0 : this.ball.vx < 0
    if (!movingIntoCourt) return
    const outerRimX = this.sideHoopAnchorX(side) + side * LOOP_RIM_HALF
    const clearance = this.ball.r + this.sideHoopSize() * .024 + .5
    const cleared = side === -1 ? this.ball.x >= outerRimX + clearance : this.ball.x <= outerRimX - clearance
    if (cleared) this.wrapApproachSide = null
  }
  private sideHoopSize() { return Math.min(190, this.w * .49) }
  private sideHoopAnchorX(side: -1 | 1) {
    const size = this.sideHoopSize(), inset = size * (.29 + .025)
    return side === -1 ? inset : this.w - inset
  }
  private getHoopConnectorGeometry() {
    const size = this.sideHoopSize(), boardCenter = this.target.x + this.target.side * size * .29
    const boardInnerFace = boardCenter - this.target.side * size * .025
    return {
      start: { x: boardInnerFace, y: this.target.y - size * .14 },
      end: { x: this.target.x + this.target.side * LOOP_RIM_HALF, y: this.target.y },
      radius: size * .024,
    }
  }
  private getHoopConnectorGeometries() {
    const diagonal = this.getHoopConnectorGeometry()
    return [
      {
        start: { x: diagonal.start.x, y: this.target.y },
        end: { x: this.target.x + this.target.side * LOOP_RIM_HALF, y: this.target.y },
        radius: diagonal.radius,
      },
      diagonal,
    ]
  }
  private collideWithHoopConnector() {
    for (const connector of this.getHoopConnectorGeometries()) {
      if (!this.resolveLoopCapsule(connector.start, connector.end, connector.radius, 1.68)) continue
      this.stabilizeBallAfterImpact()
      return true
    }
    return false
  }
  private collideWithRimUnderside(previous: Point) {
    if (this.ball.vy >= 0) return false
    const rimHalf = LOOP_RIM_HALF, undersideY = this.target.y + 6
    const crossedUnderside = previous.y - this.ball.r >= undersideY && this.ball.y - this.ball.r < undersideY
    const beneathRim = Math.abs(this.ball.x - this.target.x) <= rimHalf + this.ball.r * .35
    if (!crossedUnderside || !beneathRim) return false

    this.ball.y = undersideY + this.ball.r + .5
    this.ball.vy = Math.max(180, Math.abs(this.ball.vy) * .64)
    this.ball.vx *= .94
    this.stabilizeBallAfterImpact()
    return true
  }
  private collideWithRim(previous: Point) {
    const rimHalf = LOOP_RIM_HALF
    for (const x of [this.target.x - rimHalf, this.target.x + rimHalf]) {
      if (!this.resolveSweptLoopCircle(previous, x, this.target.y, LOOP_RIM_TUBE_RADIUS, 1.7)) continue
      this.stabilizeBallAfterImpact(); return true
    }
    return false
  }
  private resolveSweptLoopCircle(previous: Point, obstacleX: number, obstacleY: number, obstacleRadius: number, bounce: number) {
    const radius = this.ball.r + obstacleRadius
    const moveX = this.ball.x - previous.x, moveY = this.ball.y - previous.y
    const fromX = previous.x - obstacleX, fromY = previous.y - obstacleY
    const a = moveX * moveX + moveY * moveY
    const b = 2 * (fromX * moveX + fromY * moveY)
    const c = fromX * fromX + fromY * fromY - radius * radius
    const discriminant = b * b - 4 * a * c
    let hitTime: number | null = null
    if (a > .0001 && discriminant >= 0) {
      const root = Math.sqrt(discriminant), first = (-b - root) / (2 * a), second = (-b + root) / (2 * a)
      if (first >= 0 && first <= 1) hitTime = first
      else if (second >= 0 && second <= 1) hitTime = second
    }
    const currentDx = this.ball.x - obstacleX, currentDy = this.ball.y - obstacleY, currentDistance = Math.hypot(currentDx, currentDy)
    if (hitTime === null && currentDistance >= radius) return false
    if (hitTime !== null) { this.ball.x = previous.x + moveX * hitTime; this.ball.y = previous.y + moveY * hitTime }
    const dx = this.ball.x - obstacleX, dy = this.ball.y - obstacleY, distanceToObstacle = Math.max(.001, Math.hypot(dx, dy))
    const nx = dx / distanceToObstacle, ny = dy / distanceToObstacle
    this.ball.x = obstacleX + nx * (radius + .5); this.ball.y = obstacleY + ny * (radius + .5)
    const impact = this.ball.vx * nx + this.ball.vy * ny
    if (impact < 0) {
      this.ball.vx -= bounce * impact * nx; this.ball.vy -= bounce * impact * ny
      this.ball.vx *= .96; this.ball.vy *= .96
    }
    return true
  }
  private resolveLoopCapsule(start: Point, end: Point, obstacleRadius: number, bounce: number) {
    const segmentX = end.x - start.x, segmentY = end.y - start.y
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY
    const projection = segmentLengthSquared > .0001
      ? clamp(((this.ball.x - start.x) * segmentX + (this.ball.y - start.y) * segmentY) / segmentLengthSquared, 0, 1)
      : 0
    const closestX = start.x + segmentX * projection, closestY = start.y + segmentY * projection
    let dx = this.ball.x - closestX, dy = this.ball.y - closestY
    const radius = this.ball.r + obstacleRadius, distanceToObstacle = Math.hypot(dx, dy)
    if (distanceToObstacle >= radius) return false
    if (distanceToObstacle < .001) {
      const velocity = Math.max(.001, Math.hypot(this.ball.vx, this.ball.vy))
      dx = -this.ball.vx / velocity; dy = -this.ball.vy / velocity
    } else {
      dx /= distanceToObstacle; dy /= distanceToObstacle
    }
    this.ball.x = closestX + dx * (radius + .5); this.ball.y = closestY + dy * (radius + .5)
    const impact = this.ball.vx * dx + this.ball.vy * dy
    if (impact < 0) {
      this.ball.vx -= bounce * impact * dx; this.ball.vy -= bounce * impact * dy
      this.ball.vx *= .96; this.ball.vy *= .96
    }
    return true
  }
  private limitLoopBallSpeed() {
    const speed = Math.hypot(this.ball.vx, this.ball.vy), maxSpeed = 860
    if (speed > maxSpeed) { this.ball.vx *= maxSpeed / speed; this.ball.vy *= maxSpeed / speed }
  }
  private stabilizeBallAfterImpact(countsAsRim = true) {
    this.limitLoopBallSpeed()
    this.cleanStreak = 0; this.touchedSurface = true; this.ball.kick = Math.max(this.ball.kick, .4)
    if (this.ball.collisionCooldown > 0) return
    this.ball.collisionCooldown = .065
    if (countsAsRim) this.rimHits++
    this.options.onImpact('tap')
  }
  private drawTimer(ctx: CanvasRenderingContext2D) {
    const x = 58, y = 98, width = this.w - 116, height = 25
    ctx.fillStyle = 'rgba(13,13,14,.72)'; ctx.fillRect(x, y, width, height)
    const color = this.timeLeft > .28 ? '#18e9ed' : '#ff3f63'
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = this.timeLeft < .3 ? 16 : 8; ctx.fillRect(x, y, width * this.timeLeft, height); ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(x, y, width * this.timeLeft, 6)
    ctx.fillStyle = '#fff'; ctx.fillRect(this.w - 38, y, 8, height); ctx.fillRect(this.w - 22, y, 8, height)
    ctx.fillStyle = '#17110e'; ctx.fillRect(this.w - 38, y + height - 5, 8, 5); ctx.fillRect(this.w - 22, y + height - 5, 8, 5)
    ctx.fillStyle = 'rgba(255,255,255,.86)'; ctx.font = '900 15px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(String(this.score), 20, y + height * .5)
  }
  private drawSideHoopImage(ctx: CanvasRenderingContext2D, foreground: boolean) {
    if (!this.hoopImage.complete || !this.hoopImage.naturalWidth) return
    const size = this.sideHoopSize(), sourceY = this.hoopImage.naturalHeight * .57
    ctx.save(); ctx.translate(this.target.x, this.target.y); if (this.target.side === 1) ctx.scale(-1, 1)
    if (this.target.pulse > 0) { ctx.shadowColor = '#ff1996'; ctx.shadowBlur = 32 * this.target.pulse }
    if (!foreground) ctx.drawImage(this.hoopImage, -size * .586, -size * .586, size, size)
    else {
      const punch = this.target.netPunch
      ctx.scale(1, 1 + Math.sin((1 - punch) * Math.PI * 3) * punch * .18)
      ctx.drawImage(this.hoopImage, 0, sourceY, this.hoopImage.naturalWidth, this.hoopImage.naturalHeight - sourceY, -size * .586, -size * .016, size, size * .43)
    }
    ctx.restore()
  }
  private drawBallTrail(ctx: CanvasRenderingContext2D) {
    this.trail.forEach((point, index) => {
      const fire = this.cleanStreak >= FIRE_STREAK, alpha = point.life / (fire ? .62 : .3)
      ctx.fillStyle = fire ? (index < 5 ? `rgba(255,238,30,${alpha * .78})` : index < 13 ? `rgba(255,93,20,${alpha * .55})` : `rgba(196,30,25,${alpha * .3})`) : `rgba(26,15,12,${alpha * .16})`
      ctx.shadowColor = fire ? (index < 6 ? '#fff02b' : '#ff4b1f') : 'transparent'; ctx.shadowBlur = fire ? 18 : 0
      const radius = Math.max(4, this.ball.r - index * .48)
      for (const offset of this.wrappedRenderOffsets(point.x, radius)) { ctx.beginPath(); ctx.arc(point.x + offset, point.y, radius, 0, Math.PI * 2); ctx.fill() }
    })
    ctx.shadowBlur = 0
  }
  private wrappedRenderOffsets(x: number, radius: number) {
    const offsets = [0]
    if (x < radius) offsets.push(this.w)
    if (x > this.w - radius) offsets.push(-this.w)
    return offsets
  }
  private drawScoreEffect(ctx: CanvasRenderingContext2D) {
    if (this.scoreEffect.life <= 0) return
    const progress = 1 - this.scoreEffect.life, alpha = Math.min(1, this.scoreEffect.life * 2), rise = progress * 34
    const burstColor = this.scoreEffect.streak >= FIRE_STREAK ? '#ff5a20' : this.scoreEffect.clean ? '#ffe85c' : '#ff4f9c'
    ctx.save(); ctx.translate(this.scoreEffect.x, this.scoreEffect.y); ctx.globalAlpha = alpha; ctx.strokeStyle = burstColor; ctx.fillStyle = burstColor; ctx.shadowColor = burstColor; ctx.shadowBlur = this.scoreEffect.clean ? 24 : 14
    ctx.lineWidth = Math.max(2, 7 - progress * 5); ctx.beginPath(); ctx.arc(0, 0, 22 + progress * 68, 0, Math.PI * 2); ctx.stroke()
    const sparkCount = this.scoreEffect.clean ? 14 : 8
    for (let i = 0; i < sparkCount; i++) {
      const angle = i * Math.PI * 2 / sparkCount + this.scoreEffect.streak * .19
      const inner = 24 + progress * 20, outer = inner + 15 + progress * (26 + i % 3 * 5)
      ctx.lineWidth = 3 + i % 2; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner * .62); ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer * .62); ctx.stroke()
      ctx.beginPath(); ctx.arc(Math.cos(angle) * outer, Math.sin(angle) * outer * .62, 2.5 + i % 3, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.shadowColor = burstColor; ctx.shadowBlur = this.scoreEffect.clean ? 24 : 10
    ctx.font = '900 76px system-ui'; ctx.fillText(String(this.score), this.w * .5, this.h * .46 - rise)
    ctx.font = '900 24px system-ui'; ctx.fillText(this.scoreEffect.label, this.w * .5, this.h * .46 + 56 - rise)
    ctx.restore()
  }
}

type CrossingFacing = 'up' | 'down' | 'left' | 'right'
type CrossingRowKind = 'grass' | 'road' | 'water'
type CrossingMover = { kind: 'car' | 'truck' | 'log'; speed: number; length: number; gap: number; offset: number; color: string }
type CrossingRow = { index: number; type: CrossingRowKind; mover: CrossingMover | null; obstacles: number[]; coinCol: number | null }
type CrossingSpan = { start: number; end: number }

const CROSSING_COLS = 8
const CROSSING_PLAYER_HIT_HALF = .1
const crossingModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor

class CrossingRushController extends BaseController {
  private player = { col: 3, row: 1, drawCol: 3, drawRow: 1, hop: 0, facing: 'up' as CrossingFacing, riding: false }
  private rows: CrossingRow[] = []
  private collectedCoins = new Set<string>()
  private drag: Point | null = null
  private moveClock = 0
  private highRow = 1
  private coinCount = 0
  private seed = 0x51f15e
  private segment = 0
  private crashFlash = 0

  constructor(theme: GameTheme, options: ControllerOptions) { super(theme, options); this.reset() }

  reset() {
    this.player = { col: 3, row: 1, drawCol: 3, drawRow: 1, hop: 0, facing: 'up', riding: false }
    this.rows = []; this.collectedCoins.clear(); this.drag = null; this.moveClock = 0; this.highRow = 1; this.coinCount = 0; this.seed = 0x51f15e; this.segment = 0; this.crashFlash = 0
    this.ensureRows(32)
  }

  private nextRandom() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296 }

  private makeRow(index: number, type: CrossingRowKind): CrossingRow {
    const difficulty = Math.min(1, index / 90)
    let mover: CrossingMover | null = null
    if (type === 'road') {
      const truck = this.nextRandom() < .28
      const length = truck ? 1.9 : 1.18
      const gap = Math.max(1.35, 2.75 - difficulty * .95 + this.nextRandom() * .65)
      const direction = index % 2 ? 1 : -1
      mover = { kind: truck ? 'truck' : 'car', speed: direction * (1.35 + difficulty * 1.25 + this.nextRandom() * .48), length, gap, offset: this.nextRandom() * (length + gap), color: ['#f04f43', '#f8c943', '#49a9ec', '#f4f4ef', '#8d65d6'][index % 5] }
    }
    if (type === 'water') {
      const length = 2.35 + this.nextRandom() * 1.15
      const gap = 1.45 + difficulty * .7 + this.nextRandom() * .65
      const direction = index % 2 ? -1 : 1
      mover = { kind: 'log', speed: direction * (.62 + difficulty * .5 + this.nextRandom() * .28), length, gap, offset: this.nextRandom() * (length + gap), color: '#9a542c' }
    }
    const obstacles: number[] = []
    if (type === 'grass' && index > 2) {
      const count = 2 + Math.floor(this.nextRandom() * 3)
      while (obstacles.length < count) {
        const col = Math.floor(this.nextRandom() * CROSSING_COLS)
        if (!obstacles.includes(col)) obstacles.push(col)
      }
    }
    let coinCol: number | null = null
    if (index >= 4 && (index % 3 === 0 || this.nextRandom() < .3)) {
      coinCol = this.nextRandom() < .5 ? 0 : CROSSING_COLS - 1
      if (type === 'grass') obstacles.splice(obstacles.indexOf(coinCol), obstacles.includes(coinCol) ? 1 : 0)
    }
    return { index, type, mover, obstacles, coinCol }
  }

  private ensureRows(maxRow: number) {
    if (!this.rows.length) for (let i = 0; i < 3; i++) this.rows.push(this.makeRow(i, 'grass'))
    while (this.rows.length <= maxRow) {
      const useWater = this.segment % 3 === 1 || this.nextRandom() < .3
      const hazardLength = useWater ? 2 + Math.floor(this.nextRandom() * 3) : 2 + Math.floor(this.nextRandom() * 3)
      for (let i = 0; i < hazardLength; i++) this.rows.push(this.makeRow(this.rows.length, useWater ? 'water' : 'road'))
      this.rows.push(this.makeRow(this.rows.length, 'grass'))
      this.segment++
    }
  }

  private spansFor(row: CrossingRow): CrossingSpan[] {
    if (!row.mover) return []
    const period = row.mover.length + row.mover.gap
    const phase = crossingModulo(row.mover.offset + this.elapsed * row.mover.speed, period)
    const spans: CrossingSpan[] = []
    for (let start = phase - period * 3; start < CROSSING_COLS + period; start += period) spans.push({ start, end: start + row.mover.length })
    return spans
  }

  private isBlocked(row: number, col: number) {
    this.ensureRows(row + 18)
    return this.rows[row]?.type === 'grass' && this.rows[row].obstacles.includes(col)
  }

  swipe(dx: number, dy: number) {
    if (this.status !== 'playing' || this.player.hop > .45) return
    const smallTap = Math.hypot(dx, dy) < 14
    let nextCol = Math.round(this.player.col), nextRow = this.player.row
    let facing: CrossingFacing
    if (!smallTap && Math.abs(dx) > Math.abs(dy)) { nextCol += dx > 0 ? 1 : -1; facing = dx > 0 ? 'right' : 'left' }
    else { nextRow += smallTap || dy < 0 ? 1 : -1; facing = smallTap || dy < 0 ? 'up' : 'down' }
    nextCol = clamp(nextCol, 0, CROSSING_COLS - 1); nextRow = Math.max(0, nextRow)
    this.ensureRows(nextRow + 24); this.player.facing = facing
    if (this.isBlocked(nextRow, nextCol) || (nextCol === Math.round(this.player.col) && nextRow === this.player.row)) { this.player.hop = .3; this.options.onImpact('tap'); return }
    this.player.col = nextCol; this.player.row = nextRow; this.player.riding = false; this.player.hop = 1
    if (nextRow > this.highRow) { const gained = nextRow - this.highRow; this.highRow = nextRow; this.addScore(gained) }
    this.options.onImpact('tap')
  }

  pointerDown(x: number, y: number) { this.drag = { x, y } }
  pointerUp(x: number, y: number) { if (this.drag) { this.swipe(x - this.drag.x, y - this.drag.y); this.drag = null } }
  autopilot() { const roll = this.nextRandom(); this.swipe(roll < .68 ? 0 : roll < .84 ? -55 : 55, roll < .68 ? -70 : 0) }

  private moverAt(row: CrossingRow, x: number) { return this.spansFor(row).find((span) => x >= span.start && x <= span.end) }
  private vehicleTouchesPlayer(row: CrossingRow) {
    return this.spansFor(row).some((span) => this.player.col + CROSSING_PLAYER_HIT_HALF >= span.start && this.player.col - CROSSING_PLAYER_HIT_HALF <= span.end)
  }

  private collectCoin() {
    const row = this.rows[this.player.row], key = `${this.player.row},${row?.coinCol}`
    if (row?.coinCol !== null && Math.abs(this.player.col - row.coinCol) < .38 && !this.collectedCoins.has(key)) {
      this.collectedCoins.add(key); this.coinCount++; this.addScore(5)
    }
  }

  tick(dt: number) {
    this.moveClock += dt; this.crashFlash = Math.max(0, this.crashFlash - dt * 3.5)
    if (this.options.preview && this.moveClock > .7) { this.moveClock = 0; this.autopilot() }
    this.ensureRows(this.player.row + 28)
    this.player.hop = Math.max(0, this.player.hop - dt * 4.2)
    const row = this.rows[this.player.row]
    if (row?.type === 'water' && this.player.hop === 0) {
      const log = this.moverAt(row, this.player.col)
      if (!log) { this.crashFlash = 1; this.finish(); return }
      this.player.riding = true; this.player.col += (row.mover?.speed ?? 0) * dt
      if (this.player.col < -.35 || this.player.col > CROSSING_COLS - .65) { this.crashFlash = 1; this.finish(); return }
    } else if (row?.type !== 'water') this.player.riding = false
    if (row?.type === 'road' && this.player.hop === 0 && this.vehicleTouchesPlayer(row)) { this.crashFlash = 1; this.finish(); return }
    if (this.player.hop < .08) this.collectCoin()
    this.player.drawCol += (this.player.col - this.player.drawCol) * Math.min(1, dt * 15)
    this.player.drawRow += (this.player.row - this.player.drawRow) * Math.min(1, dt * 13)
  }

  private drawVoxelBox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, depth: number, top: string, front: string, side: string) {
    ctx.fillStyle = front; ctx.fillRect(x, y, width, height)
    ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + depth, y - depth); ctx.lineTo(x + width + depth, y - depth); ctx.lineTo(x + width, y); ctx.closePath(); ctx.fill()
    ctx.fillStyle = side; ctx.beginPath(); ctx.moveTo(x + width, y); ctx.lineTo(x + width + depth, y - depth); ctx.lineTo(x + width + depth, y + height - depth); ctx.lineTo(x + width, y + height); ctx.closePath(); ctx.fill()
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, variant: number) {
    this.drawVoxelBox(ctx, x - size * .1, y - size * .05, size * .2, size * .38, 3, '#9a6634', '#70421f', '#573119')
    const greens = variant % 2 ? ['#8dd33e', '#5fae2f', '#428828'] : ['#78c83b', '#4d9e2b', '#347822']
    this.drawVoxelBox(ctx, x - size * .34, y - size * .48, size * .68, size * .54, 6, greens[0], greens[1], greens[2])
  }

  private drawVehicle(ctx: CanvasRenderingContext2D, row: CrossingRow, span: CrossingSpan, y: number, cell: number, rowHeight: number) {
    const mover = row.mover!; const movingRight = mover.speed > 0; const x = span.start * cell; const width = mover.length * cell; const bodyY = y + rowHeight * .25
    ctx.fillStyle = '#1c2730'; ctx.fillRect(x + width * .13, bodyY + rowHeight * .47, width * .18, 6); ctx.fillRect(x + width * .68, bodyY + rowHeight * .47, width * .18, 6)
    this.drawVoxelBox(ctx, x, bodyY, width, rowHeight * .38, 6, mover.color, mover.color, '#b52d31')
    const cabWidth = mover.kind === 'truck' ? width * .36 : width * .56; const cabX = movingRight ? x + width - cabWidth - 5 : x + 5
    this.drawVoxelBox(ctx, cabX, bodyY - rowHeight * .14, cabWidth, rowHeight * .25, 5, '#e9f7ff', '#7ec4dc', '#4c91ae')
    ctx.fillStyle = '#263c50'; ctx.fillRect(movingRight ? cabX + cabWidth * .58 : cabX + 3, bodyY - rowHeight * .08, cabWidth * .34, rowHeight * .13)
  }

  private drawLog(ctx: CanvasRenderingContext2D, span: CrossingSpan, y: number, cell: number, rowHeight: number) {
    const x = span.start * cell, width = (span.end - span.start) * cell, logY = y + rowHeight * .3
    this.drawVoxelBox(ctx, x, logY, width, rowHeight * .32, 4, '#c87836', '#985027', '#69351f')
    ctx.fillStyle = '#e5a04f'; ctx.fillRect(x + 5, logY + 4, 4, rowHeight * .2); ctx.fillRect(x + width - 13, logY + 4, 4, rowHeight * .2)
  }

  private drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.shadowColor = '#ffec55'; ctx.shadowBlur = 12
    this.drawVoxelBox(ctx, -size / 2, -size / 2, size, size, 3, '#fff17b', '#ffc928', '#e99718')
    ctx.restore()
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
    const size = cell * .62; const hopY = Math.sin(this.player.hop * Math.PI) * cell * .3
    ctx.save(); ctx.translate(x, y - hopY)
    ctx.fillStyle = 'rgba(20,45,20,.25)'; ctx.beginPath(); ctx.ellipse(0, size * .48 + hopY, size * .42, size * .17, 0, 0, Math.PI * 2); ctx.fill()
    this.drawVoxelBox(ctx, -size * .34, -size * .03, size * .68, size * .58, 5, '#fff4bd', '#f1d77a', '#c9ad57')
    this.drawVoxelBox(ctx, -size * .3, -size * .42, size * .6, size * .43, 5, '#fffce0', '#f8e9a5', '#d9c16c')
    const facingX = this.player.facing === 'left' ? -1 : this.player.facing === 'right' ? 1 : 0
    const facingY = this.player.facing === 'down' ? 1 : -1
    ctx.fillStyle = '#18251f'
    if (facingX) { ctx.fillRect(facingX * size * .18 - 2, -size * .27, 4, 5); ctx.fillStyle = '#f26b32'; ctx.fillRect(facingX > 0 ? size * .3 : -size * .43, -size * .18, size * .14, size * .12) }
    else { ctx.fillRect(-size * .18, facingY < 0 ? -size * .35 : -size * .12, 4, 5); ctx.fillRect(size * .1, facingY < 0 ? -size * .35 : -size * .12, 4, 5); ctx.fillStyle = '#f26b32'; ctx.fillRect(-size * .12, facingY < 0 ? -size * .48 : size * .02, size * .24, size * .12) }
    ctx.restore()
  }

  render(ctx: CanvasRenderingContext2D) {
    const cell = this.w / CROSSING_COLS, rowHeight = Math.min(58, cell * .98), visibleRows = Math.ceil(this.h / rowHeight) + 5
    const camera = Math.max(0, this.player.drawRow - 3.5); const firstRow = Math.max(0, Math.floor(camera)); this.ensureRows(firstRow + visibleRows + 2)
    const sky = ctx.createLinearGradient(0, 0, 0, this.h); sky.addColorStop(0, '#b8ec7c'); sky.addColorStop(1, '#659f32'); ctx.fillStyle = sky; ctx.fillRect(0, 0, this.w, this.h)
    for (let worldRow = firstRow + visibleRows; worldRow >= firstRow; worldRow--) {
      const row = this.rows[worldRow]; if (!row) continue
      const y = this.h - (worldRow - camera + 1) * rowHeight
      if (row.type === 'grass') {
        ctx.fillStyle = worldRow % 2 ? '#83cb3f' : '#91d848'; ctx.fillRect(0, y, this.w, rowHeight + 1)
        ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let col = worldRow % 2; col < CROSSING_COLS; col += 2) ctx.fillRect(col * cell, y, cell, rowHeight * .16)
      } else if (row.type === 'road') {
        ctx.fillStyle = '#596063'; ctx.fillRect(0, y, this.w, rowHeight + 1); ctx.fillStyle = '#747b79'; ctx.fillRect(0, y, this.w, 5); ctx.fillStyle = 'rgba(255,246,189,.46)'
        for (let x = (worldRow % 2) * cell; x < this.w; x += cell * 2) ctx.fillRect(x, y + rowHeight * .52, cell * .72, 3)
      } else {
        ctx.fillStyle = '#2aa8ca'; ctx.fillRect(0, y, this.w, rowHeight + 1); ctx.fillStyle = 'rgba(135,235,244,.38)'
        for (let x = crossingModulo(worldRow * 31 + this.elapsed * 22, cell * 2) - cell * 2; x < this.w; x += cell * 2) ctx.fillRect(x, y + rowHeight * .22, cell * .8, 3)
      }
      if (row.type === 'grass') for (const col of row.obstacles) this.drawTree(ctx, (col + .5) * cell, y + rowHeight * .55, cell * .8, worldRow + col)
      if (row.type === 'road') for (const span of this.spansFor(row)) this.drawVehicle(ctx, row, span, y, cell, rowHeight)
      if (row.type === 'water') for (const span of this.spansFor(row)) this.drawLog(ctx, span, y, cell, rowHeight)
      const coinKey = `${worldRow},${row.coinCol}`
      if (row.coinCol !== null && !this.collectedCoins.has(coinKey)) this.drawCoin(ctx, (row.coinCol + .5) * cell, y + rowHeight * .35 - Math.sin(this.elapsed * 4 + worldRow) * 5, cell * .24)
    }
    const px = (this.player.drawCol + .5) * cell, py = this.h - (this.player.drawRow - camera + .5) * rowHeight
    this.drawPlayer(ctx, px, py, cell)
    if (this.crashFlash > 0) { ctx.fillStyle = `rgba(255,65,45,${this.crashFlash * .28})`; ctx.fillRect(0, 0, this.w, this.h) }
    drawGameLabel(ctx, 'SWIPE • RIDE THE LOGS', `${this.highRow - 1}m  ◆ ${this.coinCount}`, this.w, this.h)
  }
}

class NeonEscapeController extends NeonVaultController {}

type StackBlock = { x: number; y: number; width: number; color: string }
type StackSpark = Point & { vx: number; vy: number; life: number; size: number; color: string }
export const selectVisibleStackBlocks = <T extends { y: number }>(blocks: T[], camera: number, height: number) => {
  const visible: T[] = []
  for (let index = blocks.length - 1; index >= 0; index--) {
    const screenY = blocks[index].y + camera
    if (screenY < -56) continue
    if (screenY > height + 56) break
    visible.unshift(blocks[index])
  }
  return visible
}
class PerfectStackController extends BaseController {
  private blocks: StackBlock[] = []
  private current = { x: 0, y: 0, width: 220, dir: 1, speed: 150 }
  private fragment: (StackBlock & { vy: number; rotation: number }) | null = null
  private perfect = 0
  private autoClock = 0
  private perfectPulse = 0
  private placementPulse = 0
  private feedback = 'CENTER THE BLOCK'
  private feedbackLife = 1.8
  private sparks: StackSpark[] = []
  private backdropLayer: HTMLCanvasElement | null = null
  private backdropKey = -1
  reset() {
    this.blocks = [{ x: this.w / 2 - 110, y: this.h - 130, width: 220, color: '#fff1a8' }]
    this.current = { x: 0, y: this.h - 176, width: 220, dir: 1, speed: 145 }; this.fragment = null; this.perfect = 0; this.autoClock = 0; this.perfectPulse = 0; this.placementPulse = 0; this.feedback = 'CENTER THE BLOCK'; this.feedbackLife = 1.8; this.sparks = []; this.backdropLayer = null; this.backdropKey = -1
  }
  constructor(theme: GameTheme, options: ControllerOptions) { super(theme, options); this.reset() }
  resize(width: number, height: number) { if (width !== this.w || height !== this.h) { this.backdropLayer = null; this.backdropKey = -1 } super.resize(width, height) }
  destroy() { this.backdropLayer = null; super.destroy() }
  private burst(x: number, y: number, perfect: boolean) {
    const colors = perfect ? ['#fff7ae', '#ffd86b', '#ff91d0', '#8cf8ff'] : ['#d9dcff', '#91a3ff']
    const count = perfect ? 24 : 9
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 2 * i / count, speed = (perfect ? 75 : 38) + i % 5 * 18
      this.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (perfect ? 35 : 10), life: .55 + i % 4 * .09, size: perfect ? 2.5 + i % 3 : 2, color: colors[i % colors.length] })
    }
    if (this.sparks.length > 96) this.sparks.splice(0, this.sparks.length - 96)
  }
  pointerDown() {
    const base = this.blocks[this.blocks.length - 1], left = Math.max(this.current.x, base.x), right = Math.min(this.current.x + this.current.width, base.x + base.width), overlap = right - left
    if (overlap <= 0) { this.finish(); return }
    const diff = this.current.x - base.x, perfect = Math.abs(diff) <= base.width * .04
    const placedWidth = perfect ? Math.min(220, base.width + (this.perfect >= 1 ? 7 : 0)) : overlap, placedX = perfect ? base.x - Math.max(0, placedWidth - base.width) / 2 : left
    if (!perfect && Math.abs(diff) > 2) { const cutX = diff > 0 ? base.x + base.width : this.current.x; this.fragment = { x: cutX, y: this.current.y, width: this.current.width - overlap, color: this.color(), vy: 0, rotation: 0 } }
    this.perfect = perfect ? this.perfect + 1 : 0; this.blocks.push({ x: placedX, y: this.current.y, width: placedWidth, color: this.color() }); this.addScore(1); this.placementPulse = 1
    if (perfect) { this.perfectPulse = 1; this.feedback = this.perfect > 1 ? `PERFECT ×${this.perfect}` : 'PERFECT'; this.feedbackLife = 1.15; this.burst(placedX + placedWidth / 2, this.current.y + 20, true); this.options.onImpact('perfect') }
    else { const accuracy = overlap / Math.max(1, base.width); this.feedback = accuracy > .86 ? 'GREAT DROP' : accuracy > .62 ? 'NICE' : 'STAY CENTERED'; this.feedbackLife = .72; this.burst(placedX + placedWidth / 2, this.current.y + 20, false) }
    this.current = { x: this.score % 2 ? 0 : this.w - placedWidth, y: this.current.y - 46, width: placedWidth, dir: this.score % 2 ? 1 : -1, speed: Math.min(270, 145 + this.score * 9) }
  }
  private color() { return `hsl(${235 + this.score * 13}, 82%, 72%)` }
  autopilot() { const base = this.blocks[this.blocks.length - 1]; if (Math.abs(this.current.x - base.x) < 12) this.pointerDown() }
  tick(dt: number) {
    this.current.x += this.current.speed * this.current.dir * dt; if (this.current.x < -20 || this.current.x + this.current.width > this.w + 20) this.current.dir *= -1
    if (this.fragment) { this.fragment.vy += 700 * dt; this.fragment.y += this.fragment.vy * dt; this.fragment.rotation += dt * 2; if (this.fragment.y > this.h + 100) this.fragment = null }
    this.perfectPulse = Math.max(0, this.perfectPulse - dt * 1.75); this.placementPulse = Math.max(0, this.placementPulse - dt * 5); this.feedbackLife = Math.max(0, this.feedbackLife - dt)
    this.sparks.forEach((spark) => { spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.vy += 125 * dt; spark.life -= dt }); this.sparks = this.sparks.filter((spark) => spark.life > 0)
    if (this.options.preview) { this.autoClock += dt; if (this.autoClock > .2) { this.autoClock = 0; this.autopilot() } }
  }
  private getBackdrop() {
    const key = Math.min(11, Math.floor(this.score / 5))
    if (this.backdropLayer?.width === Math.ceil(this.w) && this.backdropLayer.height === Math.ceil(this.h) && this.backdropKey === key) return this.backdropLayer
    const layer = document.createElement('canvas'); layer.width = Math.ceil(this.w); layer.height = Math.ceil(this.h); const context = layer.getContext('2d', { alpha: false })!
    const hue = 244 + key * 5, gradient = context.createLinearGradient(0, 0, 0, this.h); gradient.addColorStop(0, '#11152f'); gradient.addColorStop(.48, `hsl(${hue},55%,35%)`); gradient.addColorStop(1, '#39204f'); context.fillStyle = gradient; context.fillRect(0, 0, this.w, this.h)
    const moonGlow = context.createRadialGradient(this.w * .78, this.h * .2, 2, this.w * .78, this.h * .2, 82); moonGlow.addColorStop(0, 'rgba(255,245,190,.42)'); moonGlow.addColorStop(.2, 'rgba(255,220,165,.2)'); moonGlow.addColorStop(1, 'rgba(255,180,220,0)'); context.fillStyle = moonGlow; context.fillRect(0, 0, this.w, this.h * .42)
    context.fillStyle = '#fff2c5'; context.shadowColor = '#ffdca8'; context.shadowBlur = 24; context.beginPath(); context.arc(this.w * .78, this.h * .2, 18, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0
    for (let i = 0; i < 34; i++) { const x = (i * 83 + 29) % this.w, y = 105 + (i * 47) % Math.max(120, this.h * .47); context.globalAlpha = .35 + i % 4 * .09; context.fillStyle = i % 5 ? '#fff' : '#9cf7ff'; context.fillRect(x, y, i % 7 ? 1.5 : 2.5, i % 7 ? 1.5 : 2.5) } context.globalAlpha = 1
    context.fillStyle = 'rgba(16,12,42,.42)'; for (let i = 0; i < 13; i++) { const buildingWidth = 25 + i % 3 * 9, buildingHeight = 48 + (i * 31) % 100, x = i * (this.w / 12) - 8; context.fillRect(x, this.h - 112 - buildingHeight, buildingWidth, buildingHeight); context.fillStyle = 'rgba(255,221,126,.16)'; for (let windowY = this.h - 102 - buildingHeight; windowY < this.h - 125; windowY += 18) context.fillRect(x + 7 + i % 2 * 4, windowY, 3, 5); context.fillStyle = 'rgba(16,12,42,.42)' }
    this.backdropLayer = layer; this.backdropKey = key; return layer
  }
  render(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(this.getBackdrop(), 0, 0, this.w, this.h)
    for (let i = 0; i < 8; i++) { const x = (i * 139 + 41) % this.w, y = 130 + (i * 71) % Math.max(120, this.h * .42), alpha = .2 + (Math.sin(this.elapsed * 2.2 + i * 1.7) + 1) * .24; ctx.globalAlpha = alpha; ctx.fillStyle = i % 3 ? '#fff' : '#9cf7ff'; ctx.fillRect(x, y, 2, 2) } ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 5; i++) { const x = ((i * 113 + 25) + this.elapsed * (2 + i % 2)) % (this.w + 150) - 75; ctx.beginPath(); ctx.ellipse(x, 220 + (i % 3) * 105, 52 + i * 4, 12 + i % 2 * 5, 0, 0, Math.PI * 2); ctx.fill() }
    const camera = Math.max(0, this.blocks.length * 46 - (this.h - 260))
    const base = this.blocks[this.blocks.length - 1], baseY = base.y + camera, currentY = this.current.y + camera
    ctx.save(); ctx.setLineDash([4, 7]); ctx.strokeStyle = `rgba(255,240,168,${.16 + Math.sin(this.elapsed * 4) * .05})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(base.x, currentY + 19); ctx.lineTo(base.x, baseY + 20); ctx.moveTo(base.x + base.width, currentY + 19); ctx.lineTo(base.x + base.width, baseY + 20); ctx.stroke(); ctx.setLineDash([]); ctx.restore()
    const drawBlock = (b: StackBlock, active = false, offsetY = camera) => {
      const y = b.y + offsetY, depth = Math.min(9, Math.max(3, b.width * .08)), radius = Math.min(8, Math.max(2, b.width / 2)); ctx.save()
      if (active) { ctx.shadowColor = 'rgba(255,213,102,.7)'; ctx.shadowBlur = 20 + Math.sin(this.elapsed * 7) * 4; ctx.shadowOffsetY = 6 }
      ctx.fillStyle = 'rgba(14,10,43,.45)'; ctx.beginPath(); ctx.moveTo(b.x + 2, y + 40); ctx.lineTo(b.x + b.width, y + 40); ctx.lineTo(b.x + b.width - depth, y + 40 + depth); ctx.lineTo(b.x + depth, y + 40 + depth); ctx.closePath(); ctx.fill()
      if (active) { const face = ctx.createLinearGradient(b.x, y, b.x + b.width, y + 40); face.addColorStop(0, '#ffbd59'); face.addColorStop(.5, '#ffe58a'); face.addColorStop(1, '#ff9f72'); ctx.fillStyle = face } else ctx.fillStyle = b.color
      roundedRect(ctx, b.x, y, b.width, 40, radius); ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
      ctx.fillStyle = active ? 'rgba(255,255,225,.7)' : 'rgba(255,255,255,.32)'; roundedRect(ctx, b.x + Math.min(5, b.width * .1), y + 4, Math.max(1, b.width - Math.min(10, b.width * .2)), 5, 2); ctx.fill()
      ctx.strokeStyle = active ? 'rgba(255,250,204,.7)' : 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; roundedRect(ctx, b.x + .5, y + .5, Math.max(1, b.width - 1), 39, radius); ctx.stroke(); ctx.restore()
    }
    if (this.blocks.length === 1) { ctx.fillStyle = 'rgba(8,7,25,.3)'; ctx.beginPath(); ctx.ellipse(this.w / 2, this.h - 82, 132, 20, 0, 0, Math.PI * 2); ctx.fill() }
    selectVisibleStackBlocks(this.blocks, camera, this.h).forEach((block) => drawBlock(block, false)); drawBlock({ x: this.current.x, y: this.current.y, width: this.current.width, color: '#ffda72' }, true)
    if (this.fragment) { ctx.save(); ctx.translate(this.fragment.x + this.fragment.width / 2, this.fragment.y + camera + 20); ctx.rotate(this.fragment.rotation); drawBlock({ ...this.fragment, x: -this.fragment.width / 2, y: -20 }, false, 0); ctx.restore() }
    for (const spark of this.sparks) { ctx.globalAlpha = clamp(spark.life * 2, 0, 1); ctx.fillStyle = spark.color; ctx.fillRect(spark.x - spark.size / 2, spark.y + camera - spark.size / 2, spark.size, spark.size) } ctx.globalAlpha = 1
    if (this.placementPulse > 0) { const placed = this.blocks[this.blocks.length - 1], y = placed.y + camera + 20; ctx.globalAlpha = this.placementPulse * .55; ctx.strokeStyle = '#fff4b1'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(placed.x + placed.width / 2, y, placed.width * (.5 + (1 - this.placementPulse) * .2), 19 + (1 - this.placementPulse) * 14, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1 }
    if (this.perfectPulse > 0) { const glow = ctx.createRadialGradient(this.w / 2, this.h * .45, 0, this.w / 2, this.h * .45, this.w * .7); glow.addColorStop(0, `rgba(255,235,144,${this.perfectPulse * .18})`); glow.addColorStop(1, 'rgba(255,133,216,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, this.w, this.h) }
    ctx.fillStyle = 'rgba(12,10,38,.62)'; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; roundedRect(ctx, 18, 58, this.w - 36, 68, 18); ctx.fill(); ctx.stroke()
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(231,229,255,.66)'; ctx.font = '800 9px system-ui'; ctx.fillText('FLOOR', 34, 79); ctx.fillStyle = '#fff'; ctx.font = '900 27px system-ui'; ctx.fillText(String(this.score), 33, 109)
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(231,229,255,.66)'; ctx.font = '800 9px system-ui'; ctx.fillText('BLOCK WIDTH', this.w - 34, 79); ctx.fillStyle = '#ffe486'; ctx.font = '900 20px system-ui'; ctx.fillText(`${Math.max(1, Math.round(this.current.width / 220 * 100))}%`, this.w - 33, 106)
    if (this.feedbackLife > 0) { const alpha = Math.min(1, this.feedbackLife * 2.6), pulse = 1 + Math.sin((1.2 - this.feedbackLife) * 10) * .03; ctx.save(); ctx.globalAlpha = alpha; ctx.translate(this.w / 2, 158); ctx.scale(pulse, pulse); ctx.textAlign = 'center'; ctx.fillStyle = this.perfect > 0 ? '#fff1a0' : '#dfe3ff'; ctx.shadowColor = this.perfect > 0 ? '#ffb85c' : '#879bff'; ctx.shadowBlur = this.perfect > 0 ? 20 : 10; ctx.font = this.perfect > 0 ? '950 25px system-ui' : '850 13px system-ui'; ctx.fillText(this.feedback, 0, 0); ctx.restore() }
    drawGameLabel(ctx, 'TAP TO DROP', `${this.score} floors`, this.w, this.h, 32)
  }
}

class PinCoreController extends BaseController {
  private rotation = 0
  private speed = 1.1
  private pins: number[] = []
  private shot = 0
  private stickPulse = 0
  private autoClock = 0
  reset() { this.rotation = 0; this.speed = 1.15; this.pins = [0, Math.PI]; this.shot = 0; this.stickPulse = 0; this.autoClock = 0 }
  constructor(theme: GameTheme, options: ControllerOptions) { super(theme, options); this.reset() }
  pointerDown() {
    if (this.shot > 0 || this.status !== 'playing') return
    this.shot = .001; this.options.onImpact('tap')
  }
  private completeShot() {
    const incoming = Math.PI / 2 - this.rotation
    const minGap = this.pins.length ? Math.min(...this.pins.map((p) => Math.abs(Math.atan2(Math.sin(p - incoming), Math.cos(p - incoming))))) : Math.PI
    const hitAngle = getPinCoreVisibleHitAngle(this.w)
    this.shot = 0
    if (minGap < hitAngle) { this.finish(); return }
    this.pins.push(incoming); this.stickPulse = 1; this.addScore(1); if (minGap < hitAngle + .12) this.options.onImpact('perfect'); this.speed = (1.1 + this.score * .055) * (Math.floor(this.score / 7) % 2 ? -1 : 1)
  }
  autopilot() { if (this.shot > 0) return; const predictedRotation = this.rotation + this.speed * PIN_CORE_FLIGHT_SECONDS, incoming = Math.PI / 2 - predictedRotation; const gap = Math.min(...this.pins.map((p) => Math.abs(Math.atan2(Math.sin(p - incoming), Math.cos(p - incoming))))); if (gap > .5) this.pointerDown() }
  tick(dt: number) {
    this.rotation += this.speed * dt; this.stickPulse = Math.max(0, this.stickPulse - dt * 5)
    if (this.shot > 0) { this.shot = Math.min(1, this.shot + dt / PIN_CORE_FLIGHT_SECONDS); if (this.shot >= 1) this.completeShot() }
    if (this.options.preview) { this.autoClock += dt; if (this.autoClock > .22) { this.autoClock = 0; this.autopilot() } }
  }
  render(ctx: CanvasRenderingContext2D) {
    this.paintBackdrop(ctx, '#24262b', '#08090b')
    const cx = this.w / 2, cy = this.h * .41, radius = Math.min(this.w * PIN_CORE_RADIUS_RATIO, PIN_CORE_MAX_RADIUS)
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.rotation)
    for (const angle of this.pins) { ctx.save(); ctx.rotate(angle); ctx.strokeStyle = '#f5f2dc'; ctx.lineWidth = PIN_ATTACHED_SHAFT_WIDTH; ctx.beginPath(); ctx.moveTo(radius - PIN_SHAFT_INSET, 0); ctx.lineTo(radius + PIN_SHAFT_LENGTH, 0); ctx.stroke(); ctx.fillStyle = this.theme.accent; ctx.beginPath(); ctx.arc(radius + PIN_SHAFT_LENGTH + PIN_SHAFT_INSET, 0, PIN_ATTACHED_HEAD_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
    ctx.fillStyle = '#f7e744'; ctx.shadowColor = '#f7e744'; ctx.shadowBlur = 25; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#15161a'; ctx.font = '900 34px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.max(0, 12 - this.score % 12)), 0, 0); ctx.restore(); ctx.shadowBlur = 0
    const easedShot = this.shot > 0 ? 1 - Math.pow(1 - this.shot, 3) : 0, startHandleY = this.h - 102, contactHandleY = cy + radius + PIN_SHAFT_LENGTH + PIN_SHAFT_INSET, handleY = startHandleY + (contactHandleY - startHandleY) * easedShot
    if (this.shot > 0) { ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 3; for (let trail = 1; trail <= 3; trail++) { ctx.globalAlpha = (1 - easedShot) * (.34 - trail * .07); ctx.beginPath(); ctx.moveTo(cx, handleY + trail * 13); ctx.lineTo(cx, handleY + trail * 13 + 22); ctx.stroke() } ctx.globalAlpha = 1 }
    ctx.strokeStyle = '#fff'; ctx.shadowColor = this.shot > 0 ? 'rgba(255,255,255,.5)' : 'transparent'; ctx.shadowBlur = this.shot > 0 ? 12 : 0; ctx.lineWidth = PIN_FLYING_SHAFT_WIDTH; ctx.beginPath(); ctx.moveTo(cx, handleY - PIN_SHAFT_LENGTH - PIN_SHAFT_INSET * 2); ctx.lineTo(cx, handleY - PIN_ATTACHED_HEAD_RADIUS); ctx.stroke(); ctx.fillStyle = this.theme.accent; ctx.shadowColor = this.theme.accent; ctx.shadowBlur = this.shot > 0 ? 18 : 7; ctx.beginPath(); ctx.arc(cx, handleY, PIN_FLYING_HEAD_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
    if (this.stickPulse > 0) { ctx.globalAlpha = this.stickPulse; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, contactHandleY, 10 + (1 - this.stickPulse) * 18, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1 }
    drawGameLabel(ctx, 'TAP THE GAP', `${this.score} pins`, this.w, this.h, 32)
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
  ctx.save(); ctx.translate(x, y)
  if (fire) {
    const pulse = .5 + Math.sin(rotation * 2.7) * .5
    ctx.save(); ctx.rotate(-rotation * .38); ctx.globalCompositeOperation = 'lighter'
    const aura = ctx.createRadialGradient(0, 0, r * .45, 0, 0, r * (1.65 + pulse * .12))
    aura.addColorStop(0, 'rgba(255,246,74,.72)'); aura.addColorStop(.48, 'rgba(255,111,24,.48)'); aura.addColorStop(1, 'rgba(255,37,8,0)')
    ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, 0, r * (1.72 + pulse * .12), 0, Math.PI * 2); ctx.fill()
    for (let i = 0; i < 10; i++) {
      ctx.save(); ctx.rotate(i * Math.PI * .2 + rotation * .17)
      const length = r * (1.42 + ((i + Math.round(pulse * 2)) % 3) * .13)
      ctx.fillStyle = i % 2 ? 'rgba(255,71,13,.82)' : 'rgba(255,218,35,.88)'
      ctx.shadowColor = i % 2 ? '#ff3d0d' : '#ffe52a'; ctx.shadowBlur = 13
      ctx.beginPath(); ctx.moveTo(-r * .28, -r * .72); ctx.quadraticCurveTo(-r * .18, -r * 1.08, 0, -length); ctx.quadraticCurveTo(r * .2, -r * 1.05, r * .28, -r * .72); ctx.closePath(); ctx.fill(); ctx.restore()
    }
    ctx.restore()
  }
  ctx.rotate(rotation); if (fire) { ctx.shadowColor = '#ffdb39'; ctx.shadowBlur = 30 }
  const gradient = ctx.createRadialGradient(-r * .3, -r * .35, 2, 0, 0, r); gradient.addColorStop(0, '#ffb340'); gradient.addColorStop(1, '#df5224'); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#6f271f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.bezierCurveTo(-r * .55, -r * .2, -r * .55, r * .2, 0, r); ctx.moveTo(0, -r); ctx.bezierCurveTo(r * .55, -r * .2, r * .55, r * .2, 0, r); ctx.stroke(); ctx.restore()
}

const drawGameLabel = (ctx: CanvasRenderingContext2D, hint: string, metric: string, w: number, h: number, bottomOffset = 80) => {
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.76)'; ctx.font = '700 11px system-ui'; ctx.letterSpacing = '2px'; ctx.fillText(hint, w / 2, h - bottomOffset - 28); ctx.fillStyle = '#fff'; ctx.font = '800 18px system-ui'; ctx.fillText(metric, w / 2, h - bottomOffset); ctx.restore()
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
    default: throw new Error(`Unknown Flicko game: ${id}`)
  }
}
