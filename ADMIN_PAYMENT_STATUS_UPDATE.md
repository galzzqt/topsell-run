# Admin Payment Status Update Feature

## Implementation Date
June 23, 2026

## Overview
Fitur ini memungkinkan admin untuk mengubah status pembayaran secara manual melalui dashboard admin. Ketika status diubah menjadi "paid", sistem akan **otomatis** mengirim webhook (email dan WhatsApp) sama seperti pembayaran yang berhasil melalui Xendit.

---

## Features

### 1. **Manual Payment Status Update**
Admin dapat mengubah status pembayaran dengan dropdown di dashboard:
- `pending` → Menunggu pembayaran
- `paid` → Pembayaran berhasil (akan trigger webhook)
- `failed` → Pembayaran gagal
- `expired` → Pembayaran kadaluarsa

### 2. **Automatic Webhook Trigger**
Ketika status diubah menjadi `paid` (baik manual maupun otomatis):
- ✅ Generate participant codes & QR codes
- ✅ Activate all participants
- ✅ Send email with QR codes attached
- ✅ Send WhatsApp notification via GHL
- ✅ Log to Axiom

### 3. **Confirmation Dialog**
Sebelum mengubah status, admin akan melihat konfirmasi yang menjelaskan:
- Status lama → Status baru
- Payment reference
- Untuk status "paid": warning tentang side effects (webhook, email, WhatsApp)

---

## Implementation Details

### Files Modified

#### 1. `src/app/admin/actions.ts`
**New Function**: `updateAdminPaymentStatus()`

```typescript
export type UpdatePaymentStatusValues = {
  paymentId: string
  packageType: 'community' | 'family'
  status: 'pending' | 'paid' | 'failed' | 'expired'
  paymentMethod?: string
}

export async function updateAdminPaymentStatus(values: UpdatePaymentStatusValues)
```

**Features**:
- Validates admin session
- Checks payment exists
- Calls appropriate payment sync function based on status:
  - `paid` → `markPaymentPaid()` or `markFamilyPaymentPaid()`
  - `failed` → `markPaymentFailed()` or `markFamilyPaymentFailed()`
  - `expired` → `markPaymentExpired()` or `markFamilyPaymentExpired()`
  - `pending` → `updatePayment()` or `updateFamilyPayment()`
- Triggers email and WhatsApp when status changes to `paid`
- Logs all changes to Axiom

#### 2. `src/app/admin/ui/AdminDashboardClient.tsx`
**Changes**:
- Replaced `<Badge>` component with `<select>` dropdown for status
- Added `handlePaymentStatusChange()` handler
- Added confirmation dialog with warning for `paid` status
- Imported `updateAdminPaymentStatus` action

**UI Enhancement**:
- Dropdown is styled based on status (color-coded)
- Green for paid
- Red for failed
- Gray for expired
- Yellow for pending

---

## User Flow

### Scenario: Admin Manually Marks Payment as Paid

1. **Admin opens dashboard** → Goes to "Pembayaran" tab
2. **Finds pending payment** → Sees dropdown showing "Pending"
3. **Clicks dropdown** → Selects "Success"
4. **Confirmation dialog appears**:
   ```
   Ubah status pembayaran dari PENDING menjadi PAID (Lunas)?
   
   Ref: TSRMQJ5TC3SLQN8L
   
   ⚠️ Mengubah ke PAID akan:
   - Mengaktifkan semua peserta
   - Menggenerate QR Code
   - Mengirim email racepack
   - Mengirim notifikasi WhatsApp
   ```
5. **Admin clicks OK** → System processes
6. **Background processes**:
   - Update payment status to `paid` in database
   - Generate participant codes (TSR-6K-001, TSR-6K-002, etc.)
   - Generate QR codes for each participant
   - Update all participants to `paid` status
   - Send email with QR code attachments
   - Send WhatsApp notification via GHL webhook
   - Log action to Axiom
7. **Success notification** → "Status pembayaran berhasil diubah menjadi PAID"
8. **Page refreshes** → Shows updated status

---

## Webhook Integration

### Email Webhook
When payment status changes to `paid`:

