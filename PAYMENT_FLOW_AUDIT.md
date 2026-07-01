# Payment Flow Audit - TOPSELL RUN 2026

## Overview
Comprehensive audit of the payment flow for Brother & Sister Package (Family) registration.

---

## 🔄 COMPLETE PAYMENT FLOW

### 1. REGISTRATION PHASE
**File**: `src/app/actions/family-auth.ts` (signUpFamily function)

**Process**:
1. User submits registration form on landing page
2. System creates family record in database
3. **AUTO-CREATE**: Payment record auto-created with status `pending`
   ```typescript
   // Auto-create registration
   const registration = await createFamilyRegistration({
     family_id: family.id,
     total_participants: values.participants.length,
     total_amount: totalAmount,
     status: 'pending',
   })
   
   // Auto-create payment
   const payment = await createFamilyPayment({
     registration_id: registration.id,
     amount: totalAmount,
     payment_reference: paymentRef,
     status: 'pending',
   })
   ```
4. System sends verification email (no auto-login)
5. **Result**: Payment visible in admin dashboard immediately with status `pending`

**Key Points**:
- ✅ Payment created during registration
- ✅ Status: `pending`
- ✅ Reference format: `FAM-XXXXX`
- ✅ Visible in admin dashboard immediately

---

### 2. EMAIL VERIFICATION PHASE
**Files**: 
- `src/app/verify-email/page.tsx`
- `src/app/actions/email-verification.ts`

**Process**:
1. User receives verification email with 24-hour token
2. User clicks link to verify email
3. System validates token and marks email as verified
4. User can now login to dashboard

**Key Points**:
- ✅ Email must be verified before login
- ✅ Token expires in 24 hours
- ✅ Resend available from login page (rate-limited: 1 per 2 minutes)

---

### 3. CHECKOUT CREATION PHASE
**File**: `src/app/actions/family-payments.ts` (createFamilyPayment function)

**Trigger**: User clicks "Bayar Semua Anggota" button on dashboard

**Process**:
1. **Check existing pending payments**:
   ```typescript
   const existingPayment = await findPendingFamilyPaymentByRegistrationIds(...)
   if (existingPayment) {
     return { 
       reusedPendingPayment: true,
       checkoutUrl: existingPayment.checkout_url
     }
   }
   ```
2. **If no existing payment**, creates new one:
   - Create registration record
   - Link participants to registration
   - Create payment record with reference `FAM-XXXXX`
   - Call Xendit Session API to generate checkout URL

3. **Xendit Session Creation**:
   ```typescript
   POST https://api.xendit.co/sessions
   {
     reference_id: "FAM-XXXXX",
     session_type: "PAY",
     currency: "IDR",
     amount: totalAmount,
     allowed_payment_channels: ["BCA_VA", "BNI_VA", "QRIS", ...],
     customer: { ... },
     items: [...participants],
     success_return_url: "https://domain.com/dashboard?payment=success&ref=FAM-XXXXX",
     cancel_return_url: "https://domain.com/dashboard?payment=cancelled&ref=FAM-XXXXX"
   }
   ```

4. **Store Xendit data**:
   - `checkout_url` (payment link)
   - `xendit_session_id`
   - `provider`: "xendit"

5. **Log to Axiom**:
   ```typescript
   event: 'family_payment_created'
   message: "Invoice checkout pendaftaran Bro & Sist Package dibuat"
   ```

**Result**: Modal opens with checkout URL button

**Key Points**:
- ✅ Reuses existing pending payment if available
- ✅ Creates Xendit session with VA/QRIS channels
- ✅ Stores checkout URL for user access
- ✅ All actions logged to Axiom
- ✅ Demo mode available if `XENDIT_SECRET_KEY` not configured

---

### 4. USER PAYMENT PHASE
**File**: `src/app/dashboard/page.tsx`

**Process**:
1. Modal displays checkout information:
   - Amount: `{participantCount} x Rp {price} = Rp {total}`
   - Reference: `FAM-XXXXX`
   - Button: "Buka Checkout Xendit"

2. User clicks "Buka Checkout Xendit":
   - Opens Xendit payment page in new tab
   - Starts auto-polling every 5 seconds
   - Shows message: "Menunggu pembayaran selesai. Status akan dicek otomatis..."

3. User completes payment on Xendit (VA/QRIS/etc)

