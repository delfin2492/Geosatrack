'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type Keycloak from 'keycloak-js';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
  isVerified: boolean;
  tenantId: string;
  tenantName: string;
}

interface AuthContextType {
  keycloak: Keycloak | null;
  authenticated: boolean;
  initialized: boolean;
  user: UserSession | null;
  role: string | null;
  username: string | null;
  email: string | null;
  tenantId: string | null;
  tenantName: string | null;
  token: string | null;
  isSuperAdmin: boolean;
  login: () => void;
  loginWithCredentials: (email: string, password?: string) => Promise<any>;
  switchTenantContext: (tenantId: string, tenantName: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  keycloak: null,
  authenticated: false,
  initialized: false,
  user: null,
  role: null,
  username: null,
  email: null,
  tenantId: null,
  tenantName: null,
  token: null,
  isSuperAdmin: false,
  login: () => {},
  loginWithCredentials: async () => {},
  switchTenantContext: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [keycloakInstance, setKeycloakInstance] = useState<Keycloak | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let hasStoredSession = false;

    // 1. Check local session storage
    const savedUser = localStorage.getItem('geomesh_user_session');
    if (savedUser) {
      try {
        const parsed: UserSession = JSON.parse(savedUser);
        setUser(parsed);
        setAuthenticated(true);
        hasStoredSession = true;
      } catch (e) {
        console.error('Failed to parse saved user session', e);
        localStorage.removeItem('geomesh_user_session');
      }
    }

    // 2. Initialize Keycloak in background if available
    const initKeycloak = async () => {
      try {
        const KeycloakClass = (await import('keycloak-js')).default;

        const url = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080';
        const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'geomesh';
        const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'geomesh-frontend';

        const kc = new KeycloakClass({ url, realm, clientId });

        const hasAuthCallback = window.location.hash.includes('code=') || window.location.search.includes('code=');

        const auth = await kc.init({
          onLoad: hasAuthCallback ? 'check-sso' : undefined,
          checkLoginIframe: false,
        });

        setKeycloakInstance(kc);
        if (auth && kc.tokenParsed) {
          const parsed = kc.tokenParsed as any;
          const userSession: UserSession = {
            id: parsed.sub || 'kc-user',
            email: parsed.email || 'user@geomesh.io',
            name: parsed.preferred_username || parsed.name || 'Keycloak User',
            role: parsed.role || 'tenant_admin',
            isVerified: true,
            tenantId: parsed.tenantId || 'pt-abc-logistics',
            tenantName: parsed.tenantName || 'PT ABC Logistics',
          };

          setUser(userSession);
          setAuthenticated(true);
          setToken(kc.token || null);
          localStorage.setItem('geomesh_user_session', JSON.stringify(userSession));
        } else if (!hasStoredSession) {
          setAuthenticated(false);
          setUser(null);
        }

        setInitialized(true);
      } catch (err) {
        if (!hasStoredSession) {
          setAuthenticated(false);
          setUser(null);
        }
        setInitialized(true);
      }
    };

    initKeycloak();
  }, []);

  const loginWithCredentials = async (emailStr: string, passwordStr?: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailStr, password: passwordStr }),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.message || 'Gagal login.');
    }

    const userSession: UserSession = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name || result.user.email.split('@')[0],
      role: result.user.role,
      isVerified: result.user.isVerified,
      tenantId: result.user.tenantId,
      tenantName: result.tenant?.name || 'PT ABC Logistics',
    };

    setUser(userSession);
    setAuthenticated(true);
    localStorage.setItem('geomesh_user_session', JSON.stringify(userSession));
    return userSession;
  };

  const switchTenantContext = (tenantId: string, tenantName: string) => {
    if (!user) return;
    const updated: UserSession = { ...user, tenantId, tenantName };
    setUser(updated);
    localStorage.setItem('geomesh_user_session', JSON.stringify(updated));
  };

  const login = () => {
    if (keycloakInstance) {
      keycloakInstance.login({ redirectUri: window.location.origin + '/map' });
    }
  };

  const logout = () => {
    localStorage.removeItem('geomesh_user_session');
    setUser(null);
    setAuthenticated(false);
    if (keycloakInstance && keycloakInstance.authenticated) {
      keycloakInstance.logout({ redirectUri: window.location.origin + '/login' });
    } else {
      window.location.href = '/login';
    }
  };

  const isSuperAdmin = user?.role === 'superadmin';

  return (
    <AuthContext.Provider
      value={{
        keycloak: keycloakInstance,
        authenticated,
        initialized,
        user,
        role: user?.role || null,
        username: user?.name || null,
        email: user?.email || null,
        tenantId: user?.tenantId || null,
        tenantName: user?.tenantName || null,
        token,
        isSuperAdmin,
        login,
        loginWithCredentials,
        switchTenantContext,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
