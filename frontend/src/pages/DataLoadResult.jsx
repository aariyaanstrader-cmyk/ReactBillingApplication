import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Navbar from '../components/Navbar';
import RateHeader from '../components/RateHeader';

const STATUS_LABEL = {
  created: { label: 'Created', cls: 'bg-emerald-100 text-emerald-700' },
  'will-create': { label: 'Will Create', cls: 'bg-blue-100 text-blue-700' },
  'duplicate-in-file': { label: 'Dup (file)', cls: 'bg-amber-100 text-amber-700' },
  'duplicate-in-db': { label: 'Dup (DB)', cls: 'bg-amber-100 text-amber-700' },
  error: { label: 'Error', cls: 'bg-red-100 text-red-700' },
};

export default function DataLoadResult() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all'); // all | success | duplicates | errors
  const [search, setSearch] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('dataLoadResult');
    if (!raw) { navigate('/data-load'); return; }
    setData(JSON.parse(raw));
  }, [navigate]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.results.details || [];
    if (filter === 'success') rows = rows.filter(r => r.status === 'created' || r.status === 'will-create');
    if (filter === 'duplicates') rows = rows.filter(r => r.status?.startsWith('duplicate'));
    if (filter === 'errors') rows = rows.filter(r => r.status === 'error');
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    }
    return rows;
  }, [data, filter, search]);

  if (!data) return null;

  const r = data.results;
  const isCustomers = data.mode === 'customers';

  const downloadFailures = () => {
    const failures = (r.details || []).filter(d => d.status === 'error' || d.status?.startsWith('duplicate'));
    if (!failures.length) return;
    const ws = XLSX.utils.json_to_sheet(failures);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Failures');
    XLSX.writeFile(wb, `data-load-failures-${data.mode}-${Date.now()}.xlsx`);
  };

  const downloadAll = () => {
    const ws = XLSX.utils.json_to_sheet(r.details || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `data-load-results-${data.mode}-${Date.now()}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar />
      <RateHeader />
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-black text-[#3d2b1f]">Data Load Result</h2>
            <p className="text-xs text-[#7a6652] mt-0.5">
              {isCustomers ? 'Customers' : 'Orders'} import · {new Date(data.completedAt).toLocaleString('en-IN')}
            </p>
          </div>
          <button onClick={() => navigate('/data-load')}
            className="bg-[#8b6914] hover:bg-[#a07a1a] text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap">
            ↑ Upload More
          </button>
        </div>

        {/* Summary tiles */}
        {isCustomers ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
            <Tile label="Total"          value={r.total}            color="text-[#3d2b1f]" />
            <Tile label="Created"        value={r.created}          color="text-emerald-600" />
            <Tile label="Duplicates"     value={(r.duplicatesInFile || 0) + (r.duplicatesInDb || 0)} color="text-amber-600" />
            <Tile label="Errors"         value={r.errors}           color="text-red-600" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-4">
            <Tile label="Rows"           value={r.total}            color="text-[#3d2b1f]" />
            <Tile label="Orders"         value={r.ordersCreated}    color="text-emerald-600" />
            <Tile label="Items"          value={r.itemsImported}    color="text-blue-600" />
            <Tile label="Customers (new)" value={r.customersCreated} color="text-purple-600" />
            <Tile label="Errors"         value={r.errors}           color="text-red-600" />
          </div>
        )}

        {/* Filter controls */}
        <div className="bg-white border border-[#e0d5c5] rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 flex-wrap">
            {[
              { k: 'all', label: `All (${(r.details || []).length})` },
              { k: 'success', label: `Success (${(r.details || []).filter(d => d.status === 'created' || d.status === 'will-create').length})` },
              { k: 'duplicates', label: `Duplicates (${(r.details || []).filter(d => d.status?.startsWith('duplicate')).length})` },
              { k: 'errors', label: `Errors (${(r.details || []).filter(d => d.status === 'error').length})` },
            ].map(b => (
              <button key={b.k} onClick={() => setFilter(b.k)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${filter === b.k ? 'bg-[#8b6914] text-white' : 'text-[#7a6652] hover:bg-[#faf7f2] border border-[#e0d5c5]'}`}>
                {b.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[140px]">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="w-full bg-[#faf7f2] border border-[#d4c5b0] rounded-lg px-3 py-1.5 text-xs text-[#3d2b1f] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/30" />
          </div>
          <div className="flex gap-1 ml-auto">
            <button onClick={downloadFailures} className="text-xs font-bold text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg">
              Download Failures
            </button>
            <button onClick={downloadAll} className="text-xs font-bold text-[#7a6652] hover:text-[#3d2b1f] border border-[#e0d5c5] hover:bg-[#faf7f2] px-3 py-1.5 rounded-lg">
              Download All
            </button>
          </div>
        </div>

        {/* Result table */}
        <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e0d5c5] bg-[#faf7f2]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Row</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Status</th>
                  {isCustomers ? (
                    <>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Phone</th>
                    </>
                  ) : (
                    <>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Bill No</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Customer</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Amount</th>
                    </>
                  )}
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">Reason / Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8dfd4]">
                {filtered.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-12 text-[#7a6652] text-sm">No rows match this filter</td></tr>
                ) : filtered.slice(0, 500).map((d, i) => {
                  const meta = STATUS_LABEL[d.status] || { label: d.status, cls: 'bg-[#e0d5c5] text-[#7a6652]' };
                  return (
                    <tr key={i} className="hover:bg-[#faf7f2]">
                      <td className="px-4 py-2 text-[#7a6652] text-xs">{d.row}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${meta.cls}`}>{meta.label}</span>
                      </td>
                      {isCustomers ? (
                        <>
                          <td className="px-4 py-2 text-[#3d2b1f]">{d.name || '—'}</td>
                          <td className="px-4 py-2 text-[#7a6652] text-xs">{d.phone || '—'}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 text-[#8b6914] font-semibold text-xs">{d.billNo || '—'}</td>
                          <td className="px-4 py-2 text-[#3d2b1f]">{d.customer || '—'}</td>
                          <td className="px-4 py-2 text-right text-[#3d2b1f] font-semibold">
                            {d.amount != null ? `₹${Number(d.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-2 text-[#7a6652] text-xs">{d.reason || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 500 && (
            <p className="text-xs text-[#7a6652] text-center py-2 border-t border-[#e0d5c5]">
              Showing first 500 rows. Use Download All to see everything.
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap gap-2 mt-4 justify-end">
          {isCustomers ? (
            <button onClick={() => navigate('/customers')} className="text-xs font-bold text-[#8b6914] hover:text-[#a07a1a] border border-[#d4c5b0] hover:bg-[#faf7f2] px-4 py-2 rounded-lg">View Customers →</button>
          ) : (
            <button onClick={() => navigate('/bills')} className="text-xs font-bold text-[#8b6914] hover:text-[#a07a1a] border border-[#d4c5b0] hover:bg-[#faf7f2] px-4 py-2 rounded-lg">View Orders →</button>
          )}
          <button onClick={() => navigate('/data-load')} className="text-xs font-bold bg-[#8b6914] hover:bg-[#a07a1a] text-white px-4 py-2 rounded-lg">Upload More</button>
        </div>

      </div>
    </div>
  );
}

function Tile({ label, value, color }) {
  return (
    <div className="bg-white border border-[#e0d5c5] rounded-xl p-3 text-center shadow-sm">
      <p className={`text-xl sm:text-2xl font-black ${color}`}>{value || 0}</p>
      <p className="text-[10px] text-[#7a6652] uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
