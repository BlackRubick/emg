import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  roleId: z.number().int().positive(),
  active: z.boolean().optional().default(true),
})

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, ['Administrador'])
  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) {
    throw createError({ statusCode: 400, message: result.error.errors[0].message })
  }

  const existing = await prisma.user.findUnique({ where: { email: result.data.email } })
  if (existing) throw createError({ statusCode: 409, message: 'Email already registered' })

  const hashed = await bcrypt.hash(result.data.password, 12)
  const user = await prisma.user.create({
    data: { ...result.data, password: hashed },
    select: {
      id: true, name: true, email: true, roleId: true, active: true, avatar: true,
      lastLogin: true, createdAt: true, updatedAt: true, role: true,
    },
  })

  await logAudit(event, { userId: auth.userId, action: 'CREATE', module: 'users', entityId: user.id })

  return successResponse(user, 'User created', undefined)
})
