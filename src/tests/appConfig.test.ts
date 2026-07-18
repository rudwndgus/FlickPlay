import { describe, expect, it } from 'vitest'
import { APP_CONFIG } from '../app/appConfig'
import { APP_VERSION, UPDATE_INFO } from '../app/appVersion'

describe('app configuration', () => {
  it('keeps Flicko branding centralized', () => {
    expect(APP_CONFIG.name).toBe('Flicko')
    expect(APP_CONFIG.storageKey).toBe('flicko-state-v1')
    expect(APP_CONFIG.legacyStorageKeys).toContain('flickplay-state-v1')
  })

  it('publishes versioned update information', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    expect(UPDATE_INFO.addedGames).toHaveLength(8)
  })
})
