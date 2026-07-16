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
  try { return { ...defaultState, ...await get<PersistedState>(APP_CONFIG.storageKey) } }
  catch {
    try { return { ...defaultState, ...JSON.parse(localStorage.getItem(APP_CONFIG.storageKey) ?? '{}') } }
    catch { return defaultState }
  }
}

export async function saveState(state: PersistedState) {
  try { await set(APP_CONFIG.storageKey, state) }
  catch { localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(state)) }
}
