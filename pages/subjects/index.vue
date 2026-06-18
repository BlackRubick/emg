<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Sujetos de Estudio</h2>
        <p class="text-sm text-gray-400 mt-0.5">Gestiona sujetos de investigación y sus perfiles</p>
      </div>
      <UButton v-if="authStore.isResearcher" icon="i-heroicons-plus" color="teal" @click="openCreate">
        Nuevo Sujeto
      </UButton>
    </div>

    <DataTable
      :rows="subjects"
      :columns="columns"
      :total="total"
      :loading="pending"
      :page="query.page"
      :limit="query.limit"
      searchable
      search-placeholder="Buscar sujetos..."
      @update:page="p => { query.page = p; refresh() }"
      @update:limit="l => { query.limit = l; refresh() }"
      @update:search="s => { query.search = s; query.page = 1; refresh() }"
    >
      <template #sex-data="{ row }">
        <StatusBadge :status="row.sex" />
      </template>
      <template #active-data="{ row }">
        <UBadge :color="row.active ? 'green' : 'gray'" variant="soft" size="xs">{{ row.active ? 'Activo' : 'Inactivo' }}</UBadge>
      </template>
      <template #createdAt-data="{ row }">
        <span class="text-gray-500 text-xs">{{ new Date(row.createdAt).toLocaleDateString('es') }}</span>
      </template>
      <template #actions-data="{ row }">
        <div class="flex items-center gap-1">
          <UButton icon="i-heroicons-pencil-square" variant="ghost" size="xs" color="gray" @click="openEdit(row)" />
          <UButton v-if="authStore.isAdmin" icon="i-heroicons-trash" variant="ghost" size="xs" color="red" @click="confirmDelete(row)" />
        </div>
      </template>
    </DataTable>

    <!-- Create/Edit Modal -->
    <UModal v-model="showModal">
      <UCard>
        <template #header>
          <h3 class="text-base font-semibold text-white">{{ editTarget ? 'Editar Sujeto' : 'Nuevo Sujeto' }}</h3>
        </template>
        <UForm :schema="schema" :state="form" @submit="onSubmit" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormGroup label="Nombre Completo" name="name" class="col-span-2">
              <UInput v-model="form.name" placeholder="Nombre del sujeto" />
            </UFormGroup>
            <UFormGroup label="Edad" name="age">
              <UInput v-model.number="form.age" type="number" placeholder="Edad" />
            </UFormGroup>
            <UFormGroup label="Sexo" name="sex">
              <USelect v-model="form.sex" :options="sexOptions" />
            </UFormGroup>
            <UFormGroup label="Tipo de Amputación" name="amputationType" class="col-span-2">
              <UInput v-model="form.amputationType" placeholder="ej. Transradial, Transhumeral" />
            </UFormGroup>
            <UFormGroup label="Observaciones" name="observations" class="col-span-2">
              <UTextarea v-model="form.observations" placeholder="Notas clínicas..." rows="3" />
            </UFormGroup>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3 pt-2">
              <UButton color="gray" variant="ghost" @click="showModal = false">Cancelar</UButton>
              <UButton type="submit" color="teal" :loading="saving">{{ editTarget ? 'Actualizar' : 'Crear' }}</UButton>
            </div>
          </template>
        </UForm>
      </UCard>
    </UModal>

    <ConfirmModal v-model="showDelete" :loading="deleting" @confirm="deleteSubject"
      message="Esto eliminará permanentemente al sujeto y todos sus datos relacionados." />
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'default' })
const authStore = useAuthStore()
const toast = useToast()

const query = reactive({ page: 1, limit: 20, search: '' })

const { data, pending, refresh } = await useFetch('/api/subjects', {
  query, lazy: false,
  transform: (r: any) => r,
})
const subjects = computed(() => (data.value as any)?.data || [])
const total = computed(() => (data.value as any)?.meta?.total || 0)

const columns = [
  { key: 'name', label: 'Nombre', sortable: true },
  { key: 'age', label: 'Edad' },
  { key: 'sex', label: 'Sexo' },
  { key: 'amputationType', label: 'Tipo Amputación' },
  { key: 'active', label: 'Estado' },
  { key: 'createdAt', label: 'Registrado' },
  { key: 'actions', label: '' },
]

const schema = z.object({
  name: z.string().min(2),
  age: z.number().int().min(1).max(120),
  sex: z.enum(['M', 'F', 'Otro']),
  amputationType: z.string().min(2),
  observations: z.string().optional(),
})

const sexOptions = [{ label: 'Masculino', value: 'M' }, { label: 'Femenino', value: 'F' }, { label: 'Otro', value: 'Otro' }]

const showModal = ref(false)
const showDelete = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editTarget = ref<any>(null)
const deleteTarget = ref<any>(null)

const form = reactive({ name: '', age: 0, sex: 'M', amputationType: '', observations: '' })

const openCreate = () => {
  editTarget.value = null
  Object.assign(form, { name: '', age: 0, sex: 'M', amputationType: '', observations: '' })
  showModal.value = true
}

const openEdit = (row: any) => {
  editTarget.value = row
  Object.assign(form, { name: row.name, age: row.age, sex: row.sex, amputationType: row.amputationType, observations: row.observations || '' })
  showModal.value = true
}

const confirmDelete = (row: any) => { deleteTarget.value = row; showDelete.value = true }

const onSubmit = async () => {
  saving.value = true
  try {
    if (editTarget.value) {
      await $fetch(`/api/subjects/${editTarget.value.id}`, { method: 'PUT', body: form })
      toast.add({ title: 'Sujeto actualizado', color: 'green' })
    } else {
      await $fetch('/api/subjects', { method: 'POST', body: form })
      toast.add({ title: 'Sujeto creado', color: 'green' })
    }
    showModal.value = false
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message, color: 'red' })
  } finally {
    saving.value = false
  }
}

const deleteSubject = async () => {
  deleting.value = true
  try {
    await $fetch(`/api/subjects/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Sujeto eliminado', color: 'green' })
    showDelete.value = false
    refresh()
  } catch {
    toast.add({ title: 'Error al eliminar sujeto', color: 'red' })
  } finally {
    deleting.value = false
  }
}
</script>
