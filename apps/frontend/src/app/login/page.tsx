'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getApiUrl, getBackendUrl } from '../lib/api';
import {
  Boxes,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { authenticated, initialized, loginWithCredentials } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [platformLogo, setPlatformLogo] = useState<string | null>(null);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const { getApiUrl } = await import('../lib/api');
        const res = await fetch(`${getApiUrl()}/system-settings`);
        if (res.ok) {
          const data = await res.json();
          if (data.platform_logo_url) {
            setPlatformLogo(data.platform_logo_url);
          }
        }
      } catch (e) { }
    };
    fetchBranding();
  }, []);

  useEffect(() => {
    // If user is ALREADY logged in, redirect away from login to /map
    if (initialized && authenticated) {
      router.replace('/map');
    }
  }, [initialized, authenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await loginWithCredentials(email, password);
      router.push('/map');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk. Periksa kembali email & kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  if (!initialized || authenticated) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center space-y-3 font-sans text-foreground">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-muted-foreground">Memuat Halaman...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-background text-foreground flex flex-col justify-between p-6 font-sans relative overflow-hidden">

      {/* Background Subtle Accent */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header (Removed logo) */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between z-10">
      </header>

      {/* Main Container */}
      <main className="w-full max-w-md mx-auto z-10 my-auto">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl space-y-6">

          {/* Card Title */}
          <div className="flex flex-col items-center space-y-3 text-center mb-2">
            {platformLogo ? (
              <img src={`${getBackendUrl()}${platformLogo}`} alt="GeoMesh Logo" className="object-contain h-12 w-auto max-w-full" />
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-sm">
                <Boxes className="h-7 w-7 text-primary" />
              </div>
            )}
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Welcome To Platform GeoMesh
            </h2>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email Pengguna
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="nama@perusahaan.com"
                className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Kata Sandi
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Memverifikasi...
                </span>
              ) : (
                <>
                  <span>Masuk ke Konsol</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

        </div>
      </main>
    </div>
  );
}
