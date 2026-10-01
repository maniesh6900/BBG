import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  isDue,
  nextPaymentDate,
  totalPaid,
} from '../lib/payments';
import { useDebounce } from '../lib/useDebounce';
import { supabase } from '../lib/useUserSupabase';
import NewUserForm from './newUserForm';

const DEBOUNCE_MS = 1000;
const RESULT_LIMIT = 20;

interface PaymentRow {
  id: number;
  created_at: string;
  payed_by: string;
  amount: number;
}

interface UserRow {
  id: string;
  username: string;
  phone_number: string;
  payment: PaymentRow[] | null;
}

interface UserResult {
  id: string;
  username: string;
  phone_number: string;
  totalAmount: number;
  paymentCount: number;
  lastPaymentAt: string | null;
  nextPaymentAt: Date | null;
  due: boolean;
}

/** Derived once per fetch, so nothing impure runs during render. */
function toResult(user: UserRow): UserResult {
  const payments = [...(user.payment ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const last = payments[0];
  const lastPaymentAt = last?.created_at ?? null;
  const nextPaymentAt = nextPaymentDate(
    last ? { created_at: last.created_at, amount: Number(last.amount) } : null,
  );

  return {
    id: user.id,
    username: user.username,
    phone_number: user.phone_number,
    totalAmount: totalPaid(payments.map((p) => Number(p.amount))),
    paymentCount: payments.length,
    lastPaymentAt,
    nextPaymentAt,
    due: isDue(nextPaymentAt),
  };
}

function paymentSummary(user: UserResult): string {
  if (!user.lastPaymentAt) return 'No payments yet';

  const count =
    `${user.paymentCount} payment` + (user.paymentCount === 1 ? '' : 's');
  const last = `last ${new Date(user.lastPaymentAt).toLocaleDateString()}`;
  const next =
    !user.due && user.nextPaymentAt
      ? ` · next ${user.nextPaymentAt.toLocaleDateString()}`
      : '';

  return `${count} · ${last}${next}`;
}

function amountSummary(total: number): string {
  return `Paid ${total.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function Users() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedTerm, setLoadedTerm] = useState('');

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Closing the bar discards the term immediately, so stale results and the
  // debounce timer never linger behind a collapsed search.
  const term = searchOpen ? debouncedQuery.trim() : '';
  const hasTerm = term !== '';
  // Waiting on the debounce timer.
  const pending = searchOpen && query !== debouncedQuery;
  // Debounce settled, but these results are still for an older term.
  const searching = hasTerm && term !== loadedTerm;

  useEffect(() => {
    if (!term) return;

    let active = true;

    async function search() {
      const { data, error } = await supabase
        .from('users')
        .select(
          'id, username, phone_number, payment(created_at, id, payed_by, amount)',
        )
        .ilike('username', `%${term}%`)
        .limit(RESULT_LIMIT);

      if (!active) return;

      setLoadedTerm(term);

      if (error) {
        setError(error.message);
        return;
      }

      setError(null);
      setResults(((data ?? []) as UserRow[]).map(toResult));
    }

    search();

    return () => {
      active = false;
    };
  }, [term]);

  function closeSearch() {
    setQuery('');
    setSearchOpen(false);
  }

  const settled = hasTerm && !searching;
  const showResults = settled && !error && results.length > 0;
  const showNoMatch = settled && !error && results.length === 0;

  return (
    <div>
      {searchOpen ? (
        <div className="flex items-center gap-2">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users by username…"
            aria-label="Search users by username"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="button"
            onClick={closeSearch}
            className="shrink-0 rounded-lg px-2 py-3 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-left text-gray-500 transition hover:border-gray-400 hover:text-gray-700"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
            className="h-4 w-4 shrink-0"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m12.5 12.5 4 4" />
          </svg>
          Search users
        </button>
      )}

      {searchOpen && (
        <p className="mt-2 h-5 text-sm text-gray-500">
          {pending ? 'Typing…' : searching ? 'Searching…' : ''}
        </p>
      )}

      {settled && error && <p className="text-sm text-red-600">{error}</p>}

      {showNoMatch && (
        <p className="text-sm text-gray-500">No users match “{term}”.</p>
      )}

      {showResults && (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {results.map((user) => (
            <li key={user.id}>
              <Link
                to={`/user/${user.id}`}
                className="flex items-start justify-between gap-4 px-4 py-3 transition hover:bg-gray-50"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-gray-900">
                    {user.username}
                  </span>
                  <span className="block text-sm text-gray-500">
                    {user.phone_number}
                  </span>
                  <span className="mt-0.5 block text-sm text-gray-500">
                    {paymentSummary(user)}
                  </span>
                  <span className="mt-0.5 block text-sm font-medium text-gray-900">
                    {amountSummary(user.totalAmount)}
                  </span>
                </span>

                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    user.due
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {user.due ? 'Due' : 'Not due'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!hasTerm && (
        <button
          type="button"
          onClick={() => setAddOpen((open) => !open)}
          aria-expanded={addOpen}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            className="h-4 w-4 shrink-0"
          >
            <path d="M10 4.5v11M4.5 10h11" />
          </svg>
          {addOpen ? 'Hide form' : 'Add user'}
        </button>
      )}

      {!hasTerm && addOpen && <NewUserForm />}
    </div>
  );
}

export default Users;
