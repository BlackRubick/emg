export function successResponse<T>(data: T, message = 'Success', meta?: Record<string, unknown>) {
  return { success: true, message, data, ...(meta ? { meta } : {}) }
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  message = 'Success'
) {
  return {
    success: true,
    message,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  }
}

export function getPaginationParams(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

export function getSearchParams(query: Record<string, unknown>) {
  const search = String(query.search || '').trim()
  const sortBy = String(query.sortBy || 'createdAt')
  const sortOrder = (String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
  return { search, sortBy, sortOrder }
}
