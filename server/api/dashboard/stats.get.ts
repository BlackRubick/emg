import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

// MySQL $queryRaw returns BigInt for COUNT(*) — convert all to Number
function toNum(v: unknown): number {
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'number') return v
  return Number(v) || 0
}

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const [
    totalUsers, totalSignals, totalModels, totalSubjects,
    totalGestures, totalSensors, recentSignalsRaw, modelStats, prostheses,
  ] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.signal.count(),
    prisma.trainedModel.count({ where: { status: 'ready' } }),
    prisma.subject.count({ where: { active: true } }),
    prisma.gestureClassification.count(),
    prisma.sensor.count({ where: { status: 'active' } }),
    prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE(timestamp) as date, COUNT(*) as count
      FROM signals
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `,
    prisma.trainedModel.aggregate({
      _avg: { accuracy: true, f1Score: true },
      where: { status: 'ready' },
    }),
    prisma.prosthesis.findMany({ select: { id: true, name: true, status: true } }),
  ])

  // Serialize BigInt values from raw query
  const recentSignals = (recentSignalsRaw as any[]).map(r => ({
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
    count: toNum(r.count),
  }))

  return successResponse({
    totalUsers,
    totalSignals,
    totalModels,
    totalSubjects,
    totalGestures,
    totalSensors,
    avgAccuracy: Math.round((modelStats._avg.accuracy || 0) * 10) / 10,
    avgF1Score:  Math.round((modelStats._avg.f1Score  || 0) * 10) / 10,
    recentSignals,
    prostheses,
  })
})
