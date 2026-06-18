<template>
  <div class="w-full max-w-md relative z-10">
    <!-- Card -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center shadow-lg mb-4">
          <svg class="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white">Sistema EMG</h1>
        <p class="text-gray-400 text-sm mt-1">Plataforma de Control de Prótesis</p>
      </div>

      <!-- Form -->
      <UForm :schema="schema" :state="form" @submit="onSubmit" class="space-y-4">
        <UFormGroup label="Correo" name="email">
          <UInput
            v-model="form.email"
            type="email"
            placeholder="admin@emg.system"
            icon="i-heroicons-envelope"
            size="lg"
            :ui="inputUI"
          />
        </UFormGroup>

        <UFormGroup label="Contraseña" name="password">
          <UInput
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            icon="i-heroicons-lock-closed"
            size="lg"
            :ui="inputUI"
            :trailing-icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
            @click:trailing="showPassword = !showPassword"
          />
        </UFormGroup>

        <div v-if="error" class="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 flex items-center gap-2">
          <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 text-red-400 flex-shrink-0" />
          <p class="text-red-400 text-sm">{{ error }}</p>
        </div>

        <UButton
          type="submit"
          block
          size="lg"
          :loading="loading"
          class="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 border-0 mt-2"
        >
          Iniciar Sesión
        </UButton>
      </UForm>

      <!-- Demo credentials -->
      <div class="mt-6 p-4 bg-gray-800/50 rounded-lg">
        <p class="text-xs text-gray-500 font-medium mb-2">Credenciales de prueba:</p>
        <div class="space-y-1">
          <button
            v-for="cred in demoCreds"
            :key="cred.email"
            class="w-full flex justify-between text-xs px-2 py-1.5 rounded hover:bg-gray-700/50 transition-colors text-left"
            @click="fillCreds(cred)"
          >
            <span class="text-teal-400">{{ cred.email }}</span>
            <span class="text-gray-500">{{ cred.role }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'auth' })

const authStore = useAuthStore()
const router = useRouter()

const schema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'Requerido'),
})

const form = reactive({ email: '', password: '' })
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)

const inputUI = {
  base: 'bg-gray-800 border-gray-700 focus:border-teal-500',
  color: { white: { outline: 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-teal-500 focus:ring-teal-500/20' } },
}

const demoCreds = [
  { email: 'admin@emg.system', password: 'Admin@2024!', role: 'Admin' },
  { email: 'investigador@emg.system', password: 'User@2024!', role: 'Investigador' },
  { email: 'tecnico@emg.system', password: 'User@2024!', role: 'Técnico' },
]

const fillCreds = (cred: { email: string; password: string }) => {
  form.email = cred.email
  form.password = cred.password
}

const onSubmit = async () => {
  error.value = ''
  loading.value = true
  try {
    await authStore.login(form.email, form.password)
    await router.push('/dashboard')
  } catch (e: any) {
    error.value = e?.data?.message || 'Credenciales inválidas'
  } finally {
    loading.value = false
  }
}
</script>
