import type { ControllerOptions, GameController, GameStatus, GameTheme } from '../types'
import {
  AXEBOUND_FLOOR_Y,
  AXEBOUND_LEVEL_OBJECTS,
  AXEBOUND_SUMMIT_Y,
  AXEBOUND_WORLD_HEIGHT,
  AXEBOUND_WORLD_WIDTH,
  AXEBOUND_ZONES,
  isAxeBoundStickable,
  type AxeBoundLevelObject,
  type AxeBoundMaterial,
  type AxeBoundPoint,
} from './axeBoundLevel'

type AxeState = 'held' | 'flying' | 'stuck' | 'bouncing' | 'returning'
type Transform = { x: number; y: number; rotation: number; vx: number; vy: number }
type Contact = { object: AxeBoundLevelObject; transform: Transform; normal: AxeBoundPoint; penetration: number }
type Particle = AxeBoundPoint & { vx: number; vy: number; life: number; color: string; size: number }

const MAX_STEP = 1 / 120
const PLAYER_RADIUS = 23
const AXE_BLADE_RADIUS = 7
const AXE_HANDLE_LENGTH = 42
const MIN_DRAG = 18
const MAX_DRAG = 180
const MIN_THROW_SPEED = 430
const MAX_THROW_SPEED = 1080
const MIN_STICK_SPEED = 125
const MAX_STICK_SPEED = 1420
const MIN_ROPE_LENGTH = 76

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const length = (point: AxeBoundPoint) => Math.hypot(point.x, point.y)
const rotate = (point: AxeBoundPoint, angle: number): AxeBoundPoint => ({ x: point.x * Math.cos(angle) - point.y * Math.sin(angle), y: point.x * Math.sin(angle) + point.y * Math.cos(angle) })
const normalize = (point: AxeBoundPoint): AxeBoundPoint => { const size = length(point) || 1; return { x: point.x / size, y: point.y / size } }
const dot = (a: AxeBoundPoint, b: AxeBoundPoint) => a.x * b.x + a.y * b.y
const materialRestitution = (material: AxeBoundMaterial) => material === 'metal' ? .68 : material === 'crystal' ? .76 : material === 'ice' ? .58 : .42

export const canAxeBoundAxeStick = (
  material: AxeBoundMaterial,
  velocity: AxeBoundPoint,
  surfaceNormal: AxeBoundPoint,
  bladeAngle = Math.atan2(velocity.y, velocity.x),
) => {
  if (!isAxeBoundStickable(material)) return false
  const speed = length(velocity)
  if (speed < MIN_STICK_SPEED || speed > MAX_STICK_SPEED) return false
  const approach = -dot(velocity, surfaceNormal) / speed
  const bladeDirection = { x: Math.cos(bladeAngle), y: Math.sin(bladeAngle) }
  const bladeFacing = -dot(bladeDirection, surfaceNormal)
  const allowance = material === 'wood' ? .34 : .48
  return approach >= allowance && bladeFacing >= allowance - .12
}

const objectTransformAt = (object: AxeBoundLevelObject, elapsed: number, fallingAt?: number): Transform => {
  let x = object.x, y = object.y, rotation = object.rotation, vx = 0, vy = 0
  if (object.type === 'movingPlatform') {
    const duration = (object.moveDuration ?? 3000) / 1000
    const phase = elapsed / duration * Math.PI * 2
    const amplitude = (object.moveDistance ?? 180) / 2
    x += Math.sin(phase) * amplitude
    vx = Math.cos(phase) * amplitude * Math.PI * 2 / duration
  } else if (object.type === 'rotatingBeam') {
    rotation += elapsed * (object.rotationSpeed ?? .2)
  } else if (object.type === 'swingingBlock') {
    const angle = Math.sin(elapsed * 1.25 + object.x * .01) * .58
    const ropeLength = object.ropeLength ?? 160
    const anchorX = object.anchorX ?? object.x, anchorY = object.anchorY ?? object.y - ropeLength
    x = anchorX + Math.sin(angle) * ropeLength
    y = anchorY + Math.cos(angle) * ropeLength
    vx = Math.cos(angle) * Math.cos(elapsed * 1.25 + object.x * .01) * .58 * 1.25 * ropeLength
    vy = -Math.sin(angle) * Math.cos(elapsed * 1.25 + object.x * .01) * .58 * 1.25 * ropeLength
    rotation = angle * .42
  } else if (object.type === 'fallingRock' && fallingAt !== undefined) {
    const age = elapsed - fallingAt, delay = (object.triggerDelay ?? 450) / 1000, reset = (object.resetDelay ?? 4000) / 1000
    if (age > delay && age < reset) {
      const fallTime = age - delay
      y += Math.min(520, fallTime * fallTime * 190)
      vy = Math.min(760, fallTime * 380)
    } else if (age >= reset) {
      const returnProgress = clamp((age - reset) / 1.4, 0, 1)
      y += 520 * (1 - returnProgress)
      vy = returnProgress < 1 ? -371 : 0
    }
  }
  return { x, y, rotation, vx, vy }
}

