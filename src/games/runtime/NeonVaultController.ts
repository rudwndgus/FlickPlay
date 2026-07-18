import type { ControllerOptions, GameController, GameStatus, GameTheme } from '../types'

type Point = { x: number; y: number }
type Node = Point & { teleport?: boolean }
type Particle = Point & { vx: number; vy: number; life: number; color: string }
type VaultStage = {
  map: string[]
  start: Point
  exit: Point
  coins: string[]
  portals: Map<string, Point>
  spikes: { x: number; y: number; phase: number }[]
  switches: string[]
  shield: string
  enemy: { row: number; start: number; min: number; max: number; speed: number }
  laser: { row: number; from: number; to: number }
  palette: { background: string; floor: string; wallOuter: string; wallInner: string; wallEdge: string; wallGlow: string; signal: string; player: string; playerCore: string; hud: string; hudAccent: string }
}

const VAULT_COLS = 13, VAULT_ROWS = 19
export const NEON_VAULT_MAP = [
  '1111111111111', '1000001000001', '1101101110101', '1000001000101', '1011111011101',
  '1010000010101', '1011101110101', '1000001010001', '1111111010111', '1010000000101',
  '1010001111101', '1010000000001', '1010101011101', '1000001010101', '1011111000101',
  '1010000010001', '1010111110111', '1000100000001', '1111111111111',
]
export const NEON_VAULT_STAGE_TWO_MAP = [
  '1111111111111', '1000101000001', '1110001011101', '1000101000001', '1011101000001',
  '1000100000101', '1110111011101', '1000100000001', '1010101111101', '1010100010001',
  '1010101010111', '1010000010101', '1011111110001', '1000000010101', '1011101010101',
  '1010100010001', '1010101110101', '1000100000001', '1111111111111',
]
const VAULT_STAGES: VaultStage[] = [
  {
    map: NEON_VAULT_MAP, start: { x: 1, y: 17 }, exit: { x: 11, y: 1 }, coins: ['1,9', '11,9', '7,7'],
    portals: new Map([['11,17', { x: 1, y: 1 }], ['1,1', { x: 11, y: 17 }]]),
    spikes: [{ x: 5, y: 9, phase: 0 }, { x: 6, y: 9, phase: 0 }, { x: 9, y: 13, phase: .72 }], switches: ['5,3', '11,15'], shield: '3,9',
    enemy: { row: 11, start: 4, min: 3.4, max: 10.6, speed: 1.35 }, laser: { row: 11, from: 5, to: 10 },
    palette: { background: '#020204', floor: '#030308', wallOuter: '#31051f', wallInner: '#650932', wallEdge: '#ff347f', wallGlow: '#ff075e', signal: '#f4ff2d', player: '#fbff65', playerCore: '#9fae00', hud: 'rgba(0,0,0,.9)', hudAccent: '#ff2b79' },
  },
  {
    map: NEON_VAULT_STAGE_TWO_MAP, start: { x: 11, y: 17 }, exit: { x: 1, y: 1 }, coins: ['11,7', '5,9', '3,15'], portals: new Map(),
    spikes: [{ x: 9, y: 9, phase: .25 }, { x: 3, y: 17, phase: .95 }, { x: 7, y: 15, phase: .55 }], switches: ['7,1', '3,11', '1,13'], shield: '7,13',
    enemy: { row: 7, start: 7, min: 5.4, max: 10.6, speed: 1.65 }, laser: { row: 17, from: 5, to: 10 },
    palette: { background: '#020204', floor: '#030308', wallOuter: '#087d6e', wallInner: '#35d6b5', wallEdge: '#c7fff2', wallGlow: '#20f0c3', signal: '#f4ff2d', player: '#fff36a', playerCore: '#735f00', hud: 'rgba(0,0,0,.92)', hudAccent: '#ff70a5' },
  },
]
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor
const traceVaultPath = (stage: VaultStage, start: Point, dx: number, dy: number) => {
  const nodes: Node[] = [{ ...start }]; let x = start.x, y = start.y; const used = new Set<string>()
  for (let guard = 0; guard < 100 && stage.map[y + dy]?.[x + dx] === '0'; guard++) {
    x += dx; y += dy; nodes.push({ x, y }); const key = `${x},${y}`, portal = stage.portals.get(key)
    if (portal && !used.has(key)) { used.add(key); used.add(`${portal.x},${portal.y}`); x = portal.x; y = portal.y; nodes.push({ x, y, teleport: true }) }
  }
  return nodes
}
export const analyzeVaultReachability = (stageNumber = 1) => {
  const stage = VAULT_STAGES[stageNumber - 1] ?? VAULT_STAGES[0]
  const stops = new Set([`${stage.start.x},${stage.start.y}`]), cells = new Set([`${stage.start.x},${stage.start.y}`]), queue = [{ ...stage.start }], edges = new Map<string, Set<string>>(), reverseEdges = new Map<string, Set<string>>()
  while (queue.length) {
    const start = queue.shift()!, startKey = `${start.x},${start.y}`
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const path = traceVaultPath(stage, start, dx, dy); if (path.length < 2) continue
      path.forEach((node) => cells.add(`${node.x},${node.y}`)); const end = path[path.length - 1], key = `${end.x},${end.y}`
      if (!edges.has(startKey)) edges.set(startKey, new Set()); edges.get(startKey)!.add(key)
      if (!reverseEdges.has(key)) reverseEdges.set(key, new Set()); reverseEdges.get(key)!.add(startKey)
      if (!stops.has(key)) { stops.add(key); queue.push({ x: end.x, y: end.y }) }
    }
  }
  const exitKey = `${stage.exit.x},${stage.exit.y}`, returnableStops = new Set([exitKey]), reverseQueue = [exitKey]
  while (reverseQueue.length) for (const previous of reverseEdges.get(reverseQueue.shift()!) ?? []) if (!returnableStops.has(previous)) { returnableStops.add(previous); reverseQueue.push(previous) }
  const exitReachableStops = new Set([exitKey]), exitQueue = [exitKey]
  while (exitQueue.length) for (const next of edges.get(exitQueue.shift()!) ?? []) if (!exitReachableStops.has(next)) { exitReachableStops.add(next); exitQueue.push(next) }
  return { stops, cells, returnableStops, exitReachableStops }
}

