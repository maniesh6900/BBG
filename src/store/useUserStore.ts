import { create } from 'zustand';
import { isValidPhone, normalizePhone } from '../lib/phone';
import { supabase } from '../lib/useUserSupabase';

export interface UserProfile {
  id: string;
  username: string;
  phone_number: string;
  gender: string | null;
  /** Running total of all payments, maintained by the payment_amount_sync trigger. */
  total_amount: number;
  created_at: string;
}

/** Editable profile fields, shared by create and update. */
export interface ProfileInput {
  username: string;
  phone_number: string;
  gender: string;
}

export type NewUserProfile = ProfileInput;

type Status = 'idle' | 'loading' | 'success' | 'error';

/** Validates profile fields; returns an error message, or null when valid. */
export function validateProfileInput(fields: ProfileInput): string | null {
  if (!fields.username.trim()) return 'Username is required';
  if (!fields.gender.trim()) return 'Gender is required';
  if (!normalizePhone(fields.phone_number)) return 'Phone number is required';
  if (!isValidPhone(fields.phone_number)) {
    return 'Enter a valid phone number: 7-15 digits, optionally starting with +';
  }

  return null;
}

/** Trims and normalizes fields ahead of an insert or update. */
function toProfileValues(fields: ProfileInput) {
  return {
    username: fields.username.trim(),
    phone_number: normalizePhone(fields.phone_number),
    gender: fields.gender.trim(),
  };
}

interface UserState {
  profile: NewUserProfile;
  status: Status;
  error: string | null;
  updateStatus: Status;
  updateError: string | null;
  deleteStatus: Status;
  deleteError: string | null;
  setField: (field: keyof NewUserProfile, value: string) => void;
  resetProfile: () => void;
  resetUpdate: () => void;
  resetDelete: () => void;
  /** Creates the user and returns their profile, or null on failure. */
  createUser: () => Promise<UserProfile | null>;
  /** Updates an existing user's profile, returning the saved row or null. */
  updateUser: (
    id: string,
    fields: ProfileInput,
  ) => Promise<UserProfile | null>;
  /** Deletes a user and their payments; true on success. */
  deleteUser: (id: string) => Promise<boolean>;
}

const emptyProfile: NewUserProfile = { username: '', phone_number: '', gender: '' };

export const useUserStore = create<UserState>((set, get) => ({
  profile: { ...emptyProfile },
  status: 'idle',
  error: null,
  updateStatus: 'idle',
  updateError: null,
  deleteStatus: 'idle',
  deleteError: null,

  setField: (field, value) =>
    set((state) => ({ profile: { ...state.profile, [field]: value } })),

  resetProfile: () =>
    set({ profile: { ...emptyProfile }, status: 'idle', error: null }),

  resetUpdate: () => set({ updateStatus: 'idle', updateError: null }),

  resetDelete: () => set({ deleteStatus: 'idle', deleteError: null }),

  createUser: async (): Promise<UserProfile | null> => {
    const invalid = validateProfileInput(get().profile);

    if (invalid) {
      set({ status: 'error', error: invalid });
      return null;
    }

    set({ status: 'loading', error: null });

    const newUser = toProfileValues(get().profile);

    const { data, error } = await supabase
      .from('users')
      .insert(newUser)
      .select()
      .single();

    if (error) {
      set({ status: 'error', error: error.message });
      return null;
    }

    set({ profile: { ...emptyProfile }, status: 'success', error: null });

    return data as UserProfile;
  },

  updateUser: async (id, fields): Promise<UserProfile | null> => {
    set({ updateStatus: 'loading', updateError: null });

    const invalid = validateProfileInput(fields);

    if (invalid) {
      set({ updateStatus: 'error', updateError: invalid });
      return null;
    }

    const updates = toProfileValues(fields);

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      set({ updateStatus: 'error', updateError: error.message });
      return null;
    }

    set({ updateStatus: 'success', updateError: null });

    return data as UserProfile;
  },

  deleteUser: async (id): Promise<boolean> => {
    set({ deleteStatus: 'loading', deleteError: null });

    const { data: deletedUsers, error } = await supabase.rpc('delete_user', {
      user_id: id,
    });

    if (error) {
      set({ deleteStatus: 'error', deleteError: error.message });
      return false;
    }

    if (deletedUsers !== 1) {
      set({
        deleteStatus: 'error',
        deleteError: `Expected to delete exactly one user, but deleted ${deletedUsers ?? 0}.`,
      });
      return false;
    }

    set({ deleteStatus: 'success', deleteError: null });

    return true;
  },
}));
