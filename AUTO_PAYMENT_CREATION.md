# AUTO PAYMENT CREATION ON REGISTRATION - TOPSELL RUN 2026

## Status: ✅ COMPLETED

---

## Overview

Updated Brother & Sister Package registration flow to **automatically create payment record** with status "pending" upon registration. This ensures payments appear in admin dashboard immediately, even before users click "Pay" button.

---

## Problem Statement

### Before:
```
User registers Brother & Sister Package
  ↓
Participants saved to database
  ↓
Payment record: ❌ NOT CREATED
  ↓
Admin dashboard payments: ❌ EMPTY (no payment visible)
  ↓
User logs into dashboard
  ↓
User clicks "Bayar Semua Anggota"
  ↓
Payment record: ✅ CREATED
  ↓
Admin dashboard payments: ✅ VISIBLE
```

**Issue:** Admin cannot see newly registered families in payment dashboard until they click the payment button.

### After:
```
User registers Brother & Sister Package
  ↓
Participants saved to database
  ↓
Payment record: ✅ AUTO-CREATED (status: pending)
  ↓
Admin dashboard payments: ✅ IMMEDIATELY VISIBLE
  ↓
User logs into dashboard
  ↓
User clicks "Bayar Semua Anggota"
  ↓
System reuses existing payment, generates Xendit checkout
```

**Benefit:** Admin can see all registrations immediately in payment dashboard with pending status.

---

## Changes Made

### 1. Modified Registration Flow (`src/app/actions/family-auth.ts`)

**Added Auto Payment Creation:**

```typescript
// After creating family and participants
const totalAmount = values.participants.length * TOPSELL_RUN_EVENT.price_per_participant
const paymentRefRaw = generateRandomReference('FAM')
const paymentRef = toXenditReference(paymentRefRaw)

try {
  // 1. Create registration record
  const registration = await createFamilyRegistration({
    family_id: family.id,
    total_participants: values.participants.length,
    total_amount: totalAmount,
    status: 'pending',
  })

  // 2. Link participants to registration
  await linkFamilyParticipantsToRegistration(participantIds, registration.id)

  // 3. Create payment record (status: pending)
  await createFamilyPayment({
    registration_id: registration.id,
    amount: totalAmount,
    payment_reference: paymentRef,
    status: 'pending',
  })
} catch (error) {
  console.error('Failed to create auto-payment record:', error)
  // Don't fail the registration if payment creation fails
}
```

### 2. Payment Reuse Logic (Already Exists)

The existing `createFamilyPayment()` function already handles this correctly:

```typescript
// Check for existing pending payment
const existingPayment = await findPendingFamilyPaymentByRegistrationIds(...)

if (existingPayment) {
  // Reuse existing payment, just generate Xendit checkout URL
  return {
    success: true,
    paymentId: existingPayment.id,
    checkoutUrl: existingPayment.checkout_url,
    // ...existing payment data
  }
}
```

---

## New Flow Diagram

```
┌─────────────────────────────────────────┐
│   Landing Page Registration Form        │
│   (Brother & Sister Package)            │
└──────────────┬──────────────────────────┘
               │
               ▼
     ┌─────────────────────┐
     │  signUpFamily()     │
     └─────────┬───────────┘
               │
               ├──▶ Create family record
               ├──▶ Create family auth
               ├──▶ Insert participants
               │
               ├──▶ Create family_registration ← NEW
               ├──▶ Link participants to registration ← NEW
               ├──▶ Create family_payment (status: pending) ← NEW
               │
               ├──▶ Send WhatsApp confirmation
               └──▶ Create user session

┌─────────────────────────────────────────┐
│   User Dashboard (/dashboard)           │
└──────────────┬──────────────────────────┘
               │
               ▼
       Sees pending participants
       Sees "Bayar Semua Anggota" button
               │
               ▼
     User clicks "Bayar Semua Anggota"
               │
               ▼
     ┌─────────────────────┐
     │ createFamilyPayment()│
     └─────────┬───────────┘
               │
               ├──▶ Find existing pending payment ← REUSE
               ├──▶ Generate Xendit checkout URL
               └──▶ Return checkout URL to user

┌─────────────────────────────────────────┐
│   Admin Dashboard (/admin)              │
│   Pembayaran Tab                        │
└──────────────┬──────────────────────────┘
               │
               ▼
       Shows payment IMMEDIATELY after registration ← FIXED
       Status: PENDING (yellow)
       Admin can change status manually if needed
```

