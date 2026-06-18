import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding EMG Prosthesis System database...')

  // ── Roles ────────────────────────────────────────────────────────────────
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'Administrador' },
      update: {},
      create: { name: 'Administrador', description: 'Full system access' },
    }),
    prisma.role.upsert({
      where: { name: 'Investigador' },
      update: {},
      create: { name: 'Investigador', description: 'Research and data management' },
    }),
    prisma.role.upsert({
      where: { name: 'Técnico' },
      update: {},
      create: { name: 'Técnico', description: 'Technical operations and sensor management' },
    }),
    prisma.role.upsert({
      where: { name: 'Invitado' },
      update: {},
      create: { name: 'Invitado', description: 'Read-only access' },
    }),
  ])
  console.log('✓ Roles created:', roles.map(r => r.name).join(', '))

  // ── Users ─────────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Admin@2024!', 12)
  const userPassword = await bcrypt.hash('User@2024!', 12)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@emg.system' },
    update: {},
    create: {
      name: 'Administrator',
      email: 'admin@emg.system',
      password: hashedPassword,
      roleId: roles[0].id,
      active: true,
    },
  })

  const researcher = await prisma.user.upsert({
    where: { email: 'investigador@emg.system' },
    update: {},
    create: {
      name: 'Dr. Carlos Mendoza',
      email: 'investigador@emg.system',
      password: userPassword,
      roleId: roles[1].id,
      active: true,
    },
  })

  const technician = await prisma.user.upsert({
    where: { email: 'tecnico@emg.system' },
    update: {},
    create: {
      name: 'Ana García',
      email: 'tecnico@emg.system',
      password: userPassword,
      roleId: roles[2].id,
      active: true,
    },
  })

  console.log('✓ Users created:', [adminUser, researcher, technician].map(u => u.email).join(', '))

  // ── Subjects ──────────────────────────────────────────────────────────────
  const subjects = await Promise.all([
    prisma.subject.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'Juan Pérez',
        age: 34,
        sex: 'M',
        amputationType: 'Transradial',
        observations: 'Below-elbow amputation, right arm. Good muscle activity in remaining forearm.',
      },
    }),
    prisma.subject.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: 'María López',
        age: 28,
        sex: 'F',
        amputationType: 'Congénita',
        observations: 'Congenital partial hand absence. Excellent EMG signal quality.',
      },
    }),
    prisma.subject.upsert({
      where: { id: 3 },
      update: {},
      create: {
        name: 'Pedro Ramírez',
        age: 45,
        sex: 'M',
        amputationType: 'Transhumeral',
        observations: 'Above-elbow amputation. Uses myoelectric prosthesis for 3 years.',
      },
    }),
  ])
  console.log('✓ Subjects created:', subjects.map(s => s.name).join(', '))

  // ── Sensors ───────────────────────────────────────────────────────────────
  const sensors = await Promise.all([
    prisma.sensor.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'Delsys Trigno IM',
        model: 'Trigno IM',
        manufacturer: 'Delsys Inc.',
        numChannels: 16,
        samplingFrequency: 2000,
        status: 'active',
        description: 'Wireless EMG sensor system with 16 channels',
      },
    }),
    prisma.sensor.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: 'MYO Armband',
        model: 'MYO',
        manufacturer: 'Thalmic Labs',
        numChannels: 8,
        samplingFrequency: 200,
        status: 'active',
        description: '8-channel EMG armband sensor',
      },
    }),
    prisma.sensor.upsert({
      where: { id: 3 },
      update: {},
      create: {
        name: 'BioRadio 150',
        model: 'BioRadio 150',
        manufacturer: 'Cleveland Medical Devices',
        numChannels: 4,
        samplingFrequency: 1000,
        status: 'maintenance',
        description: 'Wireless physiological monitoring',
      },
    }),
  ])
  console.log('✓ Sensors created')

  // ── Channels ──────────────────────────────────────────────────────────────
  const muscleLocations = [
    'Flexor Carpi Radialis',
    'Flexor Digitorum',
    'Extensor Carpi Radialis',
    'Extensor Digitorum',
    'Biceps Brachii',
    'Triceps Brachii',
    'Pronator Teres',
    'Supinator',
  ]

  const channels = []
  for (let i = 0; i < 8; i++) {
    channels.push(
      await prisma.channel.upsert({
        where: { id: i + 1 },
        update: {},
        create: {
          sensorId: sensors[0].id,
          channelNumber: i + 1,
          muscleLocation: muscleLocations[i],
          description: `EMG channel ${i + 1} - ${muscleLocations[i]}`,
        },
      })
    )
  }
  console.log('✓ Channels created')

  // ── Gestures ──────────────────────────────────────────────────────────────
  const gestureData = [
    { name: 'Mano Abierta', code: 'HAND_OPEN', description: 'Complete hand opening', iconName: 'hand-open' },
    { name: 'Mano Cerrada', code: 'HAND_CLOSE', description: 'Complete fist closure', iconName: 'hand-fist' },
    { name: 'Pinza Fina', code: 'FINE_PINCH', description: 'Precision pinch with index and thumb', iconName: 'hand-pinch' },
    { name: 'Agarre Cilíndrico', code: 'CYLINDRICAL_GRIP', description: 'Power grasp around cylindrical object', iconName: 'hand-grip' },
    { name: 'Flexión', code: 'WRIST_FLEX', description: 'Wrist flexion movement', iconName: 'wrist-flex' },
    { name: 'Extensión', code: 'WRIST_EXT', description: 'Wrist extension movement', iconName: 'wrist-ext' },
    { name: 'Rotación', code: 'ROTATION', description: 'Forearm rotation', iconName: 'rotation' },
    { name: 'Pronación', code: 'PRONATION', description: 'Forearm pronation', iconName: 'pronation' },
    { name: 'Supinación', code: 'SUPINATION', description: 'Forearm supination', iconName: 'supination' },
  ]

  const gestures = []
  for (const g of gestureData) {
    gestures.push(
      await prisma.gesture.upsert({
        where: { code: g.code },
        update: {},
        create: g,
      })
    )
  }
  console.log('✓ Gestures created:', gestures.map(g => g.name).join(', '))

  // ── Prosthesis ────────────────────────────────────────────────────────────
  const prosthesis = await prisma.prosthesis.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Vincent Hand v3',
      serialNumber: 'VH-2024-001',
      type: 'Transradial',
      status: 'disconnected',
      ipAddress: '192.168.1.100',
      port: 8080,
      metadata: { firmware: 'v3.2.1', battery: 85 },
    },
  })
  console.log('✓ Prosthesis created')

  // ── Sample Signals ────────────────────────────────────────────────────────
  const signalData = []
  const now = new Date()
  for (let i = 0; i < 200; i++) {
    signalData.push({
      channelId: channels[i % 8].id,
      timestamp: new Date(now.getTime() - (200 - i) * 5),
      amplitude: Math.sin(i * 0.1) * 50 + (Math.random() - 0.5) * 20,
      frequency: 50 + Math.random() * 150,
      sampleRate: 2000,
      sessionId: 'seed-session-001',
    })
  }
  await prisma.signal.createMany({ data: signalData, skipDuplicates: true })
  console.log('✓ Sample signals created')

  // ── Trained Model ─────────────────────────────────────────────────────────
  const model = await prisma.trainedModel.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'LDA Model - Subject 1 - 8ch',
      algorithm: 'LDA',
      subjectId: subjects[0].id,
      trainedBy: researcher.id,
      numChannels: 8,
      windowSize: 200,
      overlapSize: 50,
      accuracy: 94.5,
      precision: 93.8,
      recall: 94.2,
      f1Score: 94.0,
      confusionMatrix: {
        labels: gestureData.map(g => g.code),
        matrix: gestureData.map((_, i) =>
          gestureData.map((_, j) => (i === j ? Math.floor(85 + Math.random() * 15) : Math.floor(Math.random() * 5)))
        ),
      },
      status: 'ready',
      trainDuration: 12.4,
      metadata: { features: ['MAV', 'RMS', 'WL', 'ZC', 'SSC'], epochs: 100 },
    },
  })
  console.log('✓ Trained model created')

  // ── Audit Logs ────────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { userId: adminUser.id, action: 'CREATE', module: 'users', details: { message: 'System initialized' }, ipAddress: '127.0.0.1' },
      { userId: researcher.id, action: 'CREATE', module: 'subjects', entityId: subjects[0].id, details: { message: 'Subject registered' }, ipAddress: '192.168.1.50' },
      { userId: researcher.id, action: 'CREATE', module: 'models', entityId: model.id, details: { message: 'Model trained' }, ipAddress: '192.168.1.50' },
    ],
    skipDuplicates: true,
  })
  console.log('✓ Audit logs created')

  console.log('\n✅ Database seeded successfully!')
  console.log('\n📋 Login credentials:')
  console.log('   Admin:        admin@emg.system       / Admin@2024!')
  console.log('   Researcher:   investigador@emg.system / User@2024!')
  console.log('   Technician:   tecnico@emg.system      / User@2024!')
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
