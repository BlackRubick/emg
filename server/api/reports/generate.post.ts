import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  type: z.enum(['users', 'signals', 'gestures', 'models', 'performance']),
  format: z.enum(['json', 'csv']).default('json'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })

  const { type, from, to } = result.data
  const dateFilter = (from || to) ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {}

  let data: unknown
  let title: string

  switch (type) {
    case 'users':
      title = 'Users Report'
      data = await prisma.user.findMany({
        where: dateFilter,
        include: { role: true },
        omit: { password: true },
      })
      break
    case 'signals':
      title = 'EMG Signals Report'
      data = await prisma.signal.groupBy({
        by: ['channelId'],
        _count: { id: true },
        _avg: { amplitude: true },
        _min: { timestamp: true },
        _max: { timestamp: true },
      })
      break
    case 'gestures':
      title = 'Gesture Classifications Report'
      data = await prisma.gestureClassification.findMany({
        where: dateFilter,
        include: { gesture: true, model: { select: { name: true } } },
        orderBy: { timestamp: 'desc' },
        take: 500,
      })
      break
    case 'models':
      title = 'Trained Models Report'
      data = await prisma.trainedModel.findMany({
        where: dateFilter,
        include: { subject: true, trainer: { select: { name: true } } },
      })
      break
    case 'performance':
      title = 'System Performance Report'
      data = {
        models: await prisma.trainedModel.aggregate({ _avg: { accuracy: true, f1Score: true }, where: { status: 'ready' } }),
        totalSignals: await prisma.signal.count(),
        totalClassifications: await prisma.gestureClassification.count(),
        topGestures: await prisma.gestureClassification.groupBy({
          by: ['gestureId'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        }),
      }
      break
    default:
      throw createError({ statusCode: 400, message: 'Unknown report type' })
  }

  return successResponse({ title, type, generatedAt: new Date(), data })
})
