<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Modelos de Entrenamiento LDA</h2>
        <p class="text-sm text-gray-400 mt-0.5">Entrena y evalúa modelos de Análisis Discriminante Lineal</p>
      </div>
      <UButton v-if="authStore.isResearcher" icon="i-heroicons-plus" color="teal" @click="showModal = true">
        Entrenar Nuevo Modelo
      </UButton>
    </div>

    <!-- Models Grid -->
    <div v-if="!pending" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="model in models"
        :key="model.id"
        class="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors cursor-pointer"
        @click="openDetail(model)"
      >
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="font-semibold text-white text-sm">{{ model.name }}</h3>
            <p class="text-xs text-gray-500 mt-0.5">{{ model.algorithm }} · {{ model.numChannels }} canales</p>
          </div>
          <StatusBadge :status="model.status" />
        </div>

        <div v-if="model.status === 'ready'" class="grid grid-cols-2 gap-3 mt-4">
          <div class="bg-gray-800/50 rounded-lg p-3 text-center">
            <p class="text-lg font-bold text-teal-400">{{ model.accuracy?.toFixed(1) }}%</p>
            <p class="text-xs text-gray-500">Exactitud</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-3 text-center">
            <p class="text-lg font-bold text-blue-400">{{ model.f1Score?.toFixed(1) }}%</p>
            <p class="text-xs text-gray-500">Puntaje F1</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-3 text-center">
            <p class="text-base font-bold text-purple-400">{{ model.precision?.toFixed(1) }}%</p>
            <p class="text-xs text-gray-500">Precisión</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-3 text-center">
            <p class="text-base font-bold text-orange-400">{{ model.recall?.toFixed(1) }}%</p>
            <p class="text-xs text-gray-500">Recall</p>
          </div>
        </div>

        <div v-if="model.status === 'training'" class="mt-4">
          <div class="flex items-center gap-2 text-xs text-blue-400">
            <UIcon name="i-heroicons-arrow-path" class="w-3 h-3 animate-spin" />
            Entrenamiento en progreso...
          </div>
          <div class="mt-2 w-full bg-gray-800 rounded-full h-1.5">
            <div class="bg-blue-500 h-1.5 rounded-full animate-pulse" style="width: 60%"></div>
          </div>
        </div>

        <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">
          <span class="text-xs text-gray-500">Por {{ model.trainer?.name || 'Desconocido' }}</span>
          <div class="flex gap-1">
            <UButton icon="i-heroicons-eye" variant="ghost" size="xs" color="gray" @click.stop="openDetail(model)" />
            <UButton v-if="authStore.isResearcher" icon="i-heroicons-trash" variant="ghost" size="xs" color="red" @click.stop="confirmDelete(model)" />
          </div>
        </div>
      </div>

      <div v-if="!models.length" class="col-span-3 text-center py-12 text-gray-500">
        <UIcon name="i-heroicons-cpu-chip" class="w-12 h-12 mx-auto mb-3 text-gray-700" />
        <p>Sin modelos entrenados</p>
      </div>
    </div>

    <div v-else class="grid grid-cols-3 gap-4">
      <USkeleton v-for="i in 3" :key="i" class="h-52 rounded-xl" />
    </div>

    <!-- Train Modal -->
    <UModal v-model="showModal">
      <UCard>
        <template #header>
          <h3 class="font-semibold text-white">Entrenar Nuevo Modelo LDA</h3>
        </template>
        <UForm :state="trainForm" @submit="onTrain" class="space-y-4">
          <UFormGroup label="Nombre del Modelo" name="name">
            <UInput v-model="trainForm.name" placeholder="Modelo LDA - Sujeto 1" />
          </UFormGroup>
          <div class="grid grid-cols-2 gap-4">
            <UFormGroup label="Número de Canales" name="numChannels">
              <UInput v-model.number="trainForm.numChannels" type="number" min="1" max="16" />
            </UFormGroup>
            <UFormGroup label="Tamaño de Ventana (ms)" name="windowSize">
              <UInput v-model.number="trainForm.windowSize" type="number" />
            </UFormGroup>
            <UFormGroup label="Solapamiento (ms)" name="overlapSize">
              <UInput v-model.number="trainForm.overlapSize" type="number" />
            </UFormGroup>
            <UFormGroup label="Algoritmo" name="algorithm">
              <USelect v-model="trainForm.algorithm" :options="['LDA', 'SVM', 'KNN']" disabled />
            </UFormGroup>
          </div>
          <div class="flex justify-end gap-3">
            <UButton color="gray" variant="ghost" @click="showModal = false">Cancelar</UButton>
            <UButton type="submit" color="teal" :loading="training">Iniciar Entrenamiento</UButton>
          </div>
        </UForm>
      </UCard>
    </UModal>

    <!-- Detail Modal -->
    <UModal v-model="showDetail" :ui="{ width: 'sm:max-w-3xl' }">
      <UCard v-if="selectedModel">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-white">{{ selectedModel.name }}</h3>
            <StatusBadge :status="selectedModel.status" />
          </div>
        </template>
        <div class="space-y-4">
          <div class="grid grid-cols-4 gap-3">
            <div v-for="metric in metrics" :key="metric.label" class="bg-gray-800/50 rounded-lg p-3 text-center">
              <p class="text-xl font-bold" :class="metric.color">{{ metric.value }}</p>
              <p class="text-xs text-gray-500 mt-0.5">{{ metric.label }}</p>
            </div>
          </div>
          <div v-if="selectedModel.confusionMatrix">
            <h4 class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Matriz de Confusión</h4>
            <ConfusionMatrix
              :labels="selectedModel.confusionMatrix.labels"
              :matrix="selectedModel.confusionMatrix.matrix"
            />
          </div>
        </div>
      </UCard>
    </UModal>

    <ConfirmModal v-model="showDelete" :loading="deleting" @confirm="deleteModel" />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'default' })