**Auto-Polling**:
```typescript
useEffect(() => {
  if (!checkoutPayload || !hasOpenedCheckout) return
  
  const intervalId = setInterval(async () => {
    await refreshPaymentStatus(true) // silent polling
  }, 5000)
  
  return () => clearInterval(intervalId)
}, [checkoutPayload, hasOpenedCheckout])
```

**Key Points**:
- ✅ Auto-polls Xendit API every 5 seconds after checkout opened
- ✅ Silent polling (no UI feedback)
- ✅ Stops polling when payment confirmed or modal closed

---

### 5. WEBHOOK CALLBACK PHASE
**File**: `src/app/api/xendit/webhook/route.ts`

**Trigger**: Xendit sends webhook when payment status changes

**Security Check**:
```typescript
const incomingToken = request.headers.get('x-callback-token')
if (callbackToken && incomingToken !== callbackToken) {
  return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 })
}
```

**Process**:

#### A. PAID Status
1. Webhook receives event: `payment_session.completed` or status `SUCCEEDED/COMPLETED/PAID`
2. Extracts reference candidates:
   - `payment_reference` (FAM-XXXXX)
   - `xendit_session_id`
3. Finds matching payment in database
4. Marks payment as `paid`:
   ```typescript
   await markFamilyPaymentsPaidByReference(referenceId, {
     paid_at: new Date().toISOString(),
     payment_method: 'BCA_VA' // or QRIS, etc
   })
   ```
5. **Triggers post-payment actions**:
   - ✅ Generate participant codes (TSR-6K-XXX)
   - ✅ Generate QR codes
   - ✅ Activate all participants
   - ✅ Send racepack email (NO QR attachments, just confirmation)
   - ✅ Send WhatsApp notification via GHL webhook
6. Log to Axiom:
   ```typescript
   event: 'family_payment_webhook_paid'
   message: "Pembayaran Bro & Sist Package sukses via webhook"
   ```

#### B. FAILED Status
1. Webhook receives status `FAILED`
2. Marks payment as `failed`
3. Log to Axiom with warning level

#### C. EXPIRED Status
1. Webhook receives status `EXPIRED`
2. Marks payment as `expired`
3. Log to Axiom with warning level

**Key Points**:
- ✅ Token validation for security
- ✅ Handles multiple reference formats
- ✅ Triggers full email + WhatsApp flow for paid status
- ✅ All status changes logged to Axiom

---

### 6. MANUAL SYNC PHASE
**File**: `src/app/actions/family-payments.ts` (syncXenditFamilyPaymentStatus function)

**Trigger**: 
- Auto-polling (every 5 seconds while checkout open)
- User clicks "Cek Status Pembayaran" button
- Auto-sync on dashboard load (for any pending payments)

**Process**:
1. Fetches payment by reference from database
2. Calls Xendit Session API:
   ```typescript
   GET https://api.xendit.co/sessions/{xenditSessionId}
   Authorization: Basic {base64(XENDIT_SECRET_KEY:)}
   ```
3. Checks status from response:
   - `SUCCEEDED/COMPLETED/PAID` → mark as paid
   - `EXPIRED` → mark as expired
   - `FAILED` → mark as failed
   - Other → return status without changing DB

4. If paid, triggers same flow as webhook:
   - ✅ Generate codes & QR
   - ✅ Send emails
   - ✅ Send WhatsApp
   - ✅ Log to Axiom

**Key Points**:
- ✅ Fallback if webhook fails or delayed
- ✅ Can be called multiple times safely (idempotent)
- ✅ Triggers same post-payment flow as webhook
- ✅ Used by both auto-polling and manual refresh

---

### 7. ADMIN MANUAL STATUS CHANGE
**File**: `src/app/admin/actions.ts` (updateAdminPaymentStatus function)

**Trigger**: Admin changes payment status in admin dashboard

**Process**:
1. Admin selects payment from dropdown
2. Admin clicks "Save" button
3. System validates status change
4. If changing to `paid`:
   - **Confirmation dialog** shows: "Mengubah status menjadi paid akan generate kode peserta, QR code, dan mengirim email + WhatsApp. Lanjutkan?"
5. If confirmed:
   - Updates payment status
   - Triggers full post-payment flow (same as webhook)
6. Log to Axiom:
   ```typescript
   event: 'admin_payment_status_updated'
   actor: {adminId}
   oldStatus: "pending"
   newStatus: "paid"
   ```

