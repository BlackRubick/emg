<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Dataset NinaPro</h2>
        <p class="text-sm text-gray-400 mt-0.5">Sube y gestiona archivos de datasets EMG</p>
      </div>
      <UButton icon="i-heroicons-arrow-up-tray" color="teal" @click="showUpload = true">Subir Dataset</UButton>
    </div>

    <DataTable
      :rows="datasets"
      :columns="columns"
      :total="total"
      :loading="pending"
      searchable
      @update:page="p => { query.page = p; refresh() }"
      @update:limit="l => { query.limit = l; refresh() }"
      @update:search="s => { query.search = s; refresh() }"
    >
      <template #fileType-data="{ row }">
        <UBadge :color="row.fileType === 'csv' ? 'green' : row.fileType === 'mat' ? 'blue' : 'gray'" variant="soft" size="xs">
          .{{ row.fileType?.toUpperCase() }}
        </UBadge>
      </template>
      <template #fileSize-data="{ row }">
        <span class="text-xs text-gray-400">{{ formatBytes(row.fileSize) }}</span>
      </template>
      <template #validated-data="{ row }">
        <UBadge :color="row.validated ? 'green' : 'yellow'" variant="soft" size="xs">{{ row.validated ? 'Validado' : 'Pendiente' }}</UBadge>
      </template>
      <template #subject-data="{ row }">
        <span class="text-xs text-gray-400">{{ row.subject?.name || '-' }}</span>
      </template>
      <template #uploadedAt-data="{ row }">
        <span class="text-xs text-gray-500">{{ new Date(row.uploadedAt).toLocaleDateString('es') }}</span>
      </template>
    </DataTable>

    <!-- Upload Modal -->
    <UModal v-model="showUpload">
      <UCard>
        <template #header>
          <h3 class="font-semibold text-white">Subir Dataset</h3>
        </template>
        <div class="space-y-4">
          <UFormGroup label="Nombre del Dataset">
            <UInput v-model="uploadForm.name" placeholder="NinaPro DB5 - Sujeto 1" />
          </UFormGroup>
          <UFormGroup label="Descripción">
            <UTextarea v-model="uploadForm.description" rows="2" />
          </UFormGroup>
          <UFormGroup label="Archivo (CSV, MAT, JSON)">
            <input
              ref="fileInput"
              type="file"
              accept=".csv,.mat,.json"
              class="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-teal-900/50 file:text-teal-400 hover:file:bg-teal-900 cursor-pointer"
              @change="onFileSelect"
            />
          </UFormGroup>
          <div v-if="selectedFile" class="bg-gray-800/50 rounded-lg p-3 flex items-center gap-3">
            <UIcon name="i-heroicons-document" class="w-5 h-5 text-teal-400" />
            <div>
              <p class="text-sm text-white">{{ selectedFile.name }}</p>
              <p class="text-xs text-gray-500">{{ formatBytes(selectedFile.size) }}</p>
            </div>
          </div>
          <div class="flex justify-end gap-3">
            <UButton color="gray" variant="ghost" @click="showUpload = false">Cancelar</UButton>
            <UButton color="teal" :loading="uploading" :disabled="!selectedFile || !uploadForm.name" @click="uploadDataset">
              Subir
            </UButton>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
const toast = useToast()

const query = reactive({ page: 1, limit: 20, search: '' })
const { data, pending, refresh } = await useFetch('/api/datasets', { query })
const datasets = computed(() => (data.value as any)?.data || [])
const total = computed(() => (data.value as any)?.meta?.total || 0)

const columns = [
  { key: 'name', label: 'Nombre' }, { key: 'fileType', label: 'Tipo' }, { key: 'fileSize', label: 'Tamaño' },
  { key: 'subject', label: 'Sujeto' }, { key: 'validated', label: 'Estado' }, { key: 'uploadedAt', label: 'Subido' },
]

const showUpload = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const uploadForm = reactive({ name: '', description: '' })

const formatBytes = (bytes: number | bigint) => {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

const onFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  selectedFile.value = target.files?.[0] || null
  if (selectedFile.value && !uploadForm.name) {
    uploadForm.name = selectedFile.value.name.replace(/\.[^.]+$/, '')
  }
}

const uploadDataset = async () => {
  if (!selectedFile.value) return
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('name', uploadForm.name)
    formData.append('description', uploadForm.description)

    await $fetch('/api/datasets/upload', { method: 'POST', body: formData })
    toast.add({ title: 'Dataset subido exitosamente', color: 'teal' })
    showUpload.value = false
    selectedFile.value = null
    Object.assign(uploadForm, { name: '', description: '' })
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Error al subir', description: e?.data?.message, color: 'red' })
  } finally {
    uploading.value = false
  }
}
</script>
