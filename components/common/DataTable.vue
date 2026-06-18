<template>
  <div>
    <!-- Search & filters -->
    <div class="flex flex-wrap gap-3 mb-4">
      <UInput
        v-if="searchable"
        v-model="searchQuery"
        :placeholder="searchPlaceholder || 'Buscar...'"
        icon="i-heroicons-magnifying-glass"
        size="sm"
        class="w-64"
        @input="onSearch"
      />
      <slot name="filters" />
      <div class="ml-auto flex items-center gap-2">
        <USelect v-model="pageSize" :options="pageSizeOptions" size="sm" class="w-24" @change="onPageSizeChange" />
        <slot name="actions" />
      </div>
    </div>

    <!-- Table -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <UTable
        :rows="rows"
        :columns="columns"
        :loading="loading"
        :empty-state="{ icon: 'i-heroicons-circle-stack', label: emptyLabel || 'Sin datos' }"
        class="w-full"
        :ui="{
          wrapper: 'relative overflow-x-auto',
          base: 'min-w-full table-fixed',
          thead: 'bg-gray-800/50',
          tbody: 'divide-y divide-gray-800',
          tr: { base: 'hover:bg-gray-800/30 transition-colors' },
          th: { base: 'text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3', color: 'text-gray-400' },
          td: { base: 'px-4 py-3 text-sm text-gray-300 whitespace-nowrap' },
          loadingState: { icon: 'i-heroicons-arrow-path', label: 'Cargando...' },
        }"
      >
        <template v-for="(_, name) in $slots" #[name]="slotData">
          <slot :name="name" v-bind="slotData" />
        </template>
      </UTable>
    </div>

    <!-- Pagination -->
    <div v-if="total > 0" class="flex items-center justify-between mt-4 px-1">
      <p class="text-sm text-gray-400">
        Mostrando {{ ((currentPage - 1) * Number(pageSize)) + 1 }}–{{ Math.min(currentPage * Number(pageSize), total) }} de {{ total }}
      </p>
      <UPagination
        v-model="currentPage"
        :page-count="Number(pageSize)"
        :total="total"
        :ui="{ wrapper: 'flex gap-1', base: 'h-7 min-w-[28px] text-xs' }"
        @update:model-value="onPageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  rows: Record<string, unknown>[]
  columns: { key: string; label: string; sortable?: boolean }[]
  total: number
  loading?: boolean
  page?: number
  limit?: number
  searchable?: boolean
  searchPlaceholder?: string
  emptyLabel?: string
}>()

const emit = defineEmits<{
  'update:page': [page: number]
  'update:limit': [limit: number]
  'update:search': [search: string]
}>()

const searchQuery = ref('')
const currentPage = ref(props.page || 1)
const pageSize = ref(String(props.limit || 20))
const pageSizeOptions = ['10', '20', '50', '100']

let searchTimeout: ReturnType<typeof setTimeout>

const onSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    emit('update:search', searchQuery.value)
  }, 300)
}

const onPageChange = (page: number) => emit('update:page', page)
const onPageSizeChange = () => {
  currentPage.value = 1
  emit('update:limit', Number(pageSize.value))
}

watch(() => props.page, v => { if (v) currentPage.value = v })
</script>
