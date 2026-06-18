export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
  ],
  ui: {
    global: true,
  },
  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: 'tailwind.config.ts',
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
  },
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'emg-secret-key-change-in-production',
    databaseUrl: process.env.DATABASE_URL,
    public: {
      wsUrl: process.env.WS_URL || 'ws://localhost:3001',
      appName: 'EMG Prosthesis System',
      appVersion: '1.0.0',
    },
  },
  nitro: {
    plugins: ['~/server/plugins/websocket.ts'],
    experimental: {
      websocket: true,
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  app: {
    head: {
      title: 'EMG Prosthesis Control System',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Biomedical EMG Gesture Recognition System for Prosthetic Hand Control' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },
})
