import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import type { GameController } from '../games/types'

type StackBlock = { x: number; y: number; width: number; color: string }
type StackController = GameController & {
  blocks: StackBlock[]
  current: { x: number; y: number; width: number; dir: number; speed: number }
  fragment: (StackBlock & { vy: number; rotation: number }) | null
  perfect: number
  perfectPulse: number
  feedback: string
  sparks: { life: number }[]
}

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'perfect-stack')!
  const onScore = vi.fn(), onFinish = vi.fn(), onImpact = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish, onImpact }) as StackController
  controller.resize(390, 844, 1); controller.restart()
  return { controller, onScore, onFinish, onImpact }
}

describe('Perfect Stack placement', () => {
  it('keeps a centered perfect block, starts the combo, and fires the new visual feedback', () => {
    const { controller, onScore, onImpact } = makeController()
    const base = controller.blocks.at(-1)!
    controller.current.x = base.x

    controller.pointerDown(0, 0)

    expect(controller.getScore()).toBe(1)
    expect(controller.blocks.at(-1)).toMatchObject({ x: base.x, width: 220 })
    expect(controller.perfect).toBe(1)
    expect(controller.perfectPulse).toBe(1)
    expect(controller.feedback).toBe('PERFECT')
    expect(controller.sparks).toHaveLength(24)
    expect(onScore).toHaveBeenLastCalledWith(1)
    expect(onImpact).toHaveBeenCalledWith('perfect')
  })

  it('cuts the overhang without changing the original stacking rules', () => {
    const { controller } = makeController()
    const base = controller.blocks.at(-1)!
    controller.current.x = base.x + 40

    controller.pointerDown(0, 0)

    expect(controller.blocks.at(-1)).toMatchObject({ x: base.x + 40, width: 180 })
    expect(controller.current.width).toBe(180)
    expect(controller.fragment).toMatchObject({ width: 40 })
    expect(controller.perfect).toBe(0)
    expect(controller.feedback).toBe('NICE')
    expect(controller.sparks).toHaveLength(9)
  })

  it('still ends the run when a block completely misses the tower', () => {
    const { controller, onFinish } = makeController()
    controller.current.x = 360

    controller.pointerDown(0, 0)

    expect(controller.getStatus()).toBe('finished')
    expect(onFinish).toHaveBeenCalledWith(0)
  })
})
