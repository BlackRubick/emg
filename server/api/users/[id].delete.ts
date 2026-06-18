import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, ['Administrador'])
  const id = Number(getRouterParam(event, 'id'))

  if (id === auth.userId) throw createError({ statusCode: 400, message: 'Cannot delete your own account' })

  await prisma.user.delete({ where: { id } })
  await logAudit(event, { userId: auth.userId, action: 'DELETE', module: 'users', entityId: id })

  return successResponse(null, 'User deleted')
})
