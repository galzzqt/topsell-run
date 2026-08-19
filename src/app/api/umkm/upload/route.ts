import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { rateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3MB
const CLOUDINARY_FOLDER = 'topsell-run/umkm'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limit = rateLimit(`umkm-upload:${ip}`, 20, 10 * 60 * 1000)
  if (limit.limited) {
    return NextResponse.json({ error: 'Terlalu banyak upload. Coba lagi beberapa menit lagi.' }, { status: 429 })
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || ''
  const apiKey = process.env.CLOUDINARY_API_KEY || ''
  const apiSecret = process.env.CLOUDINARY_API_SECRET || ''
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Cloudinary belum dikonfigurasi. Hubungi admin.' },
      { status: 500 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Ukuran file maksimal 3MB per foto.' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File harus berupa gambar (JPG/PNG/WEBP).' }, { status: 400 })
  }

  const timestamp = Math.floor(Date.now() / 1000)
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
      return NextResponse.json({ error: `Upload foto gagal: ${errorText.slice(0, 300)}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({ url: data.secure_url as string })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menghubungi server upload.' },
      { status: 502 }
    )
  }
}
