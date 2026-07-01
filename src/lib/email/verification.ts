import 'server-only'

import nodemailer from 'nodemailer'
import { randomBytes } from 'crypto'

type VerificationEmailParams = {
  email: string
  name: string
  verificationUrl: string
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

export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex')
}

export function getVerificationTokenExpiry(): Date {
  // Token expires in 24 hours
  const expiry = new Date()
  expiry.setHours(expiry.getHours() + 24)
  return expiry
}

function renderVerificationEmail(name: string, verificationUrl: string): string {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg, #ff2a44 0%, #ff6a00 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold">TOPSELL RUN 2026</h1>
        <p style="color:#ffffff;margin:8px 0 0;font-size:14px">Aktivasi Akun Bro & Sist Package</p>
      </div>
      
      <div style="background:#ffffff;padding:40px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px">Halo ${name},</h2>
        
        <p style="margin:0 0 16px;color:#374151">
          Terima kasih telah mendaftar TOPSELL RUN 2026 Bro & Sist Package! 
          Untuk melanjutkan dan mengakses dashboard, silakan aktivasi akun Anda dengan mengklik tombol di bawah ini:
        </p>
        
        <div style="text-align:center;margin:32px 0">
          <a href="${verificationUrl}" 
             style="display:inline-block;background:linear-gradient(135deg, #ff2a44 0%, #ff6a00 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px">
            Aktivasi Akun Saya
          </a>
        </div>
        
        <p style="margin:0 0 16px;color:#374151;font-size:14px">
          Atau copy & paste link berikut ke browser Anda:
        </p>
        <p style="margin:0 0 24px;padding:12px;background:#f3f4f6;border-radius:6px;word-break:break-all;font-size:12px;color:#6b7280">
          ${verificationUrl}
        </p>
        
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:6px;margin:24px 0">
          <p style="margin:0;color:#92400e;font-size:14px;font-weight:bold">⏰ Link aktivasi ini berlaku selama 24 jam</p>
          <p style="margin:8px 0 0;color:#92400e;font-size:13px">
            Jika link kedaluwarsa, Anda bisa meminta link aktivasi baru dari halaman login.
          </p>
        </div>
        
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:24px 0">
          <p style="margin:0;color:#15803d;font-size:14px;font-weight:bold">💬 Butuh bantuan?</p>
          <p style="margin:8px 0 0;color:#166534;font-size:13px">
            Jika mengalami kesulitan dalam proses aktivasi, hubungi tim kami:
          </p>
          <a href="https://wa.me/6285892599688?text=Halo%20Admin%20Topsell%20Run%2C%20saya%20mengalami%20kesulitan%20aktivasi%20email%20pendaftaran%20Bro%20%26%20Sist%20Package."
             style="display:inline-block;margin-top:10px;background:#25d366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:6px;font-weight:bold;font-size:13px">
            💬 Chat WhatsApp CS
          </a>
        </div>
        
        <p style="margin:24px 0 0;color:#6b7280;font-size:13px">
          Jika Anda tidak melakukan pendaftaran ini, abaikan email ini.
        </p>
      </div>
      
      <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px">
        <p style="margin:0">Email otomatis dari TOPSELL RUN 2026</p>
        <p style="margin:8px 0 0">Sunrise Mall, Mojokerto • 18 Oktober 2026</p>
      </div>
    </div>
  `
}

export async function sendVerificationEmail(params: VerificationEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.warn('SMTP is not configured. Skipping verification email.')
    return { success: false, error: 'SMTP tidak dikonfigurasi' }
  }

  const config = getSmtpConfig()
  const transporter = createTransporter()

  try {
    await transporter.sendMail({
      from: config.from,
      to: params.email,
      subject: 'Aktivasi Akun TOPSELL RUN 2026 - Bro & Sist Package',
      html: renderVerificationEmail(params.name, params.verificationUrl),
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to send verification email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengirim email aktivasi',
    }
  }
}