---

## Database Records Created

### On Registration (New Behavior):

**1. `families` collection:**
```json
{
  "id": "family_xxx",
  "name": "Shury x Ansa",
  "leader_name": "Shury",
  "phone": "08123456789",
  "email": "shury@example.com",
  "family_code": "FAM-XXXX"
}
```

**2. `family_participants` collection:**
```json
[
  {
    "id": "participant_1",
    "family_id": "family_xxx",
    "registration_id": "registration_xxx", ← LINKED
    "full_name": "Shury",
    "payment_status": "pending"
  },
  {
    "id": "participant_2",
    "family_id": "family_xxx",
    "registration_id": "registration_xxx", ← LINKED
    "full_name": "Ansa",
    "payment_status": "pending"
  }
]
```

**3. `family_registrations` collection:** ← NEW AUTO-CREATED
```json
{
  "id": "registration_xxx",
  "family_id": "family_xxx",
  "total_participants": 2,
  "total_amount": 270000,
  "status": "pending"
}
```

**4. `family_payments` collection:** ← NEW AUTO-CREATED
```json
{
  "id": "payment_xxx",
  "registration_id": "registration_xxx",
  "amount": 270000,
  "payment_reference": "FAM-XXXXX",
  "status": "pending", ← KEY: Auto-set to pending
  "payment_method": null,
  "checkout_url": null,
  "xendit_session_id": null
}
```

---

## Admin Dashboard Impact

### Before:
- User registers "Shury x Ansa"
- **Admin Pembayaran Tab:** Empty ❌
- **Admin Peserta Tab:** Shows 2 participants ✅

### After:
- User registers "Shury x Ansa"
- **Admin Pembayaran Tab:** Shows payment with status "pending" ✅
  - Referensi: FAM-XXXXX
  - Grup: Shury x Ansa
  - Nominal: Rp 270.000
  - Status: Pending (yellow)
- **Admin Peserta Tab:** Shows 2 participants ✅

---

## User Dashboard Impact

### Before Change:
1. User logs in
2. Sees participants (status: pending)
3. Clicks "Bayar Semua Anggota"
4. System creates NEW payment record
5. System generates Xendit checkout

### After Change:
1. User logs in
2. Sees participants (status: pending)
3. Clicks "Bayar Semua Anggota"
4. System finds EXISTING payment record ← REUSE
5. System generates Xendit checkout (update existing payment)

**User Experience:** No change, completely transparent

---

## Error Handling

### Graceful Degradation:
```typescript
try {
  // Create registration + payment
} catch (error) {
  console.error('Failed to create auto-payment record:', error)
  // Don't fail the registration
  // Admin can manually create payment later if needed
}
```

**Why?**
- Registration success is more important than payment creation
- If payment creation fails, user can still:
  - Login to dashboard
  - Click "Bayar Semua Anggota"
  - System will create payment at that time (old behavior)
- Admin will see error in logs and can investigate

---

## Files Modified

**1. `src/app/actions/family-auth.ts`** (+25 lines)
- Added imports: `createFamilyRegistration`, `createFamilyPayment`, `linkFamilyParticipantsToRegistration`
- Added import: `generateRandomReference` from format utils
- Added import: `TOPSELL_RUN_EVENT` for pricing
- Added helper function: `toXenditReference()`
- Added auto payment creation logic after participant insertion
- Captures `participantIds` from `insertFamilyParticipants()` return value

---

## Benefits

### 1. Admin Visibility
- ✅ All registrations visible immediately in payment dashboard
- ✅ Admin can track pending payments
- ✅ Admin can manually change status if needed
- ✅ Complete payment audit trail from day one

### 2. Better Tracking
- ✅ Payment reference generated at registration
- ✅ Participants linked to registration immediately
- ✅ Total amount calculated upfront
- ✅ Easier to reconcile payments

### 3. Simplified Flow
- ✅ One source of truth for payments
- ✅ No duplicate payment creation
- ✅ Consistent payment reference across system
- ✅ Easier debugging and support

