<template>
  <header class="sticky top-0 z-30 h-14 flex items-center justify-between px-6 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl">

    <!-- Left: page title + breadcrumb -->
    <div class="flex items-center gap-3">
      <h2 class="text-sm font-semibold text-white">{{ pageTitle }}</h2>
      <span class="text-gray-700">·</span>
      <span class="text-xs text-gray-500 hidden sm:block">{{ pageDescription }}</span>
    </div>

    <!-- Right: actions -->
    <div class="flex items-center gap-2">

      <!-- WebSocket latency pill -->
      <div
        class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors border"
        :class="emgStore.isConnected
          ? 'bg-teal-950/40 border-teal-900/50 text-teal-400'
          : 'bg-gray-900 border-gray-800 text-gray-600'"
      >
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="emgStore.isConnected ? 'bg-teal-400 animate-pulse' : 'bg-gray-600'"
        />
        <span class="font-mono">{{ emgStore.isConnected ? `${emgStore.latency}ms` : 'sin conexión' }}</span>
      </div>

      <!-- Color mode -->
      <button
        class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        @click="toggleColorMode"
      >
        <UIcon :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'" class="w-4 h-4" />
      </button>

      <!-- Notifications (cosmetic) -->
      <button class="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
        <UIcon name="i-heroicons-bell" class="w-4 h-4" />
        <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-teal-400"></span>
      </button>

      <!-- User dropdown -->
      <UDropdown :items="userMenuItems" :popper="{ placement: 'bottom-end' }">
        <button class="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-800/60 transition-colors border border-transparent hover:border-gray-700/60">
          <div class="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style="background: linear-gradient(135deg, #0d9488, #2563eb)">
            {{ authStore.userInitials }}
          </div>
          <div class="hidden md:block text-left">
            <p class="text-xs font-medium text-gray-300 leading-none">{{ authStore.user?.name }}</p>
            <p class="text-xs text-gray-600 leading-none mt-0.5">{{ authStore.user?.role }}</p>
          </div>
          <UIcon name="i-heroicons-chevron-down" class="w-3 h-3 text-gray-600 hidden md:block" />
        </button>
      </UDropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEMGStore } from '~/stores/emg'

const authStore   = useAuthStore()
const emgStore    = useEMGStore()
const colorMode   = useColorMode()
const route       = useRoute()

const toggleColorMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const pageMap: Record<string, { title: string; desc: string }> = {
  '/dashboard':  { title: 'Dashboard',              desc: 'Resumen general del sistema' },
  '/subjects':   { title: 'Sujetos de Estudio',     desc: 'Gestión de participantes' },
  '/sensors':    { title: 'Sensores EMG',            desc: 'Configuración de hardware' },
  '/channels':   { title: 'Canales EMG',             desc: 'Mapeo muscular' },
  '/datasets':   { title: 'Dataset NinaPro',         desc: 'Archivos CSV / MAT' },
  '/signals':    { title: 'Señales EMG',             desc: 'Monitor y archivo' },
  '/features':   { title: 'Características',         desc: 'MAV · RMS · WL · ZC · SSC' },
  '/models':     { title: 'Modelos LDA',             desc: 'Entrenamiento y evaluación' },
  '/gestures':   { title: 'Reconocimiento de Gestos', desc: 'Clasificación en tiempo real' },
  '/prosthesis': { title: 'Control de Prótesis',     desc: 'Panel de comandos' },
  '/reports':    { title: 'Reportes',                desc: 'PDF · CSV · JSON' },
  '/audit':      { title: 'Auditoría',               desc: 'Log de actividad' },
  '/users':      { title: 'Usuarios',                desc: 'Roles y permisos' },
}

const currentPage = computed(() => {
  for (const [path, info] of Object.entries(pageMap)) {
    if (route.path.startsWith(path)) return info
  }
  return { title: 'Sistema EMG', desc: '' }
})

const pageTitle       = computed(() => currentPage.value.title)
const pageDescription = computed(() => currentPage.value.desc)

const userMenuItems = computed(() => [[
  { label: authStore.user?.email ?? '', disabled: true, icon: 'i-heroicons-envelope' },
], [
  { label: 'Cambiar contraseña', icon: 'i-heroicons-key',  to: '/auth/change-password' },
], [
  { label: 'Cerrar sesión', icon: 'i-heroicons-arrow-right-on-rectangle', click: () => authStore.logout() },
]])
</script>
