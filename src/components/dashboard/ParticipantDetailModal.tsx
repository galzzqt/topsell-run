'use client'

import React from 'react'
import { Dialog } from '@/components/ui/dialog'
import { User, Calendar, Mail, Phone, HeartPulse, AlertTriangle } from 'lucide-react'
import type { Participant, FamilyParticipant } from '@/lib/types'

interface ParticipantDetailModalProps {
  participant: Participant | FamilyParticipant | null
  isOpen: boolean
  onClose: () => void
}

export function ParticipantDetailModal({ participant, isOpen, onClose }: ParticipantDetailModalProps) {
  if (!participant) return null

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Detail Peserta">
      <div className="flex flex-col gap-4">
        {/* Header Info Section */}
        <div className="bg-brand-gray/30 rounded-xl p-4 border border-card-border">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-sport-red to-sport-orange rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-black text-foreground truncate">{participant.full_name}</h3>
              <p className="text-xs font-bold text-sport-orange uppercase">BIB: {participant.bib_name}</p>
              {participant.participant_code && (
                <p className="text-xs font-black text-sport-purple uppercase mt-1">
                  Nomor BIB: {participant.participant_code}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-brand-gray/20 rounded-lg border border-card-border">
            <Mail className="w-4 h-4 text-brand-muted" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Email</p>
              <p className="text-xs font-medium text-foreground truncate">{participant.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-brand-gray/20 rounded-lg border border-card-border">
            <Phone className="w-4 h-4 text-brand-muted" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Nomor HP</p>
              <p className="text-xs font-medium text-foreground">{participant.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-brand-gray/20 rounded-lg border border-card-border">
            <Calendar className="w-4 h-4 text-brand-muted" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Tanggal Lahir</p>
              <p className="text-xs font-medium text-foreground">{participant.date_of_birth || '-'}</p>
            </div>
          </div>
        </div>

        {/* Personal Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-brand-gray/20 rounded-lg border border-card-border">
            <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider mb-1">Gender</p>
            <p className="text-xs font-bold text-foreground">
              {participant.gender === 'male' ? 'Laki-laki' : 'Perempuan'}
            </p>
          </div>

          <div className="p-3 bg-brand-gray/20 rounded-lg border border-card-border">
            <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider mb-1">Ukuran Jersey</p>
            <p className="text-xs font-bold text-foreground">{participant.tshirt_size}</p>
          </div>
        </div>

        {/* Medical Info */}
        <div className="space-y-3">
          <div className="p-3 bg-brand-gray/20 rounded-lg border border-card-border">
            <div className="flex items-center gap-2 mb-1">
              <HeartPulse className="w-3.5 h-3.5 text-brand-muted" />
              <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Golongan Darah</p>
            </div>
            <p className="text-xs font-medium text-foreground">{participant.blood_type || '-'}</p>
          </div>

          {participant.medical_condition && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-[9px] font-bold text-amber-800 uppercase tracking-wider">Kondisi Medis</p>
              </div>
              <p className="text-xs font-medium text-amber-900">{participant.medical_condition}</p>
            </div>
          )}
        </div>

        {/* Emergency Contact */}
        <div className="p-3 bg-brand-gray/20 rounded-lg border border-card-border">
          <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider mb-2">Kontak Darurat</p>
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">
              <span className="font-bold">Nama:</span> {participant.emergency_contact_name || '-'}
            </p>
            <p className="text-xs font-medium text-foreground">
              <span className="font-bold">Nomor HP:</span> {participant.emergency_contact_phone || '-'}
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  )
}