import { create } from 'zustand';
import {
  isDue,
  minGapMessage,
  monthsForAmount,
  nextPaymentDate,
} from '../lib/payments';
import { supabase } from '../lib/useUserSupabase';

export interface Payment {
  id: number;
  created_at: string;
  payed_by: string;
  amount: number;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

interface PaymentState {
  payments: Payment[];
  /** Which user the loaded payments belong to. */
  paymentsUserId: string | null;
  status: Status;
  error: string | null;
  /** When the user may next pay, or null if they have never paid. */
  nextPaymentAt: Date | null;
  /** Whether the latest payment's coverage has elapsed and a new one may be recorded. */
  canPay: boolean;
  loadPayments: (userId: string) => Promise<void>;
  /**
   * Records a payment of the given amount (600 = 1 month, 1500 = 3 months).
   * Returns true when the payment was saved; the payment_amount_sync trigger
   * adds the amount to the user's total_amount in the database.
   */
  createPayment: (userId: string, amount: number) => Promise<boolean>;
}

export const usePaymentStore = create<PaymentState>((set) => ({
  payments: [],
  paymentsUserId: null,
  status: 'idle',
  error: null,
  nextPaymentAt: null,
  canPay: true,

  loadPayments: async (userId) => {
    set({
      payments: [],
      paymentsUserId: userId,
      status: 'loading',
      error: null,
      nextPaymentAt: null,
      canPay: true,
    });

    const { data, error } = await supabase
      .from('payment')
      .select('*')
      .eq('payed_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }

    const payments = (data ?? []).map(normalizePayment);
    const next = nextPaymentDate(payments[0]);

    set({
      payments,
      nextPaymentAt: next,
      canPay: isDue(next),
      status: 'idle',
    });
  },

  createPayment: async (userId, amount) => {
    set({ status: 'loading', error: null });

    // Re-read the latest payment so the coverage holds even if this store is stale.
    const { data: latest, error: latestError } = await supabase
      .from('payment')
      .select('created_at, amount')
      .eq('payed_by', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (latestError) {
      set({ status: 'error', error: latestError.message });
      return false;
    }

    const previous = latest?.[0];
    const next = nextPaymentDate(previous);

    if (!isDue(next)) {
      set({
        status: 'error',
        error: minGapMessage(
          next,
          previous ? monthsForAmount(Number(previous.amount)) : 0,
        ),
        nextPaymentAt: next,
        canPay: false,
      });
      return false;
    }

    const { data, error } = await supabase
      .from('payment')
      .insert({ payed_by: userId, amount })
      .select()
      .single();

    if (error) {
      set({ status: 'error', error: error.message });
      return false;
    }

    const payment = normalizePayment(data);
    const createdNext = nextPaymentDate(payment);

    set((state) => ({
      payments: [payment, ...state.payments],
      nextPaymentAt: createdNext,
      canPay: isDue(createdNext),
      status: 'success',
    }));

    return true;
  },
}));

function normalizePayment(row: unknown): Payment {
  const record = row as Partial<Payment> & { id: number };

  return {
    id: record.id,
    created_at: String(record.created_at ?? new Date(0).toISOString()),
    payed_by: String(record.payed_by ?? ''),
    amount: Number(record.amount ?? 0),
  };
}
