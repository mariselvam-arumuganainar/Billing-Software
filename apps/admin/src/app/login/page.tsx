'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { apiClient } from '@/lib/api';

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Cookies.get('sa_token')) router.replace('/dashboard');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { mobileNumber: username, password });
      const { token, role } = res.data;
      if (role !== 'SUPER_ADMIN') {
        setError('Access denied. This portal is for Super Admins only. Use the store portal at localhost:3000.');
        return;
      }
      Cookies.set('sa_token', token, { expires: 1 });
      Cookies.set('sa_role', role, { expires: 1 });
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center font-black text-white text-sm"
            style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}
          >
            SA
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Super Admin Console</p>
            <p className="text-white/40 text-xs">Restricted access</p>
          </div>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          <h1 className="text-xl font-bold text-white mb-1">Sign in</h1>
          <p className="text-white/40 text-sm mb-6">Super Admin credentials required</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="Super admin username"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          Store staff?{' '}
          <a href="http://localhost:3000" className="text-white/40 underline hover:text-white/60">
            Go to store portal
          </a>
        </p>
      </div>
    </div>
  );
}
