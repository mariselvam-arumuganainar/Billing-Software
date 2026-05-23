'use client';
export default function AdminRedirect() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07090E] p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-bold text-white">Admin Portal Moved</h1>
        <p className="text-white/50 text-sm">
          The Super Admin console has been moved to a dedicated portal.
        </p>
        <a
          href="http://localhost:3001"
          className="inline-block mt-4 px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}
        >
          Open Super Admin Console →
        </a>
        <p className="text-white/25 text-xs pt-2">
          Running at <span className="font-mono">localhost:3001</span>
        </p>
      </div>
    </div>
  );
}
