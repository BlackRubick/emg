import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAuth } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Minimum 8 characters'),
})

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)
  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) {
    throw createError({ statusCode: 400, message: result.error.errors[0].message })
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId } })
  if (!user) throw createError({ statusCode: 404, message: 'User not found' })

  const valid = await bcrypt.compare(result.data.currentPassword, user.password)
  if (!valid) throw createError({ statusCode: 400, message: 'Current password is incorrect' })

  const hashed = await bcrypt.hash(result.data.newPassword, 12)
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })

  await logAudit(event, { userId: auth.userId, action: 'CHANGE_PASSWORD', module: 'auth' })

  return successResponse(null, 'Password changed successfully')
})
