import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PLANS } from '../lib/payments';
import { useDebounce } from '../lib/useDebounce';
import { supabase } from '../lib/useUserSupabase';

const PAGE_SIZE = 50;
const DEBOUNCE_MS = 1000;

type PlanChoice = 'all' | number;

/** yyyy-mm-dd strings from date inputs; empty string means unset. */
interface DateRange {
  from: string;
  to: string;
}

const NO_DATE_RANGE: DateRange = { from: '', to: '' };

interface PaymentUsername {
  username: string;
}

interface PaymentRow {
  id: number;
  created_at: string;
  payed_by: string;
  amount: number;
  users: PaymentUsername | PaymentUsername[] | null;
}

/**
 * PostgREST returns a to-one embed as an object, but the untyped client
 * declares it as an array. Normalise whichever shape arrives.
 */
function usernameOf(users: PaymentRow['users']): string {
  const first = Array.isArray(users) ? users[0] : users;

  return first?.username ?? 'Unknown user';
}

interface PaymentRecord {
  id: number;
  userId: string;
  username: string;
  paidAt: string;
  amount: number;
}

function toRecord(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    userId: row.payed_by,
    username: usernameOf(row.users),
    paidAt: row.created_at,
    amount: Number(row.amount ?? 0),
  };
}

function planLabel(price: number): string {
  const plan = PLANS.find((p) => p.price === price);

  return plan
    ? `${plan.months} month${plan.months === 1 ? '' : 's'} · ${plan.price}`
    : String(price);
}

/** Restricts a payment query to payments made between the given days, inclusive. */
function applyDateRange<
  Q extends {
    gte: (col: string, val: string) => Q;
    lt: (col: string, val: string) => Q;
  },
>(request: Q, range: DateRange): Q {
  let filtered = request;

  if (range.from) {
    // Local midnight on the from-day, as a full UTC instant.
    filtered = filtered.gte(
      'created_at',
      new Date(`${range.from}T00:00:00`).toISOString(),
    );
  }

  if (range.to) {
    // Exclusive start of the day after the to-day, so the to-day is included.
    const dayAfter = new Date(`${range.to}T00:00:00`);
    dayAfter.setDate(dayAfter.getDate() + 1);
    filtered = filtered.lt('created_at', dayAfter.toISOString());
  }

  return filtered;
}

/** One page of the newest payments matching the filters, with usernames embedded. */
async function fetchPaymentPage(
  from: number,
  term: string,
  plan: PlanChoice,
  range: DateRange,
) {
  let request = supabase
    .from('payment')
    .select('id, created_at, payed_by, amount, users(username)')
    .order('created_at', { ascending: false });

  if (term) {
    request = request.filter('users.username', 'ilike', `%${term}%`);
  }

  if (plan !== 'all') {
    request = request.eq('amount', plan);
  }

  request = applyDateRange(request, range);

  const { data, error } = await request.range(from, from + PAGE_SIZE - 1);

  return { rows: ((data ?? []) as PaymentRow[]).map(toRecord), error };
}

/** Total number of payments matching the current filters. */
async function fetchPaymentCount(
  term: string,
  plan: PlanChoice,
  range: DateRange,
) {
  let request = supabase
    .from('payment')
    .select('id', { count: 'exact', head: true });

  if (term) {
    request = request.filter('users.username', 'ilike', `%${term}%`);
  }

  if (plan !== 'all') {
    request = request.eq('amount', plan);
  }

  request = applyDateRange(request, range);

  const { count, error } = await request;

  return { count, error };
}

