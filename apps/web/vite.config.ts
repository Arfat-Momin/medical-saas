import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      // Update strategy: prompt user to reload on new version
      registerType: 'autoUpdate',

      // Include the manifest.webmanifest in the build
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],

      manifest: {
        name: 'Medical SaaS',
        short_name: 'MedSaaS',
        description: 'Offline-first medical practice management',
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        id: '/?source=pwa',

        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // Precache all app assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // Bump this string on every deploy to force clients to pick up
        // the new bundle. Any unique value works (date, commit hash, etc).
        // Important: keep in sync with the SW auto-update logic in main.tsx.
        cleanupOutdatedCaches: true,
        ignoreURLParametersMatching: [/^v$/, /^t$/, /^utm_/, /^fbclid$/],

        // Runtime caching for API GET requests
        runtimeCaching: [
          {
            // Match BOTH relative (/api/v1/...) and absolute URLs
            urlPattern: ({ url }) => url.pathname.startsWith('/api/v1/'),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],

        // Increase limit ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â the SPA bundle is bigger than the default
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB

        // Skip waiting so updates activate promptly
        skipWaiting: true,
        clientsClaim: true,
      },

      devOptions: {
        // Enable in dev for testing (optional; disable for speed)
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
