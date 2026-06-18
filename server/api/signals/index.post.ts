import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  channelId: z.number().int().positive(),
  amplitude: z.number(),
  frequency: z.number().optional(),
  sampleRate: z.number().optional(),
  rawData: z.any().optional(),
  sessionId: z.string().optional(),
})

const batchSchema = z.array(schema)

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const body = await readBody(event)

  if (Array.isArray(body)) {
    const result = batchSchema.safeParse(body)
    if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })
    await prisma.signal.createMany({ data: result.data })
    return successResponse({ count: result.data.length }, `${result.data.length} signals saved`)
  }

  const result = schema.safeParse(body)
  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })
  const signal = await prisma.signal.create({ data: result.data })
  return successResponse(signal, 'Signal saved')
})
