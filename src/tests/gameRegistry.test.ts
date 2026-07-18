import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'

describe('Flicko game registry', () => {
  it('registers eight unique playable games', () => {
    expect(gameRegistry).toHaveLength(8)
    expect(new Set(gameRegistry.map((game) => game.id)).size).toBe(8)
  })

  it.each(gameRegistry.map((game) => [game.id, game]))('%s exposes a complete controller lifecycle', (_id, game) => {
    const controller = game.createController({ preview: false, onScore: vi.fn(), onFinish: vi.fn(), onImpact: vi.fn() })
    controller.resize(390, 844, 1)
    controller.update(1 / 60)
    expect(controller.getStatus()).toBe('playing')
    expect(controller.getScore()).toBeGreaterThanOrEqual(0)
    controller.pause(); expect(controller.getStatus()).toBe('paused')
    controller.resume(); expect(controller.getStatus()).toBe('playing')
    controller.restart(); expect(controller.getScore()).toBe(0)
    controller.destroy()
  })
})
