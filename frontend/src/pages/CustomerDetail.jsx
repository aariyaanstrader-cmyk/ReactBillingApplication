import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import RateHeader from '../components/RateHeader';
import api from '../utils/api';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/customers/${id}`),
      api.get(`/orders/customer/${id}`),
    ]).then(([custRes, ordRes]) => {
      setCustomer(custRes.data.customer);
      setEditData({
        name: custRes.data.customer.name || '',
        phone: custRes.data.customer.phone || '',
        address: custRes.data.customer.address || '',
      });
      setOrders(ordRes.data.orders || []);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/customers/${id}`, editData);
      setCustomer(res.data.customer);
      setEditing(false);
      setMsg('Saved!');
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const inputClass = 'w-full bg-[#faf7f2] border border-[#d4c5b0] rounded-xl px-3 py-2.5 text-sm text-[#3d2b1f] placeholder-[#b0a090] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/30';

  if (loading) return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar /><RateHeader />
      <div className="flex items-center justify-center py-32 gap-2 text-[#7a6652]">
        <div className="w-5 h-5 border-2 border-[#d4c5b0] border-t-[#8b6914] rounded-full animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );

  if (!customer) return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar /><RateHeader />
      <div className="text-center py-24 text-[#7a6652] text-sm">Customer not found.</div>
    </div>
  );

  // Aggregates
  const confirmedOrders = orders.filter(o => o.status !== 'cancelled');
  const totalSpend = confirmedOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);
  const totalPaid = confirmedOrders.reduce((s, o) => s + (o.amountPaid || 0), 0);
  const totalPending = confirmedOrders.reduce((s, o) => s + (o.balanceDue || 0), 0);
  const pendingOrders = confirmedOrders.filter(o => o.balanceDue > 0);

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar />
      <RateHeader />

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* Back + title */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <button onClick={() => navigate('/customers')} className="text-[#7a6652] hover:text-[#3d2b1f] transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg sm:text-xl font-semibold text-[#3d2b1f]">Customer Profile</h2>
          {msg && <span className="text-xs text-emerald-600 font-medium ml-auto sm:ml-3">{msg}</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">

          {/* LEFT: Customer Info */}
          <div className="space-y-4">

            {/* Info card */}
            <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#3d2b1f]">Details</h3>
                {!editing ? (
                  <button onClick={() => setEditing(true)}
                    className="text-xs text-[#8b6914] hover:text-[#a07a1a] font-medium transition-colors">Edit</button>
                ) : (
                  <div className="flex gap-1.5">
                    <button onClick={handleSave} disabled={saving}
                      className="text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => { setEditing(false); setEditData({ name: customer.name, phone: customer.phone || '', address: customer.address || '' }); }}
                      className="text-xs text-[#7a6652] px-2 py-1 hover:text-[#3d2b1f] rounded-lg transition-colors">Cancel</button>
                  </div>
                )}
              </div>

              {editing ? (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs text-[#7a6652] font-semibold mb-0.5">Name</label>
                    <input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#7a6652] font-semibold mb-0.5">Phone</label>
                    <input value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#7a6652] font-semibold mb-0.5">Address</label>
                    <input value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })}
                      className={inputClass} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[#7a6652] font-semibold">Name</p>
                    <p className="font-semibold text-[#3d2b1f] text-lg">{customer.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7a6652] font-semibold">Phone</p>
                    <p className="text-[#3d2b1f]">{customer.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7a6652] font-semibold">Address</p>
                    <p className="text-[#7a6652] text-sm">{customer.address || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7a6652] font-semibold">Customer Since</p>
                    <p className="text-[#7a6652] text-sm">
                      {new Date(customer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#3d2b1f] mb-2">Summary</h3>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#7a6652] font-semibold">Total Bills</span>
                <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-0.5 rounded-full">{confirmedOrders.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#7a6652] font-semibold">Total Spend</span>
                <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{fmt(totalSpend)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#7a6652] font-semibold">Total Paid</span>
                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{fmt(totalPaid)}</span>
              </div>
              {totalPending > 0 && (
                <div className="flex justify-between items-center bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <span className="text-xs font-semibold text-red-600">Pending</span>
                  <span className="font-bold text-red-600">{fmt(totalPending)}</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Orders (col-span 2) */}
          <div className="md:col-span-2">

            {/* Pending payments */}
            {pendingOrders.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 mb-4">
                <h3 className="text-sm font-semibold text-red-600 mb-2">Pending Payments ({pendingOrders.length})</h3>
                <div className="space-y-1.5">
                  {pendingOrders.map(o => (
                    <div key={o._id}
                      onClick={() => navigate(`/bills/${o._id}`)}
                      className="flex items-center justify-between gap-2 bg-white rounded-xl px-3 py-2.5 cursor-pointer hover:bg-[#faf7f2] border border-[#e0d5c5] transition-colors">
                      <div className="min-w-0">
                        <span className="text-[#8b6914] font-semibold text-sm">{o.billNo}</span>
                        <span className="text-[#7a6652] text-xs ml-2">
                          {new Date(o.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="hidden sm:inline text-xs text-[#7a6652] mr-3">Total: {fmt(o.grandTotal)}</span>
                        <span className="font-bold text-red-600 text-sm">{fmt(o.balanceDue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All orders */}
            <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e8dfd4]">
                <h3 className="text-sm font-semibold text-[#3d2b1f]">All Orders ({orders.length})</h3>
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e8dfd4]">
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase">Bill No</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase">Date</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase">Items</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase">Amount</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase">Paid</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase">Balance</th>
                      <th className="text-center px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8dfd4]">
                    {orders.length === 0 ? (
                      <tr><td colSpan="7" className="px-4 py-8 text-center text-[#7a6652] text-sm">No orders yet</td></tr>
                    ) : orders.map(o => (
                      <tr key={o._id}
                        onClick={() => navigate(`/bills/${o._id}`)}
                        className="hover:bg-[#faf7f2] cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 text-[#8b6914] font-semibold">{o.billNo}</td>
                        <td className="px-4 py-2.5 text-[#3d2b1f]">
                          {new Date(o.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="px-4 py-2.5 text-[#7a6652] text-xs">
                          {o.items?.slice(0, 2).map(it => it.displayName).join(', ')}
                          {o.items?.length > 2 && <span className="text-[#b0a090]"> +{o.items.length - 2}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-[#3d2b1f]">{fmt(o.grandTotal)}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">{fmt(o.amountPaid)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {o.balanceDue > 0
                            ? <span className="text-red-600 font-semibold">{fmt(o.balanceDue)}</span>
                            : <span className="text-emerald-600 text-xs">Paid</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                            o.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700'
                            : o.status === 'cancelled' ? 'bg-red-50 text-red-700'
                            : 'bg-gray-100 text-[#7a6652]'
                          }`}>{o.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-[#e8dfd4]">
                {orders.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[#7a6652] text-sm">No orders yet</div>
                ) : orders.map(o => (
                  <div key={o._id}
                    onClick={() => navigate(`/bills/${o._id}`)}
                    className="px-3 py-3 hover:bg-[#faf7f2] active:bg-[#f5f0e8] cursor-pointer transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-[#8b6914] truncate">{o.billNo}</span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                          o.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700'
                          : o.status === 'cancelled' ? 'bg-red-50 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                        }`}>{o.status}</span>
                      </div>
                      <span className="text-[10px] text-[#7a6652] shrink-0">
                        {new Date(o.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                    {o.items?.length > 0 && (
                      <p className="text-[10px] text-[#7a6652] truncate mb-1">
                        {o.items.slice(0, 2).map(it => it.displayName).join(', ')}
                        {o.items.length > 2 && <span className="text-[#b0a090]"> +{o.items.length - 2}</span>}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#3d2b1f]">{fmt(o.grandTotal)}</span>
                      {o.balanceDue > 0
                        ? <span className="text-xs font-bold text-red-600">Due {fmt(o.balanceDue)}</span>
                        : <span className="text-xs font-semibold text-emerald-600">Paid</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