const toLocal = (point: AxeBoundPoint, transform: Transform) => rotate({ x: point.x - transform.x, y: point.y - transform.y }, -transform.rotation)
const toWorldNormal = (normal: AxeBoundPoint, transform: Transform) => rotate(normal, transform.rotation)

const pointInPolygon = (point: AxeBoundPoint, points: readonly AxeBoundPoint[]) => {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-6) + a.x) inside = !inside
  }
  return inside
}

const closestPolygonEdge = (point: AxeBoundPoint, points: readonly AxeBoundPoint[]) => {
  let bestDistance = Infinity, bestNormal = { x: 0, y: -1 }
  for (let index = 0; index < points.length; index++) {
    const start = points[index], end = points[(index + 1) % points.length]
    const edge = { x: end.x - start.x, y: end.y - start.y }, edgeLengthSquared = dot(edge, edge) || 1
    const amount = clamp(dot({ x: point.x - start.x, y: point.y - start.y }, edge) / edgeLengthSquared, 0, 1)
    const closest = { x: start.x + edge.x * amount, y: start.y + edge.y * amount }
    const delta = { x: point.x - closest.x, y: point.y - closest.y }, distance = length(delta)
    if (distance < bestDistance) { bestDistance = distance; bestNormal = distance > 1e-4 ? normalize(delta) : normalize({ x: edge.y, y: -edge.x }) }
  }
  return { distance: bestDistance, normal: bestNormal }
}

const pointContact = (point: AxeBoundPoint, radius: number, object: AxeBoundLevelObject, transform: Transform): Contact | null => {
  const local = toLocal(point, transform)
  if (object.type === 'circle') {
    const objectRadius = object.radius ?? object.width / 2, distance = length(local), limit = objectRadius + radius
    if (distance >= limit) return null
    return { object, transform, normal: toWorldNormal(distance > .001 ? { x: local.x / distance, y: local.y / distance } : { x: 0, y: -1 }, transform), penetration: limit - distance }
  }
  if (object.type === 'polygon' && object.points) {
    const edge = closestPolygonEdge(local, object.points), inside = pointInPolygon(local, object.points)
    if (!inside && edge.distance >= radius) return null
    const normal = inside ? { x: -edge.normal.x, y: -edge.normal.y } : edge.normal
    return { object, transform, normal: toWorldNormal(normal, transform), penetration: inside ? radius + edge.distance : radius - edge.distance }
  }
  const halfWidth = object.width / 2, halfHeight = object.height / 2
  const closest = { x: clamp(local.x, -halfWidth, halfWidth), y: clamp(local.y, -halfHeight, halfHeight) }
  const delta = { x: local.x - closest.x, y: local.y - closest.y }, distance = length(delta)
  if (distance >= radius && (Math.abs(local.x) > halfWidth || Math.abs(local.y) > halfHeight)) return null
  let normal: AxeBoundPoint, penetration: number
  if (distance > .001) { normal = { x: delta.x / distance, y: delta.y / distance }; penetration = radius - distance }
  else {
    const gapX = halfWidth - Math.abs(local.x), gapY = halfHeight - Math.abs(local.y)
    if (gapX < gapY) { normal = { x: Math.sign(local.x) || 1, y: 0 }; penetration = radius + gapX }
    else { normal = { x: 0, y: Math.sign(local.y) || -1 }; penetration = radius + gapY }
  }
  return { object, transform, normal: toWorldNormal(normal, transform), penetration }
}

const materialPalette: Record<AxeBoundMaterial, { fill: string; edge: string }> = {
  rock: { fill: '#24102f', edge: '#ff2b93' },
  wood: { fill: '#4d251f', edge: '#ffb23e' },
  metal: { fill: '#14283d', edge: '#54d9ff' },
  crystal: { fill: '#32134d', edge: '#54ffe1' },
  spikeRock: { fill: '#180d20', edge: '#8d235e' },
  ice: { fill: '#12334d', edge: '#8eefff' },
}

export class AxeBoundController implements GameController {
  private w = 390
  private h = 844
  private scale = 390 / AXEBOUND_WORLD_WIDTH
  private viewWorldHeight = 844 / this.scale
  private status: GameStatus = 'playing'
  private paused = false
  private elapsed = 0
  private score = 0
  private cameraY = AXEBOUND_FLOOR_Y - 1100
  private highestY = AXEBOUND_FLOOR_Y
  private fallArmed = true
  private shake = 0
  private autoClock = 0
  private clear = false
  private clearTimer = 0
  private fallingObjects = new Map<string, number>()
  private particles: Particle[] = []
  private objectById = new Map(AXEBOUND_LEVEL_OBJECTS.map((object) => [object.id, object]))
  player = { x: 360, y: 7020, vx: 0, vy: 0, rotation: 0, grounded: false }
  axe = { state: 'held' as AxeState, x: 380, y: 6985, vx: 0, vy: 0, angle: -Math.PI / 2, angularVelocity: 0, flightTime: 0, returnTime: 0, stuckObjectId: null as string | null, stuckLocal: { x: 0, y: 0 }, ropeLength: 100, stuckTime: 0 }
  aimStart: AxeBoundPoint | null = null
  aimCurrent: AxeBoundPoint | null = null
  falls = 0
  throws = 0

