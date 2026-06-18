import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { paginatedResponse, getPaginationParams, getSearchParams } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event) as Record<string, unknown>
  const { page, limit, skip } = getPaginationParams(query)
  const { search, sortBy, sortOrder } = getSearchParams(query)

  const where = search ? { name: { contains: search } } : {}

  const [models, total] = await Promise.all([
    prisma.trainedModel.findMany({
      where, skip, take: limit, orderBy: { [sortBy]: sortOrder },
      include: {
        subject: { select: { name: true } },
        dataset: { select: { name: true } },
        trainer: { select: { name: true } },
      },
    }),
    prisma.trainedModel.count({ where }),
  ])

  return paginatedResponse(models, total, page, limit)
})