export class NeonVaultController implements GameController {
  private w = 390; private h = 844; private status: GameStatus = 'playing'; private score = 0; private elapsed = 0; private paused = false
  stage = 1
  private staticLayer: HTMLCanvasElement | null = null
  player = { col: 1, row: 17, x: 1, y: 17, moving: false, shield: false }
  dots = new Set<string>(); coins = new Set<string>(); switches = new Set<string>()
  private path: Node[] = []; private pathIndex = 0; private segmentClock = 0; private segmentDuration = .05
  private drag: Point | null = null; private dragTime = 0; private autoClock = 0
  private enemy = { x: 4, y: 11, direction: 1 }; private dying = 0; private clearing = 0; private shieldGrace = 0; private shake = 0; private impactPulse = 0
  private moveDirection = { x: 0, y: -1 }
  private toast = 'COLLECT EVERY SIGNAL'; private toastLife = 2.4; private collectedCoins = 0
  private trail: (Point & { life: number })[] = []; private particles: Particle[] = []

  constructor(_theme: GameTheme, private readonly options: ControllerOptions) { this.reset() }
  resize(width: number, height: number) { if (width !== this.w || height !== this.h) this.staticLayer = null; this.w = width; this.h = height }
  pause() { this.paused = true; this.status = this.status === 'finished' ? 'finished' : 'paused' }
  resume() { this.paused = false; if (this.status === 'paused') this.status = 'playing' }
  destroy() { this.paused = true }
  getScore() { return this.score }
  getStatus() { return this.status }
  pointerMove() {}
  restart() { this.score = 0; this.elapsed = 0; this.paused = false; this.status = 'playing'; this.reset(); this.options.onScore(0) }
  reset() {
    this.stage = 1; this.setupStage()
  }
  private setupStage() {
    const config = this.config
    this.staticLayer = null; this.player = { col: config.start.x, row: config.start.y, x: config.start.x, y: config.start.y, moving: false, shield: false }
    this.path = []; this.pathIndex = 0; this.segmentClock = 0; this.drag = null; this.autoClock = 0; this.enemy = { x: config.enemy.start, y: config.enemy.row, direction: 1 }
    this.dying = 0; this.clearing = 0; this.shieldGrace = 0; this.shake = 0; this.impactPulse = 0; this.moveDirection = { x: 0, y: -1 }; this.toast = this.stage === 1 ? 'COLLECT SIGNALS • HIT 2 SWITCHES' : 'STAGE 2 • MINT CIRCUIT'; this.toastLife = 2.4; this.collectedCoins = 0; this.trail = []; this.particles = []; this.coins = new Set(config.coins); this.switches = new Set(config.switches); this.dots = new Set()
    const reserved = new Set([`${config.start.x},${config.start.y}`, `${config.exit.x},${config.exit.y}`, ...config.coins, ...config.portals.keys(), ...config.spikes.map((s) => `${s.x},${s.y}`), ...config.switches, `${Math.round(config.enemy.start)},${config.enemy.row}`, config.shield])
    const reachable = analyzeVaultReachability(this.stage).cells
    for (let r = 0; r < config.map.length; r++) for (let c = 0; c < VAULT_COLS; c++) { const key = `${c},${r}`; if (config.map[r][c] === '0' && reachable.has(key) && !reserved.has(key)) this.dots.add(key) }
  }
  private get config() { return VAULT_STAGES[this.stage - 1] }
  private addScore(value: number) { this.score += value; this.options.onScore(this.score); this.options.onImpact(value > 1 ? 'perfect' : 'score') }
  private finish() { if (this.options.preview) { this.restart(); return } this.status = 'finished'; this.options.onFinish(this.score) }
  private spikeActive(spike: { phase: number }) { return modulo(this.elapsed + spike.phase, 1.6) < .9 }
  private laserActive() { const phase = modulo(this.elapsed + .25, 2.2); return phase > .55 && phase < 1.45 }
  private activeHazardAt(x: number, y: number) {
    const config = this.config, laser = config.laser
    const spikeHit = config.spikes.some((spike) => this.spikeActive(spike) && Math.hypot(x - spike.x, y - spike.y) < .55)
    const laserHit = this.laserActive() && Math.abs(y - laser.row) < .38 && x >= laser.from - .6 && x <= laser.to + .6
    const enemyHit = Math.hypot(x - this.enemy.x, y - config.enemy.row) < .52
    return spikeHit || laserHit || enemyHit
  }

