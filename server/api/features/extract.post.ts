import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  channelId: z.number().int().positive(),
  sessionId: z.string().optional(),
  samples: z.array(z.number()).min(10, 'Minimum 10 samples required'),
  windowStart: z.string().datetime().optional(),
  windowEnd: z.string().datetime().optional(),
})

function computeMAV(samples: number[]): number {
  return samples.reduce((sum, s) => sum + Math.abs(s), 0) / samples.length
}

function computeRMS(samples: number[]): number {
  return Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length)
}

function computeWL(samples: number[]): number {
  let wl = 0
  for (let i = 1; i < samples.length; i++) wl += Math.abs(samples[i] - samples[i - 1])
  return wl
}

function computeZC(samples: number[], threshold = 0.01): number {
  let zc = 0
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] * samples[i - 1] < 0) && Math.abs(samples[i] - samples[i - 1]) > threshold) zc++
  }
  return zc
}

function computeSSC(samples: number[], threshold = 0.01): number {
  let ssc = 0
  for (let i = 1; i < samples.length - 1; i++) {
    const cond = (samples[i] - samples[i - 1]) * (samples[i] - samples[i + 1])
    if (cond > 0 && (Math.abs(samples[i] - samples[i - 1]) > threshold || Math.abs(samples[i] - samples[i + 1]) > threshold)) ssc++
  }
  return ssc
}

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })

  const { channelId, sessionId, samples, windowStart, windowEnd } = result.data
  const now = new Date()

  const feature = await prisma.feature.create({
    data: {
      channelId,
      sessionId,
      windowStart: windowStart ? new Date(windowStart) : now,
      windowEnd: windowEnd ? new Date(windowEnd) : now,
      mav: computeMAV(samples),
      rms: computeRMS(samples),
      wl: computeWL(samples),
      zc: computeZC(samples),
      ssc: computeSSC(samples),
      metadata: { sampleCount: samples.length },
    },
  })

  return successResponse(feature, 'Features extracted')
})
