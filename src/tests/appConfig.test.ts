import { describe, expect, it } from 'vitest'
import { APP_CONFIG } from '../app/appConfig'
import { APP_VERSION, UPDATE_INFO } from '../app/appVersion'

describe('app configuration', () => {
  it('keeps FlickPlay branding centralized', () => {
    expect(APP_CONFIG.name).toBe('FlickPlay!')
    expect(APP_CONFIG.storageKey).toContain('flickplay')
  })

  it('publishes versioned update information', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    expect(UPDATE_INFO.addedGames).toHaveLength(8)
  })
})
