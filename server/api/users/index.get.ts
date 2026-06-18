import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { paginatedResponse, getPaginationParams, getSearchParams } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['Administrador'])

  const query = getQuery(event) as Record<string, unknown>
  const { page, limit, skip } = getPaginationParams(query)
  const { search, sortBy, sortOrder } = getSearchParams(query)

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true, name: true, email: true, roleId: true, active: true, avatar: true,
        lastLogin: true, createdAt: true, updatedAt: true, role: true,
      },
    }),
    prisma.user.count({ where }),
  ])

  return paginatedResponse(users, total, page, limit)
})
