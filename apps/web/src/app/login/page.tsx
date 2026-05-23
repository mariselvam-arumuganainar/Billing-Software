'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { apiClient } from '@/lib/api';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=800';

const QUOTES = [
  "Today is a new day. It's your day. You shape it. Sign in to start managing your projects.",
  "Quality is not an act, it is a habit. Let's build excellence today.",
  "Opportunities don't happen. You create them with every interaction.",
  "The best way to predict the future is to create it, one invoice at a time.",
  "Do not wait; the time will never be 'just right.' Start where you stand.",
  "Focus on being productive instead of busy. Keep operations lean and clean.",
  "Success is not final; it is the courage to continue that counts.",
  "Make a customer, not just a sale. Loyalty is the ultimate currency.",
  "Your most unhappy customers are your greatest source of learning.",
  "Great things in business are done by a team of passionate minds.",
  "Every detail matters. Let's make today exceptionally seamless.",
  "A satisfied customer is the best business strategy of all."
];

export default function LoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [quote, setQuote] = useState('');
  const [imageUrl, setImageUrl] = useState(DEFAULT_IMAGE);
  const [imageLoaded, setImageLoaded] = useState(false);

  // 1. Pick a random quote on component mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * QUOTES.length);
    setQuote(QUOTES[randomIndex] || QUOTES[0]);

    // Check localStorage for the last tenant's custom illustration URL
    const cachedImage = localStorage.getItem('lastLoginImageUrl');
    if (cachedImage) {
      setImageUrl(cachedImage);
    }
  }, []);

  // 2. Dynamic live lookup of the custom login image as the user types
  useEffect(() => {
    if (!mobile) {
      setImageUrl(localStorage.getItem('lastLoginImageUrl') || DEFAULT_IMAGE);
      return;
    }

    // Debounce the dynamic lookup to avoid hitting the server too frequently
    const timer = setTimeout(async () => {
      try {
        const response = await apiClient.get(`/auth/login-config?query=${encodeURIComponent(mobile)}`);
        if (response.data.loginImageUrl) {
          setImageUrl(response.data.loginImageUrl);
          localStorage.setItem('lastLoginImageUrl', response.data.loginImageUrl);
        } else {
          // If no custom image is found or super-admin is typed, reset to the cached image or default
          const cached = localStorage.getItem('lastLoginImageUrl');
          if (mobile === 'WolfVillain') {
            setImageUrl(DEFAULT_IMAGE);
          } else {
            setImageUrl(cached || DEFAULT_IMAGE);
          }
        }
      } catch (err) {
        console.error('Failed to fetch dynamic login config:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [mobile]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login', { mobileNumber: mobile, password });
      const { token, tenantId, role } = response.data;

      // Save credentials in cookies for frontend sessions
      Cookies.set('token', token);
      Cookies.set('tenantId', tenantId);
      Cookies.set('role', role || 'CLIENT_OWNER');

      // Check if this tenant has a custom image to save in local cache
      try {
        const configRes = await apiClient.get(`/auth/login-config?query=${encodeURIComponent(mobile)}`);
        if (configRes.data.loginImageUrl) {
          localStorage.setItem('lastLoginImageUrl', configRes.data.loginImageUrl);
        }
      } catch (err) {
        console.error('Failed to cache image on successful login:', err);
      }

      // Redirect depending on user role
      if (role === 'SUPER_ADMIN') {
        // Super Admin uses the dedicated console at port 3001
        window.location.href = 'http://localhost:3001';
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07090E] p-4 md:p-8 font-sans">
      
      {/* Outer rounded card block */}
      <div className="w-full max-w-[1000px] bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden p-6 md:p-10 border border-slate-100 flex flex-col justify-between min-h-[620px]">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center flex-1">
          
          {/* Left Form Column */}
          <div className="col-span-1 md:col-span-6 flex flex-col justify-center px-2 md:px-8">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center">
                Welcome Back <span className="ml-2 animate-bounce">👋</span>
              </h1>
              <p className="text-slate-500 text-sm mt-3.5 leading-relaxed font-medium transition-all duration-500">
                {quote || "Loading your daily inspiration..."}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold animate-shake">
                ⚠️ {error}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="mobile">
                  Mobile Number or Username
                </label>
                <input
                  id="mobile"
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="e.g. 9876543210 or WolfVillain"
                  required
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all text-sm font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#1E293B] hover:bg-[#0F172A] active:bg-black text-white rounded-2xl font-bold shadow-lg shadow-slate-900/10 transform transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-950/20 disabled:opacity-50 text-sm mt-6 uppercase tracking-wider"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          </div>

          {/* Right Illustration Column */}
          <div className="col-span-1 md:col-span-6 h-[480px] relative rounded-3xl overflow-hidden group shadow-inner">
            <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent z-10 pointer-events-none rounded-3xl" />
            
            {/* Smooth transition image box */}
            <img
              src={imageUrl}
              alt="Premium Store Branding"
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
              }}
              className={`w-full h-full object-cover rounded-3xl transition-all duration-700 ease-in-out transform ${
                imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
            />
          </div>

        </div>

        {/* Footer Brand Copyright */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-400 font-extrabold tracking-[0.2em] uppercase">
            © 2026 ALL RIGHTS RESERVED
          </p>
        </div>

      </div>
    </div>
  );
}
