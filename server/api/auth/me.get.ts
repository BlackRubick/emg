import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true, name: true, email: true, roleId: true, active: true, avatar: true,
      lastLogin: true, createdAt: true, updatedAt: true,
      role: true,
    },
  })

  if (!user) throw createError({ statusCode: 404, message: 'User not found' })

  return successResponse(user)
})