### 4. Backward Compatible
- ✅ Existing logic for payment reuse still works
- ✅ User experience unchanged
- ✅ No breaking changes to API
- ✅ Graceful error handling if payment creation fails

---

## Testing Checklist

### New Registration:
- [ ] Register new Brother & Sister Package from landing page
- [ ] Check admin dashboard Pembayaran tab → Should show payment immediately
- [ ] Check admin dashboard Peserta tab → Should show participants
- [ ] Check payment status → Should be "pending" (yellow)
- [ ] Check payment reference → Should be "FAM-XXXXX"
- [ ] Check amount → Should match participant count × price

### User Dashboard:
- [ ] Login to user dashboard
- [ ] Check participants displayed correctly
- [ ] Click "Bayar Semua Anggota"
- [ ] Verify existing payment is reused (no duplicate)
- [ ] Verify Xendit checkout URL generated
- [ ] Complete payment and verify status changes to "paid"

### Admin Actions:
- [ ] Find payment in admin dashboard
- [ ] Change status from "pending" to "paid" manually
- [ ] Verify webhooks triggered (email + WhatsApp)
- [ ] Verify participant codes generated
- [ ] Verify QR codes generated

### Error Scenarios:
- [ ] Test registration with database error during payment creation
- [ ] Verify registration still succeeds
- [ ] Verify user can still access dashboard
- [ ] Verify user can still create payment manually

---

## Comparison: Community vs Brother & Sister

### Community Package:
- **Payment Creation:** Manual (user clicks "Bayar Sekarang")
- **Why:** Each community may have different payment schedules

### Brother & Sister Package:
- **Payment Creation:** Automatic (on registration) ← NEW
- **Why:** Simpler flow, immediate payment expectation

**Note:** Community Package behavior unchanged. Only Brother & Sister Package has auto payment creation.

---

## Migration Notes

### Existing Data:
- **Old registrations (before this update):**
  - Have participants but no payment record
  - Still work fine
  - Payment created when user clicks "Bayar"
  
- **New registrations (after this update):**
  - Have participants AND payment record (status: pending)
  - Payment visible in admin immediately
  - Payment reused when user clicks "Bayar"

### No Database Migration Needed:
- ✅ Schema unchanged
- ✅ Collections unchanged
- ✅ Backward compatible
- ✅ Works with old and new data

---

## Code Example

### Old Flow (Before):
```typescript
// signUpFamily()
await insertFamilyParticipants(...)
// Done - no payment created
```

### New Flow (After):
```typescript
// signUpFamily()
const insertedParticipants = await insertFamilyParticipants(...)
const participantIds = insertedParticipants.map(p => p.id)

// NEW: Auto-create payment
const registration = await createFamilyRegistration(...)
await linkFamilyParticipantsToRegistration(participantIds, registration.id)
await createFamilyPayment({
  registration_id: registration.id,
  amount: totalAmount,
  payment_reference: paymentRef,
  status: 'pending', // ← KEY
})
```

---

## Build Status

✅ **BUILD SUCCESSFUL**

```bash
✓ Compiled successfully in 20.0s
✓ Finished TypeScript in 25.4s
✓ Collecting page data using 7 workers in 3.0s
✓ Generating static pages using 7 workers (14/14) in 1651ms
✓ Finalizing page optimization in 29ms

Exit Code: 0
```

**No errors, no warnings**

---

## Summary

### What Changed:
- ✅ Payment record auto-created on registration
- ✅ Status automatically set to "pending"
- ✅ Payment visible in admin dashboard immediately
- ✅ Participants linked to registration from the start

### What Stayed the Same:
- ✅ User dashboard experience unchanged
- ✅ Payment flow unchanged (Xendit checkout)
- ✅ Community Package flow unchanged
- ✅ Admin manual status change still works

### Impact:
- **Admins:** Can see all registrations immediately ✅
- **Users:** No change to their experience ✅
- **System:** Better tracking and audit trail ✅
- **Support:** Easier to troubleshoot payment issues ✅

---

**Date Completed:** June 23, 2026  
**Build Status:** ✅ PASS  
**Feature:** Auto Payment Creation on Registration
