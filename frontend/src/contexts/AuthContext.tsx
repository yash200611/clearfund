import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { setTokenGetter, updateRole } from '@/api/client';

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
  login: (options?: { screen_hint?: string }) => void;
  logout: () => void;
  setRole: (role: 'donor' | 'ngo') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ROLE_CLAIM = 'https://clearfund.app/role';

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
      return;
    }

    const fallbackUser: AppUser = {
      id: auth0Sub,
      name: auth0Name,
      email: auth0Email,
      role: tokenRole,
      avatar: auth0Avatar,
    };

    let cancelled = false;

    async function fetchProfile() {
      setProfileLoading(true);
      try {
        const token = await getTokenSilentlyRef.current();
        const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const profile = await res.json();
          if (!cancelled) {
            setAppUser(prev => ({
              id: profile._id ?? profile.id ?? fallbackUser.id,
              name: fallbackUser.name,
              email: fallbackUser.email,
              role: profile.role ?? prev?.role ?? fallbackUser.role,
              avatar: fallbackUser.avatar,
              wallet_address: profile.wallet_address ?? prev?.wallet_address,
            }));
          }
        } else {
          if (!cancelled) {
            setAppUser(prev => prev ? {
              ...prev,
              name: prev.name || fallbackUser.name,
              email: prev.email || fallbackUser.email,
              avatar: prev.avatar ?? fallbackUser.avatar,
              role: prev.role ?? fallbackUser.role,
            } : fallbackUser);
          }
        }
      } catch {
        if (!cancelled) {
          setAppUser(prev => prev ? {
            ...prev,
            name: prev.name || fallbackUser.name,
            email: prev.email || fallbackUser.email,
            avatar: prev.avatar ?? fallbackUser.avatar,
            role: prev.role ?? fallbackUser.role,
          } : fallbackUser);
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

  const login = useCallback((options?: { screen_hint?: string }) => {
    loginWithRedirect({
      authorizationParams: { screen_hint: options?.screen_hint },
    });
  }, [loginWithRedirect]);

  const logout = useCallback(() => {
    setAppUser(null);
    auth0Logout({ logoutParams: { returnTo: window.location.origin } });
  }, [auth0Logout]);

  const setRole = useCallback(async (role: 'donor' | 'ngo') => {
    await updateRole(role);
    setAppUser(prev => prev ? { ...prev, role } : prev);
  }, []);

  const needsRoleSelection = isAuthenticated && !!appUser && !appUser.role;

  return (
    <AuthContext.Provider
      value={{
        user: appUser,
        isAuthenticated: isAuthenticated && !!appUser,
        isLoading: auth0Loading || profileLoading,
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