const authStore = useAuthStore()
const toast = useToast()

const { data, pending, refresh } = await useFetch('/api/models', { query: { limit: 50 } })
const models = computed(() => (data.value as any)?.data || [])

const showModal = ref(false)
const showDetail = ref(false)
const showDelete = ref(false)
const training = ref(false)
const deleting = ref(false)
const selectedModel = ref<any>(null)
const deleteTarget = ref<any>(null)

const trainForm = reactive({ name: '', numChannels: 8, windowSize: 200, overlapSize: 50, algorithm: 'LDA' })

const openDetail = (model: any) => { selectedModel.value = model; showDetail.value = true }
const confirmDelete = (model: any) => { deleteTarget.value = model; showDelete.value = true }

const metrics = computed(() => selectedModel.value ? [
  { label: 'Exactitud', value: `${selectedModel.value.accuracy?.toFixed(1)}%`, color: 'text-teal-400' },
  { label: 'Precisión', value: `${selectedModel.value.precision?.toFixed(1)}%`, color: 'text-blue-400' },
  { label: 'Recall', value: `${selectedModel.value.recall?.toFixed(1)}%`, color: 'text-purple-400' },
  { label: 'Puntaje F1', value: `${selectedModel.value.f1Score?.toFixed(1)}%`, color: 'text-orange-400' },
] : [])

const onTrain = async () => {
  training.value = true
  try {
    await $fetch('/api/models', { method: 'POST', body: trainForm })
    toast.add({ title: 'Entrenamiento iniciado', description: 'Estará listo en unos segundos', color: 'teal' })
    showModal.value = false
    setTimeout(refresh, 4000)
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message, color: 'red' })
  } finally {
    training.value = false
  }
}

const deleteModel = async () => {
  deleting.value = true
  try {
    await $fetch(`/api/models/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Modelo eliminado', color: 'green' })
    showDelete.value = false
    refresh()
  } finally {
    deleting.value = false
  }
}
</script>
