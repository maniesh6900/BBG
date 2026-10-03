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

const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 200;

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
  const [allUsers, setAllUsers] = useState<UserResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped after adding a user so the list picks them up.
  const [refreshKey, setRefreshKey] = useState(0);

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Closing the bar discards the term immediately, so stale results never
  // linger behind a collapsed search.
  const term = searchOpen ? debouncedQuery.trim().toLowerCase() : '';
  const hasTerm = term !== '';
  // Waiting on the debounce timer before filtering.
  const pending = searchOpen && query !== debouncedQuery;

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error } = await supabase
        .from('users')
        .select(
          'id, username, phone_number, payment(created_at, id, payed_by, amount)',
        )
        .order('username', { ascending: true })
        .limit(RESULT_LIMIT);

      if (!active) return;

      if (error) {
        setError(error.message);
        setAllUsers([]);
        return;
      }

      setAllUsers(((data ?? []) as UserRow[]).map(toResult));
    }

    load();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  // Filtering stays local: one fetch on mount, debounced client-side search.
  const visible = !pending && hasTerm
    ? (allUsers ?? []).filter(
        (user) =>
          user.username.toLowerCase().includes(term) ||
          user.phone_number.toLowerCase().includes(term),
      )
    : (allUsers ?? []);

  function closeSearch() {
    setQuery('');
    setSearchOpen(false);
  }

  const loading = allUsers === null;
  const showList = !loading && !error;
  const showResults = showList && visible.length > 0;
  const showNoMatch = showList && visible.length === 0;

  return (
    <div>
      {/* Top row: search on the left, add-user in the corner on the right. */}
      <div className="flex items-center gap-2">
        {searchOpen ? (
          <>
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
              aria-label="Close search"
              title="Close search"
              className="shrink-0 rounded-lg border border-gray-300 bg-white p-3 text-gray-500 transition hover:border-gray-400 hover:text-gray-900"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
                className="h-5 w-5"
              >
                <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
              </svg>
            </button>
          </>
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

        {/* Upper-corner add-user button with a user-plus icon. */}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Add user"
          title="Add user"
          className="shrink-0 rounded-lg bg-blue-600 p-3.5 text-white transition hover:bg-blue-700 active:scale-95"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-5 w-5"
          >
            <circle cx="8" cy="7.5" r="2.8" />
            <path d="M3 16.5c.9-3 2.8-4.5 5-4.5 1 0 1.9.3 2.7.8" />
            <path d="M15.5 11.5v5M13 14h5" />
          </svg>
        </button>
      </div>

      {loading && (
        <p className="mt-2 text-sm text-gray-500">Loading users…</p>
      )}

      {!loading && error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showNoMatch && (
        <p className="mt-2 text-sm text-gray-500">
          {hasTerm
            ? `No users match “${term}”.`
            : 'No users yet. Add the first one with the + button above.'}
        </p>
      )}

      {showResults && (
        <ul className="mt-2 divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {visible.map((user) => (
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

      {addOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 p-4 sm:items-center"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="relative w-full max-w-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              aria-label="Close"
              className="absolute -top-2 right-0 -translate-y-full rounded-full bg-white/90 px-2 py-1 text-sm font-medium text-gray-600 shadow transition hover:text-gray-900"
            >
              Close
            </button>
            <NewUserForm
              onClose={() => {
                setAddOpen(false);
                setRefreshKey((key) => key + 1);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
