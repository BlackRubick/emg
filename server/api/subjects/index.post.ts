import { z } from 'zod'
import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  name: z.string().min(2).max(100),
  age: z.number().int().min(1).max(120),
  sex: z.enum(['M', 'F', 'Otro']),
  amputationType: z.string().min(2).max(100),
  observations: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, ['Administrador', 'Investigador'])
  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) throw createError({ statusCode: 400, message: result.error.errors[0].message })

  const subject = await prisma.subject.create({ data: result.data })
  await logAudit(event, { userId: auth.userId, action: 'CREATE', module: 'subjects', entityId: subject.id })

  return successResponse(subject, 'Subject created')
})
