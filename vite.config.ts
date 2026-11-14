import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Arcadia Quest Solo Companion',
        short_name: 'AQ Solo',
        description: "Automate et arbitre pour jouer en solo à Arcadia Quest avec le matériel physique.",
        lang: 'fr',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#0c0a09',
        theme_color: '#d97706',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,json}'], navigateFallback: 'index.html' },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Les parcours complets en jsdom rendent tout le plateau à chaque geste : sous la charge de toute la suite, 5 s peuvent manquer.
    testTimeout: 20000,
  },
});
