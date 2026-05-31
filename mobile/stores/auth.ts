import {
  clearSessionToken,
  clearUserId,
  getSessionToken,
  getUserId,
} from '@/lib/auth/session';
import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  initialize: () => Promise<void>;
  setAuthenticated: (userId: string) => void;
  setUnauthenticated: () => void;
}

// Module-level flag that survives HMR because the module stays cached
let _hasInitialized = false;
let _cachedAuth = false;
let _cachedUserId: string | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  // Start with cached values if we've initialized before (HMR case)
  isAuthenticated: _cachedAuth,
  isLoading: !_hasInitialized,
  userId: _cachedUserId,

  initialize: async () => {
    // If already initialized (HMR), just use cached values
    if (_hasInitialized) {
      set({
        isAuthenticated: _cachedAuth,
        isLoading: false,
        userId: _cachedUserId,
      });
      return;
    }

    const token = await getSessionToken();
    const userId = await getUserId();

    _hasInitialized = true;

    if (token && userId) {
      _cachedAuth = true;
      _cachedUserId = userId;
      set({ isAuthenticated: true, isLoading: false, userId });
    } else if (token) {
      // Have token but no userId — still authenticated, validate lazily
      _cachedAuth = true;
      _cachedUserId = null;
      set({ isAuthenticated: true, isLoading: false, userId: null });
    } else {
      _cachedAuth = false;
      _cachedUserId = null;
      set({ isAuthenticated: false, isLoading: false, userId: null });
    }
  },

  setAuthenticated: (userId: string) => {
    _cachedAuth = true;
    _cachedUserId = userId;
    _hasInitialized = true;
    set({ isAuthenticated: true, userId });
  },

  setUnauthenticated: () => {
    _cachedAuth = false;
    _cachedUserId = null;
    set({ isAuthenticated: false, userId: null });
  },
}));
