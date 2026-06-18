import { SignJWT, jwtVerify } from 'jose'
import type { H3Event } from 'h3'

export interface JWTPayload {
  userId: number
  email: string
  roleId: number
  roleName: string
}

function getSecret() {
  const config = useRuntimeConfig()
  return new TextEncoder().encode(config.jwtSecret || 'emg-default-secret')
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as JWTPayload
}

export async function getUserFromEvent(event: H3Event): Promise<JWTPayload | null> {
  const authHeader = getHeader(event, 'authorization')
  const cookieToken = getCookie(event, 'auth_token')

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : cookieToken

  if (!token) return null

  try {
    return await verifyToken(token)
  } catch {
    return null
  }
}

export async function requireAuth(event: H3Event): Promise<JWTPayload> {
  const user = await getUserFromEvent(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  return user
}

export async function requireRole(event: H3Event, roles: string[]): Promise<JWTPayload> {
  const user = await requireAuth(event)
  if (!roles.includes(user.roleName)) {
    throw createError({ statusCode: 403, message: 'Forbidden: insufficient permissions' })
  }
  return user
}
