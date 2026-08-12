import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getAdminSession } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 2 * 1024 * 1024
const CLOUDINARY_FOLDER = 'topsell-run'

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Akses ditolak. Fitur ini hanya untuk superadmin.' }, { status: 403 })
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || ''
  const apiKey = process.env.CLOUDINARY_API_KEY || ''
  const apiSecret = process.env.CLOUDINARY_API_SECRET || ''
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Cloudinary belum dikonfigurasi. Isi CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET di Pengaturan.' },
      { status: 500 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Ukuran file maksimal 2MB.' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File harus berupa gambar.' }, { status: 400 })
  }

  const timestamp = Math.floor(Date.now() / 1000)
  // Signature Cloudinary: sha1 dari parameter (selain file/api_key/signature) terurut alfabet + api_secret.
  const signature = createHash('sha1')
    .update(`folder=${CLOUDINARY_FOLDER}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex')

  const cloudinaryForm = new FormData()
  cloudinaryForm.append('file', file)
  cloudinaryForm.append('api_key', apiKey)
  cloudinaryForm.append('timestamp', String(timestamp))
  cloudinaryForm.append('folder', CLOUDINARY_FOLDER)
  cloudinaryForm.append('signature', signature)

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: cloudinaryForm,
    })

    if (!res.ok) {
      const errorText = await res.text()
      return NextResponse.json({ error: `Upload Cloudinary gagal: ${errorText.slice(0, 300)}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({ url: data.secure_url as string })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menghubungi Cloudinary.' },
      { status: 502 }
    )
  }
}
