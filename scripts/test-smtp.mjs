import nodemailer from 'nodemailer'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load env from project root
dotenv.config({ path: join(__dirname, '..', '.env.local') })

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

async function testEmail() {
  const config = getSmtpConfig()
  console.log('Testing SMTP connection with config:')
  console.log({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    pass: config.pass ? '*** (length: ' + config.pass.length + ')' : 'NOT SET',
    from: config.from,
    envFileLoaded: !!process.env.SMTP_PASS
  })

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    })

    console.log('Testing transporter connection...')
    await transporter.verify()
    console.log('✅ SMTP connection successful!')

    const testEmail = 'galihsindy00@gmail.com' // Change this to your own email to test
    console.log(`Sending test email to ${testEmail}...`)
    await transporter.sendMail({
      from: config.from,
      to: testEmail,
      subject: 'Test Email from Topsell Run',
      html: '<h1>Test Email</h1><p>If you received this, SMTP is working!</p>',
    })
    console.log('✅ Test email sent successfully!')
  } catch (error) {
    console.error('❌ SMTP test failed:')
    console.error(error)
  }
}

testEmail()
