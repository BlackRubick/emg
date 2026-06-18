import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { successResponse } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { datasets: true, trainedModels: { include: { dataset: true } } },
  })

  if (!subject) throw createError({ statusCode: 404, message: 'Subject not found' })
  return successResponse(subject)
})
