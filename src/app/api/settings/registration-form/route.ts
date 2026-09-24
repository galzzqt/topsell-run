import { NextResponse } from 'next/server'
import { countJerseyUsage, readAdminSettings } from '@/lib/admin/settings'
import type { PackageKey } from '@/lib/admin/settings-schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { registrationForm } = await readAdminSettings()

  // Ukuran jersey nonaktif disembunyikan; ukuran yang kuotanya habis ditandai "Habis" & tidak bisa dipilih.
  await Promise.all(
    (Object.keys(registrationForm) as PackageKey[]).map(async (pkg) => {
      const field = registrationForm[pkg].participants.tshirt_size
      const enabled = field.options.filter((option) => option.enabled !== false)
      const used = enabled.some((option) => (option.quota || 0) > 0) ? await countJerseyUsage(pkg) : {}
      field.options = enabled.map(({ value, label, soldOut, quota = 0 }) => {
        const full = soldOut || (quota > 0 && (used[value] || 0) >= quota)
        return full ? { value, label: `${label} (Habis)`, disabled: true } : { value, label }
      })
    })
  )

  return NextResponse.json(registrationForm)
}
