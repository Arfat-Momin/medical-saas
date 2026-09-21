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

        // PRIVACY / SECURITY:
        //   Do NOT cache any /api/v1/ response at the service-worker
        //   level. The previous config kept every GET (patients,
        //   invoices, prescriptions) in Cache Storage for 7 days, which
        //   left PHI sitting on shared devices. The app already has a
        //   purpose-built offline layer (Dexie + sync engine) so the
        //   SW cache adds no offline capability - only risk.
        runtimeCaching: [],

        // Increase limit ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â the SPA bundle is bigger than the default
        // The SPA bundle is bigger than Workbox's default 2 MB limit.

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
