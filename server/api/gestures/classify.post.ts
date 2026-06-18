import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  modelId: z.number().int().positive(),
  featureVector: z.array(z.number()),
  sessionId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })

  const model = await prisma.trainedModel.findUnique({ where: { id: result.data.modelId } })
  if (!model) throw createError({ statusCode: 404, message: 'Model not found' })
  if (model.status !== 'ready') throw createError({ statusCode: 400, message: 'Model not ready' })

  const gestures = await prisma.gesture.findMany({ where: { active: true }, orderBy: { id: 'asc' } })

  // LDA simulation — in production this calls a Python microservice
  const scores = gestures.map(() => Math.random())
  const total = scores.reduce((s, v) => s + v, 0)
  const probs = scores.map(s => s / total)
  const bestIdx = probs.indexOf(Math.max(...probs))
  const bestGesture = gestures[bestIdx]

  const classification = await prisma.gestureClassification.create({
    data: {
      modelId: result.data.modelId,
      gestureId: bestGesture.id,
      sessionId: result.data.sessionId,
      confidence: probs[bestIdx],
      featureVector: result.data.featureVector,
    },
    include: { gesture: true },
  })

  return successResponse({
    gesture: bestGesture,
    confidence: probs[bestIdx],
    allScores: gestures.map((g, i) => ({ gesture: g, probability: probs[i] })),
    classificationId: classification.id,
  }, 'Gesture classified')
})
