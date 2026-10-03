import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/useUserSupabase';
import UserPayment from '../payment/userPayment';
import type { UserProfile } from '../store/useUserStore';

function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let active = true;

    async function getUser() {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (!active) return;

      if (error) {
        setError(error.message);
        return;
      }

      setProfile(data);
    }

    getUser();

    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <div>
        <p className="text-sm text-red-600">{error}</p>
        <BackLink />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <dl className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex justify-between px-4 py-3">
            <dt className="text-gray-500">Username</dt>
            <dd>{profile.username}</dd>
          </div>
          <div className="flex justify-between px-4 py-3">
            <dt className="text-gray-500">Phone number</dt>
            <dd>{profile.phone_number}</dd>
          </div>
          <div className="flex justify-between px-4 py-3">
            <dt className="text-gray-500">Gender</dt>
            <dd>{profile.gender ?? '—'}</dd>
          </div>
        </dl>

        <BackLink />
      </div>

      <UserPayment userId={profile.id} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-block text-sm text-blue-600 hover:underline"
    >
      Back to home
    </Link>
  );
}

export default UserDetail;
