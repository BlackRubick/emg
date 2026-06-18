import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } })
  return successResponse(roles)
})
