'use client'

import React, { useRef } from 'react'
import { Receipt, FileText, Download } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import type { Payment, FamilyPayment, Participant, FamilyParticipant, Community, Family } from '@/lib/types'
import { TOPSELL_RUN_EVENT } from '@/lib/types'

interface EReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  payment: Payment | FamilyPayment
  participants: (Participant | FamilyParticipant)[]
  payer: Community | Family
  type: 'community' | 'family'
}

export function EReceiptModal({
  isOpen,
  onClose,
  payment,
  participants,
  payer,
  type
}: EReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const handleDownload = () => {
    window.print()
  }

  const formatPaymentMethod = (method: string | null) => {
    if (!method) return '-'
    const map: Record<string, string> = {
      'xendit_demo': 'Demo Mode',
      'BCA_VA': 'Virtual Account BCA',
      'BNI_VA': 'Virtual Account BNI',
      'BRI_VA': 'Virtual Account BRI',
      'MANDIRI_VA': 'Virtual Account Mandiri',
      'PERMATA_VA': 'Virtual Account Permata',
      'QRIS': 'QRIS'
    }
    return map[method] || method
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="E-Receipt Pembayaran">
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
            orphans: 1;
            widows: 1;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            width: 100% !important;
            background: #fff !important;
            -webkit-text-size-adjust: 100%;
            font-size: 12px !important;
          }
          body * {
            visibility: hidden;
          }
          #receipt-printable, #receipt-printable * {
            visibility: visible;
          }
          #receipt-printable {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background-color: #ffffff !important;
            z-index: 9999 !important;
            overflow: visible !important;
            page-break-inside: avoid !important;
          }
          #receipt-printable .grid {
            page-break-inside: avoid !important;
          }
          #receipt-printable .space-y-2 > div {
            page-break-inside: avoid !important;
          }
          #receipt-printable .bg-gray-100 {
            background-color: #f3f4f6 !important;
          }
          #receipt-printable [style*="color: #ff6a00"] {
            color: #ff6a00 !important;
          }
          #receipt-printable [style*="color: #ff2a44"] {
            color: #ff2a44 !important;
          }
          #receipt-printable .text-green-600 {
            color: #16a34a !important;
          }
          #receipt-printable [style*="background: linear-gradient"] {
            background: linear-gradient(90deg, #ff2a44, #ff6a00) !important;
          }
          #receipt-printable .px-6 {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
          #receipt-printable .py-6 {
            padding-top: 12px !important;
            padding-bottom: 12px !important;
          }
          #receipt-printable .py-4 {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }
          #receipt-printable .gap-4 {
            gap: 8px !important;
          }
          #receipt-printable .space-y-6 {
            gap: 8px !important;
          }
          #receipt-printable .space-y-2 {
            gap: 6px !important;
          }
          #receipt-printable .py-2 {
            padding-top: 6px !important;
            padding-bottom: 6px !important;
          }
          #receipt-printable .px-3 {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          #receipt-printable .text-xs,
          #receipt-printable .text-sm {
            font-size: 11px !important;
          }
          #receipt-printable .text-xl {
            font-size: 16px !important;
          }
          #receipt-printable .text-[10px] {
            font-size: 9px !important;
          }
          #receipt-printable .text-[9px] {
            font-size: 8px !important;
          }
          #receipt-printable .text-[8px] {
            font-size: 7px !important;
          }
          @page {
            size: A4 portrait;
            margin: 5mm !important;
          }
        }
      `}</style>
      <div className="flex flex-col gap-6">
        {/* Receipt Card */}
        <div
          id="receipt-printable"
          ref={receiptRef}
          className="w-full rounded-xl overflow-hidden border border-gray-300 shadow-2xl bg-white"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-300 text-center" style={{ background: 'linear-gradient(90deg, #ff2a44, #ff6a00)' }}>
            <FileText className="w-8 h-8 mx-auto mb-2 text-white" />
            <p className="text-[10px] font-black text-white/90 uppercase tracking-[0.2em]">OFFICIAL PAYMENT RECEIPT</p>
            <p className="text-sm font-black text-white uppercase">TOPSELL RUN 2026</p>
          </div>

          {/* Receipt Content */}
          <div className="px-6 py-6 space-y-6">
            {/* Payer & Payment Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">
                  {type === 'community' ? 'Nama Komunitas' : 'Nama Keluarga'}
                </p>
                <p className="text-sm font-black text-black truncate">{payer.name}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">
                  {type === 'community' ? 'Kode Komunitas' : 'Kode Keluarga'}
                </p>
                <p className="text-sm font-black" style={{ color: '#ff6a00' }}>
                  {type === 'community' 
                    ? (payer as Community).community_code 
                    : (payer as Family).family_code}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">No. Referensi</p>
                <p className="text-sm font-black text-black">{payment.payment_reference}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Tanggal Pembayaran</p>
                <p className="text-sm font-black text-black">
                  {payment.paid_at ? formatDate(payment.paid_at) : '-'}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Metode Pembayaran</p>
                <p className="text-sm font-black text-black">{formatPaymentMethod(payment.payment_method)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Status</p>
                <p className="text-sm font-black text-green-600 uppercase">LUNAS</p>
              </div>
            </div>

            {/* Event Info */}
            <div className="pt-4 border-t border-gray-300">
              <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-2">Detail Event</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-medium text-gray-700">{TOPSELL_RUN_EVENT.name}</p>
                  <p className="text-[10px] text-gray-600">{TOPSELL_RUN_EVENT.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-medium text-gray-700">{formatDate(TOPSELL_RUN_EVENT.date)}</p>
                  <p className="text-[10px]" style={{ color: '#ff6a00' }}>Kategori {TOPSELL_RUN_EVENT.category}</p>
                </div>
              </div>
            </div>

            {/* Participants List */}
            <div className="pt-4 border-t border-gray-300">
              <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-3">
                Daftar Peserta ({participants.length})
              </p>
              <div className="space-y-2">
                {participants.map((participant, index) => (
                  <div key={participant.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-gray-700 w-5">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-xs font-black text-black truncate">
                          {participant.full_name}
                        </p>
                        <p className="text-[10px] text-gray-600">
                          {participant.participant_code || '—'}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs font-bold" style={{ color: '#ff6a00' }}>
                      {formatCurrency(TOPSELL_RUN_EVENT.price_per_participant)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Amount */}
            <div className="pt-4 border-t border-gray-300">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-black">Total Pembayaran</p>
                <p className="text-xl font-black" style={{ color: '#ff6a00' }}>
                  {formatCurrency(payment.amount)}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-300 bg-gray-100 text-center">
            <Receipt className="w-4 h-4 mx-auto mb-2 text-gray-500" />
            <p className="text-[8px] text-gray-600 leading-relaxed">
              Terima kasih telah mendaftarkan peserta di TOPSELL RUN 2026.<br />
              E-receipt ini adalah bukti pembayaran yang sah.
            </p>
          </div>
        </div>

        {/* Download Button */}
        <div className="flex gap-3 w-full">
          <Button variant="primary" className="flex-1 text-xs" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1.5" /> Download E-Receipt
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