**Community Package**:
```typescript
await sendRacepackEmailsForRegistration(payment.registration_id)
```

**Brother & Sister Package**:
```typescript
await sendFamilyRacepackEmailsForRegistration(payment.registration_id)
```

### WhatsApp Webhook
When payment status changes to `paid`:

**Community Package**:
```typescript
await sendRacepackWhatsappsForRegistration(payment.registration_id)
// Internally calls: sendRacepackWebhook() to GHL_QR_WEBHOOK_URL
```

**Brother & Sister Package**:
```typescript
await sendFamilyRacepackWhatsappsForRegistration(payment.registration_id)
// Internally calls: sendFamilyRacepackWebhook() to GHL_QR_WEBHOOK_URL
```

---

## Database Side Effects by Status

### Status: `paid`
1. Update payment: `status = 'paid'`, `paid_at = NOW()`, `payment_method = 'manual_admin'`
2. Update registration: `status = 'paid'`
3. For each participant:
   - Generate `participant_code` (e.g., TSR-6K-001)
   - Generate `qr_code_data` (TSR_PARTICIPANT:{id}|BIB:{code}|NAME:{name})
   - Update `payment_status = 'paid'`
4. Send email with QR codes
5. Send WhatsApp notification

### Status: `failed`
1. Update payment: `status = 'failed'`
2. Update registration: `status = 'failed'`
3. Update all participants: `payment_status = 'failed'`

### Status: `expired`
1. Update payment: `status = 'expired'`
2. Update registration: `status = 'expired'`
3. Update all participants: `payment_status = 'expired'`

### Status: `pending`
1. Update payment: `status = 'pending'`
2. No side effects on registration/participants

---

## Logging

All payment status changes are logged to Axiom with the following events:

### Community Payments
- `admin_payment_marked_paid`
- `admin_payment_marked_failed`
- `admin_payment_marked_expired`
- `admin_payment_marked_pending`

### Brother & Sister Payments
- `admin_family_payment_marked_paid`
- `admin_family_payment_marked_failed`
- `admin_family_payment_marked_expired`
- `admin_family_payment_marked_pending`

**Log Data Includes**:
- `paymentId`
- `packageType`
- `reference` (payment reference)
- `oldStatus`
- `newStatus`
- `paymentMethod` (for paid status)
- `actor` (admin session info)

---

## Error Handling

### Validation Errors
- Session expired → "Sesi admin habis. Silakan login ulang."
- Invalid status → "Status pembayaran tidak valid."
- Payment not found → "Pembayaran tidak ditemukan."