  constructor(private readonly theme: GameTheme, private readonly options: ControllerOptions) { this.reset() }

  resize(width: number, height: number, _dpr?: number) {
    this.w = width; this.h = height; this.scale = width / AXEBOUND_WORLD_WIDTH; this.viewWorldHeight = height / this.scale
    this.cameraY = clamp(this.cameraY, 0, Math.max(0, AXEBOUND_WORLD_HEIGHT - this.viewWorldHeight))
  }

  update(dt: number) {
    if (this.paused || this.status === 'finished') return
    dt = Math.min(dt, .04); this.elapsed += dt
    if (this.clear) {
      this.clearTimer += dt; this.player.vx *= .94; this.player.vy *= .94; this.cameraY += (0 - this.cameraY) * Math.min(1, dt * 2.2)
      if (this.clearTimer >= 1.8) { this.status = 'finished'; this.options.onFinish(this.score) }
      return
    }
    for (const [id, startedAt] of this.fallingObjects) {
      const object = this.objectById.get(id), resetTime = ((object?.resetDelay ?? 4000) / 1000) + 1.4
      if (this.elapsed - startedAt >= resetTime) this.fallingObjects.delete(id)
    }
    if (this.options.preview) this.updateAutopilot(dt)
    const steps = Math.max(1, Math.ceil(dt / MAX_STEP)), step = dt / steps
    for (let index = 0; index < steps; index++) this.step(step)
    this.updateCamera(dt)
    this.particles.forEach((particle) => { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 360 * dt })
    this.particles = this.particles.filter((particle) => particle.life > 0).slice(0, 55)
    this.shake = Math.max(0, this.shake - dt * 4.5)
  }

  private step(dt: number) {
    this.updateAxe(dt)
    this.applyRopeConstraint(dt)
    this.player.vy += 930 * dt
    this.player.vx *= Math.pow(.995, dt * 60); this.player.vy *= Math.pow(.999, dt * 60)
    this.player.x += this.player.vx * dt; this.player.y += this.player.vy * dt
    this.player.grounded = false
    for (let pass = 0; pass < 2; pass++) this.resolvePlayerTerrain()
    this.player.rotation += this.player.vx * dt * .003
    this.trackProgress()
    this.checkSummit()
  }

  pointerDown(x: number, y: number) {
    if (this.status === 'finished' || this.clear || this.aimStart) return
    this.aimStart = { x, y }; this.aimCurrent = { x, y }
  }
  pointerMove(x: number, y: number) { if (this.aimStart) this.aimCurrent = { x, y } }
  pointerUp(x: number, y: number) {
    if (!this.aimStart) return
    this.aimCurrent = { x, y }
    const drag = { x: x - this.aimStart.x, y: y - this.aimStart.y }, dragLength = length(drag)
    this.aimStart = null; this.aimCurrent = null
    if (dragLength < MIN_DRAG) return
    this.throwAxe(normalize(drag), clamp(dragLength / MAX_DRAG, 0, 1))
  }
  swipe(dx: number, dy: number) { if (length({ x: dx, y: dy }) >= MIN_DRAG) this.throwAxe(normalize({ x: dx, y: dy }), clamp(length({ x: dx, y: dy }) / 160, 0, 1)) }

  private throwAxe(direction: AxeBoundPoint, power: number) {
    const speed = MIN_THROW_SPEED + (MAX_THROW_SPEED - MIN_THROW_SPEED) * power
    this.axe.state = 'flying'; this.axe.stuckObjectId = null; this.axe.flightTime = 0; this.axe.stuckTime = 0
    this.axe.x = this.player.x + direction.x * (PLAYER_RADIUS + 12); this.axe.y = this.player.y + direction.y * (PLAYER_RADIUS + 12)
    this.axe.vx = this.player.vx * .2 + direction.x * speed; this.axe.vy = this.player.vy * .12 + direction.y * speed
    this.axe.angle = Math.atan2(direction.y, direction.x); this.axe.angularVelocity = 2.2 + power * 2.2
    this.throws += 1; this.options.onImpact('tap')
  }

