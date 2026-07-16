import type { ControllerOptions, GameController, GameStatus, GameTheme } from '../types'

type Point = { x: number; y: number }
type Node = Point & { teleport?: boolean }
type Particle = Point & { vx: number; vy: number; life: number; color: string }

export const NEON_VAULT_MAP = [
  '1111111111', '1000000001', '1011011101', '1001000101', '1101010101',
  '1000010101', '1011110101', '1010000101', '1010111101', '1000000001',
  '1110110101', '1000100001', '1011101101', '1000000001', '1111111111',
]
const START = { x: 1, y: 13 }, EXIT = { x: 8, y: 1 }
const COINS = ['1,5', '8,9', '7,13']
const PORTALS = new Map([['8,13', { x: 1, y: 1 }], ['1,1', { x: 8, y: 13 }]])
const SPIKES = [{ x: 4, y: 9, phase: 0 }, { x: 8, y: 5, phase: .72 }]
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor

export class NeonVaultController implements GameController {
  private w = 390; private h = 844; private status: GameStatus = 'playing'; private score = 0; private elapsed = 0; private paused = false
  player = { col: 1, row: 13, x: 1, y: 13, moving: false, shield: false }
  dots = new Set<string>(); coins = new Set<string>()
  private path: Node[] = []; private pathIndex = 0; private segmentClock = 0; private segmentDuration = .055
  private drag: Point | null = null; private dragTime = 0; private autoClock = 0
  private enemy = { x: 2, y: 9, direction: 1 }; private dying = 0; private clearing = 0; private shake = 0
  private toast = 'COLLECT EVERY SIGNAL'; private toastLife = 2.4; private collectedCoins = 0
  private trail: (Point & { life: number })[] = []; private particles: Particle[] = []

  constructor(private readonly theme: GameTheme, private readonly options: ControllerOptions) { this.reset() }
  resize(width: number, height: number) { this.w = width; this.h = height }
  pause() { this.paused = true; this.status = this.status === 'finished' ? 'finished' : 'paused' }
  resume() { this.paused = false; if (this.status === 'paused') this.status = 'playing' }
  destroy() { this.paused = true }
  getScore() { return this.score }
  getStatus() { return this.status }
  pointerMove() {}
  restart() { this.score = 0; this.elapsed = 0; this.paused = false; this.status = 'playing'; this.reset(); this.options.onScore(0) }
  reset() {
    this.player = { col: START.x, row: START.y, x: START.x, y: START.y, moving: false, shield: false }
    this.path = []; this.pathIndex = 0; this.segmentClock = 0; this.drag = null; this.autoClock = 0; this.enemy = { x: 2, y: 9, direction: 1 }
    this.dying = 0; this.clearing = 0; this.shake = 0; this.toast = 'COLLECT EVERY SIGNAL'; this.toastLife = 2.4; this.collectedCoins = 0; this.trail = []; this.particles = []; this.coins = new Set(COINS); this.dots = new Set()
    const reserved = new Set([`${START.x},${START.y}`, `${EXIT.x},${EXIT.y}`, ...COINS, ...PORTALS.keys(), ...SPIKES.map((s) => `${s.x},${s.y}`), '2,9', '3,5'])
    for (let r = 0; r < NEON_VAULT_MAP.length; r++) for (let c = 0; c < 10; c++) if (NEON_VAULT_MAP[r][c] === '0' && !reserved.has(`${c},${r}`)) this.dots.add(`${c},${r}`)
  }
  private addScore(value: number) { this.score += value; this.options.onScore(this.score); this.options.onImpact(value > 1 ? 'perfect' : 'score') }
  private finish() { if (this.options.preview) { this.restart(); return } this.status = 'finished'; this.options.onFinish(this.score) }
  private open(x: number, y: number) { return NEON_VAULT_MAP[y]?.[x] === '0' }
  private spikeActive(spike: { phase: number }) { return modulo(this.elapsed + spike.phase, 1.6) < .9 }
  private laserActive() { const phase = modulo(this.elapsed + .25, 2.2); return phase > .55 && phase < 1.45 }
  private laserCell(x: number, y: number) { return y === 3 && x >= 4 && x <= 6 }

