import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { paginatedResponse, getPaginationParams, getSearchParams } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event) as Record<string, unknown>
  const { page, limit, skip } = getPaginationParams(query)
  const { search, sortBy, sortOrder } = getSearchParams(query)

  const where = search
    ? { OR: [{ name: { contains: search } }, { model: { contains: search } }, { manufacturer: { contains: search } }] }
    : {}

  const [sensors, total] = await Promise.all([
    prisma.sensor.findMany({
      where, skip, take: limit, orderBy: { [sortBy]: sortOrder },
      include: { _count: { select: { channels: true } } },
    }),
    prisma.sensor.count({ where }),
  ])

  return paginatedResponse(sensors, total, page, limit)
})
