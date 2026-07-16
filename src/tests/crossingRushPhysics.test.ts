import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import type { GameController } from '../games/types'

type Facing = 'up' | 'down' | 'left' | 'right'
type Mover = { kind: 'car' | 'truck' | 'log'; speed: number; length: number; gap: number; offset: number; color: string }
type Row = { index: number; type: 'grass' | 'road' | 'water'; mover: Mover | null; obstacles: number[]; coinCol: number | null }
type CrossingController = GameController & {
  player: { col: number; row: number; drawCol: number; drawRow: number; hop: number; facing: Facing; riding: boolean }
  rows: Row[]
  highRow: number
  coinCount: number
  collectedCoins: Set<string>
  ensureRows: (maxRow: number) => void
}

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'crossing-rush')!
  const onScore = vi.fn(), onFinish = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish, onImpact: vi.fn() }) as CrossingController
  controller.resize(390, 844, 1); controller.restart()
  return { controller, onScore, onFinish }
}

describe('Crossing Rush world and physics', () => {
  it('creates endless hazards with traffic on every road and multi-row rivers', () => {
    const { controller } = makeController()
    controller.ensureRows(180)

    expect(controller.rows.length).toBeGreaterThan(180)
    expect(controller.rows.filter((row) => row.type === 'road').every((row) => row.mover?.kind === 'car' || row.mover?.kind === 'truck')).toBe(true)
    expect(controller.rows.filter((row) => row.type === 'water').every((row) => row.mover?.kind === 'log')).toBe(true)

    const waterRuns: number[] = []
    for (let i = 3; i < controller.rows.length;) {
      if (controller.rows[i].type !== 'water') { i++; continue }
      let length = 0
      while (controller.rows[i + length]?.type === 'water') length++
      waterRuns.push(length); i += length
    }
    expect(waterRuns.length).toBeGreaterThan(2)
    expect(Math.min(...waterRuns)).toBeGreaterThanOrEqual(2)
  })

  it('faces the direction of each hop and treats a short tap as forward', () => {
    const { controller } = makeController()
    controller.swipe!(60, 0)
    expect(controller.player.facing).toBe('right')
    expect(controller.player.col).toBe(4)
    controller.player.hop = 0
    controller.swipe!(0, 0)
    expect(controller.player.facing).toBe('up')
    expect(controller.player.row).toBe(2)
  })

  it('lets a moving log carry the player across water', () => {
    const { controller } = makeController()
    controller.rows[3] = { index: 3, type: 'water', obstacles: [], coinCol: null, mover: { kind: 'log', speed: 1, length: 4, gap: 4, offset: 0, color: '#9a542c' } }
    controller.player = { col: 1, row: 3, drawCol: 1, drawRow: 3, hop: 0, facing: 'up', riding: false }

    controller.update(.02)

    expect(controller.getStatus()).toBe('playing')
    expect(controller.player.riding).toBe(true)
    expect(controller.player.col).toBeGreaterThan(1)
  })

  it('ends the run when the player lands in water between logs', () => {
    const { controller, onFinish } = makeController()
    controller.rows[3] = { index: 3, type: 'water', obstacles: [], coinCol: null, mover: { kind: 'log', speed: 0, length: 1, gap: 7, offset: 2, color: '#9a542c' } }
    controller.player = { col: 0, row: 3, drawCol: 0, drawRow: 3, hop: 0, facing: 'up', riding: false }

    controller.update(.02)

    expect(controller.getStatus()).toBe('finished')
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('places bonus coins on risky edge columns and awards five points', () => {
    const { controller, onScore } = makeController()
    controller.ensureRows(120)
    const coinRows = controller.rows.filter((row) => row.coinCol !== null)
    expect(coinRows.length).toBeGreaterThan(8)
    expect(coinRows.every((row) => row.coinCol === 0 || row.coinCol === 7)).toBe(true)

    controller.rows[2].coinCol = 0
    controller.player = { col: 0, row: 2, drawCol: 0, drawRow: 2, hop: 0, facing: 'left', riding: false }
    controller.update(.02)

    expect(controller.coinCount).toBe(1)
    expect(onScore).toHaveBeenLastCalledWith(5)
  })
})
