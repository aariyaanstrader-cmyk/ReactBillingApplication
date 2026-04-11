import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import RateHeader from '../components/RateHeader';
import api from '../utils/api';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function CustomersList() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', address: '' });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const timer = useRef(null);

  const load = async (q = '') => {
    setLoading(true);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}&limit=100` : '?limit=100';
      const r = await api.get('/customers' + params);
      setCustomers(r.data.customers || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (q) => {
    setSearch(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(q), 300);
  };

  const flash = (text, ok = false) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: '', ok: false }), 3000); };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newCust.name.trim()) return;
    setAdding(true);
    try {
      await api.post('/customers', newCust);
      flash('Customer added!', true);
      setNewCust({ name: '', phone: '', address: '' });
      setShowAdd(false);
      load(search);
    } catch (err) { flash(err.response?.data?.message || 'Failed'); }
    finally { setAdding(false); }
  };

  const inputClass = 'w-full bg-[#faf7f2] border border-[#d4c5b0] rounded-xl px-3 py-2.5 text-sm text-[#3d2b1f] placeholder-[#b0a090] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/30';

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar />
      <RateHeader />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-black text-[#3d2b1f]">Customers</h2>
            <p className="text-xs text-[#7a6652] mt-0.5">{customers.length} records</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="bg-[#8b6914] hover:bg-[#a07a1a] text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            <span>Add<span className="hidden sm:inline"> Customer</span></span>
          </button>
        </div>

        {msg.text && (
          <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg.text}</div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm p-4 sm:p-5 mb-5">
            <h3 className="text-sm font-bold text-[#3d2b1f] mb-3">New Customer</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:items-end">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold mb-1">Name *</label>
                <input required value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} className={inputClass} placeholder="Customer name" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold mb-1">Phone</label>
                <input value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} className={inputClass} placeholder="Phone number" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold mb-1">Address</label>
                <input value={newCust.address} onChange={e => setNewCust({ ...newCust, address: e.target.value })} className={inputClass} placeholder="Address" />
              </div>
              <div className="sm:col-span-3 flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAdd(false)} className="text-[#7a6652] hover:text-[#3d2b1f] text-sm px-3 py-2.5">Cancel</button>
                <button type="submit" disabled={adding}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all whitespace-nowrap">
                  {adding ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full sm:max-w-md bg-[#faf7f2] border border-[#d4c5b0] rounded-xl px-4 py-2.5 text-sm text-[#3d2b1f] placeholder-[#b0a090] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/30" />
        </div>

        {/* List container */}
        <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e8dfd4]">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Phone</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Address</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Bills</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Total Value</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8dfd4]">
                {loading ? (
                  <tr><td colSpan="6" className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-[#7a6652]">
                      <div className="w-4 h-4 border-2 border-[#d4c5b0] border-t-[#8b6914] rounded-full animate-spin" />Loading…
                    </div>
                  </td></tr>
                ) : customers.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-12 text-[#7a6652] text-sm">No customers found</td></tr>
                ) : customers.map(c => (
                  <tr key={c._id} onClick={() => navigate(`/customers/${c._id}`)}
                    className="hover:bg-[#faf7f2] cursor-pointer transition-colors">
                    <td className="px-5 py-3 text-[#8b6914] font-semibold">{c.name}</td>
                    <td className="px-5 py-3 text-[#3d2b1f]">{c.phone || '—'}</td>
                    <td className="px-5 py-3 text-[#7a6652] text-xs">{c.address || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">{c.totalBills || 0}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-[#3d2b1f]">{fmt(c.totalValue || 0)}</td>
                    <td className="px-5 py-3 text-[#7a6652] text-xs">
                      {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-[#e8dfd4]">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-[#7a6652]">
                <div className="w-4 h-4 border-2 border-[#d4c5b0] border-t-[#8b6914] rounded-full animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-12 text-[#7a6652] text-sm">No customers found</div>
            ) : customers.map(c => (
              <div key={c._id} onClick={() => navigate(`/customers/${c._id}`)}
                className="px-3 py-3 hover:bg-[#faf7f2] active:bg-[#f5f0e8] cursor-pointer transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#8b6914] truncate">{c.name}</p>
                    {c.phone && <p className="text-xs text-[#3d2b1f] truncate">{c.phone}</p>}
                    {c.address && <p className="text-[10px] text-[#7a6652] truncate">{c.address}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{c.totalBills || 0} bill{(c.totalBills || 0) !== 1 ? 's' : ''}</span>
                    <p className="text-sm font-bold text-[#3d2b1f] mt-1">{fmt(c.totalValue || 0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