function AllPayments() {
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Filters the currently loaded page set was fetched with. */
  const [loadedKey, setLoadedKey] = useState('');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState<PlanChoice>('all');
  const [range, setRange] = useState<DateRange>(NO_DATE_RANGE);

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);
  const term = debouncedQuery.trim();

  const filterKey = `${term}|${plan}|${range.from}|${range.to}`;
  const activeCount = (term !== '' ? 1 : 0) + (plan !== 'all' ? 1 : 0) +
    (range.from !== '' ? 1 : 0) + (range.to !== '' ? 1 : 0);

  useEffect(() => {
    let active = true;

    async function load() {
      const [{ rows, error }, { count }] = await Promise.all([
        fetchPaymentPage(0, term, plan, range),
        fetchPaymentCount(term, plan, range),
      ]);

      if (!active) return;

      if (error) {
        setError(error.message);
        setPayments([]);
        return;
      }

      setError(null);
      setPayments(rows);
      setTotal(count);
      setHasMore(rows.length === PAGE_SIZE);
      setLoadedKey(filterKey);
    }

    load();

    return () => {
      active = false;
    };
  }, [term, plan, range, filterKey]);

  async function loadMore() {
    if (payments === null || loadingMore || loadedKey !== filterKey) {
      return;
    }

    setLoadingMore(true);

    const { rows, error } = await fetchPaymentPage(
      payments.length,
      term,
      plan,
      range,
    );

    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setPayments((prev) => [...(prev ?? []), ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    }

    setLoadingMore(false);
  }

  const loading = payments === null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-medium">All payments</h1>

        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-label="Filters"
          title="Filters"
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition ${
            activeCount > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'text-gray-500 ring-1 ring-gray-300 hover:text-gray-900'
          }`}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M3 5h14l-5.2 6.2v4.3L8.2 17v-5.8L3 5Z" />
          </svg>

          {activeCount > 0 && (
            <span className="text-xs tabular-nums">{activeCount}</span>
          )}
        </button>
      </div>

      {/* Options only appear after the icon is clicked. */}
      {filtersOpen && (
        <FilterBar
          query={query}
          setQuery={setQuery}
          plan={plan}
          setPlan={setPlan}
          range={range}
          setRange={setRange}
        />
      )}

      {total !== null && !loading && (
        <p className="mb-2 text-sm text-gray-500">
          {total} payment{total === 1 ? '' : 's'}
          {activeCount > 0 ? ' found' : ''}
        </p>
      )}

      {error && payments !== null && payments.length === 0 && (
        <p className="mb-2 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading payments…</p>
      ) : error && payments.length > 0 ? (
        <p className="mb-2 text-sm text-red-600">{error}</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-gray-500">
          {activeCount > 0
            ? 'No payments match your search or filter.'
            : 'No payments recorded yet.'}
        </p>
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
                      {new Date(payment.paidAt).toLocaleString()}
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

      {hasMore &&
        !loading &&
        payments.length > 0 &&
        loadedKey === filterKey && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
    </div>
  );
}

interface FilterBarProps {
  query: string;
  setQuery: (value: string) => void;
  plan: PlanChoice;
  setPlan: (plan: PlanChoice) => void;
  range: DateRange;
  setRange: (range: DateRange) => void;
}

function FilterBar({
  query,
  setQuery,
  plan,
  setPlan,
  range,
  setRange,
}: FilterBarProps) {
  const hasFilters =
    query.trim() !== '' || plan !== 'all' || range.from !== '' ||
    range.to !== '';

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by username…"
        aria-label="Search payments by username"
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex gap-2" role="group" aria-label="Filter by plan">
          <button
            type="button"
            onClick={() => setPlan('all')}
            aria-pressed={plan === 'all'}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              plan === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:text-gray-900'
            }`}
          >
            All
          </button>

          {PLANS.map((p) => (
            <button
              key={p.price}
              type="button"
              onClick={() => setPlan(p.price)}
              aria-pressed={plan === p.price}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                plan === p.price
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:text-gray-900'
              }`}
            >
              {planLabel(p.price)}
            </button>
          ))}
        </div>

        <div
          className="ml-auto flex items-center gap-1.5"
          role="group"
          aria-label="Filter by date"
        >
          <input
            type="date"
            value={range.from}
            max={range.to || undefined}
            onChange={(event) =>
              setRange({ ...range, from: event.target.value })
            }
            aria-label="From date"
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 outline-none focus:border-blue-500"
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="date"
            value={range.to}
            min={range.from || undefined}
            onChange={(event) => setRange({ ...range, to: event.target.value })}
            aria-label="To date"
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 outline-none focus:border-blue-500"
          />

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setPlan('all');
                setRange(NO_DATE_RANGE);
              }}
              className="rounded-full px-2 py-1 text-xs font-medium text-gray-500 transition hover:text-gray-900"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AllPayments;
