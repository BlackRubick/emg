import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { paginatedResponse, getPaginationParams, getSearchParams } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event) as Record<string, unknown>
  const { page, limit, skip } = getPaginationParams(query)
  const { search, sortOrder } = getSearchParams(query)
  const sortBy = String(query.sortBy || 'uploadedAt')

  const where = search ? { name: { contains: search } } : {}

  const [datasets, total] = await Promise.all([
    prisma.dataset.findMany({
      where, skip, take: limit, orderBy: { [sortBy]: sortOrder },
      include: { subject: { select: { name: true } } },
    }),
    prisma.dataset.count({ where }),
  ])

  return paginatedResponse(datasets, total, page, limit)
})
