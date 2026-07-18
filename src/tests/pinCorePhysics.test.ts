import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
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

describe('Pin Core projectile flight', () => {
  it('shows a real flight before attaching and scoring the pin', () => {
    const { controller, onScore } = makeController()
    controller.pointerDown(195, 650)

    expect(controller.shot).toBeGreaterThan(0)
    expect(controller.pins).toHaveLength(2)
    expect(controller.getScore()).toBe(0)

    for (let frame = 0; frame < 3; frame++) controller.update(.033)
    expect(controller.shot).toBeGreaterThan(.4)
    expect(controller.shot).toBeLessThan(1)
    expect(controller.pins).toHaveLength(2)

    for (let frame = 0; frame < 4; frame++) controller.update(.033)
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
})
