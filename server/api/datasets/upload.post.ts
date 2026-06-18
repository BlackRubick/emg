import { z } from 'zod'
import { requireRole } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { logAudit } from '~/server/utils/audit'
import { successResponse } from '~/server/utils/response'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const metaSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, ['Administrador', 'Investigador'])

  const formData = await readMultipartFormData(event)
  if (!formData) throw createError({ statusCode: 400, message: 'No form data received' })

  const fields: Record<string, string> = {}
  let fileField: { filename?: string; data: Buffer; type?: string } | undefined

  for (const part of formData) {
    if (part.name === 'file') {
      fileField = { filename: part.filename, data: part.data, type: part.type }
    } else if (part.name) {
      fields[part.name] = part.data.toString()
    }
  }

  if (!fileField) throw createError({ statusCode: 400, message: 'No file uploaded' })

  const meta = metaSchema.safeParse(fields)
  if (!meta.success) throw createError({ statusCode: 400, message: meta.error.errors[0].message })

  const ext = fileField.filename?.split('.').pop()?.toLowerCase() || 'csv'
  if (!['csv', 'mat', 'json'].includes(ext)) {
    throw createError({ statusCode: 400, message: 'Only CSV, MAT and JSON files are allowed' })
  }

  const uploadDir = join(process.cwd(), 'public', 'uploads', 'datasets')
  await mkdir(uploadDir, { recursive: true })
  const filename = `dataset_${Date.now()}.${ext}`
  const filePath = join(uploadDir, filename)
  await writeFile(filePath, fileField.data)

  const dataset = await prisma.dataset.create({
    data: {
      name: meta.data.name,
      description: meta.data.description,
      subjectId: meta.data.subjectId,
      fileType: ext,
      filePath: `/uploads/datasets/${filename}`,
      fileSize: BigInt(fileField.data.length),
      validated: false,
    },
  })

  await logAudit(event, { userId: auth.userId, action: 'UPLOAD', module: 'datasets', entityId: dataset.id })

  return successResponse({ ...dataset, fileSize: Number(dataset.fileSize) }, 'Dataset uploaded')
})
