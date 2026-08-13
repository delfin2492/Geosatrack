'use client';

import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Settings, Mail, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, Send } from 'lucide-react';

export default function SystemSettingsPage() {
  const { isSuperAdmin, token } = useAuth();
  
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [msgSuccess, setMsgSuccess] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/system-settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSmtpHost(data.SMTP_HOST || '');
        setSmtpPort(data.SMTP_PORT || '');
        setSmtpUser(data.SMTP_USER || '');
        setSmtpPass(data.SMTP_PASS || '');
        setTelegramToken(data.TELEGRAM_BOT_TOKEN || '');
      }
    } catch (err) {
      console.error('Failed to fetch system settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSettings();
    }
  }, [isSuperAdmin]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgError(null);
    setMsgSuccess(null);
    setSaving(true);

    try {
      const res = await fetch(`${getApiUrl()}/system-settings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          SMTP_HOST: smtpHost,
          SMTP_PORT: smtpPort,
          SMTP_USER: smtpUser,
          SMTP_PASS: smtpPass,
          TELEGRAM_BOT_TOKEN: telegramToken,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update system settings.');
      }

      setMsgSuccess('System settings successfully updated!');
      setTimeout(() => setMsgSuccess(null), 3000);
    } catch (err: any) {
      setMsgError(err.message || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive w-12 h-12 mx-auto flex items-center justify-center">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-sm font-bold text-foreground">Access Denied (Superadmin Only)</h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          System Settings can only be accessed by the Superadmin account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-secondary border text-foreground">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                System Settings
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Manage global configurations and integrations for the entire platform.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader className="border-b border-border py-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Mail className="h-4.5 w-4.5 text-primary" />
            Global SMTP Configuration
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            These settings will be used by all "SMTP Email" automation rule nodes across all tenants to send notification emails.
          </p>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-xs font-semibold">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading configurations...
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-5">
              
              {msgError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2 text-xs font-semibold">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{msgError}</span>
                </div>
              )}
              {msgSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2 text-xs font-semibold">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{msgSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">SMTP Host</label>
                  <Input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    required
                    placeholder="e.g. smtp.gmail.com"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">SMTP Port</label>
                  <Input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    required
                    placeholder="e.g. 587 or 465"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">SMTP User / Email</label>
                  <Input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    required
                    placeholder="e.g. alerts@geomesh.io"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">SMTP Password</label>
                  <div className="relative">
                    <Input
                      type={showPass ? 'text' : 'password'}
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      required
                      placeholder="App password or secret"
                      className="h-9 text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Send className="h-4.5 w-4.5 text-blue-500" />
                  <h3 className="text-sm font-bold text-foreground">Telegram Integration</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Set the main Bot Token here. Users will only need to input the target Chat ID when creating automation rules.
                </p>
                <div className="grid grid-cols-1 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Telegram Bot Token</label>
                    <div className="relative">
                      <Input
                        type={showTelegramToken ? 'text' : 'password'}
                        value={telegramToken}
                        onChange={(e) => setTelegramToken(e.target.value)}
                        placeholder="e.g. 123456789:ABCDEF1234567890abcdef1234567890"
                        className="h-9 text-sm pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTelegramToken(!showTelegramToken)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showTelegramToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border mt-6">
                <Button type="submit" disabled={saving} className="text-xs font-bold h-9 px-6 rounded-lg bg-primary">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Settings className="h-3.5 w-3.5 mr-2" />}
                  Save Configuration
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