  private updateAxe(dt: number) {
    if (this.axe.state === 'held') { this.placeHeldAxe(); return }
    if (this.axe.state === 'returning') {
      this.axe.returnTime -= dt
      const target = { x: this.player.x + 20, y: this.player.y - 18 }
      this.axe.x += (target.x - this.axe.x) * Math.min(1, dt * 18); this.axe.y += (target.y - this.axe.y) * Math.min(1, dt * 18)
      if (this.axe.returnTime <= 0) { this.axe.state = 'held'; this.placeHeldAxe() }
      return
    }
    if (this.axe.state === 'stuck') { this.updateStuckAnchor(dt); return }

    this.axe.flightTime += dt; this.axe.vy += 760 * dt; this.axe.vx *= Math.pow(.998, dt * 60)
    this.axe.x += this.axe.vx * dt; this.axe.y += this.axe.vy * dt; this.axe.angle += this.axe.angularVelocity * dt
    const bladeContact = this.findPointContact({ x: this.axe.x, y: this.axe.y }, AXE_BLADE_RADIUS)
    const handlePoint = { x: this.axe.x - Math.cos(this.axe.angle) * AXE_HANDLE_LENGTH, y: this.axe.y - Math.sin(this.axe.angle) * AXE_HANDLE_LENGTH }
    const handleContact = bladeContact ? null : this.findPointContact(handlePoint, 5)
    const axeVelocity = { x: this.axe.vx, y: this.axe.vy }
    if (bladeContact && canAxeBoundAxeStick(bladeContact.object.material, axeVelocity, bladeContact.normal, this.axe.angle)) this.stickAxe(bladeContact)
    else if (bladeContact || handleContact) this.bounceAxe(bladeContact ?? handleContact!)
    else if (this.axe.flightTime > 1.75 || this.axe.y > AXEBOUND_WORLD_HEIGHT + 250 || this.axe.x < -180 || this.axe.x > AXEBOUND_WORLD_WIDTH + 180) this.returnAxe()
  }

  private placeHeldAxe() { this.axe.x = this.player.x + 21; this.axe.y = this.player.y - 19; this.axe.angle = -.9; this.axe.vx = 0; this.axe.vy = 0 }
  private returnAxe() { this.axe.state = 'returning'; this.axe.returnTime = .12; this.axe.stuckObjectId = null }

  private stickAxe(contact: Contact) {
    this.axe.state = 'stuck'; this.axe.vx = 0; this.axe.vy = 0; this.axe.angularVelocity = 0; this.axe.stuckObjectId = contact.object.id
    this.axe.stuckLocal = toLocal({ x: this.axe.x, y: this.axe.y }, contact.transform)
    this.axe.ropeLength = Math.max(MIN_ROPE_LENGTH, Math.hypot(this.player.x - this.axe.x, this.player.y - this.axe.y)); this.axe.stuckTime = 0
    this.triggerFallingObject(contact.object); this.spawnImpact(this.axe.x, this.axe.y, contact.object.material, true); this.shake = .7; this.options.onImpact('perfect')
  }

  private bounceAxe(contact: Contact) {
    const velocity = { x: this.axe.vx, y: this.axe.vy }, normalSpeed = dot(velocity, contact.normal), restitution = materialRestitution(contact.object.material)
    if (normalSpeed < 0) { this.axe.vx -= (1 + restitution) * normalSpeed * contact.normal.x; this.axe.vy -= (1 + restitution) * normalSpeed * contact.normal.y }
    this.axe.vx *= .72; this.axe.vy *= .72; this.axe.x += contact.normal.x * Math.max(3, contact.penetration); this.axe.y += contact.normal.y * Math.max(3, contact.penetration)
    this.axe.state = 'bouncing'; this.axe.angularVelocity *= -1.08; this.triggerFallingObject(contact.object); this.spawnImpact(this.axe.x, this.axe.y, contact.object.material, false); this.shake = .28; this.options.onImpact('fail')
  }

  private updateStuckAnchor(dt: number) {
    const object = this.axe.stuckObjectId ? this.objectById.get(this.axe.stuckObjectId) : undefined
    if (!object) { this.returnAxe(); return }
    const transform = this.getTransform(object), worldOffset = rotate(this.axe.stuckLocal, transform.rotation)
    this.axe.x = transform.x + worldOffset.x; this.axe.y = transform.y + worldOffset.y; this.axe.vx = transform.vx; this.axe.vy = transform.vy; this.axe.stuckTime += dt
  }

  private applyRopeConstraint(dt: number) {
    if (this.axe.state !== 'stuck') return
    if (this.axe.stuckTime > .13) this.axe.ropeLength = Math.max(MIN_ROPE_LENGTH, this.axe.ropeLength - 92 * dt)
    const delta = { x: this.axe.x - this.player.x, y: this.axe.y - this.player.y }, distance = length(delta)
    if (distance <= this.axe.ropeLength || distance < 1) return
    const direction = { x: delta.x / distance, y: delta.y / distance }, excess = distance - this.axe.ropeLength
    const movingAway = Math.max(0, -dot({ x: this.player.vx, y: this.player.vy }, direction))
    const acceleration = Math.min(5200, excess * 46 + movingAway * 9)
    this.player.vx += direction.x * acceleration * dt; this.player.vy += direction.y * acceleration * dt
  }

