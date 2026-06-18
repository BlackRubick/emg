import { defineStore } from 'pinia'

interface User {
  id: number
  name: string
  email: string
  role: string
  roleId: number
  avatar?: string | null
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: null as string | null,
    loading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isAdmin: (state) => state.user?.role === 'Administrador',
    isResearcher: (state) => ['Administrador', 'Investigador'].includes(state.user?.role || ''),
    isTechnician: (state) => ['Administrador', 'Técnico'].includes(state.user?.role || ''),
    userInitials: (state) => {
      if (!state.user?.name) return '?'
      return state.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    },
  },

  actions: {
    async login(email: string, password: string) {
      this.loading = true
      try {
        const data = await $fetch<{ data: { user: User; token: string } }>('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        })
        this.user = data.data.user
        this.token = data.data.token
        return true
      } finally {
        this.loading = false
      }
    },

    async logout() {
      await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
      this.user = null
      this.token = null
      await navigateTo('/auth/login')
    },

    async fetchMe() {
      try {
        const data = await $fetch<{ data: User & { role: { name: string } } }>('/api/auth/me')
        this.user = {
          id: data.data.id,
          name: data.data.name,
          email: data.data.email,
          role: (data.data as any).role?.name || '',
          roleId: (data.data as any).roleId,
          avatar: data.data.avatar,
        }
      } catch {
        this.user = null
        this.token = null
      }
    },
  },
})