**Key Points**:
- ✅ Save button required before commit
- ✅ Yellow highlight for pending changes
- ✅ Confirmation dialog for `paid` status
- ✅ Triggers same flow as webhook (email + WhatsApp)
- ✅ Full audit trail in Axiom

---

## 🎯 POST-PAYMENT ACTIONS (Triggered by all paid flows)

**Files**:
- `src/lib/db/family-payments.ts` (markFamilyPaymentPaid)
- `src/lib/email/racepack.ts` (sendFamilyRacepackEmailsForRegistration)
- `src/lib/whatsapp/racepack.ts` (sendFamilyRacepackWhatsappsForRegistration)

**Actions**:
1. **Generate Participant Codes**:
   ```typescript
   participant_code: "TSR-6K-001", "TSR-6K-002", ...
   ```

2. **Generate QR Codes**:
   ```typescript
   qr_code_data: "{participantId}|{fullName}|{bibName}"
   qr_code_generated_at: new Date()
   ```

3. **Update Participant Status**:
   ```typescript
   status: 'active'
   payment_status: 'paid'
   ```

4. **Send Racepack Email**:
   - Subject: `QR Race Pass TOPSELL RUN 2026 - {familyName}`
   - Body: Customizable template with variables
   - Content: Payment confirmation, participant list with BIB numbers
   - **NO QR CODE ATTACHMENTS** (accessible via dashboard only)

5. **Send WhatsApp via GHL**:
   ```typescript
   POST {GHL_QR_WEBHOOK_URL}
   {
     packageName: "Brother & Sister Package",
     familyName: "...",
     leaderName: "...",
     participantCount: 5,
     participants: [...list...]
   }
   ```

**Key Points**:
- ✅ Codes generated sequentially (TSR-6K-001, 002, etc)
- ✅ QR contains participant data
- ✅ Email uses customizable template
- ✅ WhatsApp sent via GHL webhook
- ✅ All actions idempotent (safe to retry)

---

## 🔐 SECURITY FEATURES

### 1. Webhook Security
- ✅ Token validation via `x-callback-token` header
- ✅ Payload size limit (64KB max)
- ✅ JSON validation
- ✅ Production-only enforcement

### 2. Payment Security
- ✅ Session-based access control
- ✅ Family ownership validation
- ✅ Idempotent operations
- ✅ Transaction-based updates

### 3. Audit Trail
- ✅ All actions logged to Axiom
- ✅ Includes: who, what, when, old/new values
- ✅ Payment reference for traceability
- ✅ Separate events for different sources (webhook/sync/admin)

---

## 📊 PAYMENT STATUS STATES

### Status Flow Diagram
```
Registration
     ↓
  PENDING ────────────────┐
     ↓                     ↓
   PAID                EXPIRED
     ↓                     ↓
  ACTIVE              INACTIVE
     
Alternative:
  PENDING → FAILED → INACTIVE
```

### Status Definitions
1. **pending**: Payment created but not yet paid
2. **paid**: Payment confirmed (webhook or manual)
3. **failed**: Payment failed at Xendit
4. **expired**: Payment expired (24h timeout at Xendit)

### Participant Status
1. **inactive**: Not paid yet (payment_status: pending/failed/expired)
2. **active**: Paid and codes generated (payment_status: paid)

---

## 🚨 POTENTIAL ISSUES & SOLUTIONS

### Issue 1: Webhook Delayed or Failed
**Solution**: Auto-polling + manual sync button
- Dashboard polls every 5 seconds after checkout opened
- User can manually click "Cek Status Pembayaran"
- Auto-sync on dashboard load for any pending payments

### Issue 2: Multiple Payment Attempts
**Solution**: Reuse existing pending payment
```typescript
const existingPayment = await findPendingFamilyPaymentByRegistrationIds(...)
if (existingPayment) {
  return { reusedPendingPayment: true, ...existingPayment }
}
```

### Issue 3: User Closes Browser Before Payment
**Solution**: Payment persists in database
- Payment record saved before Xendit checkout
- User can return to dashboard anytime
- Click "Bayar Semua Anggota" again to get same checkout URL

### Issue 4: Xendit Not Configured
**Solution**: Demo mode
- Checks for valid `XENDIT_SECRET_KEY`
- If missing, creates demo session
- "Simulasi Pembayaran" button available for testing

### Issue 5: Email Verification Not Completed
**Solution**: Login blocked until verified
- User cannot access dashboard
- Login page shows verification error
- Resend verification email available

---

