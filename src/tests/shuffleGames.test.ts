import { describe, expect, it } from 'vitest'
import { refreshGameOrder, shuffleGames } from '../feed/shuffleGames'

describe('shuffleGames', () => {
  it('returns a shuffled copy without mutating or losing games', () => {
    const games = ['a', 'b', 'c', 'd'] as const
    const randomValues = [0, 0.5, 0]
    let call = 0

    const shuffled = shuffleGames(games, () => randomValues[call++])

    expect(shuffled).toEqual(['c', 'd', 'b', 'a'])
    expect(games).toEqual(['a', 'b', 'c', 'd'])
    expect(new Set(shuffled)).toEqual(new Set(games))
  })

  it('handles an empty feed', () => {
    expect(shuffleGames([], () => 0.5)).toEqual([])
  })

  it('puts a different game first when refreshing the current feed', () => {
    const games = ['a', 'b', 'c'] as const
    const refreshed = refreshGameOrder(games, 'a', () => 0.99)

    expect(refreshed[0]).not.toBe('a')
    expect(new Set(refreshed)).toEqual(new Set(games))
  })
})
