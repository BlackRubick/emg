import { z } from 'zod'
import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  name: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  numChannels: z.number().int().positive().optional(),
  samplingFrequency: z.number().positive().optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  description: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, ['Administrador', 'Técnico'])
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })

  const sensor = await prisma.sensor.update({ where: { id }, data: result.data })
  await logAudit(event, { userId: auth.userId, action: 'UPDATE', module: 'sensors', entityId: id })

  return successResponse(sensor, 'Sensor updated')
})
