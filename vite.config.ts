import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? './' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.svg'],
      manifest: {
        name: 'Flicko | 플릭코',
        short_name: 'Flicko',
        description: '넘기고, 발견하고, 바로 플레이하는 세로형 미니게임 피드',
        theme_color: '#0a0b12',
        background_color: '#0a0b12',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'ko',
        scope: './',
        start_url: './',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'apple-touch-icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'maskable-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['assets/games/axebound/maps/*.png'],
        runtimeCaching: [{
          urlPattern: /\/assets\/games\/axebound\/maps\/map-\d+\.png$/,
          handler: 'CacheFirst',
          options: { cacheName: 'axebound-original-maps', expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 30 } },
        }],
        cleanupOutdatedCaches: true
      },
      devOptions: { enabled: false }
    })
  ],
  test: { environment: 'jsdom', setupFiles: './src/tests/setup.ts' }
}))
