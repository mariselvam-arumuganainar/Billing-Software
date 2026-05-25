'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Cookies from 'js-cookie';
import { apiClient } from '@/lib/api';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
type Status   = 'PENDING' | 'DONE' | 'SNOOZED';

interface Reminder {
  id: string;
  title: string;
  description?: string | null;
  reminderAt: string;
  priority: Priority;
  status: Status;
  repeat?: string | null;
}

const PRIORITY_COLOR: Record<Priority, string> = {
  LOW:    '#10b981',
  MEDIUM: '#f59e0b',
  HIGH:   '#ef4444',
};

function BellIcon({ hasDue }: { hasDue: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      {hasDue
        ? <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" fill="rgba(239,68,68,0.2)" stroke="#ef4444"/>
        : <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>
      }
    </svg>
  );
}

function XIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}

function fmtDt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

const BLANK_FORM = { title: '', description: '', reminderAt: '', priority: 'MEDIUM' as Priority };

export default function ReminderFloat() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const token = Cookies.get('token');
  const [open, setOpen]           = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [dueIds, setDueIds]       = useState<Set<string>>(new Set());
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(BLANK_FORM);
  const [saving, setSaving]       = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const notifiedRef               = useRef<Set<string>>(new Set());
  const panelRef                  = useRef<HTMLDivElement>(null);

  const fetchReminders = useCallback(async () => {
    try {
      const r = await apiClient.get('/reminders?status=PENDING');
      setReminders(r.data.reminders ?? []);
    } catch {}
  }, []);

  const fetchDue = useCallback(async () => {
    try {
      const r = await apiClient.get('/reminders/due');
      const due: Reminder[] = r.data.reminders ?? [];
      const ids = new Set(due.map(d => d.id));
      setDueIds(ids);

      due.forEach(rem => {
        if (!notifiedRef.current.has(rem.id)) {
          notifiedRef.current.add(rem.id);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Reminder: ${rem.title}`, {
              body: rem.description ?? fmtDt(rem.reminderAt),
              icon: '/favicon.ico',
            });
          }
        }
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!token) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    fetchReminders();
    fetchDue();
    const iv = setInterval(() => { fetchReminders(); fetchDue(); }, 30_000);
    return () => clearInterval(iv);
  }, [token, fetchReminders, fetchDue]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  if (!mounted || !token) return null;

  const hasDue = dueIds.size > 0;

  async function handleSave() {
    if (!form.title.trim() || !form.reminderAt) return;
    setSaving(true);
    try {
      if (editId) {
        await apiClient.put(`/reminders/${editId}`, form);
      } else {
        await apiClient.post('/reminders', form);
      }
      setForm(BLANK_FORM);
      setShowForm(false);
      setEditId(null);
      await fetchReminders();
    } catch {}
    setSaving(false);
  }

  async function markDone(id: string) {
    try {
      await apiClient.patch(`/reminders/${id}/done`);
      setReminders(r => r.filter(x => x.id !== id));
      setDueIds(s => { const n = new Set(s); n.delete(id); return n; });
    } catch {}
  }

  async function snooze(id: string) {
    try {
      await apiClient.patch(`/reminders/${id}/snooze`, { minutes: 30 });
      notifiedRef.current.delete(id);
      setDueIds(s => { const n = new Set(s); n.delete(id); return n; });
    } catch {}
  }

  async function deleteReminder(id: string) {
    try {
      await apiClient.delete(`/reminders/${id}`);
      setReminders(r => r.filter(x => x.id !== id));
      setDueIds(s => { const n = new Set(s); n.delete(id); return n; });
    } catch {}
  }

  function startEdit(rem: Reminder) {
    setEditId(rem.id);
    setForm({
      title: rem.title,
      description: rem.description ?? '',
      reminderAt: rem.reminderAt.slice(0, 16),
      priority: rem.priority,
    });
    setShowForm(true);
  }

  const dueList    = reminders.filter(r => dueIds.has(r.id));
  const pendingList = reminders.filter(r => !dueIds.has(r.id));

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-[9999] rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 print:hidden"
        style={{
          width: 52, height: 52,
          background: hasDue
            ? 'linear-gradient(135deg,#ef4444,#f97316)'
            : 'linear-gradient(135deg,#4361EE,#738DEE)',
          boxShadow: hasDue
            ? '0 0 0 3px rgba(239,68,68,0.25), 0 8px 24px rgba(239,68,68,0.35)'
            : '0 0 0 3px rgba(67,97,238,0.18), 0 8px 24px rgba(67,97,238,0.28)',
          color: '#ffffff',
        }}
        title="Reminders"
      >
        <BellIcon hasDue={hasDue} />
        {(hasDue || reminders.length > 0) && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: hasDue ? '#ef4444' : '#4361EE' }}
          >
            {hasDue ? dueIds.size : reminders.length}
          </span>
        )}
      </button>

      {/* Side panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-6 z-[9998] w-80 max-h-[70vh] rounded-2xl flex flex-col overflow-hidden print:hidden"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(67,97,238,0.12)',
            boxShadow: '0 12px 40px rgba(67,97,238,0.12), 0 4px 10px rgba(0,0,0,0.06)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}
          >
            <span className="font-bold text-sm" style={{ color: '#1A1F36' }}>Reminders</span>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(v => !v); setEditId(null); setForm(BLANK_FORM); }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#5A6882' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(67,97,238,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#4361EE'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#5A6882'; }}
                title="New reminder"
              >
                <PlusIcon />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#5A6882' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#1A1F36'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#5A6882'; }}
              >
                <XIcon />
              </button>
            </div>
          </div>

          {/* Create / Edit form */}
          {showForm && (
            <div className="p-4 space-y-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <input
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: '#F0F3F8',
                  border: '1px solid rgba(67,97,238,0.2)',
                  color: '#1A1F36',
                }}
                placeholder="Title *"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
              <input
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: '#F0F3F8',
                  border: '1px solid rgba(67,97,238,0.2)',
                  color: '#1A1F36',
                }}
                placeholder="Description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
              <input
                type="datetime-local"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: '#F0F3F8',
                  border: '1px solid rgba(67,97,238,0.2)',
                  color: '#1A1F36',
                }}
                value={form.reminderAt}
                onChange={e => setForm(f => ({ ...f, reminderAt: e.target.value }))}
              />
              <div className="flex gap-2">
                {(['LOW', 'MEDIUM', 'HIGH'] as Priority[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: form.priority === p ? PRIORITY_COLOR[p] + '18' : '#F0F3F8',
                      color: form.priority === p ? PRIORITY_COLOR[p] : '#8FA3BF',
                      border: `1px solid ${form.priority === p ? PRIORITY_COLOR[p] + '50' : 'rgba(0,0,0,0.08)'}`,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title.trim() || !form.reminderAt}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-40"
                  style={{ background: '#4361EE' }}
                >
                  {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditId(null); setForm(BLANK_FORM); }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                  style={{ color: '#5A6882', background: '#F0F3F8' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Reminder list */}
          <div className="flex-1 overflow-y-auto">
            {dueList.length === 0 && pendingList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-sm" style={{ color: '#8FA3BF' }}>
                <span className="text-3xl mb-2">🔔</span>
                No reminders
              </div>
            )}

            {dueList.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ef4444' }}>Due Now</div>
                {dueList.map(rem => (
                  <ReminderRow
                    key={rem.id}
                    rem={rem}
                    isDue
                    onDone={() => markDone(rem.id)}
                    onSnooze={() => snooze(rem.id)}
                    onEdit={() => startEdit(rem)}
                    onDelete={() => deleteReminder(rem.id)}
                  />
                ))}
              </div>
            )}

            {pendingList.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8FA3BF' }}>Upcoming</div>
                {pendingList.map(rem => (
                  <ReminderRow
                    key={rem.id}
                    rem={rem}
                    isDue={false}
                    onDone={() => markDone(rem.id)}
                    onSnooze={() => snooze(rem.id)}
                    onEdit={() => startEdit(rem)}
                    onDelete={() => deleteReminder(rem.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ReminderRow({
  rem, isDue, onDone, onSnooze, onEdit, onDelete,
}: {
  rem: Reminder;
  isDue: boolean;
  onDone: () => void;
  onSnooze: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="px-4 py-3 transition-colors"
      style={{
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        background: isDue ? 'rgba(239,68,68,0.05)' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5"
              style={{ background: PRIORITY_COLOR[rem.priority] }}
            />
            <p className="text-sm font-semibold truncate" style={{ color: '#1A1F36' }}>{rem.title}</p>
          </div>
          {rem.description && (
            <p className="text-xs ml-3.5 mt-0.5 truncate" style={{ color: '#5A6882' }}>{rem.description}</p>
          )}
          <p className="text-[10px] ml-3.5 mt-1" style={{ color: '#8FA3BF' }}>{fmtDt(rem.reminderAt)}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {isDue && (
            <button
              onClick={onSnooze}
              className="text-[10px] px-1.5 py-1 rounded transition-colors"
              style={{ background: 'rgba(0,0,0,0.06)', color: '#5A6882' }}
              title="Snooze 30 min"
            >
              +30m
            </button>
          )}
          <button
            onClick={onDone}
            className="text-[10px] px-1.5 py-1 rounded transition-colors"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
            title="Mark done"
          >
            ✓
          </button>
          <button
            onClick={onEdit}
            className="text-[10px] px-1.5 py-1 rounded transition-colors"
            style={{ background: 'rgba(0,0,0,0.06)', color: '#5A6882' }}
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            className="text-[10px] px-1.5 py-1 rounded transition-colors"
            style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
