export function getBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace('/api', '');
  }
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    
    // Check if we are running in localhost or local IP
    const isLocal = hostname === 'localhost' || 
                    hostname === '127.0.0.1' || 
                    hostname.startsWith('192.168.') || 
                    hostname.startsWith('10.') || 
                    hostname.startsWith('172.');
                    
    if (isLocal) {
      // For local network / local access, backend runs on port 4000
      return `http://${hostname}:4000`;
    } else {
      // For public domain access via Cloudflare Tunnel
      // Using first-level subdomains (geomesh-api) to bypass Cloudflare SSL multi-level limitation
      const wsProtocol = protocol === 'https:' ? 'https' : 'http';
      if (hostname === 'geomesh.vantara.my.id') {
        return `${wsProtocol}://geomesh-api.vantara.my.id`;
      }
      return `${wsProtocol}://api-${hostname}`;
    }
  }
  return 'http://localhost:4000';
}

export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return `${getBackendUrl()}/api`;
}

export function getKeycloakUrl(): string {
  if (process.env.NEXT_PUBLIC_KEYCLOAK_URL) {
    return process.env.NEXT_PUBLIC_KEYCLOAK_URL;
  }
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    const isLocal = hostname === 'localhost' || 
                    hostname === '127.0.0.1' || 
                    hostname.startsWith('192.168.') || 
                    hostname.startsWith('10.') || 
                    hostname.startsWith('172.');
                    
    if (isLocal) {
      return `http://${hostname}:8080`;
    } else {
      // Using first-level subdomains (geomesh-auth) to bypass Cloudflare SSL multi-level limitation
      const wsProtocol = protocol === 'https:' ? 'https' : 'http';
      if (hostname === 'geomesh.vantara.my.id') {
        return `${wsProtocol}://geomesh-auth.vantara.my.id`;
      }
      return `${wsProtocol}://auth-${hostname}`;
    }
  }
  return 'http://localhost:8080';
}
