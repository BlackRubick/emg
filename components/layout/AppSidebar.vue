<template>
  <aside class="fixed left-0 top-0 h-full w-64 flex flex-col z-40 bg-gray-950 border-r border-gray-800/60">

    <!-- Logo -->
    <div class="px-4 pt-5 pb-4 border-b border-gray-800/60">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style="background: linear-gradient(135deg, #0d9488, #2563eb)">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <div class="min-w-0">
          <p class="text-sm font-bold text-white leading-none">Sistema EMG</p>
          <p class="text-xs text-gray-500 mt-0.5">Control de Prótesis</p>
        </div>
        <!-- Live indicator -->
        <div v-if="emgStore.isStreaming" class="ml-auto flex items-center gap-1 text-xs text-teal-400 bg-teal-950/60 border border-teal-900/60 rounded-full px-2 py-0.5">
          <span class="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
          En vivo
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
      <template v-for="section in navSections" :key="section.title">
        <p class="px-3 pt-3 pb-1.5 text-xs font-semibold text-gray-600 uppercase tracking-widest first:pt-1">
          {{ section.title }}
        </p>
        <NuxtLink
          v-for="item in section.items"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group relative"
          :class="isActive(item.to)
            ? 'bg-teal-950/70 text-teal-300 border border-teal-900/60'
            : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'"
        >
          <!-- Active left bar -->
          <span
            v-if="isActive(item.to)"
            class="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-teal-400"
          />

          <UIcon
            :name="item.icon"
            class="w-4 h-4 flex-shrink-0 transition-colors"
            :class="isActive(item.to) ? 'text-teal-400' : 'text-gray-600 group-hover:text-gray-400'"
          />
          <span class="flex-1 truncate">{{ item.label }}</span>

          <!-- Badge -->
          <span
            v-if="item.badge"
            class="text-xs px-1.5 py-0.5 rounded-full font-medium"
            :class="isActive(item.to) ? 'bg-teal-900/60 text-teal-400' : 'bg-gray-800 text-gray-500'"
          >
            {{ item.badge }}
          </span>
        </NuxtLink>
      </template>
    </nav>

    <!-- User + Logout -->
    <div class="px-3 pb-3 pt-2 border-t border-gray-800/60 space-y-2">
      <!-- User info (non-clickable) -->
      <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-900/50 border border-gray-800/40">
        <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style="background: linear-gradient(135deg, #0d9488, #2563eb)">
          {{ authStore.userInitials }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-gray-300 truncate">{{ authStore.user?.name }}</p>
          <p class="text-xs text-gray-600 truncate">{{ authStore.user?.role }}</p>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
        </div>
      </div>

      <!-- Explicit logout button -->
      <button
        class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-950/60 hover:text-red-300 transition-all duration-150 text-sm font-medium"
        @click="authStore.logout()"
      >
        <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4" />
        Cerrar sesión
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEMGStore } from '~/stores/emg'

const authStore = useAuthStore()
const emgStore  = useEMGStore()
const route     = useRoute()

const isActive = (path: string) =>
  path === '/dashboard' ? route.path === '/dashboard' : route.path.startsWith(path)

const navSections = computed(() => [
  {
    title: 'Control',
    items: [
      { to: '/emg-control', label: 'EMG Control', icon: 'i-heroicons-cpu-chip', badge: 'ESP32' },
      { to: '/patients',    label: 'Pacientes',   icon: 'i-heroicons-user-group' },
    ],
  },
  ...(authStore.isAdmin ? [{
    title: 'Sistema',
    items: [
      { to: '/users', label: 'Usuarios', icon: 'i-heroicons-users' },
    ],
  }] : []),
])
</script>
