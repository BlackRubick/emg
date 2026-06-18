/**
 * EMG System — Pre-dev bootstrap
 * Corre automáticamente antes de `nuxt dev`:
 *   1. Crea .env si no existe (con valores por defecto)
 *   2. Si ya existe .env, lo usa tal cual
 *   3. Instala npm dependencies si faltan
 *   4. Genera Prisma Client
 *   5. Aplica migraciones a MySQL
 *   6. Seedea la BD si está vacía
 */

import { existsSync, readFileSync, writeFileSync, statSync } from 'fs'
import { execSync, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// ─── Colors ───────────────────────────────────────────────────────────────────
const c = {
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
}

const log  = msg => console.log(`  ${c.cyan('▸')} ${msg}`)
const ok   = msg => console.log(`  ${c.green('✔')} ${msg}`)
const warn = msg => console.log(`  ${c.yellow('⚠')} ${msg}`)
const fail = msg => console.log(`  ${c.red('✖')} ${msg}`)

const run = (cmd, { silent = false } = {}) =>
  execSync(cmd, { stdio: silent ? 'pipe' : 'inherit', cwd: root })

const tryRun = (cmd) => {
  const r = spawnSync(cmd, { stdio: 'pipe', cwd: root, shell: true })
  return r.status === 0
}

// ─── Banner ───────────────────────────────────────────────────────────────────
console.log('')
console.log(c.bold(c.cyan('  ╔══════════════════════════════════════════════╗')))
console.log(c.bold(c.cyan('  ║   EMG Prosthesis Control System  v1.0.0     ║')))
console.log(c.bold(c.cyan('  ║   Plataforma Biomédica sEMG                 ║')))
console.log(c.bold(c.cyan('  ╚══════════════════════════════════════════════╝')))
console.log('')

// ─── PASO 1 — .env ────────────────────────────────────────────────────────────
const envPath = join(root, '.env')

if (!existsSync(envPath)) {
  warn('.env no encontrado — creando con valores por defecto...')
  writeFileSync(envPath, `# EMG Prosthesis Control System — Variables de Entorno
# Edita los credenciales de MySQL según tu instalación local
# ─────────────────────────────────────────────────────────

# MySQL local (ajusta usuario, contraseña y nombre de BD)
DATABASE_URL="mysql://root:root@localhost:3306/emg_system"

# JWT (cámbialo en producción)
JWT_SECRET="emg-biomedical-jwt-secret-key-2024-production-ready"
JWT_EXPIRES_IN="7d"

# Aplicación
NODE_ENV="development"
PORT=3000

# WebSocket (mismo servidor Nuxt)
WS_URL="ws://localhost:3000"

# Archivos subidos
UPLOAD_DIR="./public/uploads"
MAX_FILE_SIZE=52428800
`, 'utf8')

  console.log('')
  console.log(c.yellow('  ┌──────────────────────────────────────────────────────┐'))
  console.log(c.yellow('  │  ✔ Archivo .env creado                               │'))
  console.log(c.yellow('  │                                                      │'))
  console.log(c.yellow('  │  DATABASE_URL por defecto:                           │'))
  console.log(c.yellow('  │    mysql://root:root@localhost:3306/emg_system        │'))
  console.log(c.yellow('  │                                                      │'))
  console.log(c.yellow('  │  Si usas otros credenciales, edita .env y            │'))
  console.log(c.yellow('  │  vuelve a ejecutar:  npm run dev                     │'))
  console.log(c.yellow('  └──────────────────────────────────────────────────────┘'))
  console.log('')
} else {
  ok('.env encontrado — usando configuración existente')
}

// ─── Cargar variables del .env en process.env ──────────────────────────────────
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
  if (key && !process.env[key]) process.env[key] = val
}

const dbUrl = process.env.DATABASE_URL || ''
console.log(c.dim(`  DB: ${dbUrl.replace(/:([^:@]+)@/, ':***@')}`))
console.log('')

// ─── PASO 2 — npm install ─────────────────────────────────────────────────────
const nmPath   = join(root, 'node_modules')
const pkgPath  = join(root, 'package.json')
const lockPath = join(root, 'package-lock.json')