  buildPath(dx: number, dy: number) {
    const nodes: Node[] = [{ x: this.player.col, y: this.player.row }]; let x = this.player.col, y = this.player.row; const used = new Set<string>()
    for (let guard = 0; guard < 80 && this.open(x + dx, y + dy); guard++) {
      x += dx; y += dy; nodes.push({ x, y }); const key = `${x},${y}`, portal = PORTALS.get(key)
      if (portal && !used.has(key)) { used.add(key); used.add(`${portal.x},${portal.y}`); x = portal.x; y = portal.y; nodes.push({ x, y, teleport: true }) }
    }
    return nodes
  }
  pointerDown(x: number, y: number) { this.drag = { x, y }; this.dragTime = this.elapsed }
  pointerUp(x: number, y: number) {
    if (!this.drag) return
    const dx = x - this.drag.x, dy = y - this.drag.y, duration = this.elapsed - this.dragTime; this.drag = null
    if (Math.hypot(dx, dy) >= 24 && duration <= .5) this.swipe(dx, dy)
  }
  swipe(dx: number, dy: number) {
    if (this.player.moving || this.dying || this.clearing || this.status !== 'playing') return
    let sx = 0, sy = 0; if (Math.abs(dx) > Math.abs(dy)) sx = dx > 0 ? 1 : -1; else sy = dy > 0 ? 1 : -1
    const path = this.buildPath(sx, sy); if (path.length < 2) { this.shake = .08; return }
    this.path = path; this.pathIndex = 0; this.segmentClock = 0; this.segmentDuration = clamp(.055, .09 / (path.length - 1), .45 / (path.length - 1)); this.player.moving = true; this.options.onImpact('tap')
  }
  autopilot() { for (const [x, y] of [[0, -70], [70, 0], [-70, 0], [0, 70]].sort(() => Math.random() - .5)) { this.swipe(x, y); if (this.player.moving) break } }
  private burst(x: number, y: number, color: string, count: number) { for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2; this.particles.push({ x: x + .5, y: y + .5, vx: Math.cos(a) * (1 + i % 3), vy: Math.sin(a) * (1 + i % 3), life: .35 + i % 4 * .08, color }) } }
  private danger(x: number, y: number) {
    if (this.player.shield) { this.player.shield = false; this.burst(x, y, '#6abfff', 16); this.toast = 'SHIELD BROKEN'; this.toastLife = 1.2; return }
    if (!this.dying) { this.player.moving = false; this.dying = .68; this.shake = .45; this.burst(x, y, '#ff3ca6', 22); this.options.onImpact('fail') }
  }
  private visit(node: Node) {
    const key = `${node.x},${node.y}`
    if (this.dots.delete(key)) { this.addScore(1); this.burst(node.x, node.y, '#54ffe0', 5) }
    if (this.coins.delete(key)) { this.collectedCoins++; this.addScore(10); this.burst(node.x, node.y, '#ffe45f', 12); this.toast = 'VAULT COIN +10'; this.toastLife = 1 }
    if (key === '3,5' && !this.player.shield) { this.player.shield = true; this.burst(node.x, node.y, '#6abfff', 12); this.toast = 'SHIELD READY'; this.toastLife = 1.2 }
    const spike = SPIKES.find((s) => s.x === node.x && s.y === node.y); if (spike && this.spikeActive(spike)) this.danger(node.x, node.y)
    if (this.laserCell(node.x, node.y) && this.laserActive()) this.danger(node.x, node.y)
    if (Math.hypot(node.x - this.enemy.x, node.y - this.enemy.y) < .45) this.danger(node.x, node.y)
    if (!this.dots.size) { this.toast = 'EXIT OPEN'; this.toastLife = 1.6 }
    if (node.x === EXIT.x && node.y === EXIT.y) { if (this.dots.size) { this.toast = `${this.dots.size} SIGNALS LEFT`; this.toastLife = 1.2 } else { this.player.moving = false; this.clearing = .72; this.burst(node.x, node.y, '#54ffe0', 24) } }
  }
  private move(dt: number) {
    if (!this.player.moving) return; this.segmentClock += dt
    while (this.segmentClock >= this.segmentDuration && this.player.moving) {
      this.segmentClock -= this.segmentDuration; const node = this.path[++this.pathIndex]; if (!node) { this.player.moving = false; break }
      this.player.col = node.x; this.player.row = node.y; this.player.x = node.x; this.player.y = node.y; this.visit(node)
      if (this.dying || this.clearing || this.pathIndex >= this.path.length - 1) this.player.moving = false
    }
    if (!this.player.moving) return
    const from = this.path[this.pathIndex], to = this.path[this.pathIndex + 1], t = this.segmentClock / this.segmentDuration
    this.player.x = to.teleport ? to.x : from.x + (to.x - from.x) * t; this.player.y = to.teleport ? to.y : from.y + (to.y - from.y) * t; this.trail.push({ x: this.player.x, y: this.player.y, life: .22 })
  }
  update(dt: number) {
    if (this.paused || this.status === 'finished') return; dt = Math.min(dt, .033); this.elapsed += dt; this.autoClock += dt; this.toastLife = Math.max(0, this.toastLife - dt); this.shake = Math.max(0, this.shake - dt)
    if (this.options.preview && this.autoClock > .75) { this.autoClock = 0; this.autopilot() }
    if (this.dying > 0) { this.dying -= dt; if (this.dying <= 0) this.finish() }
    if (this.clearing > 0) { this.clearing -= dt; if (this.clearing <= 0) { this.addScore(25 + this.collectedCoins * 5); this.finish() } }
    this.move(dt); this.enemy.x += this.enemy.direction * 1.35 * dt; if (this.enemy.x > 7.6 || this.enemy.x < 1.4) { this.enemy.x = clamp(this.enemy.x, 1.4, 7.6); this.enemy.direction *= -1 }
    if (!this.dying && Math.hypot(this.player.x - this.enemy.x, this.player.y - 9) < .36) this.danger(this.player.x, this.player.y)
    this.trail.forEach((p) => { p.life -= dt }); this.trail = this.trail.filter((p) => p.life > 0); this.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt }); this.particles = this.particles.filter((p) => p.life > 0)
  }
  private geometry() { const cell = Math.min(this.w / 10, (this.h - 220) / 15); return { cell, ox: (this.w - cell * 10) / 2, oy: 104 } }
  private point(x: number, y: number) { const g = this.geometry(); return { x: g.ox + (x + .5) * g.cell, y: g.oy + (y + .5) * g.cell } }
  render(ctx: CanvasRenderingContext2D) {
    const bg = ctx.createLinearGradient(0, 0, 0, this.h); bg.addColorStop(0, this.theme.background); bg.addColorStop(1, '#10072b'); ctx.fillStyle = bg; ctx.fillRect(0, 0, this.w, this.h)
    const { cell, ox, oy } = this.geometry(); ctx.save(); if (this.shake) ctx.translate(Math.sin(this.elapsed * 80) * this.shake * 8, Math.cos(this.elapsed * 63) * this.shake * 6); ctx.fillStyle = '#09081e'; ctx.fillRect(ox, oy, cell * 10, cell * 15)
    for (let r = 0; r < 15; r++) for (let c = 0; c < 10; c++) if (NEON_VAULT_MAP[r][c] === '1') { const x = ox + c * cell + 2, y = oy + r * cell + 2; ctx.fillStyle = '#17113b'; ctx.shadowColor = '#6249e8'; ctx.shadowBlur = 8; ctx.fillRect(x, y, cell - 4, cell - 4); ctx.strokeStyle = '#6049d8'; ctx.strokeRect(x + 2, y + 2, cell - 8, cell - 8) }
    for (const key of this.dots) { const [c, r] = key.split(',').map(Number), p = this.point(c, r); ctx.fillStyle = '#67ffe2'; ctx.shadowColor = '#54ffe0'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill() }
    for (const key of this.coins) { const [c, r] = key.split(',').map(Number), p = this.point(c, r); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(this.elapsed * 2); ctx.fillStyle = '#ffe45f'; ctx.shadowColor = '#ffe45f'; ctx.shadowBlur = 18; ctx.fillRect(-5, -5, 10, 10); ctx.restore() }
    for (const [key] of PORTALS) { const [c, r] = key.split(',').map(Number), p = this.point(c, r); ctx.strokeStyle = key === '1,1' ? '#35d9ff' : '#bf50ff'; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, cell * .27, this.elapsed * 2, this.elapsed * 2 + 4.8); ctx.stroke() }
    for (const s of SPIKES) { const p = this.point(s.x, s.y), active = this.spikeActive(s); ctx.fillStyle = active ? '#ff3c91' : 'rgba(255,60,145,.22)'; ctx.shadowColor = '#ff3c91'; ctx.shadowBlur = active ? 16 : 4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(p.x + i * 7 - 5, p.y + 8); ctx.lineTo(p.x + i * 7, p.y - (active ? 9 : 2)); ctx.lineTo(p.x + i * 7 + 5, p.y + 8); ctx.fill() } }
    const ls = this.point(4, 3), le = this.point(6, 3); ctx.strokeStyle = this.laserActive() ? '#ff3ca6' : 'rgba(255,60,166,.28)'; ctx.lineWidth = this.laserActive() ? 5 : 2; if (!this.laserActive()) ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.moveTo(ls.x - 12, ls.y); ctx.lineTo(le.x + 12, le.y); ctx.stroke(); ctx.setLineDash([])
    const shield = this.point(3, 5); if (!this.player.shield) { ctx.strokeStyle = '#6abfff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(shield.x, shield.y, 8, .3, 2.8); ctx.arc(shield.x, shield.y, 8, 3.5, 5.9); ctx.stroke() }
    const exit = this.point(EXIT.x, EXIT.y), open = !this.dots.size; ctx.strokeStyle = open ? '#54ffe0' : '#a52b55'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(exit.x, exit.y, 12, this.elapsed * 2, this.elapsed * 2 + 5); ctx.stroke(); if (!open) { ctx.fillStyle = '#ff668a'; ctx.font = '800 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(this.dots.size), exit.x, exit.y + 3) }
    const enemy = this.point(this.enemy.x, 9); ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(this.elapsed + .8); ctx.fillStyle = '#ff3ca6'; ctx.fillRect(-7, -7, 14, 14); ctx.restore()
    for (const t of this.trail) { const p = this.point(t.x, t.y); ctx.globalAlpha = t.life; ctx.fillStyle = '#45ffe0'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill() } ctx.globalAlpha = 1
    for (const q of this.particles) { const p = this.point(q.x - .5, q.y - .5); ctx.globalAlpha = clamp(q.life * 2, 0, 1); ctx.fillStyle = q.color; ctx.fillRect(p.x, p.y, 4, 4) } ctx.globalAlpha = 1
    if (this.dying <= 0) { const p = this.point(this.player.x, this.player.y), scale = this.clearing ? this.clearing / .72 : 1; ctx.fillStyle = '#eafff9'; ctx.shadowColor = '#45ffe0'; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(p.x, p.y, 9 * scale, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#45ffe0'; ctx.beginPath(); ctx.arc(p.x, p.y, 5 * scale, 0, Math.PI * 2); ctx.fill(); if (this.player.shield) { ctx.strokeStyle = '#6abfff'; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke() } }
    ctx.restore(); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(7,5,24,.8)'; ctx.fillRect(16, 54, this.w - 32, 42); ctx.font = '800 12px system-ui'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText('VAULT 01', 30, 80); ctx.fillStyle = '#65ffe3'; ctx.textAlign = 'center'; ctx.fillText(`SIGNALS ${this.dots.size}`, this.w / 2, 80); ctx.fillStyle = '#ffe45f'; ctx.textAlign = 'right'; ctx.fillText(`◆ ${this.collectedCoins}/3`, this.w - 30, 80)
    if (this.toastLife > 0) { ctx.globalAlpha = Math.min(1, this.toastLife * 2); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '900 13px system-ui'; ctx.fillText(this.toast, this.w / 2, 119); ctx.globalAlpha = 1 }
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '800 17px system-ui'; ctx.fillText(`${this.score} NEON`, this.w / 2, this.h - 80); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '700 11px system-ui'; ctx.fillText('SWIPE • SLIDE TO THE WALL', this.w / 2, this.h - 108)
  }
}
