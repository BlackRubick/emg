import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, ['Administrador', 'Investigador'])
  const id = Number(getRouterParam(event, 'id'))
  await prisma.trainedModel.delete({ where: { id } })
  await logAudit(event, { userId: auth.userId, action: 'DELETE', module: 'models', entityId: id })
  return successResponse(null, 'Model deleted')
})
