import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import { AxeBoundController, canAxeBoundAxeStick } from '../games/runtime/AxeBoundController'
import { AXEBOUND_LEVEL_OBJECTS, AXEBOUND_ZONES, isAxeBoundStickable } from '../games/runtime/axeBoundLevel'

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'axebound')!
  const onScore = vi.fn(), onFinish = vi.fn(), onImpact = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish, onImpact }) as AxeBoundController
  controller.resize(390, 780, 1); controller.restart()
  return { controller, onScore, onFinish, onImpact }
}

describe('AXEBOUND physics', () => {
  it('aims from anywhere and launches opposite the pull like a slingshot', () => {
    const { controller } = makeController()
    controller.pointerDown(34, 210); controller.pointerMove(154, 330); controller.pointerUp(154, 330)

    expect(controller.axe.state).toBe('flying')
    expect(controller.axe.vx).toBeLessThan(0)
    expect(controller.axe.vy).toBeLessThan(0)
    expect(controller.throws).toBe(1)
  })

  it('fires the axe upward when pulling straight down', () => {
    const { controller } = makeController()
    controller.pointerDown(350, 140); controller.pointerUp(350, 260)

    expect(controller.axe.vx).toBeCloseTo(0, 5)
    expect(controller.axe.vy).toBeLessThan(-400)
  })

  it('cancels a very short drag without releasing the ready axe', () => {
    const { controller } = makeController()
    controller.pointerDown(100, 300); controller.pointerUp(108, 306)

    expect(controller.axe.state).toBe('ready')
    expect(controller.throws).toBe(0)
  })

  it('only accepts blade-first impacts on rock and wood', () => {
    const upward = { x: 0, y: -500 }, undersideNormal = { x: 0, y: 1 }
    expect(canAxeBoundAxeStick('rock', upward, undersideNormal, -Math.PI / 2)).toBe(true)
    expect(canAxeBoundAxeStick('wood', upward, undersideNormal, -Math.PI / 2)).toBe(true)
    expect(canAxeBoundAxeStick('metal', upward, undersideNormal, -Math.PI / 2)).toBe(false)
    expect(canAxeBoundAxeStick('crystal', upward, undersideNormal, -Math.PI / 2)).toBe(false)
    expect(canAxeBoundAxeStick('ice', upward, undersideNormal, -Math.PI / 2)).toBe(false)
    expect(canAxeBoundAxeStick('spikeRock', upward, undersideNormal, -Math.PI / 2)).toBe(false)
    expect(canAxeBoundAxeStick('rock', upward, undersideNormal, 0)).toBe(false)
  })

  it('sticks into a real rock and launches the same axe from that position', () => {
    const { controller } = makeController()
    controller.axe.state = 'flying'; controller.axe.x = 232.5; controller.axe.y = 6235
    controller.axe.vx = 0; controller.axe.vy = -500; controller.axe.angle = -Math.PI / 2; controller.axe.angularVelocity = 0; controller.axe.flightTime = 0
    controller.update(.04)

    expect(controller.axe.state).toBe('stuck')
    expect(controller.axe.stuckObjectId).toBe('s2-high-left')

    const anchor = { x: controller.axe.x, y: controller.axe.y }
    controller.pointerDown(300, 300); controller.pointerUp(300, 420)

    expect(controller.axe.state).toBe('flying')
    expect(controller.axe.x).toBeCloseTo(anchor.x, 0)
    expect(controller.axe.y).toBeLessThan(anchor.y)
    expect(controller.axe.vy).toBeLessThan(0)
  })

  it('contains no separate player body or character rope', () => {
    const { controller } = makeController()

    expect('player' in controller).toBe(false)
    expect('drawPlayer' in controller).toBe(false)
    expect('drawRope' in controller).toBe(false)
  })

  it('loads the dedicated golden axe artwork', () => {
    const { controller } = makeController()
    const sprite = (controller as unknown as { axeSprite: HTMLImageElement }).axeSprite

    expect(sprite).toBeInstanceOf(HTMLImageElement)
    expect(sprite.src).toContain('/assets/games/axebound/axe.png')
  })

  it('loads the six supplied PNG maps unchanged in their original order', () => {
    const { controller } = makeController()
    const maps = (controller as unknown as { mapSprites: HTMLImageElement[] }).mapSprites

    expect(maps).toHaveLength(6)
    maps.forEach((map, index) => expect(map.src).toContain(`/assets/games/axebound/maps/map-${String(index + 1).padStart(2, '0')}.png`))
  })

  it('allows only one throw and ignores every aim gesture while the axe is airborne', () => {
    const { controller } = makeController()
    controller.axe.state = 'flying'; controller.axe.stuckObjectId = null
    controller.axe.x = 220; controller.axe.y = 540; controller.axe.vx = 180; controller.axe.vy = 260
    controller.pointerDown(40, 120); controller.pointerUp(40, 240)

    expect(controller.axe.x).toBe(220)
    expect(controller.axe.y).toBe(540)
    expect(controller.axe.vx).toBe(180)
    expect(controller.axe.vy).toBe(260)
    expect(controller.aimStart).toBeNull()
    expect(controller.throws).toBe(0)
  })

  it('collides with the attached platform instead of passing through when launched into it', () => {
    const { controller } = makeController()
    controller.axe.state = 'flying'; controller.axe.x = 232.5; controller.axe.y = 6235
    controller.axe.vx = 0; controller.axe.vy = -500; controller.axe.angle = -Math.PI / 2; controller.axe.angularVelocity = 0; controller.axe.flightTime = 0
    controller.update(.04)
    expect(controller.axe.state).toBe('stuck')

    controller.pointerDown(300, 300); controller.pointerUp(300, 420)
    expect((controller as unknown as { launchIgnoreId: string | null }).launchIgnoreId).toBeNull()
    for (let index = 0; index < 8; index++) controller.update(.01)

    expect(controller.axe.y).toBeGreaterThan(6200)
    expect(controller.axe.state).toBe('stuck')
    expect(controller.axe.stuckObjectId).toBe('s2-high-left')
  })

  it('never ends the run because the axe falls onto lower terrain', () => {
    const { controller, onFinish } = makeController()
    controller.axe.state = 'flying'; controller.axe.stuckObjectId = null
    controller.axe.x = 360; controller.axe.y = 6500; controller.axe.vy = 900
    for (let index = 0; index < 80; index++) controller.update(.04)

    expect(controller.getStatus()).toBe('playing')
    expect(controller.axe.y).toBeLessThan(8600)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('finishes only after reaching the summit altar', () => {
    const { controller, onFinish } = makeController()
    const goal = AXEBOUND_LEVEL_OBJECTS.find((object) => object.id === 'summit-goal')!
    controller.axe.state = 'flying'; controller.axe.stuckObjectId = null
    controller.axe.x = goal.x; controller.axe.y = goal.y; controller.axe.vx = 0; controller.axe.vy = 0
    controller.update(.01)

    expect(controller.getStatus()).toBe('playing')
    for (let index = 0; index < 46; index++) controller.update(.04)
    expect(controller.getStatus()).toBe('finished')
    expect(controller.getScore()).toBe(1000)
    expect(onFinish).toHaveBeenCalledWith(1000)
  })

  it('contains a continuous six-image world with both readable surface classes', () => {
    expect(new Set(AXEBOUND_LEVEL_OBJECTS.map((object) => object.id)).size).toBe(AXEBOUND_LEVEL_OBJECTS.length)
    expect(AXEBOUND_LEVEL_OBJECTS.some((object) => object.y > 7000)).toBe(true)
    expect(AXEBOUND_LEVEL_OBJECTS.some((object) => object.y < 250)).toBe(true)
    expect(AXEBOUND_LEVEL_OBJECTS.some((object) => isAxeBoundStickable(object.material))).toBe(true)
    expect(AXEBOUND_LEVEL_OBJECTS.some((object) => !isAxeBoundStickable(object.material))).toBe(true)
    expect(AXEBOUND_LEVEL_OBJECTS.filter((object) => !object.id.startsWith('outer-')).length).toBeGreaterThanOrEqual(75)
    expect(AXEBOUND_LEVEL_OBJECTS.some((object) => object.type === 'goal')).toBe(true)
  })

  it('stacks the six supplied map images in exact bottom-to-top order', () => {
    expect(AXEBOUND_ZONES.map((zone) => zone.name)).toEqual([
      '01 · FLOODED PIT', '02 · CRYSTAL RUINS', '03 · IRON SHAFT', '04 · CHANDELIER HALL', '05 · CRYSTAL ASCENT', '06 · THE CROWN',
    ])
    const ids = new Set(AXEBOUND_LEVEL_OBJECTS.map((object) => object.id))
    for (const id of ['s1-top-bridge', 's2-top-left', 's3-upper-left', 's4-top-left', 's5-top-lift', 'summit-goal']) expect(ids.has(id)).toBe(true)
  })

  it('provides a summit route whose consecutive stickable targets stay in throw range', () => {
    const climbable = AXEBOUND_LEVEL_OBJECTS.filter((object) => isAxeBoundStickable(object.material) && !object.id.startsWith('outer-'))
    const reachable = new Set<string>(['start-floor'])
    let changed = true
    while (changed) {
      changed = false
      for (const from of climbable.filter((object) => reachable.has(object.id))) {
        for (const target of climbable) {
          const upward = from.y - target.y
          const distance = Math.hypot(from.x - target.x, from.y - target.y)
          if (!reachable.has(target.id) && upward > 25 && distance <= 560) { reachable.add(target.id); changed = true }
        }
      }
    }

    expect(reachable.has('summit-goal')).toBe(true)
  })
})
