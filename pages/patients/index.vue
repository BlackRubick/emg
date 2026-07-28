<template>
  <div class="space-y-4">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Pacientes</h2>
        <p class="text-sm text-gray-500 mt-0.5">Selecciona un paciente para iniciar una prueba EMG</p>
      </div>
      <UButton icon="i-heroicons-plus" color="teal" @click="openCreate">
        Nuevo paciente
      </UButton>
    </div>

    <!-- Búsqueda -->
    <UInput
      v-model="search"
      icon="i-heroicons-magnifying-glass"
      placeholder="Buscar por nombre o tipo de amputación..."
      class="max-w-sm"
      @input="debouncedFetch"
    />

    <!-- Grid de tarjetas -->
    <div v-if="loading" class="text-center py-16 text-gray-600 text-sm">Cargando...</div>

    <div v-else-if="!patients.length" class="text-center py-16 text-gray-600 text-sm">
      Sin pacientes registrados
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="p in patients"
        :key="p.id"
        class="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-700 transition-colors"
      >
        <!-- Info paciente -->
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            :style="{ background: p.sex === 'F' ? 'linear-gradient(135deg,#db2777,#9333ea)' : 'linear-gradient(135deg,#0d9488,#2563eb)' }">
            {{ initials(p.name) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-white truncate">{{ p.name }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ p.age }} años · {{ p.sex === 'M' ? 'Masculino' : p.sex === 'F' ? 'Femenino' : 'Otro' }}</p>
          </div>
          <span class="text-xs px-2 py-0.5 rounded-full border flex-shrink-0"
            :class="p.active
              ? 'bg-green-950/40 border-green-900/50 text-green-400'
              : 'bg-gray-800 border-gray-700 text-gray-500'">
            {{ p.active ? 'Activo' : 'Inactivo' }}
          </span>
        </div>

        <!-- Amputación -->
        <div class="bg-gray-800/50 rounded-xl px-3 py-2.5 space-y-1">
          <div class="flex items-center gap-2 text-xs">
            <UIcon name="i-heroicons-clipboard-document-list" class="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
            <span class="text-gray-400">{{ p.amputationType }}</span>
          </div>
          <div v-if="p.observations" class="flex items-start gap-2 text-xs">
            <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5" />
            <span class="text-gray-600 line-clamp-2">{{ p.observations }}</span>
          </div>
        </div>

        <!-- Acciones -->
        <div class="flex items-center gap-2 mt-auto">
          <UButton
            class="flex-1"
            color="teal"
            icon="i-heroicons-bolt"
            @click="startEMG(p)"
          >
            Iniciar prueba EMG
          </UButton>
          <UButton size="sm" color="gray" variant="ghost" icon="i-heroicons-pencil-square" @click="openEdit(p)" />
          <UButton size="sm" color="red" variant="ghost" icon="i-heroicons-trash" @click="openDelete(p)" />
        </div>
      </div>
    </div>

    <!-- Paginación -->
    <div v-if="total > limit" class="flex items-center justify-between">
      <span class="text-xs text-gray-600">{{ total }} pacientes</span>
      <div class="flex gap-2 items-center">
        <UButton size="xs" color="gray" variant="ghost" :disabled="page <= 1" @click="page--; fetchPatients()">Anterior</UButton>
        <span class="text-xs text-gray-500">{{ page }} / {{ totalPages }}</span>
        <UButton size="xs" color="gray" variant="ghost" :disabled="page >= totalPages" @click="page++; fetchPatients()">Siguiente</UButton>
      </div>
    </div>

    <!-- Modal crear / editar -->
    <UModal v-model="showForm">
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 w-full max-w-md">
        <h3 class="text-base font-bold text-white">{{ editing ? 'Editar paciente' : 'Nuevo paciente' }}</h3>

        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Nombre completo</label>
            <UInput v-model="form.name" placeholder="Nombre del paciente" :ui="inputUI" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-400 mb-1">Edad</label>
              <UInput v-model.number="form.age" type="number" min="1" max="120" placeholder="Años" :ui="inputUI" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Sexo</label>
              <USelect v-model="form.sex" :options="sexOptions" option-attribute="label" value-attribute="value" :ui="inputUI" />
            </div>
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Tipo de amputación</label>
            <UInput v-model="form.amputationType" placeholder="Ej: Transradial, Congénita..." :ui="inputUI" />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Observaciones</label>
            <UTextarea v-model="form.observations" placeholder="Notas clínicas relevantes..." :rows="3" :ui="inputUI" />
          </div>
          <div v-if="editing" class="flex items-center justify-between py-1">
            <span class="text-xs text-gray-400">Paciente activo</span>
            <UToggle v-model="form.active" color="teal" />
          </div>
        </div>

        <p v-if="formError" class="text-xs text-red-400">{{ formError }}</p>

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="gray" variant="ghost" @click="showForm = false">Cancelar</UButton>
          <UButton color="teal" :loading="saving" @click="submitForm">
            {{ editing ? 'Guardar cambios' : 'Crear paciente' }}
          </UButton>
        </div>
      </div>
    </UModal>

    <!-- Modal eliminar -->
    <UModal v-model="showDelete">
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 w-full max-w-sm">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-red-950/60 border border-red-900/50 flex items-center justify-center">
            <UIcon name="i-heroicons-trash" class="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">Eliminar paciente</h3>
            <p class="text-xs text-gray-500 mt-0.5">Esta acción no se puede deshacer</p>
          </div>
        </div>
        <p class="text-sm text-gray-300">
          ¿Eliminar a <span class="font-semibold text-white">{{ deletingPatient?.name }}</span>?
        </p>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="showDelete = false">Cancelar</UButton>
          <UButton color="red" :loading="saving" @click="confirmDelete">Eliminar</UButton>
        </div>
      </div>
    </UModal>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const router = useRouter()
const toast  = useToast()
const activePatient = useState<{ id: number; name: string } | null>('activePatient', () => null)

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Patient {
  id: number; name: string; age: number; sex: string
  amputationType: string; observations: string | null
  active: boolean; createdAt: string
}

// ── Lista ──────────────────────────────────────────────────────────────────
const patients   = ref<Patient[]>([])
const total      = ref(0)
const page       = ref(1)
const limit      = 12
const search     = ref('')
const loading    = ref(false)
const totalPages = computed(() => Math.ceil(total.value / limit))

async function fetchPatients() {
  loading.value = true
  try {
    const res = await $fetch<{ data: Patient[]; meta: { total: number } }>('/api/subjects', {
      query: { page: page.value, limit, search: search.value || undefined },
    })
    patients.value = res.data
    total.value    = res.meta.total
  } catch {
    toast.add({ title: 'Error al cargar pacientes', color: 'red' })
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout>
function debouncedFetch() {
  clearTimeout(searchTimer)
  page.value = 1
  searchTimer = setTimeout(fetchPatients, 350)
}

// ── Iniciar prueba EMG ─────────────────────────────────────────────────────
function startEMG(p: Patient) {
  activePatient.value = { id: p.id, name: p.name }
  router.push('/emg-control')
}

// ── Formulario ─────────────────────────────────────────────────────────────
const showForm  = ref(false)
const editing   = ref<Patient | null>(null)
const saving    = ref(false)
const formError = ref('')

const sexOptions = [
  { label: 'Masculino', value: 'M' },
  { label: 'Femenino',  value: 'F' },
  { label: 'Otro',      value: 'Otro' },
]

const form = reactive({
  name: '', age: 0, sex: 'M', amputationType: '', observations: '', active: true,
})

const inputUI = { base: 'bg-gray-800 border-gray-700 text-white' }

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', age: 0, sex: 'M', amputationType: '', observations: '', active: true })
  formError.value = ''
  showForm.value  = true
}

function openEdit(p: Patient) {
  editing.value = p
  Object.assign(form, { name: p.name, age: p.age, sex: p.sex, amputationType: p.amputationType, observations: p.observations ?? '', active: p.active })
  formError.value = ''
  showForm.value  = true
}

async function submitForm() {
  formError.value = ''
  if (!form.name.trim())           { formError.value = 'El nombre es requerido'; return }
  if (!form.age || form.age < 1)   { formError.value = 'La edad es requerida'; return }
  if (!form.amputationType.trim()) { formError.value = 'El tipo de amputación es requerido'; return }

  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/subjects/${editing.value.id}`, {
        method: 'PUT',
        body: { name: form.name, age: form.age, sex: form.sex, amputationType: form.amputationType, observations: form.observations || undefined, active: form.active },
      })
      toast.add({ title: 'Paciente actualizado', color: 'teal' })
    } else {
      await $fetch('/api/subjects', {
        method: 'POST',
        body: { name: form.name, age: form.age, sex: form.sex, amputationType: form.amputationType, observations: form.observations || undefined },
      })
      toast.add({ title: 'Paciente creado', color: 'teal' })
    }
    showForm.value = false
    fetchPatients()
  } catch (e: any) {
    formError.value = e?.data?.message || 'Error al guardar'
  } finally {
    saving.value = false
  }
}

// ── Eliminar ───────────────────────────────────────────────────────────────
const showDelete     = ref(false)
const deletingPatient = ref<Patient | null>(null)

function openDelete(p: Patient) {
  deletingPatient.value = p
  showDelete.value      = true
}

async function confirmDelete() {
  if (!deletingPatient.value) return
  saving.value = true
  try {
    await $fetch(`/api/subjects/${deletingPatient.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Paciente eliminado', color: 'teal' })
    showDelete.value = false
    fetchPatients()
  } catch (e: any) {
    toast.add({ title: e?.data?.message || 'Error al eliminar', color: 'red' })
  } finally {
    saving.value = false
  }
}

// ── Util ───────────────────────────────────────────────────────────────────
const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

onMounted(fetchPatients)
</script>
