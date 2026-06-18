<template>
  <UModal v-model="isOpen">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-400" />
          </div>
          <h3 class="text-base font-semibold text-white">{{ title || 'Confirmar Acción' }}</h3>
        </div>
      </template>
      <p class="text-gray-400 text-sm">{{ message || '¿Estás seguro? Esta acción no se puede deshacer.' }}</p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="gray" variant="ghost" @click="isOpen = false">Cancelar</UButton>
          <UButton color="red" :loading="loading" @click="confirm">{{ confirmLabel || 'Eliminar' }}</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  title?: string
  message?: string
  confirmLabel?: string
  loading?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; confirm: [] }>()
const isOpen = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const confirm = () => emit('confirm')
</script>
