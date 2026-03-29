import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { getCurrentUser, setTokenGetter, updateRole } from '@/api/client';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'donor' | 'ngo' | 'verifier' | 'admin' | null;
  avatar?: string;
  wallet_address?: string;
}

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsRoleSelection: boolean;
  login: (options?: { screen_hint?: string; returnTo?: string }) => void;
  logout: () => void;
  setRole: (role: 'donor' | 'ngo') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ROLE_CLAIM = 'https://clearfund.app/role';
const USER_CACHE_KEY = 'clearfund_app_user';

interface CachedUserPayload {
  sub: string;
  user: AppUser;
}

function readCachedUser(sub: string | null): AppUser | null {
  if (!sub) return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUserPayload;
    if (!parsed?.user || parsed.sub !== sub) return null;
    return parsed.user;
  } catch {
    return null;
  }
}

function writeCachedUser(sub: string, user: AppUser) {
  try {
    const payload: CachedUserPayload = { sub, user };
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore cache write failures.
  }
}

function clearCachedUser() {
  try {
    localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Ignore cache clear failures.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const {
    user: auth0User,
    isAuthenticated,
    isLoading: auth0Loading,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileResolvedFromBackend, setProfileResolvedFromBackend] = useState(false);
  const getTokenSilentlyRef = useRef(getAccessTokenSilently);

  const auth0Sub = auth0User?.sub ?? null;
  const auth0Name = auth0User?.name ?? auth0User?.email ?? '';
  const auth0Email = auth0User?.email ?? '';
  const auth0Avatar = auth0User?.picture;
  const tokenRole = (auth0User?.[ROLE_CLAIM] as AppUser['role']) ?? null;

  useEffect(() => {
    getTokenSilentlyRef.current = getAccessTokenSilently;
  }, [getAccessTokenSilently]);

  useEffect(() => {
    if (isAuthenticated) {
      setTokenGetter(() => getTokenSilentlyRef.current());
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !auth0Sub) {
      setAppUser(null);
      setProfileResolvedFromBackend(false);
      return;
    }

    const cachedUser = readCachedUser(auth0Sub);
    const fallbackUser: AppUser = {
      id: cachedUser?.id ?? auth0Sub,
      name: auth0Name || cachedUser?.name || '',
      email: auth0Email || cachedUser?.email || '',
      role: cachedUser?.role ?? tokenRole,
      avatar: auth0Avatar ?? cachedUser?.avatar,
      wallet_address: cachedUser?.wallet_address,
    };
    setAppUser(prev => prev ?? fallbackUser);

    let cancelled = false;

    async function fetchProfile() {
      setProfileLoading(true);
      try {
        const profile = await getCurrentUser() as {
          _id?: string;
          id?: string;
          role?: AppUser['role'];
          wallet_address?: string;
        };
        if (!cancelled) {
          const nextUser: AppUser = {
            id: profile._id ?? profile.id ?? fallbackUser.id,
            name: fallbackUser.name,
            email: fallbackUser.email,
            role: profile.role ?? cachedUser?.role ?? fallbackUser.role,
            avatar: fallbackUser.avatar,
            wallet_address: profile.wallet_address ?? cachedUser?.wallet_address,
          };
          setAppUser(nextUser);
          writeCachedUser(auth0Sub!, nextUser);
          setProfileResolvedFromBackend(true);
        }
      } catch {
        if (!cancelled) {
          // Keep cached/fallback user so we don't force role selection on temporary backend failures.
          setAppUser(prev => prev ?? fallbackUser);
          setProfileResolvedFromBackend(false);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, auth0Sub, auth0Name, auth0Email, auth0Avatar, tokenRole]);

  const login = useCallback((options?: { screen_hint?: string; returnTo?: string }) => {
    loginWithRedirect({
      authorizationParams: {
        screen_hint: options?.screen_hint,
      },
      appState: {
        returnTo: options?.returnTo ?? '/dashboard',
      },
    });
  }, [loginWithRedirect]);

  const logout = useCallback(() => {
    setAppUser(null);
    setProfileResolvedFromBackend(false);
    clearCachedUser();
    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }, [auth0Logout]);

  const setRole = useCallback(async (role: 'donor' | 'ngo') => {
    const updated = await updateRole(role) as {
      _id?: string;
      id?: string;
      role?: AppUser['role'];
      wallet_address?: string;
    };
    setAppUser(prev => {
      if (!prev) return prev;
      const nextUser: AppUser = {
        ...prev,
        id: updated._id ?? updated.id ?? prev.id,
        role: updated.role ?? role,
        wallet_address: updated.wallet_address ?? prev.wallet_address,
      };
      if (auth0Sub) writeCachedUser(auth0Sub, nextUser);
      return nextUser;
    });
    setProfileResolvedFromBackend(true);
  }, [auth0Sub]);

  const needsRoleSelection =
    isAuthenticated &&
    !!appUser &&
    !appUser.role &&
    profileResolvedFromBackend;

  return (
    <AuthContext.Provider
      value={{
        user: appUser,
        isAuthenticated,
        isLoading: auth0Loading || (profileLoading && !appUser),
        needsRoleSelection,
        login,
        logout,
        setRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
