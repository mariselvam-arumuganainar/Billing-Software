'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { apiClient } from '@/lib/api';

type Tenant = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  profile?: { name: string; address?: string; gstNumber?: string };
  credentials?: { mobileNumber: string };
};

function logout(router: ReturnType<typeof useRouter>) {
  Cookies.remove('sa_token');
  Cookies.remove('sa_role');
  router.replace('/login');
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('clients');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newClient, setNewClient] = useState({ name: '', mobileNumber: '', password: '' });

  useEffect(() => {
    if (!Cookies.get('sa_token')) { router.replace('/login'); return; }
    fetchTenants();
  }, [router]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/tenants');
      setTenants(res.data.tenants || []);
    } catch { /* 401 handled by interceptor */ }
    finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.mobileNumber || !newClient.password) {
      setError('All fields are required'); return;
    }
    setSaving(true); setError('');
    try {
      await apiClient.post('/admin/tenants', newClient);
      setShowAddModal(false);
      setNewClient({ name: '', mobileNumber: '', password: '' });
      await fetchTenants();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create client');
    } finally { setSaving(false); }
  };

  const handleToggle = async (id: string, status: 'ACTIVE' | 'SUSPENDED') => {
    try {
      await apiClient.patch(`/admin/tenants/${id}/status`, {
        status: status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      });
      await fetchTenants();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Status update failed');
    }
  };

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.credentials?.mobileNumber || '').includes(search)
  );

  const tabs = [
    { id: 'clients', label: 'Clients', icon: '🏢' },
    { id: 'credentials', label: 'Credentials', icon: '🔐' },
    { id: 'logs', label: 'Logs', icon: '📝' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar */}
      <div
        className="h-14 flex items-center justify-between px-6 shrink-0"
        style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center font-black text-sm text-white"
            style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}
          >SA</div>
          <span className="text-sm font-bold text-white">Super Admin Console</span>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">● LIVE</span>
        </div>
        <div className="flex items-center gap-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={activeTab === t.id
                ? { background: 'rgba(255,255,255,0.15)', color: '#fff' }
                : { color: 'rgba(255,255,255,0.5)' }}
            >
              {t.icon} {t.label}
            </button>
          ))}
          <button
            onClick={() => logout(router)}
            className="ml-3 px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white transition-colors"
          >
            Sign out ↗
          </button>
        </div>
      </div>

      {/* Page header */}
      <header
        className="h-14 flex items-center justify-between px-8 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <h2 className="text-lg font-bold text-white capitalize">{activeTab}</h2>
        <span className="text-xs text-emerald-400 font-semibold">System: All Stable</span>
      </header>

      <div className="flex-1 overflow-auto p-8 relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 pointer-events-none" />

        {activeTab === 'clients' && (
          <div className="relative z-10 space-y-6 max-w-7xl mx-auto">
            {/* Toolbar */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <input
                type="text"
                placeholder="Search tenant or mobile..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-4 py-2 w-80 bg-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all outline-none"
              />
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center gap-2"
              >
                <span>+</span> Create Client Account
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {loading ? (
                <div className="text-center py-16 text-slate-400">Loading clients…</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">No client tenants found.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Store Name</th>
                      <th className="px-6 py-4">Login Mobile</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Created On</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(tenant => (
                      <tr key={tenant.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 text-sm">{tenant.name}</td>
                        <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                          {tenant.credentials?.mobileNumber || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                            tenant.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}>
                            {tenant.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {new Date(tenant.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleToggle(tenant.id, tenant.status)}
                            className={`text-xs font-extrabold px-3 py-1.5 rounded-lg border transition-all ${
                              tenant.status === 'ACTIVE'
                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {tenant.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab !== 'clients' && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3">
            <div className="text-5xl">🚧</div>
            <h3 className="text-lg font-bold text-slate-500">Module under development</h3>
            <p className="text-sm">The {activeTab} panel is part of the future enterprise pipeline.</p>
          </div>
        )}
      </div>

      {/* Create tenant modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Register New Tenant</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">{error}</div>
              )}
              {[
                { label: 'Store / Tenant Name', key: 'name', type: 'text', placeholder: 'e.g. City Supermarket' },
                { label: 'Login Mobile Number', key: 'mobileNumber', type: 'tel', placeholder: '9876543210' },
                { label: 'Login Password', key: 'password', type: 'password', placeholder: '••••••••' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={newClient[f.key as keyof typeof newClient]}
                    onChange={e => setNewClient(c => ({ ...c, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
              ))}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50">
                  {saving ? 'Creating…' : 'Register Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
