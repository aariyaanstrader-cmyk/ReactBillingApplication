import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await login(form.username, form.password);
    if (res.success) navigate('/');
    else setError(res.message);
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#800020] to-[#b8860b] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-[#8b6914]/30">
            <span className="text-2xl font-black text-white">M</span>
          </div>
          <h1 className="text-2xl font-black text-[#3d2b1f]">MM<span className="text-[#8b6914]"> Jewels</span></h1>
          <p className="text-[#b0a090] text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="bg-white border border-[#e0d5c5] rounded-2xl shadow-lg p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl mb-4 font-medium">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#7a6652] mb-1.5 uppercase tracking-wider">Username</label>
              <input type="text" required autoFocus value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full bg-[#faf7f2] border border-[#d4c5b0] rounded-xl px-4 py-2.5 text-sm text-[#3d2b1f] placeholder-[#b0a090] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/40 focus:border-[#8b6914]/30"
                placeholder="Enter username" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7a6652] mb-1.5 uppercase tracking-wider">Password</label>
              <input type="password" required value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[#faf7f2] border border-[#d4c5b0] rounded-xl px-4 py-2.5 text-sm text-[#3d2b1f] placeholder-[#b0a090] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/40 focus:border-[#8b6914]/30"
                placeholder="Enter password" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[#8b6914] hover:bg-[#7a5c10] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-[#8b6914]/20 mt-1">
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
