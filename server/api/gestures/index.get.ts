import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const gestures = await prisma.gesture.findMany({
    orderBy: { id: 'asc' },
    include: { _count: { select: { classifications: true, movements: true } } },
  })
  return successResponse(gestures)
})
