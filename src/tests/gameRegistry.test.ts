import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'

describe('Flicko game registry', () => {
  it('registers nine unique playable games', () => {
    expect(gameRegistry).toHaveLength(9)
    expect(new Set(gameRegistry.map((game) => game.id)).size).toBe(9)
  })

  it.each(gameRegistry.map((game) => [game.id, game]))('%s includes a complete in-app play guide', (_id, game) => {
    expect(game.objective.length).toBeGreaterThan(20)
    expect(game.fullDescription.length).toBeGreaterThan(55)
    expect(game.controls.length).toBeGreaterThan(0)
    expect(game.scoringRules.length).toBeGreaterThanOrEqual(2)
    expect(game.failureConditions.length).toBeGreaterThan(0)
    expect(game.tips.length).toBeGreaterThanOrEqual(3)
    expect(game.controls.every((control) => control.description.length > 20)).toBe(true)
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
