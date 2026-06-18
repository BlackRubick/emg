<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-xl font-bold text-white">Auditoría del Sistema</h2>
      <p class="text-sm text-gray-400 mt-0.5">Registro completo de actividad de todas las acciones del sistema</p>
    </div>

    <div class="flex flex-wrap gap-3 mb-2">
      <USelect v-model="query.module" :options="moduleOptions" placeholder="Todos los módulos" size="sm" class="w-40" @change="refresh()" />
      <USelect v-model="query.action" :options="actionOptions" placeholder="Todas las acciones" size="sm" class="w-40" @change="refresh()" />
    </div>

    <DataTable
      :rows="logs"
      :columns="columns"
      :total="total"
      :loading="pending"
      @update:page="p => { query.page = p; refresh() }"
      @update:limit="l => { query.limit = l; refresh() }"
    >
      <template #action-data="{ row }">
        <UBadge :color="actionColor(row.action)" variant="soft" size="xs">{{ row.action }}</UBadge>
      </template>
      <template #user-data="{ row }">
        <span class="text-sm text-gray-300">{{ row.user?.name || 'Sistema' }}</span>
      </template>
      <template #module-data="{ row }">
        <UBadge color="gray" variant="soft" size="xs">{{ row.module }}</UBadge>
      </template>
      <template #createdAt-data="{ row }">
        <span class="text-xs text-gray-500 font-mono">{{ new Date(row.createdAt).toLocaleString('es') }}</span>
      </template>
      <template #ipAddress-data="{ row }">
        <span class="text-xs text-gray-500 font-mono">{{ row.ipAddress }}</span>
      </template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const query = reactive({ page: 1, limit: 30, module: '', action: '' })
const { data, pending, refresh } = await useFetch('/api/audit', { query })
const logs = computed(() => (data.value as any)?.data || [])
const total = computed(() => (data.value as any)?.meta?.total || 0)

const columns = [
  { key: 'createdAt', label: 'Fecha/Hora' },
  { key: 'user', label: 'Usuario' },
  { key: 'action', label: 'Acción' },
  { key: 'module', label: 'Módulo' },
  { key: 'entityId', label: 'ID Entidad' },
  { key: 'ipAddress', label: 'Dirección IP' },
]

const moduleOptions = [
  { label: 'Todos', value: '' },
  ...['auth', 'users', 'subjects', 'sensors', 'channels', 'models', 'prosthesis', 'datasets'].map(m => ({ label: m, value: m })),
]

const actionOptions = [
  { label: 'Todas', value: '' },
  ...['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'UPLOAD', 'TRAIN', 'MOVE'].map(a => ({ label: a, value: a })),
]

const actionColor = (action: string) => {
  const map: Record<string, string> = {
    LOGIN: 'green', LOGOUT: 'gray', CREATE: 'blue', UPDATE: 'yellow', DELETE: 'red',
    UPLOAD: 'purple', TRAIN: 'teal', MOVE: 'orange',
  }
  return (map[action] || 'gray') as any
}
</script>
