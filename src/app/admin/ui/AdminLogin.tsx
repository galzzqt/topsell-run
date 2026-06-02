'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, LockKeyhole } from 'lucide-react'
import { loginAdmin } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AdminLogin() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    startTransition(async () => {
      const result = await loginAdmin(username, password)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <main className="min-h-screen bg-brand-dark text-foreground flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-card-bg border border-card-border rounded-xl p-5 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-sport-red to-sport-orange rounded-lg">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">TOPSELL RUN 2026</p>
            <h1 className="text-base font-black uppercase text-foreground">Super Admin</h1>
          </div>
        </div>

        <div className="bg-brand-gray/40 border border-card-border rounded-lg p-3 flex gap-3">
          <LockKeyhole className="w-4 h-4 text-sport-orange flex-shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed text-brand-muted font-medium">
            Masuk untuk melihat semua komunitas, pembayaran, peserta, dan memindai QR racepack.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Input
            label="Username Admin"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="contoh: superadmin"
            disabled={isPending}
          />
          <Input
            label="Password Admin"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Masukkan password admin"
            disabled={isPending}
            error={error}
          />
        </div>

        <Button type="submit" className="w-full py-3" isLoading={isPending}>
          Masuk Admin
        </Button>
      </form>
    </main>
  )
}
