import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

const schema = z.object({ prosthesisId: z.number().int().positive() })

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })

  const movement = await prisma.movement.create({
    data: {
      prosthesisId: result.data.prosthesisId,
      command: 'STOP',
      status: 'executed',
      source: 'api',
      latency: Math.random() * 10,
    },
  })

  await prisma.prosthesis.update({
    where: { id: result.data.prosthesisId },
    data: { status: 'idle', lastSeen: new Date() },
  })

  return successResponse(movement, 'Prosthesis stopped')
})
