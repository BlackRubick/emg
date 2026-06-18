import type { H3Event } from 'h3'
import { prisma } from './prisma'

export async function logAudit(
  event: H3Event,
  options: {
    userId?: number
    action: string
    module: string
    entityId?: number
    details?: Record<string, unknown>
  }
) {
  try {
    const ip = getHeader(event, 'x-forwarded-for')
      || getHeader(event, 'x-real-ip')
      || event.node.req.socket?.remoteAddress
      || 'unknown'
    const userAgent = getHeader(event, 'user-agent') || 'unknown'

    await prisma.auditLog.create({
      data: {
        userId: options.userId,
        action: options.action,
        module: options.module,
        entityId: options.entityId,
        details: options.details,
        ipAddress: ip.split(',')[0].trim(),
        userAgent: userAgent.slice(0, 500),
      },
    })
  } catch {
    // Audit logging should never break main flow
  }
}
