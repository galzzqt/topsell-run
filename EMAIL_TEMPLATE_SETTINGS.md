# EMAIL TEMPLATE SETTINGS - TOPSELL RUN 2026

## Status: ✅ COMPLETED

---

## Overview

Fitur untuk mengatur wording/template email racepack yang dikirim otomatis setelah pembayaran diterima. Admin dapat mengkustomisasi subject, greeting, body intro, dan body outro untuk email Community Package dan Brother & Sister Package secara terpisah.

---

## Features Implemented

### 1. Email Template Configuration UI
- **Location**: Admin Dashboard → Settings Tab
- **Sections**:
  - Email Community Package
  - Email Brother & Sister Package
- **Fields per Template**:
  - Subject
  - Greeting (Salam Pembuka)
  - Body Intro (Kalimat Pembuka)
  - Body Outro (Kalimat Penutup)

### 2. Dynamic Variables Support
Template mendukung variabel dinamis yang akan diganti secara otomatis:
- `{communityName}` - Nama komunitas
- `{familyName}` - Nama keluarga/Brother & Sister
- `{leaderName}` - Nama ketua/perwakilan
- `{participantCount}` - Jumlah peserta

### 3. Default Templates
**Community Package:**
- Subject: `QR Race Pass TOPSELL RUN 2026 - {communityName}`
- Greeting: `Halo {leaderName},`
- Body Intro: `Pembayaran komunitas {communityName} untuk TOPSELL RUN 2026 sudah kami terima. Race Pass peserta sudah aktif.`
- Body Outro: `Terima kasih sudah mendaftar! Sampai jumpa di start line. Semangat berlari! 🏃‍♂️`

**Brother & Sister Package:**
- Subject: `QR Race Pass TOPSELL RUN 2026 - {familyName}`
- Greeting: `Halo {leaderName},`
- Body Intro: `Pembayaran Brother & Sister Package untuk TOPSELL RUN 2026 sudah kami terima. Race Pass peserta sudah aktif.`
- Body Outro: `Terima kasih sudah mendaftar! Sampai jumpa di start line. Semangat berlari! 🏃‍♂️`

---

## Technical Implementation

### Backend Changes

#### 1. Schema Updates (`src/lib/admin/settings-schema.ts`)
```typescript
export type EmailTemplateSettings = {
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

export type AdminSettings = {
  registrationForm: RegistrationFormSettings
  emailTemplates: EmailTemplateSettings  // Added
  envFields: AdminEditableEnvField[]
}
```

#### 2. Email Template Functions (`src/lib/email/racepack.ts`)
- **`getEmailTemplateSettings()`**: Membaca settings dari database, fallback ke default
- **`applyEmailVariables(template, variables)`**: Replace variabel dinamis dalam template
- **Updated Functions**:
  - `renderCommunityEmail()` - Menggunakan template community
  - `renderFamilyEmail()` - Menggunakan template family
  - `sendCommunityRacepackEmail()` - Apply subject dari template
  - `sendFamilyRacepackEmail()` - Apply subject dari template

#### 3. Settings Normalization (`src/lib/admin/settings.ts`)
```typescript
export function normalizeAdminSettings(raw: AdminSettings): AdminSettings {
  return {
    registrationForm: raw.registrationForm || DEFAULT_REGISTRATION_FORM_SETTINGS,
    emailTemplates: raw.emailTemplates || DEFAULT_EMAIL_TEMPLATE_SETTINGS,  // Added
    envFields: raw.envFields || [],
  }
}
```

### Frontend Changes

#### 4. Admin Dashboard UI (`src/app/admin/ui/AdminDashboardClient.tsx`)

**New State Handlers:**
```typescript
const updateCommunityEmailTemplate = (key, value) => {
  setSettingsForm((current) => ({
    ...current,
    emailTemplates: {
      ...current.emailTemplates,
      community: { ...current.emailTemplates.community, [key]: value },
    },
  }))
}

const updateFamilyEmailTemplate = (key, value) => {
  setSettingsForm((current) => ({
    ...current,
    emailTemplates: {
      ...current.emailTemplates,
      family: { ...current.emailTemplates.family, [key]: value },
    },
  }))
}
```

**New UI Section:**
- Info box showing available variables
- Separate forms for Community and Brother & Sister templates
- Each form has 4 fields: Subject, Greeting, Body Intro, Body Outro
- Save button using existing `saveSettings()` function
- Success message display

---

## Usage Flow

