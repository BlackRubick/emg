<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Canales EMG</h2>
        <p class="text-sm text-gray-400 mt-0.5">Configura canales de sensores EMG y ubicaciones musculares</p>
      </div>
      <div class="flex gap-2">
        <USelect v-model="query.sensorId" :options="sensorOptions" placeholder="Todos los sensores" size="sm" class="w-48" @change="refresh()" />
        <UButton v-if="authStore.isTechnician" icon="i-heroicons-plus" color="teal" @click="openCreate">Agregar Canal</UButton>
      </div>
    </div>

    <DataTable
      :rows="channels"
      :columns="columns"
      :total="total"
      :loading="pending"
      searchable
      @update:page="p => { query.page = p; refresh() }"
      @update:limit="l => { query.limit = l; refresh() }"
      @update:search="s => { query.search = s; refresh() }"
    >
      <template #sensor-data="{ row }">
        <span class="text-xs text-gray-400">{{ row.sensor?.name }}</span>
      </template>
      <template #active-data="{ row }">
        <UBadge :color="row.active ? 'green' : 'gray'" variant="soft" size="xs">{{ row.active ? 'Activo' : 'Inactivo' }}</UBadge>
      </template>
      <template #actions-data="{ row }">
        <div class="flex gap-1">
          <UButton icon="i-heroicons-pencil-square" variant="ghost" size="xs" color="gray" @click="openEdit(row)" />
          <UButton v-if="authStore.isAdmin" icon="i-heroicons-trash" variant="ghost" size="xs" color="red" @click="confirmDelete(row)" />
        </div>
      </template>
    </DataTable>

    <UModal v-model="showModal">
      <UCard>
        <template #header>
          <h3 class="font-semibold text-white">{{ editTarget ? 'Editar Canal' : 'Agregar Canal' }}</h3>
        </template>
        <UForm :state="form" @submit="onSubmit" class="space-y-4">
          <UFormGroup label="Sensor">
            <USelect v-model.number="form.sensorId" :options="sensorOptions.filter(s => s.value)" />
          </UFormGroup>
          <UFormGroup label="Número de Canal">
            <UInput v-model.number="form.channelNumber" type="number" min="1" />
          </UFormGroup>
          <UFormGroup label="Ubicación Muscular">
            <USelect v-model="form.muscleLocation" :options="muscleOptions" />
          </UFormGroup>
          <UFormGroup label="Descripción">
            <UTextarea v-model="form.description" rows="2" />
          </UFormGroup>
          <div class="flex justify-end gap-3">
            <UButton color="gray" variant="ghost" @click="showModal = false">Cancelar</UButton>
            <UButton type="submit" color="teal" :loading="saving">Guardar</UButton>
          </div>
        </UForm>
      </UCard>
    </UModal>

    <ConfirmModal v-model="showDelete" :loading="deleting" @confirm="deleteChannel" />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'default' })
const authStore = useAuthStore()
const toast = useToast()

const query = reactive({ page: 1, limit: 20, search: '', sensorId: '' })
const { data, pending, refresh } = await useFetch('/api/channels', { query })
const channels = computed(() => (data.value as any)?.data || [])
const total = computed(() => (data.value as any)?.meta?.total || 0)

const { data: sensorsData } = await useFetch('/api/sensors', { query: { limit: 100 } })
const sensorOptions = computed(() => [
  { label: 'Todos los sensores', value: '' },
  ...((sensorsData.value as any)?.data || []).map((s: any) => ({ label: s.name, value: String(s.id) })),
])

const columns = [
  { key: 'channelNumber', label: 'CH#' }, { key: 'sensor', label: 'Sensor' },
  { key: 'muscleLocation', label: 'Ubic. Muscular' }, { key: 'description', label: 'Descripción' },
  { key: 'active', label: 'Estado' }, { key: 'actions', label: '' },
]

const muscleOptions = [
  'Flexor Carpi Radialis', 'Flexor Digitorum', 'Extensor Carpi Radialis', 'Extensor Digitorum',
  'Biceps Brachii', 'Triceps Brachii', 'Pronator Teres', 'Supinator', 'Personalizado',
]

const form = reactive({ sensorId: 0, channelNumber: 1, muscleLocation: 'Flexor Carpi Radialis', description: '' })
const showModal = ref(false)
const showDelete = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editTarget = ref<any>(null)
const deleteTarget = ref<any>(null)

const openCreate = () => { editTarget.value = null; Object.assign(form, { sensorId: 0, channelNumber: 1, muscleLocation: 'Flexor Carpi Radialis', description: '' }); showModal.value = true }
const openEdit = (row: any) => { editTarget.value = row; Object.assign(form, row); showModal.value = true }
const confirmDelete = (row: any) => { deleteTarget.value = row; showDelete.value = true }

const onSubmit = async () => {
  saving.value = true
  try {
    const url = editTarget.value ? `/api/channels/${editTarget.value.id}` : '/api/channels'
    await $fetch(url, { method: editTarget.value ? 'PUT' : 'POST', body: form })
    toast.add({ title: `Canal ${editTarget.value ? 'actualizado' : 'creado'}`, color: 'green' })
    showModal.value = false
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message, color: 'red' })
  } finally {
    saving.value = false
  }
}

const deleteChannel = async () => {
  deleting.value = true
  try {
    await $fetch(`/api/channels/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Canal eliminado', color: 'green' })
    showDelete.value = false
    refresh()
  } finally {
    deleting.value = false
  }
}
</script>