  private resolvePlayerTerrain() {
    const nearby = this.nearbyObjects(this.player.y, 150)
    for (const object of nearby) {
      const transform = this.getTransform(object), contact = pointContact(this.player, PLAYER_RADIUS, object, transform)
      if (!contact) continue
      this.player.x += contact.normal.x * Math.max(0, contact.penetration); this.player.y += contact.normal.y * Math.max(0, contact.penetration)
      const relativeVelocity = { x: this.player.vx - transform.vx, y: this.player.vy - transform.vy }, intoSurface = dot(relativeVelocity, contact.normal)
      if (intoSurface < 0) {
        this.player.vx -= intoSurface * contact.normal.x * 1.08; this.player.vy -= intoSurface * contact.normal.y * 1.08
        this.player.vx += transform.vx * .18; this.player.vy += transform.vy * .18
      }
      const friction = object.material === 'ice' ? .998 : object.material === 'metal' ? .94 : object.material === 'spikeRock' ? .98 : .82
      if (contact.normal.y < -.45) { this.player.vx *= friction; this.player.grounded = true }
      else this.player.vy *= .97
      this.triggerFallingObject(object)
    }
  }

  private findPointContact(point: AxeBoundPoint, radius: number) {
    for (const object of this.nearbyObjects(point.y, 100)) {
      const contact = pointContact(point, radius, object, this.getTransform(object))
      if (contact) return contact
    }
    return null
  }

  private nearbyObjects(y: number, margin: number) {
    return AXEBOUND_LEVEL_OBJECTS.filter((object) => {
      const transform = this.getTransform(object)
      return Math.abs(transform.y - y) <= object.height / 2 + margin + (object.ropeLength ?? 0)
    })
  }
  private getTransform(object: AxeBoundLevelObject) { return objectTransformAt(object, this.elapsed, this.fallingObjects.get(object.id)) }
  private triggerFallingObject(object: AxeBoundLevelObject) { if (object.type === 'fallingRock' && !this.fallingObjects.has(object.id)) this.fallingObjects.set(object.id, this.elapsed) }

  private trackProgress() {
    this.highestY = Math.min(this.highestY, this.player.y)
    const heightMeters = this.getHeightMeters(this.highestY)
    if (heightMeters > this.score) { this.score = heightMeters; this.options.onScore(this.score) }
    const drop = this.player.y - this.highestY
    if (drop > 620 && this.fallArmed) { this.falls += 1; this.fallArmed = false }
    if (drop < 260) this.fallArmed = true
  }
  private getHeightMeters(y = this.player.y) { return clamp(Math.round((AXEBOUND_FLOOR_Y - y) / (AXEBOUND_FLOOR_Y - AXEBOUND_SUMMIT_Y) * 1000), 0, 1000) }

  private checkSummit() {
    if (this.clear) return
    const goal = this.objectById.get('summit-goal')!, goalTransform = this.getTransform(goal)
    const playerReached = Math.hypot(this.player.x - goalTransform.x, this.player.y - goalTransform.y) < 82
    const axeReached = this.axe.state === 'stuck' && this.axe.stuckObjectId === goal.id && Math.hypot(this.player.x - this.axe.x, this.player.y - this.axe.y) < 125
    if (!playerReached && !axeReached) return
    this.clear = true; this.score = 1000; this.options.onScore(this.score); this.options.onImpact('perfect')
    if (this.options.preview) { this.reset(); return }
    this.clearTimer = 0; this.axe.state = 'stuck'; this.axe.stuckObjectId = goal.id; this.axe.x = goalTransform.x; this.axe.y = goalTransform.y; this.axe.stuckLocal = { x: 0, y: 0 }; this.axe.ropeLength = MIN_ROPE_LENGTH
  }

  private updateCamera(dt: number) {
    const lookAhead = this.player.vy < -120 ? 120 : 0
    const desired = clamp(this.player.y - this.viewWorldHeight * .61 - lookAhead, 0, Math.max(0, AXEBOUND_WORLD_HEIGHT - this.viewWorldHeight))
    const followSpeed = this.player.vy > 450 ? 9 : this.aimStart ? 3.2 : 5.4
    this.cameraY += (desired - this.cameraY) * Math.min(1, dt * followSpeed)
  }

  private updateAutopilot(dt: number) {
    this.autoClock += dt
    if (this.autoClock < .72) return
    this.autoClock = 0
    const candidates = AXEBOUND_LEVEL_OBJECTS.filter((object) => isAxeBoundStickable(object.material) && object.y < this.player.y - 90 && object.y > this.player.y - 520)
    const target = candidates.sort((a, b) => Math.abs(a.x - this.player.x) + Math.abs(a.y - this.player.y) - (Math.abs(b.x - this.player.x) + Math.abs(b.y - this.player.y)))[0]
    const direction = target ? normalize({ x: target.x - this.player.x, y: target.y + target.height / 2 - this.player.y }) : normalize({ x: Math.sin(this.elapsed) * .35, y: -1 })
    this.throwAxe(direction, .74)
  }

