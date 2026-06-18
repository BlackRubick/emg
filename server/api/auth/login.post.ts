import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '~/server/utils/prisma'
import { signToken } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = loginSchema.safeParse(body)

  if (!result.success) {
    throw createError({ statusCode: 400, message: result.error.errors[0].message })
  }

  const { email, password } = result.data

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  })

  if (!user || !user.active) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  })

  const token = await signToken({
    userId: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
  })

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  await logAudit(event, {
    userId: user.id,
    action: 'LOGIN',
    module: 'auth',
    details: { email: user.email },
  })

  return successResponse({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      roleId: user.roleId,
      avatar: user.avatar,
    },
  }, 'Login successful')
})
