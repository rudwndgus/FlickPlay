import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import type { GameController } from '../games/types'
import { NEON_VAULT_MAP } from '../games/runtime/NeonVaultController'

type VaultController = GameController & {
  player: { col: number; row: number; x: number; y: number; moving: boolean; shield: boolean }
  dots: Set<string>
  coins: Set<string>
  buildPath: (dx: number, dy: number) => { x: number; y: number; teleport?: boolean }[]
}

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'neon-escape')!
  const onScore = vi.fn(), onFinish = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish, onImpact: vi.fn() }) as VaultController
  controller.resize(390, 844, 1); controller.restart()
  return { controller, onScore, onFinish }
}

describe('Neon Vault movement', () => {
  it('uses a dense portrait maze with consistent row widths', () => {
    expect(NEON_VAULT_MAP).toHaveLength(19)
    expect(NEON_VAULT_MAP.every((row) => row.length === 13)).toBe(true)
    expect(NEON_VAULT_MAP.join('').split('0').length - 1).toBeGreaterThan(110)
  })

  it('slides to the tile immediately before a wall', () => {
    const { controller } = makeController()
    const path = controller.buildPath(0, -1)
    expect(path.at(-1)).toMatchObject({ x: 1, y: 15 })
  })

  it('checks and collects every signal crossed during a fast slide', () => {
    const { controller, onScore } = makeController()
    expect(controller.dots.has('1,16')).toBe(true)
    expect(controller.dots.has('1,15')).toBe(true)
    controller.swipe!(0, -70)
    for (let i = 0; i < 12; i++) controller.update(.02)
    expect(controller.player).toMatchObject({ col: 1, row: 15, moving: false })
    expect(controller.dots.has('1,16')).toBe(false)
    expect(controller.dots.has('1,15')).toBe(false)
    expect(onScore).toHaveBeenLastCalledWith(2)
  })

  it('ignores new directions until the current slide has stopped', () => {
    const { controller } = makeController()
    controller.swipe!(0, -70)
    const initialPath = controller.buildPath(0, -1)
    controller.swipe!(70, 0)
    expect(controller.player.moving).toBe(true)
    expect(initialPath.at(-1)).toMatchObject({ x: 1, y: 15 })
  })

  it('cancels touches shorter than the 24px swipe threshold', () => {
    const { controller } = makeController()
    controller.pointerDown(100, 100)
    controller.pointerUp(118, 102)
    expect(controller.player.moving).toBe(false)
  })

  it('teleports through a portal and keeps the original direction', () => {
    const { controller } = makeController()
    const path = controller.buildPath(1, 0)
    expect(path.some((node) => node.teleport && node.x === 1 && node.y === 1)).toBe(true)
    expect(path.at(-1)).toMatchObject({ x: 11, y: 1 })
  })
})
