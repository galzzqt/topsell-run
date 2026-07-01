# COMPLETE SYSTEM FLOW - TOPSELL RUN 2026

## 📚 Table of Contents
1. [System Overview](#system-overview)
2. [User Roles](#user-roles)
3. [Complete User Journey](#complete-user-journey)
4. [Admin Flow](#admin-flow)
5. [Technical Architecture](#technical-architecture)
6. [Integration Points](#integration-points)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Testing Guide](#testing-guide)

---

## 🎯 SYSTEM OVERVIEW

### Application Purpose
Platform pendaftaran dan manajemen peserta untuk event **TOPSELL RUN 2026 - 6K Fun Run** di Jakarta Timur (18 Oktober 2026).

### Two Package Types
1. **Community Package** - Pendaftaran grup komunitas (min 5 orang)
2. **Brother & Sister Package** - Pendaftaran keluarga/saudara (flexible jumlah)

### Key Features
- ✅ Online registration with email verification
- ✅ Payment via Xendit (VA/QRIS)
- ✅ QR code generation for race pass
- ✅ Email & WhatsApp notifications
- ✅ Admin dashboard for management
- ✅ User dashboard for tracking
- ✅ Customizable email templates
- ✅ Complete audit logging

---

## 👥 USER ROLES

### 1. Guest User (Visitor)
- View landing page
- Register for Community or Brother & Sister Package
- Cannot access dashboard

### 2. Community Leader
- Manage community profile
- Add/view community members
- Make payment for all members
- View QR codes for members
- Download e-receipt

### 3. Family Leader (Brother & Sister)
- Manage family profile
- Add/view family members
- Make payment for all members
- View QR codes for members
- Download e-receipt

### 4. Admin
- View all registrations (Community + Brother & Sister)
- View all participants
- View all payments
- Manually change payment status
- Customize email templates
- Manage system settings
- View audit logs (via Axiom)

---

## 🚀 COMPLETE USER JOURNEY

### PHASE 1: LANDING & DISCOVERY
**File**: `src/app/page.tsx`

**User Actions**:
1. User visits homepage (https://domain.com)
2. Sees hero section with:
   - Event info: TOPSELL RUN 2026 - 6K Fun Run
   - Date: 18 Oktober 2026
   - Location: Jakarta Timur
   - Price: Rp 149.000 → Rp 135.000 (promo)
3. Views event countdown timer (days, hours, minutes, seconds)
4. Sees package options:
   - **Community Package**: Min 5 orang (grup komunitas)
   - **Brother & Sister Package**: Flexible (keluarga/saudara)

**Navbar Options**:
- If logged in: Shows username + dropdown (Dashboard, Logout)
- If not logged in: Shows "Login Sekarang" button

**Scroll to Registration Form**:
- Click "Daftar Sekarang" → smooth scroll to form
- Form appears in card with gradient header

---

### PHASE 2: REGISTRATION
**File**: `src/app/page.tsx`, `src/app/actions/family-auth.ts`

#### 2A. BROTHER & SISTER PACKAGE REGISTRATION

**Form Fields - Group Info**:
1. Nama Grup/Keluarga (required)
2. Nama Perwakilan/Leader (required)
3. No. WhatsApp Perwakilan (required, unique)
4. Email Perwakilan (required, unique)
5. Kategori: "6K 135.000" (pre-selected)
6. Provinsi (dropdown, loaded from API)
7. Kota/Kabupaten (dropdown, dynamic based on Provinsi)
8. Kecamatan (dropdown, dynamic based on Kota)
9. Password (min 6 chars, required)
10. Konfirmasi Password (must match)

**Form Fields - Participants** (min 1, no max):
For each participant:
1. Nama Lengkap (required)
2. Nama di BIB (required, max 12 chars)
3. Email (required, unique)
4. No. HP/WA (required, unique)
5. Tanggal Lahir (DD/MM/YYYY format)
6. Gender (male/female)
7. Ukuran Jersey (XS/S/M/L/XL/XXL/XXXL)
8. Golongan Darah (A/B/AB/O)
9. Kondisi Medis (optional, textarea)
10. Nama Kontak Darurat (optional)
11. No. Kontak Darurat (optional)

**Buttons**:
- "+ Tambah Anggota" - Add new participant slot
- "🗑️ Hapus" - Remove participant (if more than 1)

**Validation Rules**:
- No. WhatsApp perwakilan unique (cross-check with existing families)
- Email & phone unique per participant
- Participant with active payment (pending/paid) cannot register again
- Cross-check between Community and Brother & Sister packages

**Submit Process**:
```typescript
1. Validate form data (zodResolver)
2. Check duplicate family phone
3. Check duplicate participant email/phone (cross-package)
4. Create family record
5. Save family auth (password hash)
6. Insert family participants
7. **AUTO-CREATE payment record** with status "pending"
8. **AUTO-CREATE registration record**
9. Link participants to registration
10. Generate verification token (32-byte hex)
11. Send verification email
12. **NO auto-login** (must verify email first)
```

**Success Result**:
- Confetti animation plays
- **Popup modal appears** (NOT inline card):
  - ✅ Success icon with pulse animation
  - Email address displayed
  - Prominent verification notice card (amber/orange gradient)
  - "Aktivasi Email Diperlukan" heading
  - 24-hour expiry notice
  - "Login Setelah Aktivasi" button → redirects to /login
  - Helper text about checking spam folder

**Database Records Created**:
```
families:
  - id, name, leader_name, phone, email, category
  - email_verified: false
  - verification_token: "abc123..."
  - verification_token_expires: (24 hours from now)

family_participants:
  - (multiple) id, family_id, full_name, email, phone, etc
  - payment_status: "pending"
  - status: "inactive"

family_registrations:
  - id, family_id, total_participants, total_amount
  - status: "pending"

family_payments:
  - id, registration_id, amount, payment_reference (FAM-XXXXX)
  - status: "pending"
  - checkout_url: null (filled later)
```

**Key Points**:
- ✅ Payment visible in admin dashboard IMMEDIATELY
- ✅ Email verification REQUIRED before login
- ✅ Popup modal more prominent than old inline card
- ✅ Registration complete but inactive until payment

---

### PHASE 3: EMAIL VERIFICATION
**Files**: 
- `src/lib/email/verification.ts`
- `src/app/verify-email/page.tsx`
- `src/app/actions/email-verification.ts`

**Email Content**:
```
Subject: Verifikasi Email - TOPSELL RUN 2026
Body:
  - Selamat! Registrasi berhasil
  - Klik link untuk aktivasi:
    https://domain.com/verify-email?token=abc123...
  - Link berlaku 24 jam
  - Jangan share link ini
```

**User Clicks Link**:
1. Redirects to `/verify-email?token=abc123...`
2. Page validates token:
   - ✅ Token exists?
   - ✅ Token not expired?
   - ✅ Email not already verified?
3. If valid:
   - Updates `email_verified: true`
   - Clears `verification_token`
   - Shows success page with "Login Sekarang" button
4. If invalid:
   - Shows error message
   - Option to resend verification email

**Resend Verification** (from login page):
- Rate limited: 1 email per 2 minutes
- New token generated
- Same 24-hour expiry

**Key Points**:
- ✅ CANNOT login without email verification
- ✅ Token single-use (cleared after verification)
- ✅ Secure: 32-byte cryptographically random hex

---

### PHASE 4: LOGIN & DASHBOARD ACCESS
**Files**:
- `src/app/(auth)/login/page.tsx`
- `src/app/actions/family-auth.ts`

**Login Form**:
1. No. WhatsApp (phone)
2. Password

**Login Process**:
```typescript
1. Validate phone format
2. Find family by phone
3. Check email_verified = true
   - If false: Show error "Email belum diverifikasi"
   - Show "Kirim Ulang Email Verifikasi" button
4. Verify password (bcrypt compare)
5. Create family session (HMAC signed cookie)
6. Redirect to /dashboard
```

**Session Cookie**:
```
Cookie name: topsell_family_session
Value: {id}.{expires}.{signature}
Signature: HMAC-SHA256(id + expires, SESSION_SECRET)
Expires: 7 days
HttpOnly: true
Secure: true (production)
SameSite: Lax
```

**Key Points**:
- ✅ Email verification blocks login
- ✅ Session cryptographically signed
- ✅ 7-day expiry
- ✅ Resend verification from login page

---

### PHASE 5: FAMILY DASHBOARD
**Files**:
- `src/app/dashboard/page.tsx`
- `src/app/actions/family-dashboard.ts`

**Dashboard Layout**:

#### Header
- TOPSELL RUN 2026 logo
- Family name display
- Family code badge (copyable)
- "Daftarkan Anggota" button → scroll to landing page form
- Settings button (profile modal)
- Logout button

#### Stats Cards (Grid 2x2 on mobile, 1x4 on desktop)
1. **Total Anggota**: Count of all participants
2. **Sudah Lunas**: Count of paid participants (green)
3. **Belum Bayar**: Count of pending participants (yellow)
4. **Total Terbayar**: Sum of paid amounts (orange)

#### Event Info Strip
- Event name, date, location
- Category: Bro & Sist Package / 6K
- Price per participant: Rp 135.000

#### Payment Section
- Title: "Pembayaran Bro & Sist Package"
- Subtitle: "Bayar semua anggota sekaligus"
- Total tagihan: {pendingCount} × Rp 135.000 = Rp {total}
- **"Bayar Semua Anggota" button** (primary, orange gradient)
  - Disabled if no pending participants
  - Shows loading state while creating checkout

#### Participants Table
**Tabs**:
- All ({totalCount})
- Pending ({pendingCount})
- Lunas ({paidCount})
- Kadaluarsa ({expiredCount})

**Columns**:
1. # (index)
2. Anggota / BIB:
   - Full name (bold)
   - Email
   - Date of birth
   - BIB name (orange, uppercase)
3. Gender (♂ L / ♀ P) - hidden on mobile
4. Jersey (XS/S/M/L/XL/XXL/XXXL in badge)
5. Medis - hidden on tablet:
   - Blood type
   - Medical condition
   - Emergency contact
6. Status Badge:
   - PAID (green)
   - PENDING (yellow)
   - FAILED (red)
   - EXPIRED (gray)
7. BIB / Pass:
   - "Detail" button for paid participants
   - "—" for pending participants

**Empty State**:
- Icon: Users
- Message: "Belum ada anggota"
- Subtext: "Anggota didaftarkan melalui form registrasi di halaman utama"

#### Payment History (if any payments exist)
**List Items**:
- Status badge (PAID/PENDING/FAILED/EXPIRED)
- Reference: FAM-XXXXX
- Participant count
- Creation date
- Total amount (orange, large)
- "E-Receipt" button (for paid only)

**Auto-Refresh**:
- Fetches data every 15 seconds (while dashboard open)
- Silent background refresh

**Auto-Sync on Load**:
- Checks all pending payments
- Syncs status with Xendit
- Updates UI if status changed

---

### PHASE 6: PAYMENT CHECKOUT
**Files**:
- `src/app/actions/family-payments.ts` (createFamilyPayment)
- `src/app/dashboard/page.tsx`

**User Clicks "Bayar Semua Anggota"**:

#### Step 1: Check Existing Payment
```typescript
1. Find pending registrations for this family
2. Check if payment already exists for those registrations
3. If exists:
   - Reuse existing payment
   - Return existing checkout_url
   - Flag: reusedPendingPayment = true
4. If not exists:
   - Continue to create new payment
```

#### Step 2: Create New Payment (if needed)
```typescript
1. Get all pending participants without registration
2. Calculate total: count × Rp 135.000
3. Generate payment reference: FAM-12345
4. Create registration record
5. Link participants to registration
6. Create payment record
7. Call Xendit Session API
```

#### Step 3: Xendit Session API Call
```typescript
POST https://api.xendit.co/sessions
Authorization: Basic {base64(XENDIT_SECRET_KEY:)}

Body:
{
  reference_id: "FAM12345",
  session_type: "PAY",
  currency: "IDR",
  amount: 675000,
  country: "ID",
  mode: "PAYMENT_LINK",
  capture_method: "AUTOMATIC",
  allowed_payment_channels: [
    "BCA_VIRTUAL_ACCOUNT",
    "BNI_VIRTUAL_ACCOUNT",
    "BRI_VIRTUAL_ACCOUNT",
    "MANDIRI_VIRTUAL_ACCOUNT",
    "PERMATA_VIRTUAL_ACCOUNT",
    "QRIS"
  ],
  description: "TOPSELL RUN 6K Family - 5 peserta",
  customer: {
    reference_id: "family123_FAM12345",
    type: "INDIVIDUAL",
    individual_detail: {
      given_names: "John Doe"
    },
    email: "john@example.com"
  },
  items: [
    {
      reference_id: "participant1",
      type: "DIGITAL_PRODUCT",
      category: "EVENT_TICKET",
      name: "TOPSELL RUN 6K - John Doe",
      quantity: 1,
      net_unit_amount: 135000,
      currency: "IDR"
    },
    // ... more participants
  ],
  success_return_url: "https://domain.com/dashboard?payment=success&ref=FAM12345",
  cancel_return_url: "https://domain.com/dashboard?payment=cancelled&ref=FAM12345"
}
```

**Response**:
```json
{
  "payment_session_id": "sess_abc123...",
  "payment_link_url": "https://checkout.xendit.co/v2/...",
  "status": "PENDING"
}
```

#### Step 4: Update Payment Record
```typescript
await updateFamilyPayment(payment.id, {
  payment_method: null, // filled later when paid
  provider: "xendit",
  xendit_session_id: "sess_abc123...",
  checkout_url: "https://checkout.xendit.co/v2/...",
  snap_token: "https://checkout.xendit.co/v2/..." // same as checkout_url
})
```

#### Step 5: Log to Axiom
```typescript
await ingestAdminLog({
  level: 'info',
  source: 'payment',
  event: 'family_payment_created',
  message: "Invoice checkout pendaftaran Bro & Sist Package dibuat: ...",
  data: {
    familyId, paymentId, reference, amount, participantCount
  }
})
```

#### Step 6: Show Checkout Modal
Modal appears with:
- Title: "Pembayaran Bro & Sist Package"
- Payment reference: FAM-12345
- Amount breakdown: {count} anggota × Rp 135.000 = Rp {total}
- Payment methods: Virtual Account (BCA/BNI/BRI/Mandiri/Permata), QRIS
- "Buka Checkout Xendit" button (primary, orange)
- Note: "Setelah membuka checkout, status pembayaran akan dicek otomatis"

**Demo Mode** (if XENDIT_SECRET_KEY not configured):
- Skips Xendit API call
- Generates demo session ID: `demo-xendit-session-xxx`
- Shows "Simulasi Pembayaran" button instead
- When clicked, marks payment as paid immediately (for testing)

---

### PHASE 7: USER PAYMENT PROCESS
**Files**: `src/app/dashboard/page.tsx`

#### User Clicks "Buka Checkout Xendit"
```typescript
1. Opens checkout_url in new tab/window
2. Sets hasOpenedCheckout = true
3. Starts auto-polling (every 5 seconds)
4. Shows message in modal:
   "Menunggu pembayaran selesai. Status akan dicek otomatis setiap beberapa detik."
```

#### New Tab Opens (Xendit Checkout Page)
User sees:
- Payment amount
- Available methods:
  - **Virtual Account**: BCA, BNI, BRI, Mandiri, Permata
  - **QRIS**: Scan QR code
- Instructions for each method
- Payment deadline (24 hours)

#### User Selects Payment Method
Example: BCA Virtual Account
1. User clicks "BCA Virtual Account"
2. Xendit generates VA number: 12345678901234
3. User copies VA number
4. User opens BCA mobile/internet banking
5. User transfers to VA number
6. Payment processed by Xendit

#### Auto-Polling (Every 5 Seconds)
```typescript
useEffect(() => {
  if (!checkoutPayload || !hasOpenedCheckout) return
  
  const intervalId = setInterval(async () => {
    // Call syncXenditFamilyPaymentStatus silently
    const isPaid = await refreshPaymentStatus(true)
    
    if (isPaid) {
      // Stop polling
      // Trigger confetti
      // Close modal
      // Show success
    }
  }, 5000)
  
  return () => clearInterval(intervalId)
}, [checkoutPayload, hasOpenedCheckout])
```

#### Manual Status Check
Modal also shows button:
- "Cek Status Pembayaran" (secondary button)
- When clicked:
  - Shows loading state
  - Calls `syncXenditFamilyPaymentStatus(reference)`
  - Shows result message
  - Updates UI if status changed

---

### PHASE 8: WEBHOOK CALLBACK (SERVER-SIDE)
**Files**: `src/app/api/xendit/webhook/route.ts`

#### Xendit Sends Webhook
When payment status changes, Xendit sends POST request:
```
POST https://domain.com/api/xendit/webhook
Headers:
  x-callback-token: {XENDIT_CALLBACK_TOKEN}
  content-type: application/json

Body:
{
  event: "payment_session.completed",
  data: {
    payment_session_id: "sess_abc123...",
    reference_id: "FAM12345",
    status: "SUCCEEDED",
    payment_method: {
      type: "VIRTUAL_ACCOUNT",
      virtual_account: {
        channel_code: "BCA"
      }
    }
  }
}
```

#### Server Validates Request
```typescript
1. Check x-callback-token header
   - If mismatch: Return 401 Unauthorized
2. Parse JSON payload
   - If invalid: Return 400 Bad Request
3. Check payload size (max 64KB)
   - If too large: Return 413 Payload Too Large
```

#### Server Processes Webhook
**For PAID Status** (SUCCEEDED/COMPLETED/PAID):
```typescript
1. Extract reference_id: "FAM12345"
2. Extract xendit_session_id: "sess_abc123..."
3. Find payment in database by reference or session ID
4. Update payment:
   - status: "paid"
   - paid_at: current timestamp
   - payment_method: "BCA_VA" (or QRIS, etc)
5. Trigger POST-PAYMENT FLOW ⚡
6. Log to Axiom
7. Return 200 OK
```

**For FAILED Status**:
```typescript
1. Find payment by reference/session
2. Update payment status: "failed"
3. Log to Axiom (warning level)
4. Return 200 OK
```

**For EXPIRED Status**:
```typescript
1. Find payment by reference/session
2. Update payment status: "expired"
3. Log to Axiom (warning level)
4. Return 200 OK
```

---

### PHASE 9: POST-PAYMENT FLOW ⚡
**Files**:
- `src/lib/db/family-payments.ts` (markFamilyPaymentPaid)
- `src/lib/email/racepack.ts`
- `src/lib/whatsapp/racepack.ts`

**Triggered by**:
- Xendit webhook (status = paid)
- Manual sync (status = paid)
- Admin manual status change (to paid)

#### Step 1: Generate Participant Codes
```typescript
for each participant in registration:
  // Get next sequence number
  const sequence = await getNextParticipantSequence()
  
  // Format: TSR-6K-001, TSR-6K-002, ...
  participant_code = `TSR-6K-${sequence.toString().padStart(3, '0')}`
```

#### Step 2: Generate QR Codes
```typescript
for each participant:
  // QR data format: {participantId}|{fullName}|{bibName}
  qr_code_data = `${participant.id}|${participant.full_name}|${participant.bib_name}`
  
  // Store in database (NOT generated as image)
  await updateParticipant(participant.id, {
    qr_code_data,
    qr_code_generated_at: new Date()
  })
```

**Note**: QR codes stored as text, generated on-demand for display

#### Step 3: Activate Participants
```typescript
for each participant in registration:
  await updateParticipant(participant.id, {
    status: 'active',
    payment_status: 'paid',
    participant_code: 'TSR-6K-XXX',
    qr_code_data: '...',
    qr_code_generated_at: new Date()
  })
```

#### Step 4: Send Racepack Email 📧
**File**: `src/lib/email/racepack.ts`

**Email Template** (customizable by admin):
```
Subject: QR Race Pass TOPSELL RUN 2026 - {familyName}

Greeting: {customizable}

Body Intro: {customizable}
- Variables: {communityName}, {familyName}, {leaderName}, {participantCount}

Participant Table:
┌────────────────────────────────────────────┐
│ No │ Nama Lengkap │ BIB Name │ Kode       │
├────────────────────────────────────────────┤
│ 1  │ John Doe     │ JOHN     │ TSR-6K-001 │
│ 2  │ Jane Doe     │ JANE     │ TSR-6K-002 │
└────────────────────────────────────────────┘

Body Outro: {customizable}

Footer:
- QR codes dapat diakses melalui dashboard
- Terima kasih telah mendaftar
- TOPSELL RUN 2026 Team

Attachments: NONE (QR codes accessible via dashboard only)
```

**SMTP Settings** (from .env):
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
SMTP_FROM=TOPSELL RUN <no-reply@topsellrun.com>
```

**Key Changes**:
- ❌ NO QR code attachments (removed for better deliverability)
- ✅ QR codes accessible via dashboard
- ✅ Customizable templates with variables
- ✅ HTML formatted table

#### Step 5: Send WhatsApp Notification 📱
**File**: `src/lib/whatsapp/racepack.ts`

**GHL Webhook Call**:
```typescript
POST {GHL_QR_WEBHOOK_URL}
Headers:
  Authorization: Bearer {GHL_QR_WEBHOOK_TOKEN}
  Content-Type: application/json

Body:
{
  packageType: "family",
  packageName: "Brother & Sister Package",
  familyName: "Keluarga Doe",
  leaderName: "John Doe",
  leaderPhone: "081234567890",
  participantCount: 5,
  totalAmount: 675000,
  paymentReference: "FAM12345",
  eventName: "TOPSELL RUN 2026 - 6K Fun Run",
  eventDate: "18 Oktober 2026",
  eventLocation: "Jakarta Timur",
  participants: [
    {
      fullName: "John Doe",
      bibName: "JOHN",
      participantCode: "TSR-6K-001",
      email: "john@example.com",
      phone: "081234567890"
    },
    // ... more participants
  ]
}
```

**GHL Automation**:
- Receives webhook payload
- Sends WhatsApp message to leader
- Message includes:
  - Success confirmation
  - Participant count
  - Dashboard link
  - Event details

**Environment Variables**:
```
GHL_QR_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/...
GHL_QR_WEBHOOK_TOKEN=optional_bearer_token
```

#### Step 6: Log to Axiom 📊
```typescript
await ingestAdminLog({
  level: 'info',
  source: 'payment',
  event: 'family_payment_webhook_paid', // or synced_paid, admin_paid
  message: "Pembayaran Bro & Sist Package sukses via webhook",
  data: {
    paymentId,
    reference: "FAM12345",
    amount: 675000,
    participantCount: 5,
    paymentMethod: "BCA_VA"
  }
})
```

**Axiom Dataset**: Configured via `AXIOM_DATASET` env var

#### Step 7: Return Success
- Email sent ✅
- WhatsApp sent ✅
- Codes generated ✅
- QR codes stored ✅
- Participants activated ✅
- Logged to Axiom ✅

---

### PHASE 10: DASHBOARD UPDATE (CLIENT-SIDE)
**File**: `src/app/dashboard/page.tsx`

#### Auto-Polling Detects Payment
```typescript
// Polling checks every 5 seconds
const isPaid = await syncXenditFamilyPaymentStatus(reference)

if (isPaid) {
  // Trigger celebration
  confetti({
    particleCount: 160,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['#ff2a44', '#ff6a00', '#ffffff']
  })
  
  // Track Meta Pixel
  trackMetaPixelPurchase(amount, 'IDR', {
    content_ids: [reference],
    content_type: 'product',
    num_items: participantCount
  })
  
  // Refresh dashboard data
  await fetchFamilyData(true)
  
  // Close modal
  setCheckoutPayload(null)
  setHasCelebratedPayment(true)
}
```

#### Dashboard Updates Show
- Stats cards updated:
  - Sudah Lunas: +5
  - Belum Bayar: -5
  - Total Terbayar: +Rp 675.000
- Participant table:
  - Status badges change: PENDING → PAID (green)
  - "Detail" button now available
- Payment history:
  - New paid payment appears
  - "E-Receipt" button available

#### Return URL Flow (Alternative)
If user returns via Xendit success_return_url:
```
URL: https://domain.com/dashboard?payment=success&ref=FAM12345

1. Dashboard detects ?payment=success query param
2. Starts polling (every 2 seconds, max 12 attempts = 24 seconds)
3. Each poll:
   - Syncs payment status
   - Checks if paid
   - If paid: confetti + celebration
   - If not yet: continue polling
4. After 12 attempts or paid:
   - Remove query params
   - Show normal dashboard
```

---

### PHASE 11: VIEW QR CODES & DETAILS
**File**: `src/app/dashboard/page.tsx`, `src/components/dashboard/ParticipantDetailModal.tsx`

#### User Clicks "Detail" Button (Paid Participant)
Modal opens showing:

**Header**:
- Title: "Detail Peserta"
- Close button (X)

**QR Code Section**:
- Large QR code (generated on-demand from qr_code_data)
- Participant code below: TSR-6K-XXX
- "Download QR" button (saves as PNG)

**Participant Information**:
- Full Name: John Doe
- BIB Name: JOHN
- Email: john@example.com
- Phone: 081234567890
- Date of Birth: 15/08/1990
- Gender: Male
- Jersey Size: L
- Blood Type: A
- Medical Condition: None
- Emergency Contact: Jane Doe (081298765432)

**Event Information**:
- Event: TOPSELL RUN 2026 - 6K Fun Run
- Date: 18 Oktober 2026
- Location: Jakarta Timur
- Status: PAID (green badge)

**Actions**:
- "Download QR" - Downloads QR as PNG image
- "Close" - Closes modal

---

### PHASE 12: DOWNLOAD E-RECEIPT
**File**: `src/components/dashboard/EReceiptModal.tsx`

#### User Clicks "E-Receipt" (Paid Payment)
Modal opens showing:

**Receipt Header**:
- TOPSELL RUN 2026 logo
- Title: "BUKTI PEMBAYARAN"
- Subtitle: "E-Receipt / Invoice Digital"

**Payment Information**:
- Payment Reference: FAM12345
- Payment Date: 15 Juni 2026, 14:30 WIB
- Payment Method: BCA Virtual Account
- Status: PAID (green badge)

**Payer Information**:
- Package Type: Brother & Sister Package
- Family Name: Keluarga Doe
- Leader Name: John Doe
- Email: john@example.com
- Phone: 081234567890

**Participants Table**:
```
┌──────────────────────────────────────────────────────┐
│ No │ Nama Lengkap │ BIB Name │ Kode       │ Harga   │
├──────────────────────────────────────────────────────┤
│ 1  │ John Doe     │ JOHN     │ TSR-6K-001 │ 135.000 │
│ 2  │ Jane Doe     │ JANE     │ TSR-6K-002 │ 135.000 │
│ 3  │ Jimmy Doe    │ JIMMY    │ TSR-6K-003 │ 135.000 │
│ 4  │ Jenny Doe    │ JENNY    │ TSR-6K-004 │ 135.000 │
│ 5  │ Jack Doe     │ JACK     │ TSR-6K-005 │ 135.000 │
├──────────────────────────────────────────────────────┤
│                    TOTAL           │ Rp    675.000   │
└──────────────────────────────────────────────────────┘
```

**Event Details**:
- Event Name: TOPSELL RUN 2026 - 6K Fun Run
- Event Date: 18 Oktober 2026
- Location: Jakarta Timur
- Category: 6K Fun Run

**Footer**:
- "Bukti pembayaran ini sah dan tidak perlu tanda tangan"
- "QR Race Pass dapat diakses melalui dashboard"
- Support contact info

**Actions**:
- "Print Receipt" - Opens browser print dialog
- "Download PDF" - (future: generates PDF)
- "Close" - Closes modal

---

## 🔧 ADMIN FLOW

### ADMIN LOGIN
**File**: `src/app/admin/page.tsx`, `src/app/admin/ui/AdminLogin.tsx`

**Access**:
- URL: https://domain.com/admin
- No separate login page (modal on same page)

**Login Process**:
```typescript
1. Admin enters username + password
2. System checks against ADMIN_CREDENTIALS env var:
   Format: "username:password,username2:password2"
3. If valid:
   - Create admin session (cookie)
   - Show admin dashboard
4. If invalid:
   - Show error message
   - Stay on login form
```

**Admin Session Cookie**:
```
Cookie name: topsell_admin_session
Value: {username}.{expires}.{signature}
Expires: 7 days
HttpOnly: true
Secure: true (production)
```

---

### ADMIN DASHBOARD
**File**: `src/app/admin/ui/AdminDashboardClient.tsx`

#### Header
- TOPSELL RUN 2026 logo
- Admin username display
- Logout button

#### Tabs
1. **Dashboard** - Overview stats
2. **Peserta** - All participants (Community + Brother & Sister)
3. **Pembayaran** - All payments
4. **Settings** - System settings

---

### TAB 1: DASHBOARD (Overview)
**Stats Cards** (Grid 2x3):
1. Total Komunitas: Count of communities
2. Total Brother & Sister: Count of families
3. Total Peserta: Sum of all participants
4. Peserta Lunas: Count of paid participants
5. Peserta Pending: Count of pending participants
6. Total Pendapatan: Sum of paid amounts

**Recent Activities** (if implemented):
- Latest registrations
- Latest payments
- Recent status changes

---

### TAB 2: PESERTA (Participants)
**Sub-tabs**:
- Community Package
- Brother & Sister Package

#### Community Package Tab
**Table Columns**:
1. # (index)
2. Nama Komunitas
3. Leader
4. Email
5. Total Anggota
6. Status Payment
7. Actions: "Lihat Detail" button

#### Brother & Sister Package Tab
**Table Columns**:
1. # (index)
2. Nama Keluarga
3. Leader
4. Email
5. Total Anggota
6. Status Payment
7. Actions: "Lihat Detail" button

**Filters**:
- Search by name/email
- Filter by status (All/Paid/Pending/Expired)
- Sort by date (newest/oldest)

**Detail Modal** (when clicking "Lihat Detail"):
- Group/family information
- List of all participants with details
- Payment history
- QR codes (if paid)

---

### TAB 3: PEMBAYARAN (Payments)
**Sub-tabs**:
- Community Package
- Brother & Sister Package

#### Payment Table Columns
1. # (index)
2. Reference (FAM-XXXXX or COM-XXXXX)
3. Nama Grup/Keluarga
4. Jumlah Anggota
5. Total Amount
6. Status (Dropdown - **EDITABLE**) ⚠️
7. Payment Method
8. Tanggal
9. Aksi: Save/Cancel buttons (when changed)

#### Status Dropdown Options
- **Pending** (yellow)
- **Paid** (green)
- **Failed** (red)
- **Expired** (gray)

#### Admin Changes Status Flow
```typescript
1. Admin clicks status dropdown
2. Selects new status (e.g., pending → paid)
3. Row highlights YELLOW (pending save)
4. Save and Cancel buttons appear in "Aksi" column
5. Admin clicks "Save"
6. Confirmation dialog appears:
   "Mengubah status menjadi PAID akan:
   - Generate kode peserta (TSR-6K-XXX)
   - Generate QR codes
   - Mengirim email racepack
   - Mengirim notifikasi WhatsApp
   Lanjutkan?"
7. Admin clicks "Konfirmasi"
8. System triggers POST-PAYMENT FLOW ⚡
9. Status updates in database
10. Row no longer yellow
11. Success message appears
12. Log to Axiom with admin actor
```

**Cancel Button**:
- Resets status to original value
- Removes yellow highlight
- No API call made

**Multiple Changes**:
- Admin can change multiple payment statuses
- All show yellow highlights
- Save each individually
- Or cancel each individually

**Audit Log** (in Axiom):
```typescript
{
  level: 'info',
  source: 'admin',
  event: 'admin_payment_status_updated',
  message: "Admin mengubah status payment FAM12345: pending → paid",
  data: {
    adminId: "admin_username",
    paymentId: "...",
    reference: "FAM12345",
    oldStatus: "pending",
    newStatus: "paid",
    timestamp: "2026-06-15T14:30:00Z"
  }
}
```

**Key Points**:
- ✅ Save button required (no immediate save)
- ✅ Yellow highlight for pending changes
- ✅ Confirmation dialog for destructive actions
- ✅ Triggers same flow as webhook
- ✅ Full audit trail

---

### TAB 4: SETTINGS

#### Section 1: Event Settings
**Fields**:
- Event Name (readonly: TOPSELL RUN 2026 - 6K Fun Run)
- Event Date (readonly: 18 Oktober 2026)
- Event Location (readonly: Jakarta Timur)
- Price per Participant (readonly: Rp 135.000)

#### Section 2: Registration Form Settings
**Fields**:
- Registration Open (toggle: enabled/disabled)
- Max Participants per Community (number, default: unlimited)
- Max Participants per Family (number, default: unlimited)
- Required Fields Configuration:
  - Date of Birth (toggle)
  - Blood Type (toggle)
  - Medical Condition (toggle)
  - Emergency Contact (toggle)

#### Section 3: Email Template Settings
**Info Box**:
```
Variabel yang tersedia:
- {communityName} - Nama komunitas
- {familyName} - Nama keluarga
- {leaderName} - Nama leader/perwakilan
- {participantCount} - Jumlah peserta
```

**Community Package Email Template**:
- Subject Line (text input)
  - Default: "QR Race Pass TOPSELL RUN 2026 - {communityName}"
- Greeting (textarea)
  - Default: "Halo {leaderName},"
- Body Intro (textarea)
  - Default: "Terima kasih telah mendaftar..."
- Body Outro (textarea)
  - Default: "Sampai jumpa di event!"

**Brother & Sister Package Email Template**:
- Subject Line (text input)
  - Default: "QR Race Pass TOPSELL RUN 2026 - {familyName}"
- Greeting (textarea)
  - Default: "Halo {leaderName},"
- Body Intro (textarea)
  - Default: "Terima kasih telah mendaftar..."
- Body Outro (textarea)
  - Default: "Sampai jumpa di event!"

**Save Button**:
- "Simpan Template Email" (primary button)
- Saves to MongoDB settings collection
- Success message on save
- Changes take effect immediately

#### Section 4: Webhook Settings
**Fields** (read-only, managed via .env):
- GHL Registration Webhook URL
- GHL Registration Webhook Token
- GHL QR Webhook URL
- GHL QR Webhook Token

**Info Text**:
"Webhook URLs dikonfigurasi melalui environment variables (.env file)"

#### Section 5: Payment Settings
**Fields** (read-only, managed via .env):
- Xendit Secret Key (masked: xnd_***...***123)
- Xendit Callback Token (masked)
- Allowed Payment Channels:
  - BCA Virtual Account ✅
  - BNI Virtual Account ✅
  - BRI Virtual Account ✅
  - Mandiri Virtual Account ✅
  - Permata Virtual Account ✅
  - QRIS ✅

**Info Text**:
"Payment settings dikonfigurasi melalui environment variables (.env file)"

---

## 🏗️ TECHNICAL ARCHITECTURE

### Tech Stack
- **Framework**: Next.js 16.2.6 (React, TypeScript)
- **Styling**: Tailwind CSS
- **Database**: MongoDB
- **Authentication**: Custom session (HMAC signed cookies)
- **Payment**: Xendit API (Virtual Account, QRIS)
- **Email**: Nodemailer (SMTP)
- **WhatsApp**: GHL (GoHighLevel) Webhooks
- **Logging**: Axiom
- **Analytics**: Meta Pixel
- **Deployment**: Vercel / Custom Server

### Project Structure
```
src/
├── app/
│   ├── (auth)/              # Auth routes (login, register)
│   ├── admin/               # Admin dashboard
│   ├── api/                 # API routes
│   │   ├── location/        # Location API (provinsi, kota, kecamatan)
│   │   ├── settings/        # Settings API
│   │   └── xendit/webhook/  # Xendit webhook handler
│   ├── dashboard/           # User dashboard (family)
│   ├── community-dashboard/ # User dashboard (community)
│   ├── verify-email/        # Email verification page
│   ├── actions/             # Server actions
│   │   ├── family-auth.ts
│   │   ├── family-payments.ts
│   │   ├── family-dashboard.ts
│   │   ├── email-verification.ts
│   │   └── ...
│   ├── page.tsx             # Landing page
│   └── layout.tsx           # Root layout
├── components/
│   ├── ui/                  # UI components (Button, Input, Dialog, etc)
│   └── dashboard/           # Dashboard components (modals, cards)
├── lib/
│   ├── auth/                # Authentication logic
│   │   ├── family-session.ts
│   │   ├── community-session.ts
│   │   ├── admin-session.ts
│   │   └── password.ts
│   ├── db/                  # Database operations
│   │   ├── families.ts
│   │   ├── family-participants.ts
│   │   ├── family-payments.ts
│   │   ├── communities.ts
│   │   ├── participants.ts
│   │   └── payments.ts
│   ├── email/               # Email services
│   │   ├── racepack.ts
│   │   ├── verification.ts
│   │   └── receipt.ts
│   ├── whatsapp/            # WhatsApp services
│   │   └── racepack.ts
│   ├── ghl/                 # GoHighLevel webhooks
│   │   └── webhook.ts
│   ├── utils/               # Utility functions
│   │   ├── format.ts
│   │   ├── location.ts
│   │   └── xendit.ts
│   ├── validations/         # Zod schemas
│   │   └── auth.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   └── mongodb/             # MongoDB client
│       └── client.ts
└── public/                  # Static assets
```

### Database Collections

#### families
```typescript
{
  id: string (UUID)
  name: string
  leader_name: string
  phone: string (unique)
  email: string (unique)
  category: string
  provinsi: string
  kota: string
  kecamatan: string
  family_code: string (unique, e.g., "FAM-ABC123")
  email_verified: boolean
  verification_token: string | null
  verification_token_expires: Date | null
  verification_sent_at: Date | null
  created_at: Date
  updated_at: Date
}
```

#### family_participants
```typescript
{
  id: string (UUID)
  family_id: string (FK → families.id)
  registration_id: string | null (FK → family_registrations.id)
  full_name: string
  bib_name: string
  email: string (unique)
  phone: string (unique)
  date_of_birth: string (DD/MM/YYYY)
  gender: 'male' | 'female'
  tshirt_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL'
  blood_type: 'A' | 'B' | 'AB' | 'O'
  medical_condition: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  participant_code: string | null (e.g., "TSR-6K-001")
  qr_code_data: string | null
  qr_code_generated_at: Date | null
  status: 'inactive' | 'active'
  payment_status: 'pending' | 'paid' | 'failed' | 'expired'
  created_at: Date
  updated_at: Date
}
```

#### family_registrations
```typescript
{
  id: string (UUID)
  family_id: string (FK → families.id)
  total_participants: number
  total_amount: number
  status: 'pending' | 'completed' | 'cancelled'
  created_at: Date
  updated_at: Date
}
```

#### family_payments
```typescript
{
  id: string (UUID)
  registration_id: string (FK → family_registrations.id)
  amount: number
  payment_reference: string (unique, e.g., "FAM-12345")
  payment_method: string | null (e.g., "BCA_VA", "QRIS")
  provider: string | null (e.g., "xendit")
  xendit_session_id: string | null
  checkout_url: string | null
  snap_token: string | null
  status: 'pending' | 'paid' | 'failed' | 'expired'
  paid_at: Date | null
  created_at: Date
  updated_at: Date
}
```

#### family_auth
```typescript
{
  family_id: string (FK → families.id)
  phone: string (unique)
  password_hash: string
  password_salt: string
  created_at: Date
  updated_at: Date
}
```

#### communities
```typescript
{
  id: string (UUID)
  name: string
  leader_name: string
  phone: string (unique)
  email: string (unique)
  category: string
  provinsi: string
  kota: string
  kecamatan: string
  community_code: string (unique)
  email_verified: boolean
  verification_token: string | null
  verification_token_expires: Date | null
  created_at: Date
  updated_at: Date
}
```

#### participants (community)
Similar structure to family_participants but with community_id

#### registrations (community)
Similar structure to family_registrations but with community_id

#### payments (community)
Similar structure to family_payments

#### admin_settings
```typescript
{
  id: string
  registration_form_settings: {
    require_date_of_birth: boolean
    require_blood_type: boolean
    require_medical_condition: boolean
    require_emergency_contact: boolean
  }
  email_template_settings: {
    community: {
      subject: string
      greeting: string
      bodyIntro: string
      bodyOutro: string
    }
    family: {
      subject: string
      greeting: string
      bodyIntro: string
      bodyOutro: string
    }
  }
  updated_at: Date
  updated_by: string
}
```

---

## 🔌 INTEGRATION POINTS

### 1. Xendit Payment Gateway
**Endpoints Used**:
- `POST /sessions` - Create payment session
- `GET /sessions/{id}` - Get session status
- `GET /payment_requests/{id}` - Get payment details
- Webhook: `POST /api/xendit/webhook` - Receive callbacks

**Authentication**: Basic Auth (base64(XENDIT_SECRET_KEY:))

**Payment Flow**:
