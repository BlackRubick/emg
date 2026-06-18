import { z } from 'zod'
import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  channelNumber: z.number().int().positive().optional(),
  muscleLocation: z.string().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, ['Administrador', 'Técnico'])
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })
  const channel = await prisma.channel.update({ where: { id }, data: result.data })
  await logAudit(event, { userId: auth.userId, action: 'UPDATE', module: 'channels', entityId: id })
  return successResponse(channel, 'Channel updated')
})
