import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { setTokenGetter } from '@/api/client';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'donor' | 'ngo' | 'verifier' | 'admin';
  avatar?: string;
  wallet_address?: string;
}

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (options?: { screen_hint?: string }) => void;
  logout: () => void;
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

  // Register the token getter so client.ts can attach Bearer tokens
  useEffect(() => {
    if (isAuthenticated) {
      setTokenGetter(getAccessTokenSilently);
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  // Fetch backend profile after Auth0 login
  useEffect(() => {
    if (!isAuthenticated || !auth0User) {
      setAppUser(null);
      return;
    }

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
            id: profile._id ?? profile.id ?? auth0User.sub ?? '',
            name: auth0User.name ?? auth0User.email ?? '',
            email: auth0User.email ?? '',
            role: profile.role ?? auth0User[ROLE_CLAIM] ?? 'donor',
            avatar: auth0User.picture,
            wallet_address: profile.wallet_address,
          });
        } else {
          // Backend unreachable — fall back to Auth0 user info
          setAppUser({
            id: auth0User.sub ?? '',
            name: auth0User.name ?? auth0User.email ?? '',
            email: auth0User.email ?? '',
            role: (auth0User[ROLE_CLAIM] as AppUser['role']) ?? 'donor',
            avatar: auth0User.picture,
          });
        }
      } catch {
        setAppUser({
          id: auth0User.sub ?? '',
          name: auth0User.name ?? auth0User.email ?? '',
          email: auth0User.email ?? '',
          role: (auth0User[ROLE_CLAIM] as AppUser['role']) ?? 'donor',
          avatar: auth0User.picture,
        });
      } finally {
        setProfileLoading(false);
      }
    }

    fetchProfile();
  }, [isAuthenticated, auth0User, getAccessTokenSilently]);

  const login = useCallback((options?: { screen_hint?: string }) => {
    loginWithRedirect({
      authorizationParams: {
        screen_hint: options?.screen_hint,
      },
    });
  }, [loginWithRedirect]);

  const logout = useCallback(() => {
    setAppUser(null);
    auth0Logout({ logoutParams: { returnTo: window.location.origin } });
  }, [auth0Logout]);

  return (
    <AuthContext.Provider
      value={{
        user: appUser,
        isAuthenticated: isAuthenticated && !!appUser,
        isLoading: auth0Loading || profileLoading,
        login,
        logout,
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
