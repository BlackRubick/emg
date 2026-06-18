import { z } from 'zod'
import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  sensorId: z.number().int().positive(),
  channelNumber: z.number().int().min(1),
  muscleLocation: z.string().min(1).max(100),
  description: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, ['Administrador', 'Técnico'])
  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })

  const channel = await prisma.channel.create({
    data: result.data,
    include: { sensor: true },
  })
  await logAudit(event, { userId: auth.userId, action: 'CREATE', module: 'channels', entityId: channel.id })
  return successResponse(channel, 'Channel created')
})