  private spawnImpact(x: number, y: number, material: AxeBoundMaterial, stuck: boolean) {
    const color = stuck ? '#ffcf4e' : materialPalette[material].edge
    for (let index = 0; index < 8; index++) {
      const angle = index / 8 * Math.PI * 2 + this.elapsed, speed = 45 + (index % 3) * 32
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + (index % 2) * .18, color, size: 3 + index % 2 })
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    this.drawBackdrop(ctx)
    ctx.save()
    if (this.shake > 0) ctx.translate(Math.sin(this.elapsed * 90) * this.shake * 3, Math.cos(this.elapsed * 77) * this.shake * 2)
    for (const object of AXEBOUND_LEVEL_OBJECTS) this.drawObject(ctx, object)
    this.drawRope(ctx); this.drawParticles(ctx); this.drawPlayer(ctx); this.drawAxe(ctx); this.drawAim(ctx)
    ctx.restore()
    this.drawHud(ctx)
    if (this.clear) this.drawClearOverlay(ctx)
  }

  private worldToScreen(point: AxeBoundPoint): AxeBoundPoint { return { x: point.x * this.scale, y: (point.y - this.cameraY) * this.scale } }
  private drawBackdrop(ctx: CanvasRenderingContext2D) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.h); gradient.addColorStop(0, '#05030c'); gradient.addColorStop(.55, '#0b0616'); gradient.addColorStop(1, this.theme.surface)
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.w, this.h)
    const drift = -(this.cameraY * this.scale * .08) % 180
    ctx.strokeStyle = 'rgba(91,28,112,.12)'; ctx.lineWidth = 2
    for (let index = -1; index < 7; index++) { const y = index * 180 + drift; ctx.beginPath(); ctx.moveTo(this.w * .12, y); ctx.lineTo(this.w * .3, y + 90); ctx.lineTo(this.w * .2, y + 180); ctx.stroke(); ctx.beginPath(); ctx.moveTo(this.w * .88, y + 20); ctx.lineTo(this.w * .7, y + 105); ctx.stroke() }
    ctx.fillStyle = 'rgba(222,49,162,.035)'
    for (let index = 0; index < 20; index++) ctx.fillRect((index * 83) % this.w, (index * 137 + drift * .4) % this.h, 3, 26 + index % 4 * 12)
  }

  private drawObject(ctx: CanvasRenderingContext2D, object: AxeBoundLevelObject) {
    const transform = this.getTransform(object), screen = this.worldToScreen(transform)
    const extra = (object.ropeLength ?? 0) * this.scale
    if (screen.y < -object.height * this.scale - extra - 80 || screen.y > this.h + object.height * this.scale + extra + 80) return
    if (object.type === 'swingingBlock') {
      const anchor = this.worldToScreen({ x: object.anchorX ?? object.x, y: object.anchorY ?? object.y - (object.ropeLength ?? 160) })
      ctx.strokeStyle = 'rgba(155,89,170,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(screen.x, screen.y); ctx.stroke()
    }
    const palette = materialPalette[object.material]
    ctx.save(); ctx.translate(screen.x, screen.y); ctx.rotate(transform.rotation); ctx.scale(this.scale, this.scale)
    ctx.fillStyle = palette.fill; ctx.strokeStyle = palette.edge; ctx.lineWidth = 5 / this.scale; ctx.shadowColor = palette.edge; ctx.shadowBlur = 10 / this.scale
    ctx.beginPath()
    if (object.type === 'circle') ctx.arc(0, 0, object.radius ?? object.width / 2, 0, Math.PI * 2)
    else if (object.type === 'polygon' && object.points) { ctx.moveTo(object.points[0].x, object.points[0].y); object.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); ctx.closePath() }
    else ctx.roundRect(-object.width / 2, -object.height / 2, object.width, object.height, Math.min(12, object.height * .22))
    ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0
    if (object.material === 'rock' || object.material === 'spikeRock') {
      ctx.strokeStyle = object.material === 'rock' ? 'rgba(255,111,190,.34)' : 'rgba(128,40,96,.34)'; ctx.lineWidth = 2 / this.scale
      for (let index = -1; index <= 1; index++) { ctx.beginPath(); ctx.moveTo(index * object.width * .2, -object.height * .34); ctx.lineTo(index * object.width * .2 + 11, 0); ctx.lineTo(index * object.width * .2 - 3, object.height * .3); ctx.stroke() }
    } else if (object.material === 'metal') {
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2 / this.scale; ctx.beginPath(); ctx.moveTo(-object.width * .35, 0); ctx.lineTo(object.width * .35, 0); ctx.stroke()
    } else if (object.material === 'wood') {
      ctx.strokeStyle = 'rgba(255,204,104,.35)'; ctx.lineWidth = 2 / this.scale; for (let x = -object.width * .3; x <= object.width * .3; x += 28) { ctx.beginPath(); ctx.moveTo(x, -object.height / 2); ctx.lineTo(x + 9, object.height / 2); ctx.stroke() }
    }
    ctx.restore()
    if (object.type === 'goal') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const glow = ctx.createRadialGradient(screen.x, screen.y, 4, screen.x, screen.y, 70); glow.addColorStop(0, 'rgba(255,244,154,.9)'); glow.addColorStop(1, 'rgba(255,217,73,0)'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(screen.x, screen.y, 70, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const point = this.worldToScreen(this.player), radius = PLAYER_RADIUS * this.scale
    ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(this.player.rotation * .15)
    if (this.player.vy > 520) { ctx.strokeStyle = 'rgba(255,80,177,.28)'; ctx.lineWidth = 2; for (let index = -2; index <= 2; index++) { ctx.beginPath(); ctx.moveTo(index * 7, -34); ctx.lineTo(index * 7, -70 - Math.min(50, this.player.vy * .04)); ctx.stroke() } }
    ctx.fillStyle = '#f5a53b'; ctx.shadowColor = '#ff8d32'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, -radius * .42, radius * .43, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffd16a'; ctx.beginPath(); ctx.roundRect(-radius * .48, -radius * .08, radius * .96, radius * 1.25, radius * .34); ctx.fill()
    ctx.fillStyle = '#4a174f'; ctx.beginPath(); ctx.moveTo(-radius * .42, radius * .12); ctx.lineTo(radius * .52, radius * .25); ctx.lineTo(0, radius * 1.2); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#ffcf45'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-radius * .2, radius * 1.1); ctx.lineTo(-radius * .55, radius * 1.55); ctx.moveTo(radius * .18, radius * 1.1); ctx.lineTo(radius * .52, radius * 1.5); ctx.stroke(); ctx.restore()
  }

  private drawAxe(ctx: CanvasRenderingContext2D) {
    const point = this.worldToScreen(this.axe); ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(this.axe.angle); ctx.scale(this.scale, this.scale)
    ctx.strokeStyle = '#ffca45'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.shadowColor = '#ffae32'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(-AXE_HANDLE_LENGTH, 0); ctx.lineTo(-5, 0); ctx.stroke()
    ctx.fillStyle = '#fff1a0'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(-4, -22, -20, -18); ctx.lineTo(-10, 1); ctx.lineTo(-20, 18); ctx.quadraticCurveTo(-4, 22, 4, 0); ctx.fill(); ctx.restore()
  }

  private drawRope(ctx: CanvasRenderingContext2D) {
    if (this.axe.state !== 'stuck') return
    const player = this.worldToScreen(this.player), axe = this.worldToScreen(this.axe)
    ctx.save(); ctx.strokeStyle = 'rgba(255,205,70,.82)'; ctx.shadowColor = '#ff3f9f'; ctx.shadowBlur = 8; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.quadraticCurveTo((player.x + axe.x) / 2 + this.player.vx * .015, (player.y + axe.y) / 2 + 8, axe.x, axe.y); ctx.stroke(); ctx.restore()
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const particle of this.particles) { const point = this.worldToScreen(particle); ctx.globalAlpha = clamp(particle.life * 2.5, 0, 1); ctx.fillStyle = particle.color; ctx.fillRect(point.x, point.y, particle.size, particle.size) }
    ctx.globalAlpha = 1
  }

  private drawAim(ctx: CanvasRenderingContext2D) {
    if (!this.aimStart || !this.aimCurrent) return
    const drag = { x: this.aimCurrent.x - this.aimStart.x, y: this.aimCurrent.y - this.aimStart.y }, dragLength = length(drag)
    if (dragLength < 2) return
    const direction = normalize(drag), power = clamp(dragLength / MAX_DRAG, 0, 1), speed = MIN_THROW_SPEED + (MAX_THROW_SPEED - MIN_THROW_SPEED) * power
    ctx.save(); ctx.strokeStyle = '#ffcc45'; ctx.lineWidth = 3; ctx.shadowColor = '#ff3f9f'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(this.aimStart.x, this.aimStart.y); ctx.lineTo(this.aimStart.x + direction.x * Math.min(MAX_DRAG, dragLength), this.aimStart.y + direction.y * Math.min(MAX_DRAG, dragLength)); ctx.stroke(); ctx.shadowBlur = 0
    const player = this.worldToScreen(this.player)
    for (let index = 1; index <= 7; index++) {
      const time = index * .075, world = { x: this.player.x + direction.x * speed * time, y: this.player.y + direction.y * speed * time + 380 * time * time }
      const point = this.worldToScreen(world); ctx.globalAlpha = 1 - index * .09; ctx.fillStyle = index === 7 ? '#ff5fae' : '#ffe486'; ctx.beginPath(); ctx.arc(point.x, point.y, index === 7 ? 4 : 2.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '800 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${Math.round(power * 100)}%`, player.x, player.y + 44); ctx.restore()
  }

  private drawHud(ctx: CanvasRenderingContext2D) {
    const currentHeight = this.getHeightMeters(), zone = AXEBOUND_ZONES.find((item) => this.player.y >= item.y) ?? AXEBOUND_ZONES[AXEBOUND_ZONES.length - 1]
    ctx.save(); ctx.fillStyle = 'rgba(5,3,12,.82)'; ctx.strokeStyle = 'rgba(255,64,157,.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(12, 10, this.w - 24, 55, 14); ctx.fill(); ctx.stroke()
    ctx.textAlign = 'left'; ctx.fillStyle = '#ff5bae'; ctx.font = '900 8px ui-monospace, monospace'; ctx.fillText(zone.name, 26, 27); ctx.fillStyle = '#fff'; ctx.font = '900 16px ui-monospace, monospace'; ctx.fillText(`HEIGHT ${currentHeight}m`, 26, 49)
    ctx.textAlign = 'right'; ctx.fillStyle = '#9c86ae'; ctx.font = '800 8px ui-monospace, monospace'; ctx.fillText('SESSION BEST', this.w - 26, 27); ctx.fillStyle = '#ffe066'; ctx.font = '900 16px ui-monospace, monospace'; ctx.fillText(`${this.score}m`, this.w - 26, 49)
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.58)'; ctx.font = '800 9px system-ui'; ctx.fillText(`DRAG TO THROW  •  FALLS ${this.falls}  •  THROWS ${this.throws}`, this.w / 2, this.h - 18); ctx.restore()
  }

  private drawClearOverlay(ctx: CanvasRenderingContext2D) {
    const alpha = clamp(this.clearTimer * 2.5, 0, 1), minutes = Math.floor(this.elapsed / 60), seconds = Math.floor(this.elapsed % 60)
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = 'rgba(4,2,10,.78)'; ctx.fillRect(0, 0, this.w, this.h)
    const glow = ctx.createRadialGradient(this.w / 2, this.h * .33, 5, this.w / 2, this.h * .33, this.w * .45); glow.addColorStop(0, 'rgba(255,224,92,.35)'); glow.addColorStop(1, 'rgba(255,44,151,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, this.w, this.h * .7)
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffcf45'; ctx.font = '900 10px ui-monospace, monospace'; ctx.fillText('THE HOLLOW SPIRE', this.w / 2, this.h * .28)
    ctx.fillStyle = '#fff'; ctx.font = '950 27px system-ui'; ctx.fillText('YOU REACHED THE CROWN', this.w / 2, this.h * .35)
    const labels = [['TIME', `${minutes}:${String(seconds).padStart(2, '0')}`], ['FALLS', String(this.falls)], ['BEST HEIGHT', '1000m'], ['THROWS', String(this.throws)]]
    ctx.font = '800 9px ui-monospace, monospace'
    labels.forEach(([label, value], index) => { const x = this.w * (.2 + index % 2 * .6), y = this.h * (.46 + Math.floor(index / 2) * .1); ctx.fillStyle = '#8f7ca4'; ctx.fillText(label, x, y); ctx.fillStyle = '#fff1bd'; ctx.font = '900 18px ui-monospace, monospace'; ctx.fillText(value, x, y + 23); ctx.font = '800 9px ui-monospace, monospace' })
    ctx.restore()
  }

  pause() { this.paused = true; if (this.status !== 'finished') this.status = 'paused' }
  resume() { this.paused = false; if (this.status === 'paused') this.status = 'playing' }
  restart() { this.score = 0; this.elapsed = 0; this.paused = false; this.status = 'playing'; this.reset() }
  reset() {
    this.player = { x: 360, y: 7020, vx: 0, vy: 0, rotation: 0, grounded: false }
    this.axe = { state: 'held', x: 380, y: 6985, vx: 0, vy: 0, angle: -Math.PI / 2, angularVelocity: 0, flightTime: 0, returnTime: 0, stuckObjectId: null, stuckLocal: { x: 0, y: 0 }, ropeLength: 100, stuckTime: 0 }
    this.cameraY = clamp(AXEBOUND_FLOOR_Y - this.viewWorldHeight * .86, 0, AXEBOUND_WORLD_HEIGHT - this.viewWorldHeight); this.highestY = AXEBOUND_FLOOR_Y; this.aimStart = null; this.aimCurrent = null; this.falls = 0; this.throws = 0; this.fallArmed = true; this.shake = 0; this.autoClock = 0; this.clear = false; this.clearTimer = 0; this.fallingObjects.clear(); this.particles = []
  }
  destroy() { this.paused = true; this.particles = [] }
  getScore() { return this.score }
  getStatus() { return this.status }
}
