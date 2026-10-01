import { useEffect, useState } from 'react';

/** Formats the local date as DD/MM. */
function formatToday(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');

  return `${dd}/${mm}`;
}

/** Milliseconds until the next local midnight. */
function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  return midnight.getTime() - now.getTime();
}

/**
 * Shows the current date as DD/MM for the bottom-nav "Today" tab. Re-renders
 * at midnight so the badge always shows the real current date, even if the
 * app stays open across the rollover.
 */
function TodayBadge() {
  const [today, setToday] = useState(() => formatToday(new Date()));

  useEffect(() => {
    let timeoutId: number | undefined;

    function schedule() {
      timeoutId = window.setTimeout(() => {
        setToday(formatToday(new Date()));
        schedule();
      }, msUntilMidnight());
    }

    schedule();

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <span className="text-sm font-medium tabular-nums leading-none">
      {today}
    </span>
  );
}

export default TodayBadge;
