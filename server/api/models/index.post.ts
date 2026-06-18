import { z } from 'zod'
import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  name: z.string().min(2).max(150),
  algorithm: z.string().default('LDA'),
  subjectId: z.number().int().positive().optional(),
  datasetId: z.number().int().positive().optional(),
  numChannels: z.number().int().min(1),
  windowSize: z.number().positive(),
  overlapSize: z.number().min(0),
})

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, ['Administrador', 'Investigador'])
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })

  const model = await prisma.trainedModel.create({
    data: { ...result.data, trainedBy: auth.userId, status: 'training' },
  })

  // Simulate training async (in real system this would trigger a Python ML service)
  setTimeout(async () => {
    await prisma.trainedModel.update({
      where: { id: model.id },
      data: {
        status: 'ready',
        accuracy: 88 + Math.random() * 10,
        precision: 87 + Math.random() * 10,
        recall: 88 + Math.random() * 9,
        f1Score: 87.5 + Math.random() * 10,
        trainDuration: 5 + Math.random() * 15,
        confusionMatrix: { labels: ['HAND_OPEN', 'HAND_CLOSE', 'FINE_PINCH', 'CYLINDRICAL_GRIP', 'WRIST_FLEX'], matrix: [[48,1,0,1,0],[1,47,1,0,1],[0,1,49,0,0],[1,0,0,48,1],[0,1,0,1,48]] },
      },
    })
  }, 3000)

  await logAudit(event, { userId: auth.userId, action: 'TRAIN', module: 'models', entityId: model.id })
  return successResponse(model, 'Model training started')
})
