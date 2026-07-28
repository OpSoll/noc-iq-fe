'use client';

import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { PaymentService } from '@/services/paymentService';
import type { Payment } from '@/types/payment';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';

interface PaymentDetailDrawerProps {
  paymentId: string;
  onClose: () => void;
}

export function PaymentDetailDrawer({ paymentId, onClose }: PaymentDetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [retryNote, setRetryNote] = useState('');
  const queryClient = useQueryClient();

  useFocusTrap(drawerRef);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    drawerRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleEscape);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => PaymentService.fetchPayment(paymentId),
    enabled: !!paymentId,
  });

  const retryMutation = useMutation({
    mutationFn: () => PaymentService.retryPayment(paymentId, { note: retryNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] });
      onClose();
    },
  });

  if (isLoading || !payment) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="relative flex w-full max-w-md flex-col bg-white p-6 shadow-xl" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Loading payment details">
          <div className="flex-1 space-y-4 pt-12">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={drawerRef}
        className="relative flex w-full max-w-md flex-col bg-white p-6 shadow-xl transition-transform"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 id="drawer-title" className="text-lg font-semibold">
            Payment Details
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="font-medium">{payment.amountUsdc} {payment.assetCode}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                payment.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                payment.status === 'RELEASED' ? 'bg-blue-100 text-blue-700' :
                payment.status === 'REFUNDED' ? 'bg-yellow-100 text-yellow-700' :
                payment.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {payment.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="font-medium">{new Date(payment.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Commission</p>
              <p className="font-medium font-mono text-sm">{payment.commissionId?.slice(0, 12)}...</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-500">Client Wallet</p>
            <p className="font-mono text-sm break-all">{payment.clientWallet}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Artist Wallet</p>
            <p className="font-mono text-sm break-all">{payment.artistWallet}</p>
          </div>
          {payment.txHash && (
            <div>
              <p className="text-sm text-gray-500">Transaction Hash</p>
              <p className="font-mono text-sm break-all">{payment.txHash}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500">Platform Fee</p>
            <p className="font-medium">{payment.platformFeeUsdc} USDC</p>
          </div>
        </div>

        {payment.status === 'FAILED' && (
          <div className="mt-4 border-t pt-4">
            <label htmlFor="retry-note" className="mb-1 block text-sm text-gray-500">Retry note (optional)</label>
            <textarea
              id="retry-note"
              value={retryNote}
              onChange={(e) => setRetryNote(e.target.value)}
              className="mb-2 w-full rounded border px-3 py-2 text-sm"
              rows={2}
              placeholder="Reason for retry..."
            />
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {retryMutation.isPending ? 'Retrying...' : 'Retry Payment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
