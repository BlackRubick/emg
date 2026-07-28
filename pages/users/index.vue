<template>
  <div class="space-y-4">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Usuarios</h2>
        <p class="text-sm text-gray-500 mt-0.5">Gestión de cuentas del sistema</p>
      </div>
      <UButton icon="i-heroicons-plus" color="teal" @click="openCreate">
        Nuevo usuario
      </UButton>
    </div>

    <!-- Búsqueda -->
    <div class="flex gap-3">
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Buscar por nombre o correo..."
        class="max-w-sm"
        :ui="{ base: 'bg-gray-900 border-gray-800' }"
        @input="debouncedFetch"
      />
    </div>

    <!-- Tabla -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-800">
            <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Correo</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Último acceso</th>
            <th class="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="px-5 py-10 text-center text-gray-600 text-xs">Cargando...</td>
          </tr>
          <tr v-else-if="!users.length">
            <td colspan="6" class="px-5 py-10 text-center text-gray-600 text-xs">Sin usuarios</td>
          </tr>
          <tr
            v-for="u in users"
            :key="u.id"
            class="border-t border-gray-800/60 hover:bg-gray-800/30 transition-colors"
          >
            <td class="px-5 py-3">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style="background: linear-gradient(135deg, #0d9488, #2563eb)">
                  {{ initials(u.name) }}
                </div>
                <span class="text-gray-200 font-medium">{{ u.name }}</span>
              </div>
            </td>
            <td class="px-5 py-3 text-gray-400">{{ u.email }}</td>
            <td class="px-5 py-3">
              <span class="text-xs px-2 py-0.5 rounded-full border border-teal-900/50 bg-teal-950/40 text-teal-400">
                {{ u.role?.name ?? '—' }}
              </span>
            </td>
            <td class="px-5 py-3">
              <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                :class="u.active
                  ? 'bg-green-950/40 border border-green-900/50 text-green-400'
                  : 'bg-gray-800 border border-gray-700 text-gray-500'">
                {{ u.active ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td class="px-5 py-3 text-gray-600 text-xs font-mono">
              {{ u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric' }) : 'Nunca' }}
            </td>
            <td class="px-5 py-3">
              <div class="flex items-center justify-end gap-2">
                <UButton size="xs" color="gray" variant="ghost" icon="i-heroicons-pencil-square"
                  @click="openEdit(u)" />
                <UButton size="xs" color="red" variant="ghost" icon="i-heroicons-trash"
                  :disabled="u.id === authStore.user?.id"
                  @click="openDelete(u)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Paginación -->
      <div v-if="total > limit" class="flex items-center justify-between px-5 py-3 border-t border-gray-800">
        <span class="text-xs text-gray-600">{{ total }} usuarios</span>
        <div class="flex gap-2">
          <UButton size="xs" color="gray" variant="ghost" :disabled="page <= 1" @click="page--; fetchUsers()">Anterior</UButton>
          <span class="text-xs text-gray-500 self-center">{{ page }} / {{ totalPages }}</span>
          <UButton size="xs" color="gray" variant="ghost" :disabled="page >= totalPages" @click="page++; fetchUsers()">Siguiente</UButton>
        </div>
      </div>
    </div>

    <!-- Modal crear / editar -->
    <UModal v-model="showForm">
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 w-full max-w-md">
        <h3 class="text-base font-bold text-white">{{ editing ? 'Editar usuario' : 'Nuevo usuario' }}</h3>

        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Nombre</label>
            <UInput v-model="form.name" placeholder="Nombre completo" :ui="inputUI" />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Correo</label>
            <UInput v-model="form.email" type="email" placeholder="correo@ejemplo.com" :ui="inputUI" />
          </div>
          <div v-if="!editing">
            <label class="block text-xs text-gray-400 mb-1">Contraseña</label>
            <UInput v-model="form.password" type="password" placeholder="Mínimo 8 caracteres" :ui="inputUI" />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Rol</label>
            <USelect
              v-model="form.roleId"
              :options="roleOptions"
              option-attribute="label"
              value-attribute="value"
              :ui="inputUI"
            />
          </div>
          <div class="flex items-center justify-between py-1">
            <span class="text-xs text-gray-400">Cuenta activa</span>
            <UToggle v-model="form.active" color="teal" />
          </div>
        </div>

        <p v-if="formError" class="text-xs text-red-400">{{ formError }}</p>

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="gray" variant="ghost" @click="showForm = false">Cancelar</UButton>
          <UButton color="teal" :loading="saving" @click="submitForm">
            {{ editing ? 'Guardar cambios' : 'Crear usuario' }}
          </UButton>
        </div>
      </div>
    </UModal>

    <!-- Modal confirmar eliminación -->
    <UModal v-model="showDelete">
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 w-full max-w-sm">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-red-950/60 border border-red-900/50 flex items-center justify-center">
            <UIcon name="i-heroicons-trash" class="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">Eliminar usuario</h3>
            <p class="text-xs text-gray-500 mt-0.5">Esta acción no se puede deshacer</p>
          </div>
        </div>
        <p class="text-sm text-gray-300">
          ¿Eliminar a <span class="font-semibold text-white">{{ deletingUser?.name }}</span>?
        </p>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="showDelete = false">Cancelar</UButton>
          <UButton color="red" :loading="saving" @click="confirmDelete">Eliminar</UButton>
        </div>
      </div>
    </UModal>

  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'default' })

const authStore = useAuthStore()
const toast = useToast()

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Role { id: number; name: string }
interface User {
  id: number; name: string; email: string
  roleId: number; active: boolean; avatar: string | null
  lastLogin: string | null; role: Role
}

// ── Lista de usuarios ──────────────────────────────────────────────────────
const users   = ref<User[]>([])
const total   = ref(0)
const page    = ref(1)
const limit   = 10
const search  = ref('')
const loading = ref(false)
const totalPages = computed(() => Math.ceil(total.value / limit))

async function fetchUsers() {
  loading.value = true
  try {
    const res = await $fetch<{ data: User[]; meta: { total: number } }>('/api/users', {
      query: { page: page.value, limit, search: search.value || undefined },
    })
    users.value = res.data
    total.value = res.meta.total
  } catch {
    toast.add({ title: 'Error al cargar usuarios', color: 'red' })
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout>
function debouncedFetch() {
  clearTimeout(searchTimer)
  page.value = 1
  searchTimer = setTimeout(fetchUsers, 350)
}

// ── Roles ──────────────────────────────────────────────────────────────────
const roles = ref<Role[]>([])
const roleOptions = computed(() => roles.value.map(r => ({ label: r.name, value: r.id })))

async function fetchRoles() {
  try {
    const res = await $fetch<{ data: Role[] }>('/api/roles')
    roles.value = res.data
  } catch {}
}

// ── Formulario ─────────────────────────────────────────────────────────────
const showForm   = ref(false)
const editing    = ref<User | null>(null)
const saving     = ref(false)
const formError  = ref('')
const form = reactive({ name: '', email: '', password: '', roleId: 0, active: true })

const inputUI = { base: 'bg-gray-800 border-gray-700 text-white' }

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', email: '', password: '', roleId: roles.value[0]?.id ?? 0, active: true })
  formError.value = ''
  showForm.value = true
}

function openEdit(u: User) {
  editing.value = u
  Object.assign(form, { name: u.name, email: u.email, password: '', roleId: u.roleId, active: u.active })
  formError.value = ''
  showForm.value = true
}

async function submitForm() {
  formError.value = ''
  if (!form.name.trim() || !form.email.trim()) { formError.value = 'Nombre y correo son requeridos'; return }
  if (!editing.value && form.password.length < 8) { formError.value = 'La contraseña debe tener mínimo 8 caracteres'; return }

  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/users/${editing.value.id}`, {
        method: 'PUT',
        body: { name: form.name, email: form.email, roleId: form.roleId, active: form.active },
      })
      toast.add({ title: 'Usuario actualizado', color: 'teal' })
    } else {
      await $fetch('/api/users', {
        method: 'POST',
        body: { name: form.name, email: form.email, password: form.password, roleId: form.roleId, active: form.active },
      })
      toast.add({ title: 'Usuario creado', color: 'teal' })
    }
    showForm.value = false
    fetchUsers()
  } catch (e: any) {
    formError.value = e?.data?.message || 'Error al guardar'
  } finally {
    saving.value = false
  }
}

// ── Eliminar ───────────────────────────────────────────────────────────────
const showDelete   = ref(false)
const deletingUser = ref<User | null>(null)

function openDelete(u: User) {
  deletingUser.value = u
  showDelete.value = true
}

async function confirmDelete() {
  if (!deletingUser.value) return
  saving.value = true
  try {
    await $fetch(`/api/users/${deletingUser.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Usuario eliminado', color: 'teal' })
    showDelete.value = false
    fetchUsers()
  } catch (e: any) {
    toast.add({ title: e?.data?.message || 'Error al eliminar', color: 'red' })
  } finally {
    saving.value = false
  }
}

// ── Utilidades ─────────────────────────────────────────────────────────────
const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

// ── Init ───────────────────────────────────────────────────────────────────
onMounted(() => { fetchRoles(); fetchUsers() })
</script>
