import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/auth/')) return

  const authStore = useAuthStore()

  if (!authStore.isAuthenticated) {
    await authStore.fetchMe()
  }

  if (!authStore.isAuthenticated) {
    return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.path)}`)
  }
})
