import 'server-only'

import nodemailer from 'nodemailer'
import { findPacerById } from '@/lib/db'

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

function renderPacerApprovalEmail(name: string, pacerCode: string, category: string, appUrl: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:bold">TOPSELL RUN 2026</h1>
        <p style="color:#ffffff;margin:8px 0 0;font-size:14px;letter-spacing:1px;text-transform:uppercase">Selamat! Anda Terpilih Sebagai Pacer</p>
      </div>
      
      <div style="background:#ffffff;padding:40px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px">Halo ${escapeHtml(name)},</h2>
        
        <p style="margin:0 0 16px;color:#374151">
          Berdasarkan hasil seleksi tim panitia TOPSELL RUN 2026, dengan bangga kami informasikan bahwa pendaftaran Anda sebagai <strong>Pacer (Kategori ${escapeHtml(category)})</strong> telah <strong>DISETUJUI (APPROVED)</strong>!
        </p>
        
        <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:24px 0">
          <h3 style="margin:0 0 12px;font-size:14px;color:#374151;text-transform:uppercase;letter-spacing:0.5px">Detail Pacer Anda:</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr>
              <td style="padding:6px 0;color:#6b7280">Nama Lengkap</td>
              <td style="padding:6px 0;text-align:right;font-weight:bold;color:#111827">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280">Kode Pacer</td>
              <td style="padding:6px 0;text-align:right;font-weight:bold;color:#10b981">${escapeHtml(pacerCode)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280">Kategori Pace</td>
              <td style="padding:6px 0;text-align:right;font-weight:bold;color:#111827">${escapeHtml(category)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280">Status Keanggotaan</td>
              <td style="padding:6px 0;text-align:right;font-weight:bold;color:#10b981">✓ AKTIF / DISETUJUI</td>
            </tr>
          </table>
        </div>
        
        <p style="margin:0 0 16px;color:#374151">
          Silakan masuk ke Dashboard Pacer Anda untuk melengkapi profil, mengunduh QR Pass, dan memantau koordinasi tim Pacer:
        </p>
        
        <div style="text-align:center;margin:32px 0">
          <a href="${appUrl}/login" 
             style="display:inline-block;background:linear-gradient(135deg, #10b981 0%, #059669 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px">
            Masuk ke Dashboard Pacer
          </a>
        </div>
        
        <p style="margin:0 0 24px;color:#374151">
          Selamat bergabung dalam jajaran pelari pacemaker resmi! Dedikasi Anda akan sangat membantu ribuan pelari lain mencapai garis finish dan mencetak waktu terbaik mereka.
        </p>
        
        <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:30px">
          <p style="margin:0;color:#6b7280;font-size:13px">Salam semangat berlari,</p>
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

export async function sendPacerApprovalEmail(pacerId: string): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.warn('SMTP is not configured. Skipping pacer approval email.')
    return { success: false, error: 'SMTP tidak dikonfigurasi' }
  }

  try {
    const pacer = await findPacerById(pacerId)
    if (!pacer) {
      return { success: false, error: 'Pacer tidak ditemukan' }
    }
    if (!pacer.email) {
      return { success: false, error: 'Email pacer tidak terdaftar' }
    }

    const config = getSmtpConfig()
    const transporter = createTransporter()
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')

    await transporter.sendMail({
      from: config.from,
      to: pacer.email,
      subject: `Selamat! Pendaftaran Pacer Anda Disetujui - TOPSELL RUN 2026`,
      html: renderPacerApprovalEmail(pacer.name, pacer.pacer_code, pacer.category, appUrl),
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to send pacer approval email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengirim email pemberitahuan pacer',
    }
  }
}
