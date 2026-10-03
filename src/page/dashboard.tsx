import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PLANS, isDue, nextPaymentDate, totalPaid } from '../lib/payments';
import { supabase } from '../lib/useUserSupabase';

const MAX_ROWS = 500;

interface PaymentRow {
  id: number;
  created_at: string;
  payed_by: string;
  amount: number;
}

interface UserRow {
  id: string;
  username: string;
  gender: string | null;
  payment: PaymentRow[] | null;
}

interface UserStat {
  id: string;
  username: string;
  gender: string | null;
  total: number;
  due: boolean;
  payments: { created_at: string; amount: number }[];
}

interface DashboardData {
  users: UserStat[];
}

async function loadDashboard(): Promise<DashboardData> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, gender, payment(created_at, id, payed_by, amount)')
    .order('username', { ascending: true })
    .limit(MAX_ROWS);

  if (error) throw error;

  const users = ((data ?? []) as UserRow[]).map((row) => {
    const payments = (row.payment ?? []).map((p) => ({
      created_at: p.created_at,
      amount: Number(p.amount),
    }));

    const latest = payments.reduce<{ created_at: string; amount: number } | null>(
      (best, p) => (!best || p.created_at > best.created_at ? p : best),
      null,
    );

    return {
      id: row.id,
      username: row.username,
      gender: row.gender,
      total: totalPaid(payments.map((p) => p.amount)),
      due: isDue(nextPaymentDate(latest)),
      payments,
    };
  });

  return { users };
}

interface Stats {
  totalRevenue: number;
  revenueThisMonth: number;
  paymentsCount: number;
  userCount: number;
  dueCount: number;
  planCounts: { label: string; count: number }[];
  genderCounts: { label: string; count: number }[];
  unspecifiedGender: number;
  topPayers: UserStat[];
}

function computeStats(data: DashboardData): Stats {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalRevenue = 0;
  let revenueThisMonth = 0;
  let paymentsCount = 0;
  let dueCount = 0;

  const planTotals = new Map<number, number>(PLANS.map((p) => [p.price, 0]));
  const genderTotals = new Map<string, number>();
  let unspecifiedGender = 0;

  for (const user of data.users) {
    if (user.due) dueCount += 1;

    if (user.gender) {
      genderTotals.set(user.gender, (genderTotals.get(user.gender) ?? 0) + 1);
    } else {
      unspecifiedGender += 1;
    }

    for (const payment of user.payments) {
      paymentsCount += 1;
      totalRevenue += payment.amount;

      if (new Date(payment.created_at) >= monthStart) {
        revenueThisMonth += payment.amount;
      }

      if (planTotals.has(payment.amount)) {
        planTotals.set(
          payment.amount,
          (planTotals.get(payment.amount) ?? 0) + 1,
        );
      }
    }
  }

  return {
    totalRevenue,
    revenueThisMonth,
    paymentsCount,
    userCount: data.users.length,
    dueCount,
    planCounts: PLANS.map((p) => ({
      label: `${p.months} month${p.months === 1 ? '' : 's'}`,
      count: planTotals.get(p.price) ?? 0,
    })),
    genderCounts: [...genderTotals.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    unspecifiedGender,
    topPayers: [...data.users]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .filter((user) => user.total > 0),
  };
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-medium tabular-nums text-gray-900">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    loadDashboard()
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Failed to load dashboard',
          );
          setData({ users: [] });
        }
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const loading = data === null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-medium">Dashboard</h1>

        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          className="rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-900"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading dashboard…</p>}

      {!loading && error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && data && <DashboardBody data={data} />}
    </div>
  );
}

function DashboardBody({ data }: { data: DashboardData }) {
  const stats = computeStats(data);

  const planTotal = stats.planCounts.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total revenue"
          value={stats.totalRevenue.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}
          hint={`${stats.paymentsCount} payment${stats.paymentsCount === 1 ? '' : 's'}`}
        />
        <StatCard
          label="This month"
          value={stats.revenueThisMonth.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}
          hint="revenue"
        />
        <StatCard
          label="Members"
          value={String(stats.userCount)}
          hint={`${stats.dueCount} due for renewal`}
        />
        <StatCard
          label="Active rate"
          value={`${
            stats.userCount === 0
              ? 0
              : Math.round(
                  ((stats.userCount - stats.dueCount) / stats.userCount) * 100,
                )
          }%`}
          hint="paid up"
        />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-900">By plan</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {stats.planCounts.map((plan) => (
            <div
              key={plan.label}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="w-20 shrink-0 text-sm text-gray-700">
                {plan.label}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <span
                  className="block h-full rounded-full bg-blue-600"
                  style={{
                    width:
                      planTotal === 0
                        ? '0%'
                        : `${(plan.count / planTotal) * 100}%`,
                  }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-sm tabular-nums text-gray-900">
                {plan.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-900">By gender</h2>
        {stats.genderCounts.length === 0 ? (
          <p className="text-sm text-gray-500">No gender data yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.genderCounts.map((gender) => (
              <span
                key={gender.label}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
              >
                {gender.label}:{' '}
                <span className="tabular-nums">{gender.count}</span>
              </span>
            ))}
            {stats.unspecifiedGender > 0 && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                Unspecified:{' '}
                <span className="tabular-nums">{stats.unspecifiedGender}</span>
              </span>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-900">Top payers</h2>
        {stats.topPayers.length === 0 ? (
          <p className="text-sm text-gray-500">No payments yet.</p>
        ) : (
          <ol className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {stats.topPayers.map((user, index) => (
              <li key={user.id}>
                <Link
                  to={`/user/${user.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 transition hover:bg-gray-50"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-4 shrink-0 text-sm tabular-nums text-gray-400">
                      {index + 1}
                    </span>
                    <span className="truncate font-medium text-gray-900">
                      {user.username}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-gray-900">
                    {user.total.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
