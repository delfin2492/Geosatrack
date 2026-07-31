'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type Keycloak from 'keycloak-js';

interface AuthContextType {
  keycloak: Keycloak | null;
  authenticated: boolean;
  initialized: boolean;
  username: string | null;
  email: string | null;
  tenantId: string | null;
  token: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  keycloak: null,
  authenticated: false,
  initialized: false,
  username: null,
  email: null,
  tenantId: null,
  token: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [keycloakInstance, setKeycloakInstance] = useState<Keycloak | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Dynamically load Keycloak to avoid Next.js SSR document/window undefined issues
    const initKeycloak = async () => {
      try {
        const KeycloakClass = (await import('keycloak-js')).default;
        
        const url = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080';
        const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'geomesh';
        const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'geomesh-frontend';

        // Check if Keycloak configuration is present
        if (!url || !realm || !clientId) {
          console.warn('⚠️ Keycloak configuration is missing. Running in Bypass/Developer Mode.');
          setInitialized(true);
          // Set dummy developer profile
          setUsername('Developer Admin');
          setEmail('developer@geomesh.local');
          setTenantId('pt-abc-logistics'); // dummy seed tenant id
          setAuthenticated(true);
          return;
        }

        const kc = new KeycloakClass({
          url,
          realm,
          clientId,
        });

        kc.onTokenExpired = () => {
          kc.updateToken(30)
            .then((refreshed) => {
              if (refreshed) {
                console.log('Token refreshed successfully');
                setToken(kc.token || null);
              }
            })
            .catch(() => {
              console.error('Failed to refresh token');
              kc.clearToken();
            });
        };

        // Only check login if returning from Keycloak authentication flow (prevents redirect to Keycloak 404 page)
        const hasAuthCallback = window.location.hash.includes('code=') || window.location.search.includes('code=');

        const auth = await kc.init({
          onLoad: hasAuthCallback ? 'check-sso' : undefined,
          checkLoginIframe: false,
        });

        setKeycloakInstance(kc);
        setAuthenticated(auth);
        setToken(kc.token || null);

        if (auth && kc.tokenParsed) {
          const parsed = kc.tokenParsed as any;
          setUsername(parsed.preferred_username || parsed.name || null);
          setEmail(parsed.email || null);
          
          // Map tenantId from custom Keycloak attribute/claim
          const tId = parsed.tenantId || parsed.tenant_id || parsed.realm_access?.tenantId;
          setTenantId(tId || 'pt-abc-logistics'); // default fallback if claim not present yet
        }

        setInitialized(true);
        console.log('Keycloak initialized successfully. Authenticated:', auth);
      } catch (error) {
        console.error('❌ Failed to initialize Keycloak. Falling back to Developer Mode.', error);
        setInitialized(true);
        // Fallback profile for easy local development
        setUsername('Dev Mode (Keycloak Offline)');
        setEmail('dev-mode@geomesh.local');
        setTenantId('pt-abc-logistics');
        setAuthenticated(true);
      }
    };

    initKeycloak();
  }, []);

  const login = () => {
    if (keycloakInstance) {
      keycloakInstance.login();
    } else {
      console.log('Dummy login clicked in developer mode');
    }
  };

  const logout = () => {
    if (keycloakInstance) {
      keycloakInstance.logout({
        redirectUri: window.location.origin,
      });
    } else {
      console.log('Dummy logout clicked in developer mode');
      setAuthenticated(false);
      setUsername(null);
      setEmail(null);
      setTenantId(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        keycloak: keycloakInstance,
        authenticated,
        initialized,
        username,
        email,
        tenantId,
        token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
