import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import { getPinCoreVisibleHitAngle, PIN_CORE_FLIGHT_SECONDS } from '../games/runtime/controllers'
import type { GameController } from '../games/types'

type PinController = GameController & {
  rotation: number
  speed: number
  pins: number[]
  shot: number
  stickPulse: number
}

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'pin-core')!
  const onScore = vi.fn(), onFinish = vi.fn(), onImpact = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish, onImpact }) as PinController
  controller.resize(390, 766, 1); controller.restart()
  return { controller, onScore, onFinish, onImpact }
}

describe('Pin Core dart flight and visible collision', () => {
  it('shows a very short dart flight before attaching and scoring the pin', () => {
    const { controller, onScore } = makeController()
    controller.pointerDown(195, 650)

    expect(controller.shot).toBeGreaterThan(0)
    expect(controller.pins).toHaveLength(2)
    expect(controller.getScore()).toBe(0)

    controller.update(.033)
    expect(controller.shot).toBeGreaterThan(.3)
    expect(controller.shot).toBeLessThan(1)
    expect(controller.pins).toHaveLength(2)

    controller.update(.033)
    expect(controller.shot).toBeLessThan(1)
    controller.update(.033)
    expect(controller.shot).toBe(0)
    expect(controller.pins).toHaveLength(3)
    expect(controller.getScore()).toBe(1)
    expect(controller.stickPulse).toBeGreaterThan(0)
    expect(onScore).toHaveBeenLastCalledWith(1)
  })

  it('ignores repeated taps while the current pin is in flight', () => {
    const { controller, onImpact } = makeController()
    controller.pointerDown(195, 650)
    const progress = controller.shot
    controller.pointerDown(195, 650)

    expect(controller.shot).toBe(progress)
    expect(controller.pins).toHaveLength(2)
    expect(onImpact.mock.calls.filter(([kind]) => kind === 'tap')).toHaveLength(1)
  })

  it('checks collision only when the flying pin reaches the rotating core', () => {
    const { controller, onFinish } = makeController()
    controller.speed = 0
    controller.rotation = Math.PI / 2
    controller.pointerDown(195, 650)

    expect(controller.getStatus()).toBe('playing')
    for (let frame = 0; frame < 7; frame++) controller.update(.033)

    expect(controller.getStatus()).toBe('finished')
    expect(controller.pins).toHaveLength(2)
    expect(onFinish).toHaveBeenCalledWith(0)
  })

  it('never collides with a rotating pin along the flight path', () => {
    const { controller, onFinish } = makeController()
    controller.speed = 0
    controller.rotation = Math.PI / 2
    controller.pointerDown(195, 650)

    controller.update(PIN_CORE_FLIGHT_SECONDS * .35)
    expect(controller.getStatus()).toBe('playing')
    expect(onFinish).not.toHaveBeenCalled()

    controller.rotation = 0
    controller.update(.03)
    controller.update(.03)
    expect(controller.getStatus()).toBe('playing')
    expect(controller.pins).toHaveLength(3)
    expect(controller.getScore()).toBe(1)
  })

  it('uses no wider hit area than the visible pin head and shaft', () => {
    const visibleHitAngle = getPinCoreVisibleHitAngle(390)
    expect(visibleHitAngle).toBeLessThan(.11)

    const safe = makeController()
    safe.controller.speed = 0
    safe.controller.rotation = Math.PI / 2 - (visibleHitAngle + .002)
    safe.controller.pointerDown(195, 650)
    for (let frame = 0; frame < 3; frame++) safe.controller.update(.033)
    expect(safe.controller.getStatus()).toBe('playing')
    expect(safe.controller.getScore()).toBe(1)

    const overlapping = makeController()
    overlapping.controller.speed = 0
    overlapping.controller.rotation = Math.PI / 2 - (visibleHitAngle - .002)
    overlapping.controller.pointerDown(195, 650)
    for (let frame = 0; frame < 3; frame++) overlapping.controller.update(.033)
    expect(overlapping.controller.getStatus()).toBe('finished')
    expect(overlapping.controller.getScore()).toBe(0)
  })
})
