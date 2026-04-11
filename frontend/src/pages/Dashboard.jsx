import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import RateHeader from '../components/RateHeader';
import api from '../utils/api';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

function StatCard({ label, count, sales, paid, icon, gradient }) {
  const outstanding = (sales || 0) - (paid || 0);
  return (
    <div className={`rounded-xl p-3 sm:p-3.5 ${gradient} relative overflow-hidden min-w-0`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60 truncate">{label}</p>
        <span className="text-white/30 shrink-0">{icon}</span>
      </div>
      <p className="text-lg sm:text-xl font-black text-white break-words">{fmt(sales)}</p>
      <div className="flex items-center justify-between mt-2 gap-1">
        <span className="text-[10px] text-white/50 shrink-0">{count} bill{count !== 1 ? 's' : ''}</span>
        <span className="text-[10px] font-semibold text-white/70 truncate text-right">{fmt(paid)} paid</span>
      </div>
      {outstanding > 0 && (
        <div className="mt-1.5 bg-white/10 rounded px-2 py-0.5">
          <span className="text-[10px] text-white/80 truncate block">Due: {fmt(outstanding)}</span>
        </div>
      )}
    </div>
  );
}

function WhatsAppBtn({ phone, name, billNo, balanceDue }) {
  const cleanPhone = phone?.replace(/\D/g, '') || '';
  const last10 = cleanPhone.slice(-10);
  if (!last10) return null;
  const msg = [
    `Hi ${name},`,
    '',
    `This is a gentle reminder regarding your pending balance of *Rs.${Number(balanceDue).toLocaleString('en-IN')}* for invoice *${billNo}*.`,
    '',
    'Kindly arrange for the payment at your earliest convenience.',
    '',
    'Thank you!',
    'MM Jewels',
  ].join('\n');
  return (
    <a href={`https://wa.me/91${last10}?text=${encodeURIComponent(msg)}`}
      target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold transition-colors shrink-0"
      title="Send WhatsApp reminder">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.625-1.47A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-2.17 0-4.19-.588-5.932-1.613l-.424-.254-2.744.873.87-2.675-.277-.44A9.798 9.798 0 012.182 12c0-5.42 4.398-9.818 9.818-9.818S21.818 6.58 21.818 12s-4.398 9.818-9.818 9.818z"/></svg>
      Remind
    </a>
  );
}

function CallBtn({ phone }) {
  const cleanPhone = phone?.replace(/\D/g, '') || '';
  const last10 = cleanPhone.slice(-10);
  if (!last10) return null;
  return (
    <a href={`tel:+91${last10}`}
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold transition-colors shrink-0"
      title="Call customer">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
      Call
    </a>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingTab, setPendingTab] = useState('all'); // all, high, recent

  useEffect(() => {
    api.get('/orders/analytics/summary')
      .then(r => { if (r.data.success) setStats(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredPending = (stats?.pendingOrders || []).filter(o => {
    if (pendingTab === 'high') return o.balanceDue >= 10000;
    if (pendingTab === 'recent') {
      const d = new Date(o.billDate);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar />
      <RateHeader />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-5 gap-2">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-[#3d2b1f]">Dashboard</h2>
            <p className="text-[10px] text-[#7a6652] mt-0.5 truncate">Business overview at a glance</p>
          </div>
          <button onClick={() => navigate('/new-bill')}
            className="bg-[#8b6914] hover:bg-[#7a5c10] text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-xl transition-all shadow-lg flex items-center gap-1.5 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            <span>New<span className="hidden sm:inline"> Order</span></span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-[#7a6652]">
            <div className="w-5 h-5 border-2 border-[#e0d5c5] border-t-[#8b6914] rounded-full animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : stats ? (
          <>
            {/* ── STATS CARDS ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <StatCard label="Today" count={stats.today.count} sales={stats.today.sales} paid={stats.today.paid}
                gradient="bg-gradient-to-br from-[#6b1d2a] to-[#8b2040]"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>} />
              <StatCard label="This Week" count={stats.week.count} sales={stats.week.sales} paid={stats.week.paid}
                gradient="bg-gradient-to-br from-[#8b6914] to-[#a67c00]"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>} />
              <StatCard label="This Month" count={stats.month.count} sales={stats.month.sales} paid={stats.month.paid}
                gradient="bg-gradient-to-br from-[#1a6b5a] to-[#20806b]"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>} />
              <StatCard label="This Year" count={stats.year.count} sales={stats.year.sales} paid={stats.year.paid}
                gradient="bg-gradient-to-br from-[#5c1a3b] to-[#7a2050]"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
            </div>

            {/* ── QUICK STATS ROW ───────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-white border border-[#e0d5c5] rounded-xl p-3 text-center cursor-pointer hover:bg-[#faf7f2] transition-colors"
                onClick={() => navigate('/bills')}>
                <p className="text-lg font-black text-emerald-600">{stats.statusBreakdown.confirmed}</p>
                <p className="text-[10px] text-[#7a6652] font-semibold uppercase tracking-wider">Confirmed</p>
              </div>
              <div className="bg-white border border-[#e0d5c5] rounded-xl p-3 text-center cursor-pointer hover:bg-[#faf7f2] transition-colors"
                onClick={() => navigate('/bills')}>
                <p className="text-lg font-black text-amber-600">{stats.statusBreakdown.draft}</p>
                <p className="text-[10px] text-[#7a6652] font-semibold uppercase tracking-wider">Drafts</p>
              </div>
              <div className="bg-white border border-red-200 rounded-xl p-3 text-center cursor-pointer hover:bg-red-50 transition-colors"
                onClick={() => document.getElementById('pending-section')?.scrollIntoView({ behavior: 'smooth' })}>
                <p className="text-lg font-black text-red-600">{stats.pending.count}</p>
                <p className="text-[10px] text-[#7a6652] font-semibold uppercase tracking-wider">Pending</p>
              </div>
            </div>

            {/* ── PENDING PAYMENTS ──────────────────────────────────────── */}
            {stats.pending.count > 0 && (
              <div id="pending-section" className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden mb-5">
                <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-red-700">Pending Payments</p>
                        <p className="text-[10px] text-red-400">{stats.pending.count} order{stats.pending.count !== 1 ? 's' : ''} · Total {fmt(stats.pending.total)}</p>
                      </div>
                    </div>
                  </div>
                  {/* Filter tabs */}
                  <div className="flex gap-1.5 mt-2">
                    {[['all', 'All'], ['high', '₹10K+'], ['recent', 'Last 7 days']].map(([key, label]) => (
                      <button key={key} onClick={() => setPendingTab(key)}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${pendingTab === key ? 'bg-red-600 text-white' : 'bg-white text-red-600 border border-red-200'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="divide-y divide-red-100 max-h-[400px] overflow-y-auto">
                  {filteredPending.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[#7a6652] text-xs">No orders in this filter</div>
                  ) : filteredPending.map(o => (
                    <div key={o._id} onClick={() => navigate(`/bills/${o._id}`)}
                      className="px-4 py-2.5 hover:bg-red-50/50 cursor-pointer transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#8b6914]">{o.billNo}</span>
                            <span className="text-[10px] text-[#7a6652]">{fmtDate(o.billDate)}</span>
                          </div>
                          <p className="text-xs font-medium text-[#3d2b1f] truncate">{o.customer?.name}</p>
                          {o.customer?.phone && (
                            <p className="text-[10px] text-[#7a6652]">{o.customer.phone}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-red-600">{fmt(o.balanceDue)}</p>
                          <p className="text-[10px] text-[#7a6652]">of {fmt(o.netPayable)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <WhatsAppBtn phone={o.customer?.phone} name={o.customer?.name} billNo={o.billNo} balanceDue={o.balanceDue} />
                        <CallBtn phone={o.customer?.phone} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TODAY'S BILLS ──────────────────────────────────────────── */}
            {stats.todayBills?.length > 0 && (
              <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm overflow-hidden mb-5">
                <div className="px-4 py-2.5 border-b border-[#e8dfd4] flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#3d2b1f]">Today's Bills</h3>
                  <span className="text-[10px] text-[#7a6652] font-semibold">{stats.todayBills.length} order{stats.todayBills.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-[#e8dfd4]">
                  {stats.todayBills.map(bill => (
                    <div key={bill._id} onClick={() => navigate(`/bills/${bill._id}`)}
                      className="px-4 py-2.5 hover:bg-[#faf7f2] cursor-pointer transition-colors flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#8b6914]">{bill.billNo}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${bill.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {bill.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#3d2b1f] font-medium">{bill.customer?.name}
                          {bill.customer?.phone && <span className="text-[#7a6652] ml-1.5">{bill.customer.phone}</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#3d2b1f]">{fmt(bill.grandTotal)}</p>
                        {bill.balanceDue > 0
                          ? <p className="text-[10px] font-semibold text-red-600">Due: {fmt(bill.balanceDue)}</p>
                          : <p className="text-[10px] font-semibold text-emerald-600">Paid</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── RECENT BILLS ──────────────────────────────────────────── */}
            <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#e8dfd4] flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#3d2b1f]">Recent Bills</h3>
                <button onClick={() => navigate('/bills')} className="text-[10px] text-[#8b6914] hover:text-[#7a5c10] font-semibold">View All →</button>
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e8dfd4]">
                      <th className="text-left px-4 py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Bill</th>
                      <th className="text-left px-4 py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Customer</th>
                      <th className="text-right px-4 py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Amount</th>
                      <th className="text-right px-4 py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Balance</th>
                      <th className="text-center px-4 py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8dfd4]">
                    {stats.recentBills.map(bill => (
                      <tr key={bill._id} onClick={() => navigate(`/bills/${bill._id}`)}
                        className="hover:bg-[#faf7f2] cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 font-bold text-[#8b6914]">{bill.billNo}</td>
                        <td className="px-4 py-2.5 text-[#7a6652]">{fmtDate(bill.billDate)}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-[#3d2b1f]">{bill.customer?.name}</span>
                          {bill.customer?.phone && <span className="text-[#7a6652] ml-1.5 text-[10px]">{bill.customer.phone}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-[#3d2b1f]">{fmt(bill.grandTotal)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {bill.balanceDue > 0
                            ? <span className="text-red-600 font-bold">{fmt(bill.balanceDue)}</span>
                            : <span className="text-emerald-600 font-semibold">Paid</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                            bill.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                            bill.status === 'draft' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'}`}>
                            {bill.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-[#e8dfd4]">
                {stats.recentBills.map(bill => (
                  <div key={bill._id} onClick={() => navigate(`/bills/${bill._id}`)}
                    className="px-4 py-2.5 hover:bg-[#faf7f2] cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#8b6914]">{bill.billNo}</span>
                          <span className="text-[10px] text-[#7a6652]">{fmtDate(bill.billDate)}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                            bill.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                            bill.status === 'draft' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'}`}>
                            {bill.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#3d2b1f] font-medium">{bill.customer?.name}
                          {bill.customer?.phone && <span className="text-[#7a6652] ml-1.5 text-[10px]">{bill.customer.phone}</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#3d2b1f]">{fmt(bill.grandTotal)}</p>
                        {bill.balanceDue > 0
                          ? <p className="text-[10px] font-semibold text-red-600">{fmt(bill.balanceDue)}</p>
                          : <p className="text-[10px] font-semibold text-emerald-600">Paid</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {stats.recentBills.length === 0 && (
                <div className="px-4 py-10 text-center text-[#7a6652] text-xs">No bills yet</div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-[#7a6652] text-sm">Could not load data.</div>
        )}
      </div>
    </div>
  );
}
