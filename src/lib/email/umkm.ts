import 'server-only'

import nodemailer from 'nodemailer'
import { findUmkmById } from '@/lib/db'
import { formatCurrency } from '@/lib/utils/format'

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT || '465'),
    secure: (process.env.SMTP_SECURE || 'true') !== 'false',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  }
}

function isEmailConfigured() {
  const config = getSmtpConfig()
  return Boolean(config.host && config.port && config.user && config.pass && config.from)
}

function createTransporter() {
  const config = getSmtpConfig()
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })
}

function escapeHtml(value: string | null | undefined) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderUmkmApprovalEmail(params: {
  name: string
  picName: string
  umkmCode: string
  businessField: string
  amountDue: number
  appUrl: string
}) {
  const { name, picName, umkmCode, businessField, amountDue, appUrl } = params
  const needsPayment = amountDue > 0

  // Tenant gratis / sudah lunas tidak perlu diarahkan ke pembayaran.
  const callToAction = needsPayment
    ? `
        <div style="background:#fff7ed;border:1px solid #fed7aa;padding:20px;border-radius:8px;margin:24px 0">
          <h3 style="margin:0 0 8px;font-size:14px;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px">Langkah Selanjutnya: Pembayaran</h3>
          <p style="margin:0 0 12px;color:#7c2d12;font-size:14px">
            Tombol pembayaran di dashboard Anda kini sudah <strong>aktif</strong>. Slot tenant baru terkunci setelah pembayaran diterima.
          </p>
          <p style="margin:0;color:#7c2d12;font-size:14px">
            Total yang harus dibayar: <strong style="font-size:18px;color:#ea580c">${escapeHtml(formatCurrency(amountDue))}</strong>
          </p>
        </div>

        <div style="text-align:center;margin:32px 0">
          <a href="${appUrl}/umkm-login"
             style="display:inline-block;background:linear-gradient(135deg, #f97316 0%, #ea580c 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px">
            Masuk &amp; Selesaikan Pembayaran
          </a>
        </div>
      `
    : `
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;padding:20px;border-radius:8px;margin:24px 0">
          <p style="margin:0;color:#065f46;font-size:14px">
            Tidak ada biaya yang perlu dibayar. Slot tenant Anda sudah terkunci.
          </p>
        </div>

        <div style="text-align:center;margin:32px 0">
          <a href="${appUrl}/umkm-login"
             style="display:inline-block;background:linear-gradient(135deg, #10b981 0%, #059669 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px">
            Masuk ke Dashboard Tenant
          </a>
        </div>
      `

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:bold">TOPSELL RUN 2026</h1>
        <p style="color:#ffffff;margin:8px 0 0;font-size:14px;letter-spacing:1px;text-transform:uppercase">Pendaftaran Tenant UMKM Disetujui</p>
      </div>

      <div style="background:#ffffff;padding:40px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px">Halo ${escapeHtml(picName)},</h2>

        <p style="margin:0 0 16px;color:#374151">
          Kabar baik! Pendaftaran tenant UMKM <strong>${escapeHtml(name)}</strong> pada TOPSELL RUN 2026 telah <strong>DISETUJUI (APPROVED)</strong> oleh tim panitia.
        </p>

        <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:24px 0">
          <h3 style="margin:0 0 12px;font-size:14px;color:#374151;text-transform:uppercase;letter-spacing:0.5px">Detail Tenant Anda:</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr>
              <td style="padding:6px 0;color:#6b7280">Nama Usaha</td>
              <td style="padding:6px 0;text-align:right;font-weight:bold;color:#111827">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280">Kode Tenant</td>
              <td style="padding:6px 0;text-align:right;font-weight:bold;color:#10b981">${escapeHtml(umkmCode)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280">Bidang Usaha</td>
              <td style="padding:6px 0;text-align:right;font-weight:bold;color:#111827">${escapeHtml(businessField)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280">Status</td>
              <td style="padding:6px 0;text-align:right;font-weight:bold;color:#10b981">✓ DISETUJUI</td>
            </tr>
          </table>
        </div>

        ${callToAction}

        <p style="margin:0 0 24px;color:#374151">
          Sampai jumpa di Sunrise Mall, Mojokerto. Terima kasih sudah menjadi bagian dari TOPSELL RUN 2026.
        </p>

        <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:30px">
          <p style="margin:0;color:#6b7280;font-size:13px">Salam hangat,</p>
          <p style="margin:4px 0 0;font-weight:bold;color:#111827">Tim Panitia TOPSELL RUN 2026</p>
        </div>
      </div>

      <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px">
        <p style="margin:0">Email otomatis dari TOPSELL RUN 2026</p>
        <p style="margin:8px 0 0">Sunrise Mall, Mojokerto • 18 Oktober 2026</p>
      </div>
    </div>
  `
}

function renderUmkmRejectionEmail(params: {
  name: string
  picName: string
  umkmCode: string
  note: string | null
  appUrl: string
}) {
  const { name, picName, umkmCode, note, appUrl } = params

  const noteBlock = note
    ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;padding:20px;border-radius:8px;margin:24px 0">
          <h3 style="margin:0 0 8px;font-size:14px;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Catatan dari Panitia</h3>
          <p style="margin:0;color:#7f1d1d;font-size:14px">${escapeHtml(note)}</p>
        </div>
      `
    : ''

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:bold">TOPSELL RUN 2026</h1>
        <p style="color:#ffffff;margin:8px 0 0;font-size:14px;letter-spacing:1px;text-transform:uppercase">Status Pendaftaran Tenant UMKM</p>
      </div>

      <div style="background:#ffffff;padding:40px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px">Halo ${escapeHtml(picName)},</h2>

        <p style="margin:0 0 16px;color:#374151">
          Terima kasih atas minat Anda mendaftarkan <strong>${escapeHtml(name)}</strong> (${escapeHtml(umkmCode)}) sebagai tenant UMKM di TOPSELL RUN 2026.
        </p>

        <p style="margin:0 0 16px;color:#374151">
          Setelah kami tinjau, pendaftaran ini <strong>belum dapat kami setujui</strong> untuk kesempatan kali ini.
        </p>

        ${noteBlock}

        <p style="margin:0 0 24px;color:#374151">
          Bila ada yang ingin ditanyakan atau Anda merasa ada data yang perlu diperbaiki, silakan balas email ini — tim kami akan membantu meninjau ulang.
        </p>

        <div style="text-align:center;margin:32px 0">
          <a href="${appUrl}/umkm-login"
             style="display:inline-block;background:#f3f4f6;color:#374151;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:14px;border:1px solid #d1d5db">
            Lihat Status di Dashboard
          </a>
        </div>

        <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:30px">
          <p style="margin:0;color:#6b7280;font-size:13px">Salam hangat,</p>
          <p style="margin:4px 0 0;font-weight:bold;color:#111827">Tim Panitia TOPSELL RUN 2026</p>
        </div>
      </div>

      <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px">
        <p style="margin:0">Email otomatis dari TOPSELL RUN 2026</p>
        <p style="margin:8px 0 0">Sunrise Mall, Mojokerto • 18 Oktober 2026</p>
      </div>
    </div>
  `
}

/**
 * Kabari tenant UMKM setelah admin memutuskan status pendaftarannya.
 *
 * Approval-lah yang membuka tombol bayar di dashboard tenant
 * (src/app/umkm-dashboard/page.tsx), jadi tanpa email ini tenant hanya tahu
 * kalau kebetulan login sendiri.
 */
export async function sendUmkmStatusEmail(
  umkmId: string,
  status: 'approved' | 'rejected',
  note?: string | null,
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.warn('SMTP is not configured. Skipping UMKM status email.')
    return { success: false, error: 'SMTP tidak dikonfigurasi' }
  }

  try {
    const umkm = await findUmkmById(umkmId)
    if (!umkm) {
      return { success: false, error: 'Data UMKM tidak ditemukan' }
    }
    if (!umkm.email) {
      return { success: false, error: 'Email UMKM tidak terdaftar' }
    }

    const config = getSmtpConfig()
    const transporter = createTransporter()
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const picName = umkm.pic_name || umkm.name

    // Tenant yang sudah lunas tidak lagi punya tagihan, sama seperti tenant gratis.
    const amountDue = umkm.payment_status === 'paid' ? 0 : Math.max(0, umkm.payment_amount ?? 0)

    await transporter.sendMail({
      from: config.from,
      to: umkm.email,
      subject:
        status === 'approved'
          ? `Selamat! Tenant UMKM Anda Disetujui - TOPSELL RUN 2026`
          : `Status Pendaftaran Tenant UMKM Anda - TOPSELL RUN 2026`,
      html:
        status === 'approved'
          ? renderUmkmApprovalEmail({
              name: umkm.name,
              picName,
              umkmCode: umkm.umkm_code,
              businessField: umkm.business_field,
              amountDue,
              appUrl,
            })
          : renderUmkmRejectionEmail({
              name: umkm.name,
              picName,
              umkmCode: umkm.umkm_code,
              note: note?.trim() || null,
              appUrl,
            }),
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to send UMKM status email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengirim email status UMKM',
    }
  }
}