1. **Admin logs in** to admin dashboard
2. **Navigate to Settings tab**
3. **Scroll down** to "Template Email Racepack" section
4. **View available variables** in the info box
5. **Edit Community Package template fields**:
   - Customize subject with `{communityName}` or `{leaderName}`
   - Edit greeting, body intro, and body outro
6. **Edit Brother & Sister Package template fields**:
   - Customize subject with `{familyName}` or `{leaderName}`
   - Edit greeting, body intro, and body outro
7. **Click "Simpan Template Email"**
8. **Success message** confirms save

---

## How It Works

### When Payment is Received:

1. **Xendit webhook** triggers or **admin changes status to "paid"**
2. **Email sending process** starts:
   - `sendRacepackEmailsForRegistration()` or `sendFamilyRacepackEmailsForRegistration()`
3. **Template loading**:
   - `getEmailTemplateSettings()` reads from MongoDB
   - Falls back to defaults if not found
4. **Variable replacement**:
   - Collects data: community/family name, leader name, participant count
   - `applyEmailVariables()` replaces `{variable}` with actual values
5. **Email generation**:
   - `renderCommunityEmail()` or `renderFamilyEmail()` builds HTML
   - Uses customized subject, greeting, bodyIntro, bodyOutro
6. **Email sent** via SMTP with QR code attachments

---

## Example Customization

### Before (Default):
**Subject:** `QR Race Pass TOPSELL RUN 2026 - {communityName}`
**Body:** `Pembayaran komunitas {communityName} untuk TOPSELL RUN 2026 sudah kami terima...`

### After (Custom):
**Subject:** `🏃 Race Pass Aktif - {communityName} siap berlari!`
**Body:** `Hore! Pembayaran dari {communityName} dengan {participantCount} peserta sudah dikonfirmasi...`

Variables will be automatically replaced:
- `{communityName}` → "Malang Striders"
- `{participantCount}` → "15"

Result: **Subject:** `🏃 Race Pass Aktif - Malang Striders siap berlari!`

---

## Files Modified

### Backend:
1. `src/lib/admin/settings-schema.ts` (+40 lines)
   - Added `EmailTemplateSettings` type
   - Added `DEFAULT_EMAIL_TEMPLATE_SETTINGS`
   - Updated `AdminSettings` type

2. `src/lib/admin/settings.ts` (+2 lines)
   - Updated `normalizeAdminSettings()` to include emailTemplates

3. `src/lib/email/racepack.ts` (+60 lines)
   - Added `getEmailTemplateSettings()` function
   - Added `applyEmailVariables()` function
   - Updated `renderCommunityEmail()` to use templates
   - Updated `renderFamilyEmail()` to use templates
   - Updated `sendCommunityRacepackEmail()` to apply subject template
   - Updated `sendFamilyRacepackEmail()` to apply subject template

### Frontend:
4. `src/app/admin/ui/AdminDashboardClient.tsx` (+150 lines)
   - Added `updateCommunityEmailTemplate()` handler
   - Added `updateFamilyEmailTemplate()` handler
   - Added complete UI section for email template settings
   - Includes info box, forms, and save functionality

---

## Testing Checklist

- [x] Build passes (`npm run build`)
- [ ] Admin can access Settings tab
- [ ] Email template section visible after env fields section
- [ ] Variable info box displays correctly
- [ ] Can edit Community Package template fields
- [ ] Can edit Brother & Sister Package template fields
- [ ] Changes persist after clicking "Simpan Template Email"
- [ ] Settings reload correctly on page refresh
- [ ] Email sent with custom subject
- [ ] Variables replaced correctly in email body
- [ ] Email sent for Community Package with custom template
- [ ] Email sent for Brother & Sister Package with custom template
- [ ] Default templates used if custom not set

---

## Notes

- Templates are stored in MongoDB in `admin_settings` collection
- Changes take effect immediately after save
- No need to restart server
- Variables are case-sensitive: `{communityName}` not `{communityname}`
- HTML tags can be used in templates (e.g., `<strong>{leaderName}</strong>`)
- Templates support both English and Indonesian text
- Empty fields will fall back to defaults

---

## Future Enhancements (Not Implemented)

- [ ] Template preview with sample data
- [ ] Rich text editor for body fields
- [ ] Additional variables (event date, payment amount, etc.)
- [ ] Multiple language support
- [ ] Template versioning/history
- [ ] Send test email functionality
- [ ] Email template for payment failed/expired status
- [ ] WhatsApp message template customization

---

**Build Status:** ✅ PASS (Exit Code: 0)
**Date Completed:** 2026-06-23
