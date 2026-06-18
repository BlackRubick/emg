import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const prostheses = await prisma.prosthesis.findMany({
    include: {
      movements: {
        orderBy: { executedAt: 'desc' },
        take: 5,
        include: { gesture: { select: { name: true, code: true } } },
      },
    },
  })
  return successResponse(prostheses)
})
