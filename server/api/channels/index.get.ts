import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { paginatedResponse, getPaginationParams, getSearchParams } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event) as Record<string, unknown>
  const { page, limit, skip } = getPaginationParams(query)
  const { search, sortBy, sortOrder } = getSearchParams(query)
  const sensorId = query.sensorId ? Number(query.sensorId) : undefined

  const where: Record<string, unknown> = {}
  if (sensorId) where.sensorId = sensorId
  if (search) where.OR = [{ muscleLocation: { contains: search } }, { description: { contains: search } }]

  const [channels, total] = await Promise.all([
    prisma.channel.findMany({
      where, skip, take: limit, orderBy: { [sortBy]: sortOrder },
      include: { sensor: { select: { name: true, model: true } } },
    }),
    prisma.channel.count({ where }),
  ])

  return paginatedResponse(channels, total, page, limit)
})