let needsInstall = !existsSync(nmPath)
if (!needsInstall && existsSync(lockPath)) {
  const pkgMtime = statSync(pkgPath).mtimeMs
  const nmMtime  = statSync(nmPath).mtimeMs
  if (pkgMtime > nmMtime) {
    needsInstall = true
    log('package.json fue modificado — reinstalando...')
  }
}

if (needsInstall) {
  log('Instalando dependencias npm (primera vez)...')
  run('npm install')
  ok('Dependencias instaladas')
} else {
  ok('Dependencias ya instaladas')
}

// ─── PASO 3 — Prisma generate ─────────────────────────────────────────────────
log('Generando Prisma Client...')
try {
  run('npx prisma generate', { silent: true })
  ok('Prisma Client generado')
} catch (e) {
  fail('Error generando Prisma Client')
  console.error(e.message)
  process.exit(1)
}

// ─── PASO 4 — Migraciones / DB sync ───────────────────────────────────────────
log('Aplicando migraciones a MySQL...')

// Detectar si hay migraciones generadas o si es setup fresco
const migrationsDir = join(root, 'prisma', 'migrations')
const hasMigrations = existsSync(migrationsDir) &&
  existsSync(join(migrationsDir, 'migration_lock.toml'))

let dbOk = false

if (hasMigrations) {
  // Preferir migrate deploy (aplica migraciones existentes)
  try {
    run('npx prisma migrate deploy', { silent: true })
    ok('Migraciones aplicadas')
    dbOk = true
  } catch {
    warn('migrate deploy falló — intentando db push...')
  }
}

if (!dbOk) {
  // Setup fresco o migraciones no disponibles → db push
  try {
    run('npx prisma db push --accept-data-loss', { silent: true })
    ok('Schema sincronizado con MySQL (db push)')
    dbOk = true
  } catch (e) {
    fail('No se pudo conectar a MySQL.')
    console.log('')
    console.log(c.yellow('  ─────────────────────────────────────────────────────────'))
    console.log(c.yellow(`  DATABASE_URL actual: ${dbUrl.replace(/:([^:@]+)@/, ':***@')}`))
    console.log(c.yellow('  ─────────────────────────────────────────────────────────'))
    console.log('')
    console.log('  Verifica que MySQL está corriendo y que las credenciales en .env son correctas.')
    console.log('')
    console.log('  macOS (Homebrew):  ' + c.cyan('brew services start mysql'))
    console.log('  Linux:             ' + c.cyan('sudo systemctl start mysql'))
    console.log('  XAMPP/MAMP:        inicia el servidor MySQL desde el panel')
    console.log('')
    console.log('  Luego edita .env con tus credenciales y vuelve a ejecutar:')
    console.log('  ' + c.cyan('npm run dev'))
    console.log('')
    process.exit(1)
  }
}

// ─── PASO 5 — Seed si la BD está vacía ────────────────────────────────────────
log('Verificando datos iniciales...')
try {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient({ log: [] })

  let count = 0
  try {
    count = await prisma.role.count()
  } finally {
    await prisma.$disconnect()
  }

  if (count === 0) {
    log('Base de datos vacía — ejecutando seeder...')
    run('npx tsx prisma/seed.ts')
    ok('Datos de prueba creados')
  } else {
    ok(`Base de datos lista (${count} roles, datos ya existentes)`)
  }
} catch {
  warn('No se pudo verificar datos iniciales — continuando...')
}

// ─── Resumen final ────────────────────────────────────────────────────────────
console.log('')
console.log(c.bold(c.green('  ✅ Todo listo — iniciando servidor...')))
console.log('')
console.log(`  ${c.bold('URL del sistema:')}   ${c.cyan('http://localhost:3000')}`)
console.log(`  ${c.dim('Frontend + API + WebSocket corren en el mismo proceso (Nuxt/Nitro)')}`)
console.log('')
console.log(`  ${c.bold('Credenciales:')}`)
console.log(`    Admin:       ${c.cyan('admin@emg.system')}        ${c.dim('Admin@2024!')}`)
console.log(`    Researcher:  ${c.cyan('investigador@emg.system')}  ${c.dim('User@2024!')}`)
console.log(`    Technician:  ${c.cyan('tecnico@emg.system')}       ${c.dim('User@2024!')}`)
console.log('')
