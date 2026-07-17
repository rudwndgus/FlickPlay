import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import type { GameController } from '../games/types'
import { analyzeVaultReachability, NEON_VAULT_MAP, NEON_VAULT_STAGE_TWO_MAP } from '../games/runtime/NeonVaultController'

type VaultController = GameController & {
  player: { col: number; row: number; x: number; y: number; moving: boolean; shield: boolean }
  dots: Set<string>
  coins: Set<string>
  switches: Set<string>
  clearing: number
  stage: number
  buildPath: (dx: number, dy: number) => { x: number; y: number; teleport?: boolean }[]
  visit: (node: { x: number; y: number }) => void
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
    expect(NEON_VAULT_STAGE_TWO_MAP).toHaveLength(19)
    expect(NEON_VAULT_STAGE_TWO_MAP.every((row) => row.length === 13)).toBe(true)
    expect(NEON_VAULT_STAGE_TWO_MAP.join('').split('0').length - 1).toBeGreaterThan(110)
  })

  it('makes every required signal reachable and always allows a route back to the exit', () => {
    const { controller } = makeController()
    const analysis = analyzeVaultReachability()
    expect(analysis.stops.has('11,1')).toBe(true)
    expect([...controller.dots].every((key) => analysis.cells.has(key))).toBe(true)
    expect([...controller.switches].every((key) => analysis.cells.has(key))).toBe(true)
    expect([...analysis.stops].every((key) => analysis.returnableStops.has(key))).toBe(true)
    expect([...analysis.stops].every((key) => analysis.exitReachableStops.has(key))).toBe(true)
  })

  it('slides to the tile immediately before a wall', () => {
    const { controller } = makeController()
    const path = controller.buildPath(0, -1)
    expect(path.at(-1)).toMatchObject({ x: 1, y: 9 })
  })

  it('checks and collects every signal crossed during a fast slide', () => {
    const { controller, onScore } = makeController()
    const crossedSignals = controller.buildPath(0, -1)
      .slice(1)
      .map(({ x, y }) => `${x},${y}`)
      .filter((key) => controller.dots.has(key))
    const crossedCoins = controller.buildPath(0, -1)
      .slice(1)
      .map(({ x, y }) => `${x},${y}`)
      .filter((key) => controller.coins.has(key))
    expect(crossedSignals.length).toBeGreaterThan(2)
    controller.swipe!(0, -70)
    for (let i = 0; i < 40; i++) controller.update(.02)
    expect(controller.player).toMatchObject({ col: 1, row: 9, moving: false })
    expect(crossedSignals.every((key) => !controller.dots.has(key))).toBe(true)
    expect(onScore).toHaveBeenLastCalledWith(crossedSignals.length + crossedCoins.length * 10)
  })

  it('ignores new directions until the current slide has stopped', () => {
    const { controller } = makeController()
    controller.swipe!(0, -70)
    const initialPath = controller.buildPath(0, -1)
    controller.swipe!(70, 0)
    expect(controller.player.moving).toBe(true)
    expect(initialPath.at(-1)).toMatchObject({ x: 1, y: 9 })
  })

  it('cancels touches shorter than the 24px swipe threshold', () => {
    const { controller } = makeController()
    controller.pointerDown(100, 100)
    controller.pointerUp(118, 102)
    expect(controller.player.moving).toBe(false)
  })

  it('teleports through a portal and keeps the original direction', () => {
    const { controller } = makeController()
    controller.player = { col: 5, row: 17, x: 5, y: 17, moving: false, shield: false }
    const path = controller.buildPath(1, 0)
    expect(path.some((node) => node.teleport && node.x === 1 && node.y === 1)).toBe(true)
    expect(path.at(-1)).toMatchObject({ x: 5, y: 1 })
  })

  it('keeps the vault locked until both switches and every signal are cleared', () => {
    const { controller } = makeController()
    controller.dots.clear()
    controller.visit({ x: 11, y: 1 })
    expect(controller.clearing).toBe(0)

    controller.visit({ x: 5, y: 3 })
    controller.visit({ x: 11, y: 15 })
    expect(controller.switches.size).toBe(0)
    controller.visit({ x: 11, y: 1 })
    expect(controller.clearing).toBeGreaterThan(0)
  })

  it('opens a solvable mint stage after stage one and only finishes at its exit', () => {
    const { controller, onFinish } = makeController()
    controller.dots.clear()
    controller.switches.clear()
    controller.visit({ x: 11, y: 1 })
    for (let i = 0; i < 24; i++) controller.update(.033)

    expect(controller.stage).toBe(2)
    expect(controller.player).toMatchObject({ col: 11, row: 17, moving: false })
    expect(controller.getStatus()).toBe('playing')
    expect(onFinish).not.toHaveBeenCalled()
    const analysis = analyzeVaultReachability(2)
    expect(analysis.stops.has('1,1')).toBe(true)
    expect([...controller.dots].every((key) => analysis.cells.has(key))).toBe(true)
    expect([...controller.switches].every((key) => analysis.cells.has(key))).toBe(true)
    expect([...analysis.stops].every((key) => analysis.returnableStops.has(key) && analysis.exitReachableStops.has(key))).toBe(true)

    controller.dots.clear()
    controller.switches.clear()
    controller.visit({ x: 1, y: 1 })
    for (let i = 0; i < 24; i++) controller.update(.033)
    expect(controller.getStatus()).toBe('finished')
    expect(onFinish).toHaveBeenCalledOnce()
  })
})