  buildPath(dx: number, dy: number) {
    return traceVaultPath(this.config, { x: this.player.col, y: this.player.row }, dx, dy)
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
    this.path = path; this.pathIndex = 0; this.segmentClock = 0; this.segmentDuration = clamp(.041, .068 / (path.length - 1), .3 / (path.length - 1)); this.moveDirection = { x: sx, y: sy }; this.player.moving = true; this.impactPulse = .15; this.options.onImpact('tap')
  }
  autopilot() { for (const [x, y] of [[0, -70], [70, 0], [-70, 0], [0, 70]].sort(() => Math.random() - .5)) { this.swipe(x, y); if (this.player.moving) break } }
  private burst(x: number, y: number, color: string, count: number) { for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2; this.particles.push({ x: x + .5, y: y + .5, vx: Math.cos(a) * (1 + i % 3), vy: Math.sin(a) * (1 + i % 3), life: .35 + i % 4 * .08, color }) } }
  private stopAtCurrentCell() {
    const node = this.path[this.pathIndex]
    if (node) { this.player.col = node.x; this.player.row = node.y; this.player.x = node.x; this.player.y = node.y }
    this.player.moving = false; this.path = node ? this.path.slice(0, this.pathIndex + 1) : []; this.segmentClock = 0; this.impactPulse = 1; this.shake = Math.max(this.shake, .2)
  }
  private danger(x: number, y: number) {
    if (this.shieldGrace > 0) return
    if (this.player.shield) { this.player.shield = false; this.shieldGrace = .55; this.stopAtCurrentCell(); this.burst(x, y, '#6abfff', 20); this.toast = 'SHIELD BLOCK • STOPPED'; this.toastLife = 1.35; this.options.onImpact('perfect'); return }
    if (!this.dying) { this.player.moving = false; this.dying = .68; this.shake = .45; this.burst(x, y, '#ff3ca6', 22); this.options.onImpact('fail') }
  }
  private visit(node: Node) {
    const config = this.config
    const key = `${node.x},${node.y}`
    if (this.dots.delete(key)) { this.addScore(1); this.burst(node.x, node.y, '#f5ff35', 5) }
    if (this.coins.delete(key)) { this.collectedCoins++; this.addScore(10); this.burst(node.x, node.y, '#ffe45f', 12); this.toast = 'VAULT COIN +10'; this.toastLife = 1 }
    if (this.switches.delete(key)) { const active = config.switches.length - this.switches.size; this.addScore(5); this.burst(node.x, node.y, '#19f7e7', 16); this.shake = .16; this.toast = this.switches.size ? `SWITCH ${active}/${config.switches.length} • KEEP GOING` : 'ALL SWITCHES ACTIVE'; this.toastLife = 1.6; this.options.onImpact('perfect') }
    if (key === config.shield && !this.player.shield) { this.player.shield = true; this.burst(node.x, node.y, '#6abfff', 12); this.toast = 'SHIELD READY'; this.toastLife = 1.2 }
    if (this.activeHazardAt(node.x, node.y)) this.danger(node.x, node.y)
    if (!this.dots.size && !this.switches.size) { this.toast = 'EXIT OPEN'; this.toastLife = 1.6 }
    if (node.x === config.exit.x && node.y === config.exit.y) { if (this.dots.size || this.switches.size) { this.toast = this.switches.size ? `${this.switches.size} SWITCHES • ${this.dots.size} SIGNALS` : `${this.dots.size} SIGNALS LEFT`; this.toastLife = 1.5 } else { this.player.moving = false; this.clearing = .72; this.burst(node.x, node.y, '#54ffe0', 24) } }
  }
  private move(dt: number) {
    if (!this.player.moving) return; this.segmentClock += dt; const wasMoving = this.player.moving
    while (this.segmentClock >= this.segmentDuration && this.player.moving) {
      this.segmentClock -= this.segmentDuration; const node = this.path[++this.pathIndex]; if (!node) { this.player.moving = false; break }
      this.player.col = node.x; this.player.row = node.y; this.player.x = node.x; this.player.y = node.y; this.visit(node)
      if (this.dying || this.clearing || this.pathIndex >= this.path.length - 1) this.player.moving = false
    }
    if (!this.player.moving) { if (wasMoving && !this.dying && !this.clearing) { this.impactPulse = 1; this.shake = Math.max(this.shake, .045) } return }
    const from = this.path[this.pathIndex], to = this.path[this.pathIndex + 1], t = this.segmentClock / this.segmentDuration
    this.player.x = to.teleport ? to.x : from.x + (to.x - from.x) * t; this.player.y = to.teleport ? to.y : from.y + (to.y - from.y) * t; this.trail.push({ x: this.player.x, y: this.player.y, life: .22 })
  }
  update(dt: number) {
    if (this.paused || this.status === 'finished') return; dt = Math.min(dt, .033); this.elapsed += dt; this.autoClock += dt; this.toastLife = Math.max(0, this.toastLife - dt); this.shieldGrace = Math.max(0, this.shieldGrace - dt); this.shake = Math.max(0, this.shake - dt); this.impactPulse = Math.max(0, this.impactPulse - dt * 7)
    if (this.options.preview && this.autoClock > .75) { this.autoClock = 0; this.autopilot() }
    if (this.dying > 0) { this.dying -= dt; if (this.dying <= 0) this.finish() }
    if (this.clearing > 0) { this.clearing -= dt; if (this.clearing <= 0) { this.addScore(25 + this.collectedCoins * 5); if (this.stage < VAULT_STAGES.length) { this.stage++; this.setupStage(); this.options.onImpact('perfect') } else this.finish() } }
    if ((this.status as GameStatus) === 'finished') return
    const enemy = this.config.enemy; this.move(dt); this.enemy.x += this.enemy.direction * enemy.speed * dt; if (this.enemy.x > enemy.max || this.enemy.x < enemy.min) { this.enemy.x = clamp(this.enemy.x, enemy.min, enemy.max); this.enemy.direction *= -1 }
    if (!this.dying && !this.clearing && this.activeHazardAt(this.player.x, this.player.y)) this.danger(this.player.x, this.player.y)
    this.trail.forEach((p) => { p.life -= dt }); this.trail = this.trail.filter((p) => p.life > 0); this.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt }); this.particles = this.particles.filter((p) => p.life > 0)
  }
  private geometry() { const cell = Math.min(this.w / VAULT_COLS, (this.h - 220) / VAULT_ROWS); return { cell, ox: (this.w - cell * VAULT_COLS) / 2, oy: 104 } }
  private point(x: number, y: number) { const g = this.geometry(); return { x: g.ox + (x + .5) * g.cell, y: g.oy + (y + .5) * g.cell } }
  private wallAt(x: number, y: number) { return this.config.map[y]?.[x] === '1' }
  private drawWall(ctx: CanvasRenderingContext2D, col: number, row: number, cell: number, ox: number, oy: number) {
    const palette = this.config.palette
    const x = ox + col * cell, y = oy + row * cell
    ctx.fillStyle = palette.wallOuter; ctx.fillRect(x, y, cell + .5, cell + .5)
    ctx.fillStyle = palette.wallInner; ctx.fillRect(x + 5, y + 5, cell - 10, cell - 10)
    ctx.strokeStyle = palette.wallEdge; ctx.fillStyle = palette.wallEdge; ctx.lineWidth = 2; ctx.shadowColor = palette.wallGlow; ctx.shadowBlur = 7
    const edge = (side: 'top' | 'right' | 'bottom' | 'left') => {
      ctx.beginPath()
      if (side === 'top') { ctx.moveTo(x, y + 1); ctx.lineTo(x + cell, y + 1) }
      if (side === 'right') { ctx.moveTo(x + cell - 1, y); ctx.lineTo(x + cell - 1, y + cell) }
      if (side === 'bottom') { ctx.moveTo(x, y + cell - 1); ctx.lineTo(x + cell, y + cell - 1) }
      if (side === 'left') { ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + cell) }
      ctx.stroke()
      for (let i = 5; i < cell - 3; i += 7) ctx.fillRect(side === 'left' ? x + 3 : side === 'right' ? x + cell - 5 : x + i, side === 'top' ? y + 3 : side === 'bottom' ? y + cell - 5 : y + i, side === 'top' || side === 'bottom' ? 3 : 2, side === 'left' || side === 'right' ? 3 : 2)
    }
    if (!this.wallAt(col, row - 1)) edge('top'); if (!this.wallAt(col + 1, row)) edge('right'); if (!this.wallAt(col, row + 1)) edge('bottom'); if (!this.wallAt(col - 1, row)) edge('left')
  }
  private getStaticLayer() {
    if (this.staticLayer?.width === Math.ceil(this.w) && this.staticLayer.height === Math.ceil(this.h)) return this.staticLayer
    const layer = document.createElement('canvas'); layer.width = Math.ceil(this.w); layer.height = Math.ceil(this.h)
    const layerContext = layer.getContext('2d')!; const { cell, ox, oy } = this.geometry(); const palette = this.config.palette
    layerContext.fillStyle = palette.floor; layerContext.fillRect(ox, oy, cell * VAULT_COLS, cell * VAULT_ROWS)
    for (let row = 0; row < VAULT_ROWS; row++) for (let col = 0; col < VAULT_COLS; col++) if (this.wallAt(col, row)) this.drawWall(layerContext, col, row, cell, ox, oy)
    layerContext.shadowBlur = 0; this.staticLayer = layer; return layer
  }
  render(ctx: CanvasRenderingContext2D) {
    const config = this.config, palette = config.palette
    ctx.fillStyle = palette.background; ctx.fillRect(0, 0, this.w, this.h)
    const { cell } = this.geometry(); ctx.save(); if (this.shake) ctx.translate(Math.sin(this.elapsed * 80) * this.shake * 8, Math.cos(this.elapsed * 63) * this.shake * 6); ctx.drawImage(this.getStaticLayer(), 0, 0)
    ctx.shadowBlur = 0; ctx.fillStyle = palette.signal
    for (const key of this.dots) { const [c, r] = key.split(',').map(Number), p = this.point(c, r); ctx.fillRect(p.x - 2, p.y - 2, 4, 4) }
    for (const key of this.coins) { const [c, r] = key.split(',').map(Number), p = this.point(c, r); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(this.elapsed * 2); ctx.fillStyle = '#ffe45f'; ctx.shadowColor = '#ffe45f'; ctx.shadowBlur = 18; ctx.fillRect(-5, -5, 10, 10); ctx.restore() }
    for (const [key] of config.portals) { const [c, r] = key.split(',').map(Number), p = this.point(c, r); ctx.strokeStyle = key === '1,1' ? '#35d9ff' : '#bf50ff'; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, cell * .27, this.elapsed * 2, this.elapsed * 2 + 4.8); ctx.stroke() }
    for (const key of config.switches) { const [c, r] = key.split(',').map(Number), p = this.point(c, r), active = !this.switches.has(key); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = active ? '#19f7e7' : '#ff9f1c'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = active ? 18 : 10; ctx.fillRect(-6, -6, 12, 12); ctx.fillStyle = palette.floor; ctx.fillRect(-2, -2, 4, 4); ctx.restore() }
    for (const s of config.spikes) { const p = this.point(s.x, s.y), active = this.spikeActive(s); ctx.fillStyle = active ? '#19f7e7' : 'rgba(25,247,231,.2)'; ctx.shadowColor = '#00f5e1'; ctx.shadowBlur = active ? 18 : 4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(p.x + i * 7 - 5, p.y + 8); ctx.lineTo(p.x + i * 7, p.y - (active ? 9 : 2)); ctx.lineTo(p.x + i * 7 + 5, p.y + 8); ctx.fill() } }
    const ls = this.point(config.laser.from, config.laser.row), le = this.point(config.laser.to, config.laser.row); ctx.strokeStyle = this.laserActive() ? '#00f5df' : 'rgba(0,245,223,.28)'; ctx.lineWidth = this.laserActive() ? 5 : 2; if (!this.laserActive()) ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.moveTo(ls.x - 9, ls.y); ctx.lineTo(le.x + 9, le.y); ctx.stroke(); ctx.setLineDash([])
    const [shieldCol, shieldRow] = config.shield.split(',').map(Number), shield = this.point(shieldCol, shieldRow); if (!this.player.shield) { ctx.strokeStyle = '#3377ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(shield.x, shield.y, 7, .3, 2.8); ctx.arc(shield.x, shield.y, 7, 3.5, 5.9); ctx.stroke() }
    const exit = this.point(config.exit.x, config.exit.y), open = !this.dots.size && !this.switches.size; ctx.strokeStyle = open ? '#16c79a' : '#a52b55'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(exit.x, exit.y, 10, this.elapsed * 2, this.elapsed * 2 + 5); ctx.stroke(); if (!open) { ctx.fillStyle = '#ff3b7f'; ctx.font = '800 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(this.dots.size + this.switches.size), exit.x, exit.y + 3) }
    const enemy = this.point(this.enemy.x, config.enemy.row); ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(this.elapsed + .8); ctx.fillStyle = this.stage === 1 ? '#16f5e6' : '#ff4f8b'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 20; ctx.fillRect(-7, -7, 14, 14); ctx.fillStyle = palette.floor; ctx.fillRect(-3, -3, 6, 6); ctx.restore()
    for (const t of this.trail) { const p = this.point(t.x, t.y); ctx.globalAlpha = t.life; ctx.fillStyle = '#f4ff2d'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill() } ctx.globalAlpha = 1
    for (const q of this.particles) { const p = this.point(q.x - .5, q.y - .5); ctx.globalAlpha = clamp(q.life * 2, 0, 1); ctx.fillStyle = q.color; ctx.fillRect(p.x, p.y, 4, 4) } ctx.globalAlpha = 1
    if (this.dying <= 0) {
      const p = this.point(this.player.x, this.player.y), clearScale = this.clearing ? this.clearing / .72 : 1
      const movingStretch = this.player.moving ? .26 : 0, impact = this.player.moving ? 0 : Math.sin(this.impactPulse * Math.PI) * .24
      const horizontal = this.moveDirection.x !== 0, along = 1 + movingStretch - impact, across = 1 - movingStretch * .48 + impact * .65
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale((horizontal ? along : across) * clearScale, (horizontal ? across : along) * clearScale)
      ctx.fillStyle = palette.player; ctx.shadowColor = palette.player; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = palette.playerCore; ctx.fillRect(-3, -3, 6, 6); ctx.restore()
      if (this.player.shield || this.shieldGrace > 0) { ctx.globalAlpha = this.player.shield ? 1 : .35 + Math.sin(this.elapsed * 35) * .2; ctx.strokeStyle = '#347cff'; ctx.lineWidth = this.player.shield ? 2 : 4; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1 }
    }
    ctx.restore(); ctx.shadowBlur = 0; ctx.fillStyle = palette.hud; ctx.fillRect(16, 54, this.w - 32, 42); ctx.font = '800 12px monospace'; ctx.fillStyle = palette.signal; ctx.textAlign = 'left'; ctx.fillText(`VAULT 0${this.stage}`, 30, 80); ctx.fillStyle = palette.hudAccent; ctx.textAlign = 'center'; ctx.fillText(`S${this.dots.size}  ⚡${config.switches.length - this.switches.size}/${config.switches.length}`, this.w / 2, 80); ctx.fillStyle = palette.signal; ctx.textAlign = 'right'; ctx.fillText(`◆ ${this.collectedCoins}/${config.coins.length}`, this.w - 30, 80)
    const darkText = '#fff'
    if (this.toastLife > 0) { ctx.globalAlpha = Math.min(1, this.toastLife * 2); ctx.fillStyle = darkText; ctx.textAlign = 'center'; ctx.font = '900 13px system-ui'; ctx.fillText(this.toast, this.w / 2, 119); ctx.globalAlpha = 1 }
    ctx.textAlign = 'center'; ctx.fillStyle = darkText; ctx.font = '800 17px system-ui'; ctx.fillText(`${this.score} NEON`, this.w / 2, this.h - 80); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '700 11px system-ui'; ctx.fillText('SWIPE • SLIDE TO THE WALL', this.w / 2, this.h - 108)
  }
}
