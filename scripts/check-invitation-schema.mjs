// Self-check skema invitation dinamis: `node scripts/check-invitation-schema.mjs`
import assert from 'node:assert/strict'
import { buildInvitationSchema, hiddenInvitationFields } from '../src/lib/validations/auth.ts'

const on = { visible: true, required: true }
const full = {
  full_name: 'Budi Santoso', bib_name: 'BUDI', ktp_number: '3517000000000001', email: 'budi@gmail.com', phone: '081234567890',
  date_of_birth: '1990-01-01', gender: 'male', tshirt_size: 'M', blood_type: 'A', medical_condition: '',
  emergency_contact_name: 'Ani', emergency_contact_phone: '081234567891', community_name: 'PT X', participant_type: 'instansi',
  category: '3K', provinsi: 'Jawa Timur', kota: 'Mojokerto', kecamatan: 'Sooko',
  agreement_safety: true, agreement_data: true, agreement_refund: true,
}
const allOn = { participants: { ktp_number: on, date_of_birth: on, gender: on, emergency_contact_name: on, blood_type: on }, registrant: { provinsi: on, category: on } }

// Semua wajib: data lengkap lolos, KTP kosong ditolak.
assert.equal(buildInvitationSchema(allOn).safeParse(full).success, true)
assert.equal(buildInvitationSchema(allOn).safeParse({ ...full, ktp_number: '' }).success, false)

// KTP/tgl lahir/gender/kontak darurat/provinsi disembunyikan → boleh kosong.
const hidden = { visible: false, required: true }
const off = { participants: { ktp_number: hidden, date_of_birth: hidden, gender: hidden, emergency_contact_name: hidden }, registrant: { provinsi: hidden } }
assert.deepEqual(hiddenInvitationFields(off).sort(), ['date_of_birth', 'emergency_contact_name', 'gender', 'ktp_number', 'provinsi'])
const blanked = { ...full, ktp_number: '', date_of_birth: '', gender: '', emergency_contact_name: '', provinsi: '' }
assert.equal(buildInvitationSchema(off).safeParse(blanked).success, true)

// Tampil tapi tidak wajib: kosong lolos, tapi kalau diisi format tetap dicek.
const optional = { participants: { ktp_number: { visible: true, required: false } }, registrant: {} }
assert.equal(buildInvitationSchema(optional).safeParse({ ...full, ktp_number: '' }).success, true)
assert.equal(buildInvitationSchema(optional).safeParse({ ...full, ktp_number: '123' }).success, false)

// Email & WA tidak bisa direlaksasi.
assert.equal(buildInvitationSchema({ participants: { email: hidden, phone: hidden }, registrant: {} }).safeParse({ ...full, email: '', phone: '' }).success, false)

// Golongan darah "Tidak Tahu".
assert.equal(buildInvitationSchema(allOn).safeParse({ ...full, blood_type: 'none' }).success, true)

console.log('invitation schema checks passed')
