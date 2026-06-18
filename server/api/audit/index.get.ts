import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { paginatedResponse, getPaginationParams } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['Administrador'])
  const query = getQuery(event) as Record<string, unknown>
  const { page, limit, skip } = getPaginationParams(query)

  const where: Record<string, unknown> = {}
  if (query.module) where.module = String(query.module)
  if (query.userId) where.userId = Number(query.userId)
  if (query.action) where.action = String(query.action)

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ])

  return paginatedResponse(logs, total, page, limit)
})
