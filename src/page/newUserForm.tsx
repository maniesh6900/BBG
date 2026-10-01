import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import type { FormEvent } from 'react';

function NewUserForm() {
  const profile = useUserStore((state) => state.profile);
  const status = useUserStore((state) => state.status);
  const error = useUserStore((state) => state.error);
  const setField = useUserStore((state) => state.setField);
  const createUser = useUserStore((state) => state.createUser);

  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const created = await createUser();

    // Jump straight to the new user's profile.
    if (created) {
      navigate(`/user/${created.id}`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5"
    >
      <h2 className="font-medium">New user</h2>

      <input
        type="text"
        placeholder="Username"
        value={profile.username}
        onChange={(event) => setField('username', event.target.value)}
        required
        className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
      />
      <input
        type="tel"
        placeholder="Phone number"
        value={profile.phone_number}
        onChange={(event) => setField('phone_number', event.target.value)}
        required
        className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {status === 'loading' ? 'Creating…' : 'Create user'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === 'success' && (
        <p className="text-sm text-green-700">
          User created. Search above to find them.
        </p>
      )}
    </form>
  );
}

export default NewUserForm;
