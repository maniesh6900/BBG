import { create } from 'zustand';
import { supabase } from '../lib/useUserSupabase';

export interface UserProfile {
  id: string;
  username: string;
  phone_number: string;
  created_at: string;
}

export type NewUserProfile = Pick<UserProfile, 'username' | 'phone_number'>;

type Status = 'idle' | 'loading' | 'success' | 'error';

interface UserState {
  profile: NewUserProfile;
  status: Status;
  error: string | null;
  setField: (field: keyof NewUserProfile, value: string) => void;
  resetProfile: () => void;
  /** Creates the user and returns their profile, or null on failure. */
  createUser: () => Promise<UserProfile | null>;
}

const emptyProfile: NewUserProfile = { username: '', phone_number: '' };

export const useUserStore = create<UserState>((set, get) => ({
  profile: { ...emptyProfile },
  status: 'idle',
  error: null,

  setField: (field, value) =>
    set((state) => ({ profile: { ...state.profile, [field]: value } })),

  resetProfile: () =>
    set({ profile: { ...emptyProfile }, status: 'idle', error: null }),

  createUser: async (): Promise<UserProfile | null> => {
    const { username, phone_number } = get().profile;
    const newUser = {
      username: username.trim(),
      phone_number: phone_number.trim(),
    };

    if (!newUser.username || !newUser.phone_number) {
      set({ status: 'error', error: 'Username and phone number are required' });
      return null;
    }

    set({ status: 'loading', error: null });

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
}));
