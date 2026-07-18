import { get, set } from 'idb-keyval'
import { APP_CONFIG } from '../../app/appConfig'
import type { GameStats } from '../../games/types'

export interface PersistedState {
  feedIndex: number
  liked: string[]
  bookmarked: string[]
  muted: boolean
  stats: Record<string, GameStats>
}

export const defaultState: PersistedState = {
  feedIndex: 0,
  liked: [],
  bookmarked: [],
  muted: true,
  stats: {},
}

export async function loadState(): Promise<PersistedState> {
  const storageKeys = [APP_CONFIG.storageKey, ...APP_CONFIG.legacyStorageKeys]

  for (const key of storageKeys) {
    try {
      const state = await get<PersistedState>(key)
      if (state) {
        if (key !== APP_CONFIG.storageKey) {
          try { await set(APP_CONFIG.storageKey, state) }
          catch { /* The loaded legacy state remains usable for this session. */ }
        }
        return { ...defaultState, ...state }
      }
    } catch {
      break
    }
  }

  for (const key of storageKeys) {
    try {
      const serializedState = localStorage.getItem(key)
      if (serializedState) {
        const state = JSON.parse(serializedState) as PersistedState
        if (key !== APP_CONFIG.storageKey) {
          try { localStorage.setItem(APP_CONFIG.storageKey, serializedState) }
          catch { /* The loaded legacy state remains usable for this session. */ }
        }
        return { ...defaultState, ...state }
      }
    } catch {
      return defaultState
    }
  }

  return defaultState
}

export async function saveState(state: PersistedState) {
  try { await set(APP_CONFIG.storageKey, state) }
  catch { localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(state)) }
}
