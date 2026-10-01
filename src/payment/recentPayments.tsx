import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/useUserSupabase';

const RECENT_LIMIT = 10;

interface RecentUsername {
  username: string;
}

interface RecentPaymentRow {
  id: number;
  created_at: string;
  payed_by: string;
  amount: number;
  users: RecentUsername | RecentUsername[] | null;
}

/**
 * PostgREST returns a to-one embed as an object, but the untyped client
 * declares it as an array. Normalise whichever shape arrives.
 */
function usernameOf(users: RecentPaymentRow['users']): string {
  const first = Array.isArray(users) ? users[0] : users;

  return first?.username ?? 'Unknown user';
}

interface RecentPayment {
  id: number;
  userId: string;
  username: string;
  paidAt: string;
  amount: number;
}

function RecentPayments() {
  const [payments, setPayments] = useState<RecentPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
  const { data, error } = await supabase
    .from('payment')
    .select('id, created_at, payed_by, amount, users(username)')
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT);

      if (!active) return;

      if (error) {
        setError(error.message);
        setPayments([]);
        return;
      }

      setPayments(
        ((data ?? []) as RecentPaymentRow[]).map((row) => ({
          id: row.id,
          userId: row.payed_by,
          username: usernameOf(row.users),
          paidAt: row.created_at,
          amount: Number(row.amount ?? 0),
        })),
      );
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  // null means the first load has not settled yet.
  if (payments === null) {
    return <p className="text-sm text-gray-500">Loading recent payments…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (payments.length === 0) {
    return <p className="text-sm text-gray-500">No payments recorded yet.</p>;
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-gray-500">
        Recent payments
      </h2>

      <ol className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {payments.map((payment, index) => (
          <li key={payment.id}>
            <Link
              to={`/user/${payment.userId}`}
              className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-gray-50"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-4 shrink-0 text-sm tabular-nums text-gray-400">
                  {index + 1}
                </span>
                <span className="truncate font-medium text-gray-900">
                  {payment.username}
                </span>
              </span>

              <span className="shrink-0 text-sm text-gray-500">
                {new Date(payment.paidAt).toLocaleDateString()}
              </span>

              <span className="w-20 shrink-0 text-right text-sm font-medium text-gray-900">
                {payment.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default RecentPayments;