## 🧪 TESTING CHECKLIST

### Registration Flow
- [ ] Register new family with participants
- [ ] Check payment created with status `pending`
- [ ] Check payment visible in admin dashboard
- [ ] Verify email sent with 24-hour token
- [ ] Verify email link works
- [ ] Check login blocked before verification
- [ ] Login successful after verification

### Checkout Flow
- [ ] Login to dashboard
- [ ] Click "Bayar Semua Anggota"
- [ ] Verify modal opens with correct amount
- [ ] Verify checkout URL generated
- [ ] Verify modal shows pending participants count
- [ ] Click "Buka Checkout Xendit"
- [ ] Verify new tab opens with Xendit page
- [ ] Verify auto-polling message appears

### Payment Success Flow (via Xendit)
- [ ] Complete payment on Xendit
- [ ] Verify webhook received (check logs)
- [ ] Verify payment status changes to `paid`
- [ ] Verify participant codes generated (TSR-6K-XXX)
- [ ] Verify QR codes generated
- [ ] Verify racepack email sent (NO attachments)
- [ ] Verify WhatsApp sent via GHL
- [ ] Verify confetti animation on dashboard
- [ ] Verify participants now show "PAID" badge
- [ ] Verify "Detail" button available for paid participants

### Manual Sync Flow
- [ ] Complete payment on Xendit
- [ ] Wait for auto-polling to detect (max 5 seconds)
- [ ] Verify status updates automatically
- [ ] Verify confetti triggers
- [ ] Test manual "Cek Status Pembayaran" button

### Admin Manual Status Change
- [ ] Login as admin
- [ ] Go to Pembayaran tab
- [ ] Find pending payment
- [ ] Change status to `paid` via dropdown
- [ ] Verify row becomes yellow
- [ ] Click "Save" button
- [ ] Verify confirmation dialog appears
- [ ] Confirm change
- [ ] Verify same post-payment flow triggers
- [ ] Verify Axiom logs show admin action

### Failure Scenarios
- [ ] Expired payment (webhook expired status)
- [ ] Failed payment (webhook failed status)
- [ ] User cancels Xendit checkout
- [ ] User closes browser during payment
- [ ] Webhook token mismatch (should reject)
- [ ] Invalid Xendit session ID
- [ ] Multiple checkout attempts (should reuse)

---

## 📁 KEY FILES REFERENCE

### Payment Creation
- `src/app/actions/family-payments.ts` - All payment logic
- `src/app/actions/family-auth.ts` - Auto-create on registration

### Payment Processing
- `src/app/api/xendit/webhook/route.ts` - Webhook handler
- `src/lib/db/family-payments.ts` - Database operations

### Post-Payment Actions
- `src/lib/email/racepack.ts` - Email sending
- `src/lib/whatsapp/racepack.ts` - WhatsApp via GHL

### Admin Features
- `src/app/admin/actions.ts` - Manual status update
- `src/app/admin/ui/AdminDashboardClient.tsx` - Admin UI

### User Interface
- `src/app/dashboard/page.tsx` - Family dashboard
- `src/app/page.tsx` - Registration form with email verification modal

---

## 🎯 SUMMARY

### ✅ What's Working
1. **Auto-payment creation** during registration
2. **Email verification** system before dashboard access
3. **Payment reuse** for pending payments
4. **Xendit integration** with VA/QRIS channels
5. **Webhook handling** for paid/failed/expired statuses
6. **Auto-polling** for payment status
7. **Manual sync** as fallback
8. **Admin manual status change** with save button
9. **Post-payment flow** (codes, QR, email, WhatsApp)
10. **Audit logging** to Axiom
11. **Demo mode** for testing without Xendit
12. **Email templates** customizable by admin
13. **NO QR attachments** in email (dashboard only)
14. **Email verification popup** modal

### ⚠️ Known Limitations
1. **No retry mechanism** for failed webhooks (manual sync required)
2. **No payment history timeline** (only current status)
3. **No bulk status update** (one at a time)
4. **No refund support** yet
5. **24-hour Xendit expiry** (cannot extend)

### 🚀 Recommended Next Steps
1. Monitor webhook success rate in production
2. Set up Axiom alerts for failed payments
3. Add payment method display in admin dashboard
4. Consider adding payment receipt PDF generation
5. Add bulk payment status export

---

**Last Updated**: July 1, 2026  
**Status**: ✅ PRODUCTION READY  
**Build**: ✅ PASSING
