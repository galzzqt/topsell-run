'use client'

import React, { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { Download, Printer, Shield, QrCode } from 'lucide-react'
import { Participant } from '@/lib/types'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface QRCodeModalProps {
  participant: Participant | null
  isOpen: boolean
  onClose: () => void
}

export function QRCodeModal({ participant, isOpen, onClose }: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!isOpen || !participant?.qr_code_data || !canvasRef.current) return

    QRCode.toCanvas(canvasRef.current, participant.qr_code_data, {
      width: 200,
      margin: 2,
      color: {
        dark: '#0a0a0a',
        light: '#FFFFFF',
      },
    })
  }, [isOpen, participant])

  const handleDownload = () => {
    if (!canvasRef.current || !participant) return
    const link = document.createElement('a')
    link.download = `TOPSELL-RUN-${participant.participant_code || participant.id}.png`
    link.href = canvasRef.current.toDataURL()
    link.click()
  }

  const handlePrint = () => {
    if (!participant) return
    window.print()
  }

  if (!participant) return null

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Race Pass & QR Code">
      <div className="flex flex-col items-center gap-6">

        {/* TOPSELL RUN Race Pass Card */}
        <div
          id="race-pass-printable"
          className="w-full max-w-sm rounded-2xl overflow-hidden border border-card-border shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #111111 100%)' }}
        >
          {/* Header Strip */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ background: 'linear-gradient(90deg, #ff2a44, #ff6a00)' }}
          >
            <div>
              <p className="text-[9px] font-black text-white/70 uppercase tracking-[0.2em]">OFFICIAL RACE PASS</p>
              <p className="text-xs font-black text-white uppercase tracking-widest">TOPSELL RUN 2026</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-bold text-white/70 uppercase">Kategori</p>
              <p className="text-sm font-black text-white">6K</p>
            </div>
          </div>

          {/* BIB Number */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-brand-muted uppercase tracking-widest">Nomor BIB</p>
              <p className="text-2xl font-black tracking-wider" style={{ color: '#ff6a00' }}>
                {participant.participant_code || '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold text-brand-muted uppercase tracking-widest">Status</p>
              <div className="flex items-center gap-1 text-green-400">
                <Shield className="w-3 h-3 fill-green-400/20" />
                <span className="text-xs font-black uppercase">LUNAS</span>
              </div>
            </div>
          </div>

          {/* QR Code + Participant Info */}
          <div className="px-5 py-5 flex gap-5 items-center">
            <div className="rounded-xl overflow-hidden border border-white/10 bg-white p-1.5 flex-shrink-0">
              <canvas ref={canvasRef} />
            </div>
            <div className="flex flex-col gap-2.5 min-w-0">
              <div>
                <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Nama Peserta</p>
                <p className="text-sm font-black text-white truncate">{participant.full_name}</p>
                <p className="text-[10px] font-bold text-sport-orange truncate">BIB: {participant.bib_name}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Jersey Size</p>
                <p className="text-sm font-black text-white">{participant.tshirt_size}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Gender</p>
                <p className="text-xs font-bold text-white capitalize">{participant.gender === 'male' ? 'Laki-laki' : 'Perempuan'}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Tanggal Lahir</p>
                <p className="text-xs font-bold text-white">{participant.date_of_birth || '-'}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Gol. Darah</p>
                <p className="text-xs font-bold text-white">{participant.blood_type || '-'}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Kontak Darurat</p>
                <p className="text-xs font-bold text-white truncate">{participant.emergency_contact_name || '-'}</p>
                <p className="text-[10px] font-bold text-brand-muted truncate">{participant.emergency_contact_phone || '-'}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="px-5 py-2.5 flex justify-between items-center"
            style={{ background: 'linear-gradient(90deg, #0d0d0d, #1a1a1a)' }}
          >
            <p className="text-[8px] font-bold text-brand-muted/50 uppercase tracking-widest">
              Scan QR untuk verifikasi & racepack pickup
            </p>
            <QrCode className="w-3.5 h-3.5 text-brand-muted/40" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 w-full">
          <Button variant="outline" className="flex-1 text-xs" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1.5" /> Cetak
          </Button>
          <Button variant="primary" className="flex-1 text-xs" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1.5" /> Download PNG
          </Button>
        </div>

        <p className="text-[9px] text-brand-muted text-center font-medium leading-relaxed">
          Tunjukkan QR Code ini saat pengambilan racepack dan pada hari H event.<br />
          Dilarang memperjualbelikan QR Code ini.
        </p>
      </div>
    </Dialog>
  )
}
