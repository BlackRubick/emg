<template>
  <UBadge :color="color" :variant="variant || 'soft'" size="xs">{{ label }}</UBadge>
</template>

<script setup lang="ts">
const props = defineProps<{
  status: string
  variant?: 'solid' | 'soft' | 'outline' | 'subtle'
}>()

const statusMap: Record<string, { label: string; color: 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange' }> = {
  active:       { label: 'Activo',        color: 'green' },
  inactive:     { label: 'Inactivo',      color: 'gray' },
  maintenance:  { label: 'Mantenimiento', color: 'orange' },
  training:     { label: 'Entrenando',    color: 'blue' },
  ready:        { label: 'Listo',         color: 'green' },
  failed:       { label: 'Fallido',       color: 'red' },
  connected:    { label: 'Conectado',     color: 'green' },
  disconnected: { label: 'Desconectado',  color: 'red' },
  idle:         { label: 'Inactivo',      color: 'yellow' },
  executed:     { label: 'Ejecutado',     color: 'green' },
  pending:      { label: 'Pendiente',     color: 'yellow' },
  M:            { label: 'Masculino',     color: 'blue' },
  F:            { label: 'Femenino',      color: 'green' },
  Otro:         { label: 'Otro',          color: 'gray' },
}

const mapped = computed(() => statusMap[props.status] || { label: props.status, color: 'gray' as const })
const label = computed(() => mapped.value.label)
const color = computed(() => mapped.value.color)
</script>
