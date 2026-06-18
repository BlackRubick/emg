import { getUserFromEvent } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)

  deleteCookie(event, 'auth_token', { path: '/' })

  if (user) {
    await logAudit(event, {
      userId: user.userId,
      action: 'LOGOUT',
      module: 'auth',
    })
  }

  return successResponse(null, 'Logged out successfully')
})
