import { z } from 'zod'
import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  name: z.string().min(2).max(100),
  model: z.string().min(1).max(100),
  manufacturer: z.string().min(1).max(100),
  numChannels: z.number().int().min(1).max(256),
  samplingFrequency: z.number().positive(),
  status: z.enum(['active', 'inactive', 'maintenance']).default('active'),
  description: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, ['Administrador', 'Técnico'])
  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })

  const sensor = await prisma.sensor.create({ data: result.data })
  await logAudit(event, { userId: auth.userId, action: 'CREATE', module: 'sensors', entityId: sensor.id })

  return successResponse(sensor, 'Sensor created')
})
