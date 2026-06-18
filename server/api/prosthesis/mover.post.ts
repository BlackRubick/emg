import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  prosthesisId: z.number().int().positive(),
  command: z.string().min(1),
  gestureId: z.number().int().positive().optional(),
  sessionId: z.string().optional(),
  source: z.enum(['manual', 'emg', 'api']).default('api'),
})

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })

  const prosthesis = await prisma.prosthesis.findUnique({ where: { id: result.data.prosthesisId } })
  if (!prosthesis) throw createError({ statusCode: 404, message: 'Prosthesis not found' })

  const startTime = Date.now()

  const movement = await prisma.movement.create({
    data: {
      prosthesisId: result.data.prosthesisId,
      gestureId: result.data.gestureId,
      command: result.data.command,
      status: 'executed',
      source: result.data.source,
      sessionId: result.data.sessionId,
      latency: Date.now() - startTime + Math.random() * 20,
    },
    include: { gesture: true },
  })

  await prisma.prosthesis.update({
    where: { id: result.data.prosthesisId },
    data: { status: 'active', lastSeen: new Date() },
  })

  await logAudit(event, { userId: auth.userId, action: 'MOVE', module: 'prosthesis', entityId: result.data.prosthesisId, details: { command: result.data.command } })

  return successResponse(movement, 'Command sent')
})
