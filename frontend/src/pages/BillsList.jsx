import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import RateHeader from '../components/RateHeader';
import api from '../utils/api';

export default function BillsList() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ from: '', to: '', billType: '' });
  const navigate = useNavigate();

  const fetchOrders = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 20 });
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.billType) params.append('billType', filters.billType);
      const res = await api.get(`/orders?${params}`);
      setOrders(res.data.orders || []);
      setTotal(res.data.total || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchOrders(page); }, [page]);

  const statusColors = {
    confirmed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
    draft: 'bg-amber-100 text-amber-700',
  };
  const totalPages = Math.ceil(total / 20);

  const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar />
      <RateHeader />
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-4 sm:mb-5 gap-2">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-[#3d2b1f]">Orders</h2>
            <p className="text-xs text-[#7a6652] mt-0.5">{total.toLocaleString()} records</p>
          </div>
          <button onClick={() => navigate('/new-bill')}
            className="bg-[#8b6914] hover:bg-[#7a5c10] text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-xl transition-all shadow-lg flex items-center gap-1.5 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            <span>New<span className="hidden sm:inline"> Order</span></span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#e0d5c5] rounded-xl p-2.5 sm:p-3 mb-4 flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-1.5 flex-1 sm:flex-none min-w-0">
            <label className="text-[10px] text-[#7a6652] uppercase tracking-wider font-semibold shrink-0">From</label>
            <input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })}
              className="min-w-0 flex-1 sm:flex-none bg-[#faf7f2] border border-[#d4c5b0] rounded-lg px-2 py-1.5 text-xs text-[#3d2b1f] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/50" />
          </div>
          <div className="flex items-center gap-1.5 flex-1 sm:flex-none min-w-0">
            <label className="text-[10px] text-[#7a6652] uppercase tracking-wider font-semibold shrink-0">To</label>
            <input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })}
              className="min-w-0 flex-1 sm:flex-none bg-[#faf7f2] border border-[#d4c5b0] rounded-lg px-2 py-1.5 text-xs text-[#3d2b1f] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/50" />
          </div>
          <button onClick={() => { setPage(1); fetchOrders(1); }}
            className="bg-[#8b6914] hover:bg-[#7a5c10] text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0">Search</button>
          {(filters.from || filters.to) && (
            <button onClick={() => { setFilters({ from: '', to: '', billType: '' }); setPage(1); fetchOrders(1); }}
              className="text-xs text-[#7a6652] hover:text-[#3d2b1f] px-2 py-1.5 shrink-0">Clear</button>
          )}
        </div>

        {/* List container */}
        <div className="bg-white border border-[#e0d5c5] rounded-xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e0d5c5]">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Bill No</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Customer</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Amount</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Balance</th>
                  <th className="text-center px-5 py-3 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0d5c5]">
                {loading ? (
                  <tr><td colSpan="6" className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-[#7a6652]">
                      <div className="w-4 h-4 border-2 border-[#d4c5b0] border-t-[#8b6914] rounded-full animate-spin" />
                      <span className="text-sm">Loading…</span>
                    </div>
                  </td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-12 text-[#7a6652] text-sm">No orders found</td></tr>
                ) : orders.map((o) => (
                  <tr key={o._id} onClick={() => navigate(`/bills/${o._id}`)}
                    className="hover:bg-[#faf7f2] cursor-pointer transition-colors">
                    <td className="px-5 py-3 font-bold text-[#8b6914]">{o.billNo}</td>
                    <td className="px-5 py-3 text-[#7a6652]">
                      {new Date(o.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-medium text-[#3d2b1f]">{o.customer.name}</span>
                      {o.customer.phone && <span className="text-[#7a6652] text-xs ml-1.5">{o.customer.phone}</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-[#3d2b1f]">{fmtINR(o.grandTotal)}</td>
                    <td className="px-5 py-3 text-right">
                      {o.balanceDue > 0
                        ? <span className="text-red-600 font-bold">{fmtINR(o.balanceDue)}</span>
                        : <span className="text-emerald-600 text-xs font-semibold">Paid</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${statusColors[o.status] || 'bg-[#e0d5c5] text-[#7a6652]'}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-[#e0d5c5]">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-[#7a6652]">
                <div className="w-4 h-4 border-2 border-[#d4c5b0] border-t-[#8b6914] rounded-full animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-[#7a6652] text-sm">No orders found</div>
            ) : orders.map((o) => (
              <div key={o._id} onClick={() => navigate(`/bills/${o._id}`)}
                className="px-3 py-3 hover:bg-[#faf7f2] active:bg-[#f5f0e8] cursor-pointer transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-[#8b6914] truncate">{o.billNo}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${statusColors[o.status] || 'bg-[#e0d5c5] text-[#7a6652]'}`}>
                      {o.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#7a6652] shrink-0">
                    {new Date(o.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#3d2b1f] truncate">{o.customer.name}</p>
                    {o.customer.phone && <p className="text-[10px] text-[#7a6652] truncate">{o.customer.phone}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#3d2b1f]">{fmtINR(o.grandTotal)}</p>
                    {o.balanceDue > 0
                      ? <p className="text-[10px] font-bold text-red-600">Due {fmtINR(o.balanceDue)}</p>
                      : <p className="text-[10px] font-semibold text-emerald-600">Paid</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-[#7a6652]">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-[#e0d5c5] rounded-lg text-xs font-semibold text-[#7a6652] disabled:opacity-30 hover:bg-[#faf7f2]">← Prev</button>
              <button disabled={orders.length < 20 || page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-[#e0d5c5] rounded-lg text-xs font-semibold text-[#7a6652] disabled:opacity-30 hover:bg-[#faf7f2]">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
