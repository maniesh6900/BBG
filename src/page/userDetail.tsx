import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { totalPaid } from '../lib/payments';
import { supabase } from '../lib/useUserSupabase';
import UserPayment from '../payment/userPayment';
import { usePaymentStore } from '../store/usePaymentStore';
import { useUserStore } from '../store/useUserStore';
import type { UserProfile } from '../store/useUserStore';
import type { FormEvent } from 'react';

function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteStatus = useUserStore((state) => state.deleteStatus);
  const deleteError = useUserStore((state) => state.deleteError);
  const deleteUser = useUserStore((state) => state.deleteUser);
  const resetDelete = useUserStore((state) => state.resetDelete);

  // The user's payments are loaded by UserPayment below; they are the source
  // of truth for the Total paid row.
  const payments = usePaymentStore((state) => state.payments);
  const paymentsUserId = usePaymentStore((state) => state.paymentsUserId);
  const paymentsLoaded = usePaymentStore((state) => state.paymentsLoaded);

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

  // Sum loaded payment rows; fall back to the DB total until loading succeeds.
  const totalPaidDisplay =
    paymentsUserId === profile.id && paymentsLoaded
      ? totalPaid(payments.map((payment) => payment.amount))
      : Number(profile.total_amount ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        {editing ? (
          <EditProfileForm
            profile={profile}
            onDone={(updated) => {
              setProfile(updated);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h1 className="font-medium">Profile</h1>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-lg px-2 py-1.5 text-sm font-medium text-blue-600 transition hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-lg px-2 py-1.5 text-sm font-medium text-red-600 transition hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>

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
              <div className="flex justify-between px-4 py-3">
                <dt className="text-gray-500">Total paid</dt>
                <dd className="font-medium tabular-nums text-gray-900">
                  {totalPaidDisplay.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </dd>
              </div>
            </dl>
          </>
        )}

        <BackLink />
      </div>

      <UserPayment userId={profile.id} />

      {confirmingDelete && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 p-4 sm:items-center"
          onClick={() => {
            resetDelete();
            setConfirmingDelete(false);
          }}
        >
          <div
            className="relative w-full max-w-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="font-medium">Delete user?</h2>
              <p className="mt-1 text-sm text-gray-600">
                This permanently removes{' '}
                <span className="font-medium text-gray-900">
                  {profile.username}
                </span>{' '}
                and all of their payments.
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const deleted = await deleteUser(profile.id);

                    if (deleted) {
                      // Stay in the Users tab; replace so Back skips the
                      // now-deleted user's page.
                      navigate('/users', { replace: true });
                    }
                  }}
                  disabled={deleteStatus === 'loading'}
                  className="flex-1 rounded-md bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteStatus === 'loading' ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetDelete();
                    setConfirmingDelete(false);
                  }}
                  className="rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>

              {deleteError && (
                <p className="mt-2 text-sm text-red-600">{deleteError}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface EditProfileFormProps {
  profile: UserProfile;
  /** Called with the saved profile after a successful update. */
  onDone: (updated: UserProfile) => void;
  onCancel: () => void;
}

function EditProfileForm({ profile, onDone, onCancel }: EditProfileFormProps) {
  const updateStatus = useUserStore((state) => state.updateStatus);
  const updateError = useUserStore((state) => state.updateError);
  const updateUser = useUserStore((state) => state.updateUser);
  const resetUpdate = useUserStore((state) => state.resetUpdate);

  // Local draft state, so cancelling discards any half-typed edits.
  const [username, setUsername] = useState(profile.username);
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number);
  const [gender, setGender] = useState(profile.gender ?? '');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const updated = await updateUser(profile.id, {
      username,
      phone_number: phoneNumber,
      gender,
    });

    if (updated) {
      onDone(updated);
    }
  }

  function handleCancel() {
    resetUpdate();
    onCancel();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5"
    >
      <h2 className="font-medium">Edit profile</h2>

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        required
        className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
      />
      <input
        type="tel"
        inputMode="tel"
        placeholder="Phone number (e.g. +249912345678)"
        value={phoneNumber}
        onChange={(event) => setPhoneNumber(event.target.value)}
        required
        className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
      />
      <select
        value={gender}
        onChange={(event) => setGender(event.target.value)}
        required
        aria-label="Gender"
        className={`rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500 ${
          gender === '' ? 'text-gray-500' : 'text-gray-900'
        }`}
      >
        <option value="" disabled>
          Gender…
        </option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
        <option value="Other">Other</option>
      </select>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={updateStatus === 'loading'}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {updateStatus === 'loading' ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>

      {updateError && <p className="text-sm text-red-600">{updateError}</p>}
    </form>
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
