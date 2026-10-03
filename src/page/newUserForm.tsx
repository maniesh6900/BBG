import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isValidPhone } from '../lib/phone';
import { useUserStore } from '../store/useUserStore';
import type { FormEvent } from 'react';

const PHONE_ERROR =
  'Enter a valid phone number: 7-15 digits, optionally starting with +';

interface NewUserFormProps {
  /** Optional escape hatch instead of navigating (e.g. inside a modal). */
  onClose?: () => void;
}

function NewUserForm({ onClose }: NewUserFormProps) {
  const profile = useUserStore((state) => state.profile);
  const status = useUserStore((state) => state.status);
  const error = useUserStore((state) => state.error);
  const setField = useUserStore((state) => state.setField);
  const createUser = useUserStore((state) => state.createUser);

  const navigate = useNavigate();

  // Shown under the phone field before submit is ever sent.
  const [phoneError, setPhoneError] = useState<string | null>(null);

  function handlePhoneChange(value: string) {
    setField('phone_number', value);
    setPhoneError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Block the request early on an invalid number.
    if (!isValidPhone(profile.phone_number)) {
      setPhoneError(PHONE_ERROR);
      return;
    }

    const created = await createUser();

    if (!created) return;

    setPhoneError(null);

    // Inside a modal, just close it — the list is already visible behind it.
    if (onClose) {
      onClose();
      return;
    }

    // Jump straight to the new user's profile.
    navigate(`/user/${created.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5"
    >
      <h2 className="font-medium">New user</h2>

      <input
        type="text"
        placeholder="full name"
        value={profile.username}
        onChange={(event) => setField('username', event.target.value)}
        required
        className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
      />
      <input
        type="tel"
        inputMode="tel"
        placeholder="Phone number"
        value={profile.phone_number}
        onChange={(event) => handlePhoneChange(event.target.value)}
        required
        aria-invalid={phoneError ? true : undefined}
        className={`rounded-md border px-3 py-2 outline-none focus:border-blue-500 ${
          phoneError ? 'border-red-400' : 'border-gray-300'
        }`}
      />
      {phoneError && <p className="text-sm text-red-600">{phoneError}</p>}
      <select
        value={profile.gender}
        onChange={(event) => setField('gender', event.target.value)}
        required
        aria-label="Gender"
        className={`rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500 ${
          profile.gender === '' ? 'text-gray-500' : 'text-gray-900'
        }`}
      >
        <option value="" disabled>
          Gender…
        </option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
        <option value="Other">Other</option>
      </select>
      <button
        type="submit"
        disabled={status === 'loading'}
        className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {status === 'loading' ? 'Creating…' : 'Create user'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export default NewUserForm;
