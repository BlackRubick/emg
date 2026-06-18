<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Sensores EMG</h2>
        <p class="text-sm text-gray-400 mt-0.5">Gestiona sensores electromiográficos y configuraciones</p>
      </div>
      <UButton v-if="authStore.isTechnician" icon="i-heroicons-plus" color="teal" @click="openCreate">
        Agregar Sensor
      </UButton>
    </div>

    <DataTable
      :rows="sensors"
      :columns="columns"
      :total="total"
      :loading="pending"
      searchable
      @update:page="p => { query.page = p; refresh() }"
      @update:limit="l => { query.limit = l; refresh() }"
      @update:search="s => { query.search = s; refresh() }"
    >
      <template #status-data="{ row }">
        <StatusBadge :status="row.status" />
      </template>
      <template #samplingFrequency-data="{ row }">
        <span class="font-mono text-teal-400">{{ row.samplingFrequency }} Hz</span>
      </template>
      <template #numChannels-data="{ row }">
        <span class="font-mono">{{ row.numChannels }}</span>
      </template>
      <template #_count-data="{ row }">
        <UBadge color="blue" variant="soft" size="xs">{{ row._count?.channels || 0 }} ch</UBadge>
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
          <h3 class="font-semibold text-white">{{ editTarget ? 'Editar Sensor' : 'Agregar Sensor' }}</h3>
        </template>
        <UForm :schema="sensorSchema" :state="form" @submit="onSubmit" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormGroup label="Nombre" name="name" class="col-span-2">
              <UInput v-model="form.name" placeholder="Delsys Trigno IM" />
            </UFormGroup>
            <UFormGroup label="Modelo" name="model">
              <UInput v-model="form.model" placeholder="ID del modelo" />
            </UFormGroup>
            <UFormGroup label="Fabricante" name="manufacturer">
              <UInput v-model="form.manufacturer" placeholder="Delsys Inc." />
            </UFormGroup>
            <UFormGroup label="Canales" name="numChannels">
              <UInput v-model.number="form.numChannels" type="number" />
            </UFormGroup>
            <UFormGroup label="Frec. Muestreo (Hz)" name="samplingFrequency">
              <UInput v-model.number="form.samplingFrequency" type="number" />
            </UFormGroup>
            <UFormGroup label="Estado" name="status" class="col-span-2">
              <USelect v-model="form.status" :options="statusOptions" />
            </UFormGroup>
            <UFormGroup label="Descripción" name="description" class="col-span-2">
              <UTextarea v-model="form.description" rows="2" />
            </UFormGroup>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <UButton color="gray" variant="ghost" @click="showModal = false">Cancelar</UButton>
            <UButton type="submit" color="teal" :loading="saving">Guardar</UButton>
          </div>
        </UForm>
      </UCard>
    </UModal>

    <ConfirmModal v-model="showDelete" :loading="deleting" @confirm="deleteSensor" />
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'default' })
const authStore = useAuthStore()
const toast = useToast()

const query = reactive({ page: 1, limit: 20, search: '' })
const { data, pending, refresh } = await useFetch('/api/sensors', { query })
const sensors = computed(() => (data.value as any)?.data || [])
const total = computed(() => (data.value as any)?.meta?.total || 0)

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'model', label: 'Modelo' },
  { key: 'manufacturer', label: 'Fabricante' },
  { key: 'numChannels', label: 'Canales' },
  { key: 'samplingFrequency', label: 'Frec. Muestreo' },
  { key: '_count', label: 'Configurados' },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: '' },
]

const sensorSchema = z.object({
  name: z.string().min(2),
  model: z.string().min(1),
  manufacturer: z.string().min(1),
  numChannels: z.number().int().positive(),
  samplingFrequency: z.number().positive(),
  status: z.string(),
  description: z.string().optional(),
})

const statusOptions = [
  { label: 'Activo', value: 'active' },
  { label: 'Inactivo', value: 'inactive' },
  { label: 'Mantenimiento', value: 'maintenance' },
]
const form = reactive({ name: '', model: '', manufacturer: '', numChannels: 8, samplingFrequency: 2000, status: 'active', description: '' })

const showModal = ref(false)
const showDelete = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editTarget = ref<any>(null)
const deleteTarget = ref<any>(null)

const openCreate = () => {
  editTarget.value = null
  Object.assign(form, { name: '', model: '', manufacturer: '', numChannels: 8, samplingFrequency: 2000, status: 'active', description: '' })
  showModal.value = true
}

const openEdit = (row: any) => {
  editTarget.value = row
  Object.assign(form, row)
  showModal.value = true
}

const confirmDelete = (row: any) => { deleteTarget.value = row; showDelete.value = true }

const onSubmit = async () => {
  saving.value = true
  try {
    const url = editTarget.value ? `/api/sensors/${editTarget.value.id}` : '/api/sensors'
    await $fetch(url, { method: editTarget.value ? 'PUT' : 'POST', body: form })
    toast.add({ title: `Sensor ${editTarget.value ? 'actualizado' : 'creado'}`, color: 'green' })
    showModal.value = false
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message, color: 'red' })
  } finally {
    saving.value = false
  }
}

const deleteSensor = async () => {
  deleting.value = true
  try {
    await $fetch(`/api/sensors/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Sensor eliminado', color: 'green' })
    showDelete.value = false
    refresh()
  } finally {
    deleting.value = false
  }
}
</script>
