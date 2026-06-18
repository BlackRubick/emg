import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { paginatedResponse, getPaginationParams } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event) as Record<string, unknown>
  const { page, limit, skip } = getPaginationParams(query)

  const where: Record<string, unknown> = {}
  if (query.channelId) where.channelId = Number(query.channelId)
  if (query.sessionId) where.sessionId = String(query.sessionId)
  if (query.from || query.to) {
    where.timestamp = {
      ...(query.from ? { gte: new Date(String(query.from)) } : {}),
      ...(query.to ? { lte: new Date(String(query.to)) } : {}),
    }
  }

  const [signals, total] = await Promise.all([
    prisma.signal.findMany({
      where, skip, take: limit,
      orderBy: { timestamp: 'desc' },
      include: { channel: { select: { channelNumber: true, muscleLocation: true } } },
    }),
    prisma.signal.count({ where }),
  ])

  return paginatedResponse(signals, total, page, limit)
})
