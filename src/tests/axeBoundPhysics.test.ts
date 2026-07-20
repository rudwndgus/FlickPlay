import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import { AxeBoundController, canAxeBoundAxeStick } from '../games/runtime/AxeBoundController'
import { AXEBOUND_LEVEL_OBJECTS, isAxeBoundStickable } from '../games/runtime/axeBoundLevel'

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

  it('fires upward when the player pulls straight down', () => {
    const { controller } = makeController()
    controller.pointerDown(350, 140); controller.pointerUp(350, 260)

    expect(controller.axe.vx).toBeCloseTo(0, 5)
    expect(controller.axe.vy).toBeLessThan(-400)
  })

  it('cancels a very short drag without releasing a held axe', () => {
    const { controller } = makeController()
    controller.pointerDown(100, 300); controller.pointerUp(108, 306)

    expect(controller.axe.state).toBe('held')
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

  it('sticks into a real rock surface and pulls the player without teleporting', () => {
    const { controller } = makeController()
    controller.axe.state = 'flying'; controller.axe.x = 360; controller.axe.y = 6307
    controller.axe.vx = 0; controller.axe.vy = -500; controller.axe.angle = -Math.PI / 2; controller.axe.angularVelocity = 0; controller.axe.flightTime = 0
    controller.update(.04)

    expect(controller.axe.state).toBe('stuck')
    expect(controller.axe.stuckObjectId).toBe('zone1-rest')

    controller.player.x = 360; controller.player.y = 6500; controller.player.vx = 0; controller.player.vy = 0
    controller.axe.ropeLength = 120; controller.axe.stuckTime = 1
    const previousY = controller.player.y
    controller.update(.04)

    expect(controller.player.y).toBeLessThan(previousY)
    expect(controller.player.vy).toBeLessThan(0)
  })

  it('never ends the run because the player falls onto lower terrain', () => {
    const { controller, onFinish } = makeController()
    controller.player.x = 360; controller.player.y = 6500; controller.player.vy = 900
    for (let index = 0; index < 80; index++) controller.update(.04)

    expect(controller.getStatus()).toBe('playing')
    expect(controller.player.y).toBeLessThan(7155)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('finishes only after reaching the summit altar', () => {
    const { controller, onFinish } = makeController()
    controller.player.x = 360; controller.player.y = 85; controller.player.vx = 0; controller.player.vy = 0
    controller.update(.01)

    expect(controller.getStatus()).toBe('playing')
    for (let index = 0; index < 46; index++) controller.update(.04)
    expect(controller.getStatus()).toBe('finished')
    expect(controller.getScore()).toBe(1000)
    expect(onFinish).toHaveBeenCalledWith(1000)
  })

  it('contains a continuous eight-zone world with both readable surface classes', () => {
    expect(new Set(AXEBOUND_LEVEL_OBJECTS.map((object) => object.id)).size).toBe(AXEBOUND_LEVEL_OBJECTS.length)
    expect(AXEBOUND_LEVEL_OBJECTS.some((object) => object.y > 7000)).toBe(true)
    expect(AXEBOUND_LEVEL_OBJECTS.some((object) => object.y < 150)).toBe(true)
    expect(AXEBOUND_LEVEL_OBJECTS.some((object) => isAxeBoundStickable(object.material))).toBe(true)
    expect(AXEBOUND_LEVEL_OBJECTS.some((object) => !isAxeBoundStickable(object.material))).toBe(true)
    const objectTypes = new Set(AXEBOUND_LEVEL_OBJECTS.map((object) => object.type))
    for (const type of ['movingPlatform', 'rotatingBeam', 'swingingBlock', 'fallingRock', 'goal'] as const) expect(objectTypes.has(type)).toBe(true)
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
