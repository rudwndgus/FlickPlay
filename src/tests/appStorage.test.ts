import { beforeEach, describe, expect, it, vi } from 'vitest'

const idb = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}))

vi.mock('idb-keyval', () => idb)

import { loadState, type PersistedState } from '../services/storage/appStorage'

const legacyState: PersistedState = {
  feedIndex: 3,
  liked: ['loop-hoops'],
  bookmarked: ['pocket-golf'],
  muted: false,
  stats: {},
}

describe('app storage migration', () => {
  beforeEach(() => {
    idb.get.mockReset()
    idb.set.mockReset()
    localStorage.clear()
  })

  it('moves IndexedDB state from the legacy key to the Flicko key', async () => {
    idb.get.mockImplementation(async (key: string) => key === 'flickplay-state-v1' ? legacyState : undefined)

    await expect(loadState()).resolves.toEqual(legacyState)
    expect(idb.get).toHaveBeenNthCalledWith(1, 'flicko-state-v1')
    expect(idb.get).toHaveBeenNthCalledWith(2, 'flickplay-state-v1')
    expect(idb.set).toHaveBeenCalledWith('flicko-state-v1', legacyState)
  })

  it('falls back to and migrates legacy localStorage state', async () => {
    idb.get.mockRejectedValue(new Error('IndexedDB unavailable'))
    localStorage.setItem('flickplay-state-v1', JSON.stringify(legacyState))

    await expect(loadState()).resolves.toEqual(legacyState)
    expect(localStorage.getItem('flicko-state-v1')).toBe(JSON.stringify(legacyState))
  })
})
