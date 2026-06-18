import { createHmac, randomUUID, scryptSync, timingSafeEqual } from 'crypto'
import bcrypt from 'bcryptjs'

export type PasswordScheme = 'scrypt' | 'bcrypt'

export type PasswordRecord = {
  password_hash: string
  password_salt: string
  password_scheme: PasswordScheme
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function hashScryptPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex')
}

export function createPasswordRecord(password: string): PasswordRecord {
  const salt = createHmac('sha256', randomUUID()).update(`${Date.now()}`).digest('hex').slice(0, 24)
  return {
    password_salt: salt,
    password_hash: hashScryptPassword(password, salt),
    password_scheme: 'scrypt',
  }
}

export function createBcryptPasswordRecord(bcryptHash: string): PasswordRecord {
  return {
    password_hash: bcryptHash,
    password_salt: '',
    password_scheme: 'bcrypt',
  }
}

export function verifyPassword(password: string, record: PasswordRecord) {
  if (!password || !record.password_hash) return false

  if (record.password_scheme === 'bcrypt') {
    return bcrypt.compareSync(password, record.password_hash)
  }

  return safeCompare(hashScryptPassword(password, record.password_salt), record.password_hash)
}
