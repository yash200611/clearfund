import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  useEffect(() => {
    if (isAuthenticated) {
      setTokenGetter(getAccessTokenSilently);
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  useEffect(() => {
    if (!isAuthenticated || !auth0User) {
      setAppUser(null);
      return;
    }

    const u = auth0User;
    async function fetchProfile() {
      setProfileLoading(true);
      try {
        const token = await getAccessTokenSilently();
        const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const profile = await res.json();
          setAppUser({
            id: profile._id ?? profile.id ?? u.sub ?? '',
            name: u.name ?? u.email ?? '',
            email: u.email ?? '',
            role: profile.role ?? (u[ROLE_CLAIM] as AppUser['role']) ?? null,
            avatar: u.picture,
            wallet_address: profile.wallet_address,
          });
        } else {
          setAppUser({
            id: u.sub ?? '',
            name: u.name ?? u.email ?? '',
            email: u.email ?? '',
            role: (u[ROLE_CLAIM] as AppUser['role']) ?? null,
            avatar: u.picture,
          });
        }
      } catch {
        setAppUser({
          id: u.sub ?? '',
          name: u.name ?? u.email ?? '',
          email: u.email ?? '',
          role: (u[ROLE_CLAIM] as AppUser['role']) ?? null,
          avatar: u.picture,
        });
      } finally {
        setProfileLoading(false);
      }
    }

    fetchProfile();
  }, [isAuthenticated, auth0User, getAccessTokenSilently]);

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
