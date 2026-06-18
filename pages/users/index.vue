<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Gestión de Usuarios</h2>
        <p class="text-sm text-gray-400 mt-0.5">Gestiona usuarios y permisos del sistema</p>
      </div>
      <UButton icon="i-heroicons-user-plus" color="teal" @click="openCreate">Nuevo Usuario</UButton>
    </div>

    <DataTable
      :rows="users"
      :columns="columns"
      :total="total"
      :loading="pending"
      searchable
      search-placeholder="Buscar por nombre o correo..."
      @update:page="p => { query.page = p; refresh() }"
      @update:limit="l => { query.limit = l; refresh() }"
      @update:search="s => { query.search = s; refresh() }"
    >
      <template #role-data="{ row }">
        <UBadge color="teal" variant="soft" size="xs">{{ row.role?.name }}</UBadge>
      </template>
      <template #active-data="{ row }">
        <UBadge :color="row.active ? 'green' : 'red'" variant="soft" size="xs">{{ row.active ? 'Activo' : 'Inactivo' }}</UBadge>
      </template>
      <template #lastLogin-data="{ row }">
        <span class="text-xs text-gray-500">{{ row.lastLogin ? new Date(row.lastLogin).toLocaleDateString('es') : 'Nunca' }}</span>
      </template>
      <template #actions-data="{ row }">
        <div class="flex gap-1">
          <UButton icon="i-heroicons-pencil-square" variant="ghost" size="xs" color="gray" @click="openEdit(row)" />
          <UButton icon="i-heroicons-trash" variant="ghost" size="xs" color="red"
            :disabled="row.id === authStore.user?.id"
            @click="confirmDelete(row)" />
        </div>
      </template>
    </DataTable>

    <UModal v-model="showModal">
      <UCard>
        <template #header>
          <h3 class="font-semibold text-white">{{ editTarget ? 'Editar Usuario' : 'Nuevo Usuario' }}</h3>
        </template>
        <UForm :state="form" @submit="onSubmit" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormGroup label="Nombre Completo" name="name" class="col-span-2">
              <UInput v-model="form.name" placeholder="Nombre completo" />
            </UFormGroup>
            <UFormGroup label="Correo" name="email" class="col-span-2">
              <UInput v-model="form.email" type="email" placeholder="usuario@emg.system" />
            </UFormGroup>
            <UFormGroup v-if="!editTarget" label="Contraseña" name="password" class="col-span-2">
              <UInput v-model="form.password" type="password" placeholder="Mín. 8 caracteres" />
            </UFormGroup>
            <UFormGroup label="Rol" name="roleId">
              <USelect v-model.number="form.roleId" :options="roleOptions" />
            </UFormGroup>
            <UFormGroup label="Estado" name="active">
              <USelect v-model="form.active" :options="[{ label: 'Activo', value: true }, { label: 'Inactivo', value: false }]" />
            </UFormGroup>
          </div>
          <div class="flex justify-end gap-3">
            <UButton color="gray" variant="ghost" @click="showModal = false">Cancelar</UButton>
            <UButton type="submit" color="teal" :loading="saving">{{ editTarget ? 'Actualizar' : 'Crear' }}</UButton>
          </div>
        </UForm>
      </UCard>
    </UModal>

    <ConfirmModal v-model="showDelete" :loading="deleting" @confirm="deleteUser" />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'default' })
const authStore = useAuthStore()
const toast = useToast()

const query = reactive({ page: 1, limit: 20, search: '' })
const { data, pending, refresh } = await useFetch('/api/users', { query })
const users = computed(() => (data.value as any)?.data || [])
const total = computed(() => (data.value as any)?.meta?.total || 0)

const { data: rolesData } = await useFetch('/api/roles')
const roleOptions = computed(() =>
  ((rolesData.value as any)?.data || []).map((r: any) => ({ label: r.name, value: r.id }))
)

const columns = [
  { key: 'name', label: 'Nombre' }, { key: 'email', label: 'Correo' },
  { key: 'role', label: 'Rol' }, { key: 'active', label: 'Estado' },
  { key: 'lastLogin', label: 'Último Acceso' }, { key: 'actions', label: '' },
]

const showModal = ref(false)
const showDelete = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editTarget = ref<any>(null)
const deleteTarget = ref<any>(null)
const form = reactive({ name: '', email: '', password: '', roleId: 1, active: true })

const openCreate = () => {
  editTarget.value = null
  Object.assign(form, { name: '', email: '', password: '', roleId: 1, active: true })
  showModal.value = true
}

const openEdit = (row: any) => {
  editTarget.value = row
  Object.assign(form, { name: row.name, email: row.email, password: '', roleId: row.roleId, active: row.active })
  showModal.value = true
}

const confirmDelete = (row: any) => { deleteTarget.value = row; showDelete.value = true }

const onSubmit = async () => {
  saving.value = true
  try {
    const body = editTarget.value ? { name: form.name, email: form.email, roleId: form.roleId, active: form.active } : form
    const url = editTarget.value ? `/api/users/${editTarget.value.id}` : '/api/users'
    await $fetch(url, { method: editTarget.value ? 'PUT' : 'POST', body })
    toast.add({ title: `Usuario ${editTarget.value ? 'actualizado' : 'creado'}`, color: 'green' })
    showModal.value = false
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message, color: 'red' })
  } finally {
    saving.value = false
  }
}

const deleteUser = async () => {
  deleting.value = true
  try {
    await $fetch(`/api/users/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Usuario eliminado', color: 'green' })
    showDelete.value = false
    refresh()
  } finally {
    deleting.value = false
  }
}
</script>
