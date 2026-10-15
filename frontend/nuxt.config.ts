// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  // Server-only (never under `public`): env NUXT_BACKEND_URL / NUXT_PARTNER_TOKEN.
  runtimeConfig: {
    backendUrl: '',
    partnerToken: 'demo-partner-token',
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
