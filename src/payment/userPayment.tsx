import { useEffect, useState } from 'react';
import { PLANS, monthsForAmount } from '../lib/payments';
import { usePaymentStore } from '../store/usePaymentStore';

interface UserPaymentProps {
  userId: string;
}

function UserPayment({ userId }: UserPaymentProps) {
  const payments = usePaymentStore((state) => state.payments);
  const status = usePaymentStore((state) => state.status);
  const error = usePaymentStore((state) => state.error);
  const nextPaymentAt = usePaymentStore((state) => state.nextPaymentAt);
  const canPay = usePaymentStore((state) => state.canPay);
  const loadPayments = usePaymentStore((state) => state.loadPayments);
  const createPayment = usePaymentStore((state) => state.createPayment);

  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    loadPayments(userId);
  }, [userId, loadPayments]);

  const busy = status === 'loading';

  // Clicking "Record payment" reveals the plan buttons.
  function handleRecordClick() {
    setChoosing(true);
  }

  // Picking a plan records the payment immediately. The store prepends the
  // new payment on success, so totals computed from it update live.
  async function handleChoose(price: number) {
    await createPayment(userId, price);
    setChoosing(false);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Payments</h2>

        {canPay ? (
          choosing ? (
            <button
              type="button"
              onClick={() => setChoosing(false)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRecordClick}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Record payment
            </button>
          )
        ) : (
          <button
            type="button"
            disabled
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Not due yet
          </button>
        )}
      </div>

      {choosing && canPay && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-gray-700">
            Payment opens for
          </p>
          <div
            className="flex gap-2"
            role="group"
            aria-label="Payment opens for"
          >
            {PLANS.map((plan) => (
              <button
                key={plan.price}
                type="button"
                disabled={busy}
                onClick={() => handleChoose(plan.price)}
                className={`flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm transition ${
                  busy
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:border-blue-500 hover:bg-blue-50'
                }`}
              >
                <span className="block font-medium text-gray-900">
                  {busy ? 'Saving…' : `${plan.months} month${plan.months === 1 ? '' : 's'}`}
                </span>
                <span className="block text-gray-500">{plan.price}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!canPay && nextPaymentAt && (
        <p className="mb-2 text-sm text-gray-500">
          Current payment is still open. Next payment available on{' '}
          {nextPaymentAt.toLocaleDateString()}.
        </p>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {payments.length === 0 ? (
        <p className="text-sm text-gray-500">No payments yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {payments.map((payment) => (
            <li key={payment.id} className="px-4 py-3 text-sm text-gray-600">
              {new Date(payment.created_at).toLocaleString()}
              <span className="text-gray-400">
                {' '}
                · opens for{' '}
                {monthsForAmount(payment.amount) > 0
                  ? `${monthsForAmount(payment.amount)} month${monthsForAmount(payment.amount) === 1 ? '' : 's'}`
                  : 'unknown plan'}
              </span>
              <span className="float-right font-medium text-gray-900">
                {payment.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default UserPayment;
