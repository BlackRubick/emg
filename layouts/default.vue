<template>
  <div class="min-h-screen bg-gray-950 text-gray-100 flex">
    <!-- Sidebar -->
    <LayoutAppSidebar />

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0 ml-64">
      <!-- Top Bar -->
      <LayoutAppTopBar />

      <!-- Page Content -->
      <main class="flex-1 p-6 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
await authStore.fetchMe()

if (!authStore.isAuthenticated) {
  await navigateTo('/auth/login')
}
</script>
