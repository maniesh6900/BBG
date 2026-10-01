import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/useUserSupabase';

interface HomePaymentRow {
  id: number;
  created_at: string;
  payed_by: string;
  amount: number;
  users: { username: string } | { username: string }[] | null;
}

/**
 * PostgREST returns a to-one embed as an object, but the untyped client
 * declares it as an array. Normalise whichever shape arrives.
 */
function usernameOf(users: HomePaymentRow['users']): string {
  const first = Array.isArray(users) ? users[0] : users;

  return first?.username ?? 'Unknown user';
}

interface HomePayment {
  id: number;
  userId: string;
  username: string;
  paidAt: string;
  amount: number;
}

/** Local midnight of today; all of today's payments fall after this instant. */
function startOfToday(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return now.toISOString();
}

function Home() {
  const [payments, setPayments] = useState<HomePayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error } = await supabase
        .from('payment')
        .select('id, created_at, payed_by, amount, users(username)')
        .gte('created_at', startOfToday())
        .order('created_at', { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
        setPayments([]);
        return;
      }

      setPayments(
        ((data ?? []) as HomePaymentRow[]).map((row) => ({
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

  const total = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);

  if (payments === null) {
    return <p className="text-sm text-gray-500">Loading today's payments…</p>;
  }

  return (
    <div>
      <h1 className="mb-2 font-medium">Today's payments</h1>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="mb-3 rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">
          {payments.length} payment{payments.length === 1 ? '' : 's'} today
        </p>
        <p className="text-2xl font-medium text-gray-900">
          {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
      </div>

      {payments.length === 0 ? (
        <p className="text-sm text-gray-500">No payments recorded today yet.</p>
      ) : (
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
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900">
                      {payment.username}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {new Date(payment.paidAt).toLocaleTimeString()}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {new Date(payment.paidAt).toLocaleDateString()}
                    </span>
                  </span>
                </span>

                <span className="w-20 shrink-0 text-right text-sm font-medium text-gray-900">
                  {payment.amount.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default Home;
