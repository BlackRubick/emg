import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { paginatedResponse, getPaginationParams, getSearchParams } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event) as Record<string, unknown>
  const { page, limit, skip } = getPaginationParams(query)
  const { search, sortBy, sortOrder } = getSearchParams(query)

  const where = search
    ? { OR: [{ name: { contains: search } }, { amputationType: { contains: search } }] }
    : {}

  const [subjects, total] = await Promise.all([
    prisma.subject.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
    prisma.subject.count({ where }),
  ])

  return paginatedResponse(subjects, total, page, limit)
})
