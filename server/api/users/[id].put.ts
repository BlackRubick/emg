import { z } from 'zod'
import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  roleId: z.number().int().positive().optional(),
  active: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, ['Administrador'])
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })

  const user = await prisma.user.update({
    where: { id },
    data: result.data,
    include: { role: true },
    omit: { password: true },
  })

  await logAudit(event, { userId: auth.userId, action: 'UPDATE', module: 'users', entityId: id })
  return successResponse(user, 'User updated')
})
