// vite.config.ts
import { defineConfig } from "file:///D:/project/hospital-SaaS%20new/medical-saas/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.43_terser@5.51.2/node_modules/vite/dist/node/index.js";
import react from "file:///D:/project/hospital-SaaS%20new/medical-saas/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@20.19.43_terser@5.51.2_/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///D:/project/hospital-SaaS%20new/medical-saas/node_modules/.pnpm/vite-plugin-pwa@1.3.0_vite@5.4.21_@types+node@20.19.43_terser@5.51.2__workbox-build@7.4.1_@ty_ccvfauwvjdbppmugjxouoyy34i/node_modules/vite-plugin-pwa/dist/index.js";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///D:/project/hospital-SaaS%20new/medical-saas/apps/web/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Update strategy: prompt user to reload on new version
      registerType: "autoUpdate",
      // Include the manifest.webmanifest in the build
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "Medical SaaS",
        short_name: "MedSaaS",
        description: "Offline-first medical practice management",
        theme_color: "#2563eb",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        id: "/?source=pwa",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        // Precache all app assets
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Bump this string on every deploy to force clients to pick up
        // the new bundle. Any unique value works (date, commit hash, etc).
        // Important: keep in sync with the SW auto-update logic in main.tsx.
        cleanupOutdatedCaches: true,
        ignoreURLParametersMatching: [/^v$/, /^t$/, /^utm_/, /^fbclid$/],
        // Runtime caching for API GET requests
        runtimeCaching: [
          {
            // Match BOTH relative (/api/v1/...) and absolute URLs
            urlPattern: ({ url }) => url.pathname.startsWith("/api/v1/"),
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7
                // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        // Increase limit ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â the SPA bundle is bigger than the default
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 5 MB
        // Skip waiting so updates activate promptly
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        // Enable in dev for testing (optional; disable for speed)
        enabled: false
      }
    })
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)) }
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true }
    }
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxwcm9qZWN0XFxcXGhvc3BpdGFsLVNhYVMgbmV3XFxcXG1lZGljYWwtc2Fhc1xcXFxhcHBzXFxcXHdlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxccHJvamVjdFxcXFxob3NwaXRhbC1TYWFTIG5ld1xcXFxtZWRpY2FsLXNhYXNcXFxcYXBwc1xcXFx3ZWJcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L3Byb2plY3QvaG9zcGl0YWwtU2FhUyUyMG5ldy9tZWRpY2FsLXNhYXMvYXBwcy93ZWIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIFVSTCB9IGZyb20gJ25vZGU6dXJsJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG5cbiAgICBWaXRlUFdBKHtcbiAgICAgIC8vIFVwZGF0ZSBzdHJhdGVneTogcHJvbXB0IHVzZXIgdG8gcmVsb2FkIG9uIG5ldyB2ZXJzaW9uXG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcblxuICAgICAgLy8gSW5jbHVkZSB0aGUgbWFuaWZlc3Qud2VibWFuaWZlc3QgaW4gdGhlIGJ1aWxkXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ3JvYm90cy50eHQnLCAnYXBwbGUtdG91Y2gtaWNvbi5wbmcnXSxcblxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogJ01lZGljYWwgU2FhUycsXG4gICAgICAgIHNob3J0X25hbWU6ICdNZWRTYWFTJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdPZmZsaW5lLWZpcnN0IG1lZGljYWwgcHJhY3RpY2UgbWFuYWdlbWVudCcsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzI1NjNlYicsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjZjhmYWZjJyxcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgICAgICBvcmllbnRhdGlvbjogJ3BvcnRyYWl0JyxcbiAgICAgICAgc2NvcGU6ICcvJyxcbiAgICAgICAgc3RhcnRfdXJsOiAnLycsXG4gICAgICAgIGlkOiAnLz9zb3VyY2U9cHdhJyxcblxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJy9pY29ucy9pY29uLTE5Mi5wbmcnLFxuICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgICAgICAgICAgcHVycG9zZTogJ2FueScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6ICcvaWNvbnMvaWNvbi01MTIucG5nJyxcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAgICAgICAgIHB1cnBvc2U6ICdhbnknLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAnL2ljb25zL2ljb24tMTkyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnbWFza2FibGUnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAnL2ljb25zL2ljb24tNTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnbWFza2FibGUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuXG4gICAgICB3b3JrYm94OiB7XG4gICAgICAgIC8vIFByZWNhY2hlIGFsbCBhcHAgYXNzZXRzXG4gICAgICAgIGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2Zyx3b2ZmMn0nXSxcblxuICAgICAgICAvLyBCdW1wIHRoaXMgc3RyaW5nIG9uIGV2ZXJ5IGRlcGxveSB0byBmb3JjZSBjbGllbnRzIHRvIHBpY2sgdXBcbiAgICAgICAgLy8gdGhlIG5ldyBidW5kbGUuIEFueSB1bmlxdWUgdmFsdWUgd29ya3MgKGRhdGUsIGNvbW1pdCBoYXNoLCBldGMpLlxuICAgICAgICAvLyBJbXBvcnRhbnQ6IGtlZXAgaW4gc3luYyB3aXRoIHRoZSBTVyBhdXRvLXVwZGF0ZSBsb2dpYyBpbiBtYWluLnRzeC5cbiAgICAgICAgY2xlYW51cE91dGRhdGVkQ2FjaGVzOiB0cnVlLFxuICAgICAgICBpZ25vcmVVUkxQYXJhbWV0ZXJzTWF0Y2hpbmc6IFsvXnYkLywgL150JC8sIC9edXRtXy8sIC9eZmJjbGlkJC9dLFxuXG4gICAgICAgIC8vIFJ1bnRpbWUgY2FjaGluZyBmb3IgQVBJIEdFVCByZXF1ZXN0c1xuICAgICAgICBydW50aW1lQ2FjaGluZzogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1hdGNoIEJPVEggcmVsYXRpdmUgKC9hcGkvdjEvLi4uKSBhbmQgYWJzb2x1dGUgVVJMc1xuICAgICAgICAgICAgdXJsUGF0dGVybjogKHsgdXJsIH0pID0+IHVybC5wYXRobmFtZS5zdGFydHNXaXRoKCcvYXBpL3YxLycpLFxuICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtGaXJzdCcsXG4gICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdhcGktY2FjaGUnLFxuICAgICAgICAgICAgICBuZXR3b3JrVGltZW91dFNlY29uZHM6IDMsXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcbiAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiA1MDAsXG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogNywgLy8gNyBkYXlzXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XG4gICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuXG4gICAgICAgIC8vIEluY3JlYXNlIGxpbWl0IFx1MDBDM1x1MDE5Mlx1MDBDNlx1MjAxOVx1MDBDM1x1MjAyMFx1MDBFMlx1MjBBQ1x1MjEyMlx1MDBDM1x1MDE5Mlx1MDBFMlx1MjBBQ1x1MDE2MVx1MDBDM1x1MjAxQVx1MDBDMlx1MDBBMlx1MDBDM1x1MDE5Mlx1MDBDNlx1MjAxOVx1MDBDM1x1MjAxQVx1MDBDMlx1MDBBMlx1MDBDM1x1MDE5Mlx1MDBDMlx1MDBBMlx1MDBDM1x1MDBBMlx1MDBFMlx1MjBBQ1x1MDE2MVx1MDBDMlx1MDBBQ1x1MDBDM1x1MjAyNlx1MDBDMlx1MDBBMVx1MDBDM1x1MDE5Mlx1MDBFMlx1MjBBQ1x1MDE2MVx1MDBDM1x1MjAxQVx1MDBDMlx1MDBBQ1x1MDBDM1x1MDE5Mlx1MDBDNlx1MjAxOVx1MDBDM1x1MjAxQVx1MDBDMlx1MDBBMlx1MDBDM1x1MDE5Mlx1MDBDMlx1MDBBMlx1MDBDM1x1MDBBMlx1MDBFMlx1MjAxQVx1MDBBQ1x1MDBDNVx1MDBBMVx1MDBDM1x1MjAxQVx1MDBDMlx1MDBBQ1x1MDBDM1x1MDE5Mlx1MDBFMlx1MjBBQ1x1MDE2MVx1MDBDM1x1MjAxQVx1MDBDMlx1MDA5RCB0aGUgU1BBIGJ1bmRsZSBpcyBiaWdnZXIgdGhhbiB0aGUgZGVmYXVsdFxuICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNSAqIDEwMjQgKiAxMDI0LCAvLyA1IE1CXG5cbiAgICAgICAgLy8gU2tpcCB3YWl0aW5nIHNvIHVwZGF0ZXMgYWN0aXZhdGUgcHJvbXB0bHlcbiAgICAgICAgc2tpcFdhaXRpbmc6IHRydWUsXG4gICAgICAgIGNsaWVudHNDbGFpbTogdHJ1ZSxcbiAgICAgIH0sXG5cbiAgICAgIGRldk9wdGlvbnM6IHtcbiAgICAgICAgLy8gRW5hYmxlIGluIGRldiBmb3IgdGVzdGluZyAob3B0aW9uYWw7IGRpc2FibGUgZm9yIHNwZWVkKVxuICAgICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSksXG4gIF0sXG5cbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7ICdAJzogZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuL3NyYycsIGltcG9ydC5tZXRhLnVybCkpIH0sXG4gIH0sXG5cbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBob3N0OiB0cnVlLFxuICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgICBwcm94eToge1xuICAgICAgJy9hcGknOiB7IHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6NDAwMCcsIGNoYW5nZU9yaWdpbjogdHJ1ZSB9LFxuICAgIH0sXG4gIH0sXG4gIHByZXZpZXc6IHtcbiAgICBwb3J0OiA0MTczLFxuICAgIGhvc3Q6IHRydWUsXG4gICAgYWxsb3dlZEhvc3RzOiB0cnVlLFxuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6IHsgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDo0MDAwJywgY2hhbmdlT3JpZ2luOiB0cnVlIH0sXG4gICAgfSxcbiAgfSxcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNWLFNBQVMsb0JB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
