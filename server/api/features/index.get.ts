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

  const [features, total] = await Promise.all([
    prisma.feature.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: { channel: { select: { channelNumber: true, muscleLocation: true } } },
    }),
    prisma.feature.count({ where }),
  ])

  return paginatedResponse(features, total, page, limit)
})
