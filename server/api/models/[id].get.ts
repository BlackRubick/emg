import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const model = await prisma.trainedModel.findUnique({
    where: { id },
    include: {
      subject: true,
      dataset: true,
      trainer: { select: { name: true, email: true } },
      _count: { select: { classifications: true } },
    },
  })

  if (!model) throw createError({ statusCode: 404, message: 'Model not found' })
  return successResponse(model)
})