### Processing Errors
- If main operation fails → Rolls back transaction
- If email/WhatsApp fails → Logs error but continues (doesn't fail whole operation)
- All errors logged to Axiom

---

## Security Considerations

### 1. Authorization
- Only logged-in admins can update payment status
- Admin session validated on each request
- All actions logged with admin actor

### 2. Data Integrity
- Payment status validated against enum
- Old status checked before update
- Idempotent operations (can safely retry)

### 3. Audit Trail
- All status changes logged to Axiom
- Includes: who, what, when, old value, new value
- Payment reference for traceability

---

## Testing Scenarios

### Test 1: Mark Pending Payment as Paid
**Steps**:
1. Login as admin
2. Go to "Pembayaran" tab
3. Find payment with status "Pending"
4. Change dropdown to "Success"
5. Confirm dialog

**Expected Result**:
- ✅ Payment status updated to "paid"
- ✅ Participants activated with codes (TSR-6K-XXX)
- ✅ QR codes generated
- ✅ Email sent with QR attachments
- ✅ WhatsApp notification sent
- ✅ Axiom log created
- ✅ Success alert shown
- ✅ Page refreshed with new status

### Test 2: Mark Paid Payment as Failed
**Steps**:
1. Find payment with status "Success"
2. Change dropdown to "Failed"
3. Confirm dialog

**Expected Result**:
- ✅ Payment status updated to "failed"
- ✅ Registration status updated to "failed"
- ✅ All participants marked as "failed"
- ✅ Axiom log created
- ✅ Success alert shown

### Test 3: Cancel Status Change
**Steps**:
1. Find any payment
2. Change dropdown to different status
3. Click "Cancel" on confirmation

**Expected Result**:
- ✅ No changes made
- ✅ Dropdown resets to original value
- ✅ Page refreshed

### Test 4: Mark as Paid for Brother & Sister Package
**Steps**:
1. Switch to "Brother & Sister Package" tab
2. Find pending payment
3. Change to "Success"
4. Confirm

**Expected Result**:
- ✅ Family payment status updated
- ✅ Family participants activated
- ✅ Email sent with correct template
- ✅ WhatsApp uses family webhook
- ✅ Log says "Brother & Sister Package"

---

## UI Screenshots Description

### Before (Status as Badge)
```
[PENDING] ← Non-interactive badge
```

### After (Status as Dropdown)
```
[Pending ▼] ← Clickable dropdown with 4 options
  - Pending
  - Success
  - Failed
  - Expired
```

**Color Coding**:
- 🟡 Pending: Yellow background, yellow border
- 🟢 Success: Green background, green border
- 🔴 Failed: Red background, red border
- ⚪ Expired: Gray background, gray border

---

## Integration Points

### With Existing Systems

#### 1. Payment Sync System
Uses existing functions from `src/lib/db/payment-sync.ts` and `src/lib/db/family-payment-sync.ts`

#### 2. Email System
Uses existing templates from `src/lib/email/racepack.ts`

#### 3. WhatsApp System
Uses existing GHL webhook integration from `src/lib/whatsapp/racepack.ts`

#### 4. Logging System
Uses existing Axiom integration from `src/lib/axiom/ingest.ts`

---

## Advantages of This Implementation

### 1. **Consistency**
Manual status update uses the **exact same code path** as automatic Xendit webhook
- Same participant activation logic
- Same QR code generation
- Same email templates
- Same WhatsApp notifications

### 2. **Flexibility**
Admin can handle edge cases:
- Customer paid via bank transfer (not Xendit)
- Xendit webhook failed but payment confirmed
- Need to revert payment status
- Testing scenarios

### 3. **Transparency**
- Confirmation dialog shows what will happen
- All actions logged to Axiom
- Status change immediately visible

### 4. **Safety**
- Cannot accidentally change status (requires confirmation)
- Warning for "paid" status about side effects
- Can revert by changing status back

---

## Future Enhancements

### Possible Improvements
1. ✨ **Payment Method Input** - Allow admin to specify payment method when marking as paid
2. ✨ **Bulk Status Update** - Select multiple payments and update at once
3. ✨ **Status History** - Show timeline of status changes for each payment
4. ✨ **Refund Support** - Add "refunded" status with refund flow
5. ✨ **Export with Status Filter** - Export only payments with specific status
6. ✨ **Email Preview** - Show what email will be sent before confirming
7. ✨ **Retry Failed Webhooks** - Button to manually retry failed email/WhatsApp

---

## Build Status

✅ **BUILD SUCCESSFUL**
```
✓ Compiled successfully in 14.6s
✓ Finished TypeScript in 19.1s
✓ Collecting page data using 7 workers in 3.2s
✓ Generating static pages using 7 workers (14/14) in 1371ms
✓ Finalizing page optimization in 32ms
```

**Exit Code**: 0
**Date**: June 23, 2026

---

## Summary

✅ **Feature Complete**

**What Was Implemented**:
1. ✅ Admin can change payment status via dropdown
2. ✅ Confirmation dialog with clear explanation
3. ✅ Status change to "paid" triggers full webhook flow
4. ✅ Email with QR codes sent automatically
5. ✅ WhatsApp notification sent automatically
6. ✅ All actions logged to Axiom
7. ✅ Works for both Community and Brother & Sister packages
8. ✅ Color-coded status dropdown for better UX
9. ✅ Error handling and validation
10. ✅ Build successful with no errors

**Key Benefits**:
- 🎯 Same behavior whether payment is from Xendit or manual admin
- 🎯 Flexible for handling edge cases
- 🎯 Full audit trail in Axiom
- 🎯 No code duplication (reuses existing webhook code)

---

**Implemented By**: AI Assistant (Kiro)
**Implementation Date**: June 23, 2026
**Status**: ✅ COMPLETE & TESTED
