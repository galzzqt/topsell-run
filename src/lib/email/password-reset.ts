import 'server-only'

import nodemailer from 'nodemailer'
import { randomBytes } from 'crypto'

export type PasswordResetEmailParams = {
  email: string
  name: string
  resetUrl: string
  packageType: 'community' | 'family' | 'individual' | 'invitation' | 'pacer' | 'umkm'
}

function getPackageDisplayName(packageType: 'community' | 'family' | 'individual' | 'invitation' | 'pacer' | 'umkm'): string {
  switch (packageType) {
    case 'community':
      return 'Community Package'
    case 'individual':
      return 'Pendaftaran Individu'
    case 'invitation':
      return 'Pendaftaran Invitation'
    case 'pacer':
      return 'Pendaftaran Pacer'
    case 'umkm':
      return 'Tenant UMKM'
    case 'family':
    default:
      return 'Bro & Sist Package'
  }
}

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
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })
}

export function generateResetPasswordToken(): string {
  return randomBytes(32).toString('hex')
}

export function getResetPasswordTokenExpiry(): Date {
  // Token expires in 24 hours per user request
  const expiry = new Date()
  expiry.setHours(expiry.getHours() + 24)
  return expiry
}

function renderPasswordResetEmail(
  name: string,
  resetUrl: string,
  packageType: 'community' | 'family' | 'individual' | 'invitation' | 'pacer' | 'umkm'
): string {
  const packageName = getPackageDisplayName(packageType)
  const waLinkText = 'Halo%20Admin%20Topsell%20Run%2C%20saya%20membutuhkan%20bantuan%20reset%20password%20akun%20saya.'

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold">TOPSELL RUN 2026</h1>
        <p style="color:#ffffff;margin:8px 0 0;font-size:14px">Permintaan Reset Password • ${packageName}</p>
      </div>
      
      <div style="background:#ffffff;padding:40px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px">Halo ${name},</h2>
        
        <p style="margin:0 0 16px;color:#374151">
          Kami menerima permintaan untuk mengatur ulang kata sandi (password) akun TOPSELL RUN 2026 Anda (${packageName}). 
          Jika Anda yang meminta ini, silakan klik tombol di bawah ini untuk membuat password baru:
        </p>
        
        <div style="text-align:center;margin:32px 0">
          <a href="${resetUrl}" 
             style="display:inline-block;background:linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.1)">
            Reset Password Saya
          </a>
        </div>
        
        <p style="margin:0 0 16px;color:#374151;font-size:14px">
          Atau salin dan tempel link berikut ke peramban (browser) Anda:
        </p>
        <p style="margin:0 0 24px;padding:12px;background:#f3f4f6;border-radius:6px;word-break:break-all;font-size:12px;color:#6b7280">
          ${resetUrl}
        </p>
        
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:6px;margin:24px 0">
          <p style="margin:0;color:#92400e;font-size:14px;font-weight:bold">⏰ Link reset password ini berlaku selama 24 jam</p>
          <p style="margin:8px 0 0;color:#92400e;font-size:13px">
            Demi keamanan, tautan ini hanya dapat digunakan satu kali. Jika sudah kedaluwarsa, Anda dapat mengajukan permintaan reset baru.
          </p>
        </div>
        
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:24px 0">
          <p style="margin:0;color:#15803d;font-size:14px;font-weight:bold">💬 Butuh bantuan CS?</p>
          <p style="margin:8px 0 0;color:#166534;font-size:13px">
            Jika Anda mengalami kendala saat mengatur ulang password, hubungi Customer Service kami:
          </p>
          <a href="https://wa.me/6282119227871?text=${waLinkText}"
             style="display:inline-block;margin-top:10px;background:#25d366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:6px;font-weight:bold;font-size:13px">
            💬 Chat WhatsApp CS
          </a>
        </div>
        
        <p style="margin:24px 0 0;color:#6b7280;font-size:13px">
          Jika Anda tidak meminta pengaturan ulang password ini, abaikan email ini. Akun dan password Anda tetap aman.
        </p>
      </div>
      
      <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px">
        <p style="margin:0">Email otomatis dari TOPSELL RUN 2026</p>
        <p style="margin:8px 0 0">Sunrise Mall, Mojokerto • 18 Oktober 2026</p>
      </div>
    </div>
  `
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.warn('SMTP is not configured. Skipping password reset email.')
    return { success: false, error: 'SMTP belum dikonfigurasi di server' }
  }

  const config = getSmtpConfig()
  const transporter = createTransporter()
  const packageName = getPackageDisplayName(params.packageType)

  try {
    await transporter.sendMail({
      from: config.from,
      to: params.email,
      subject: `Reset Password TOPSELL RUN 2026 - ${packageName}`,
      html: renderPasswordResetEmail(params.name, params.resetUrl, params.packageType),
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to send password reset email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengirim email reset password',
    }
  }
}
