import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Navbar from '../components/Navbar';
import RateHeader from '../components/RateHeader';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

// Template definitions ────────────────────────────────────────
const CUSTOMER_TEMPLATE = {
  filename: 'mm-jewels-customers-template.xlsx',
  sheet: 'Customers',
  headers: ['name', 'phone', 'address'],
  sample: [
    { name: 'Ramesh Kumar',  phone: '9876543210', address: '12 Bazaar Street, Chennai' },
    { name: 'Priya Devi',    phone: '9123456789', address: '45 MG Road, Bangalore' },
    { name: 'Anil Verma',    phone: '9988776655', address: 'Plot 7, Sector 18, Pune' },
  ],
  notes: [
    'name is REQUIRED',
    'phone + name combo must be unique (duplicates inside file or already in DB are skipped)',
    'address is optional',
  ],
};

const ORDER_TEMPLATE = {
  filename: 'mm-jewels-orders-template.xlsx',
  sheet: 'Orders',
  headers: [
    'billNo','billDate','customerName','customerPhone','customerAddress',
    'itemName','metal','grossWeight','waste','stoneValue','makingCharge',
    'qty','goldRate','paymentMode','amountPaid','discount','notes'
  ],
  sample: [
    { billNo: '', billDate: '11/04/2026', customerName: 'Ramesh Kumar', customerPhone: '9876543210', customerAddress: '12 Bazaar Street, Chennai',
      itemName: 'Gold Chain 22K', metal: 'Gold', grossWeight: 12.5, waste: 0.5, stoneValue: 0, makingCharge: 1500,
      qty: 1, goldRate: '', paymentMode: 'cash', amountPaid: 80000, discount: 0, notes: '' },
    { billNo: '', billDate: '11/04/2026', customerName: 'Priya Devi', customerPhone: '9123456789', customerAddress: '',
      itemName: 'Silver Anklet', metal: 'Silver', grossWeight: 50, waste: 0, stoneValue: 0, makingCharge: 800,
      qty: 1, goldRate: '', paymentMode: 'upi', amountPaid: 5000, discount: 0, notes: '' },
    { billNo: 'INV-202627-1001', billDate: '11/04/2026', customerName: 'Anil Verma', customerPhone: '9988776655', customerAddress: '',
      itemName: 'Gold Ring', metal: 'Gold', grossWeight: 5.2, waste: 0.2, stoneValue: 1200, makingCharge: 600,
      qty: 1, goldRate: '', paymentMode: 'cash', amountPaid: 35000, discount: 0, notes: 'Multi-item bill' },
    { billNo: 'INV-202627-1001', billDate: '11/04/2026', customerName: 'Anil Verma', customerPhone: '9988776655', customerAddress: '',
      itemName: 'Gold Earring', metal: 'Gold', grossWeight: 3.0, waste: 0.1, stoneValue: 0, makingCharge: 400,
      qty: 2, goldRate: '', paymentMode: 'cash', amountPaid: 0, discount: 0, notes: '' },
  ],
  notes: [
    'customerName, itemName, grossWeight are REQUIRED',
    'metal: Gold or Silver (defaults to Gold)',
    'billNo: leave empty to auto-generate. Use SAME billNo across rows for multi-item bills.',
    'billDate: dd/mm/yyyy format. Defaults to today if blank.',
    'goldRate: leave empty to use today\'s rate from DailyRate',
    'paymentMode: cash | card | upi | cheque | credit',
    'Customers are auto-created if (name+phone) does not match an existing customer.',
  ],
};

// ──────────────────────────────────────────────────────────────
const inputClass = 'w-full bg-[#faf7f2] border border-[#d4c5b0] rounded-xl px-3 py-2.5 text-sm text-[#3d2b1f] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/30';

export default function DataLoad() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [mode, setMode] = useState('customers'); // 'customers' | 'orders'
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [validation, setValidation] = useState(null); // results from dry-run
  const [msg, setMsg] = useState({ text: '', ok: false });

  // Admin guard
  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#faf7f2]">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="bg-white border border-[#e0d5c5] rounded-xl p-8">
            <h2 className="text-xl font-black text-[#3d2b1f] mb-2">Admin Access Only</h2>
            <p className="text-sm text-[#7a6652]">Data Load is restricted to admin users.</p>
          </div>
        </div>
      </div>
    );
  }

  const template = mode === 'customers' ? CUSTOMER_TEMPLATE : ORDER_TEMPLATE;

  const flash = (text, ok = false) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: '', ok: false }), 4000); };

  const reset = () => {
    setFileName(''); setParsedRows([]); setParseError(''); setValidation(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const switchMode = (m) => { setMode(m); reset(); };

  // Template download ───────────────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const sheetData = [template.headers, ...template.sample.map(row => template.headers.map(h => row[h] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    // column widths
    ws['!cols'] = template.headers.map(h => ({ wch: Math.max(h.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, template.sheet);

    // Notes sheet
    const notes = [['Field Notes'], ...template.notes.map(n => [n])];
    const ws2 = XLSX.utils.aoa_to_sheet(notes);
    ws2['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

    XLSX.writeFile(wb, template.filename);
  };

  // File parsing ────────────────────────────────────────────
  const handleFile = (file) => {
    if (!file) return;
    setParseError(''); setValidation(null); setParsedRows([]);
    const validExt = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!validExt) {
      setParseError('Unsupported file type. Use .xlsx, .xls, or .csv');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setParseError('File too large. Max 8 MB.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        if (!json.length) {
          setParseError('No data rows found in the file');
          return;
        }
        if (json.length > 2000) {
          setParseError(`Too many rows (${json.length}). Max 2000 per upload.`);
          return;
        }
        setParsedRows(json);
      } catch (err) {
        setParseError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  // Validate (dry-run) ──────────────────────────────────────
  const handleValidate = async () => {
    if (!parsedRows.length) return;
    setValidating(true);
    try {
      const r = await api.post(`/data-load/${mode}`, { rows: parsedRows, dryRun: true }, { timeout: 60000 });
      setValidation(r.data.results);
      flash('Validation complete. Review summary below before committing.', true);
    } catch (err) {
      flash(err.response?.data?.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  // Commit ──────────────────────────────────────────────────
  const handleCommit = async () => {
    if (!validation) return;
    if (!window.confirm(`Import ${mode === 'customers' ? validation.created : validation.ordersCreated} ${mode === 'customers' ? 'customers' : 'orders'}?\nThis cannot be undone (you can void/cancel records later).`)) return;
    setCommitting(true);
    try {
      const r = await api.post(`/data-load/${mode}`, { rows: parsedRows, dryRun: false }, { timeout: 120000 });
      // Stash result for the result page
      sessionStorage.setItem('dataLoadResult', JSON.stringify({
        mode, completedAt: new Date().toISOString(), results: r.data.results
      }));
      navigate('/data-load/result');
    } catch (err) {
      flash(err.response?.data?.message || 'Import failed');
      setCommitting(false);
    }
  };

  // Preview computed cols ───────────────────────────────────
  const previewCols = useMemo(() => {
    if (!parsedRows.length) return [];
    return Object.keys(parsedRows[0]).slice(0, 8);
  }, [parsedRows]);

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar />
      <RateHeader />
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-[#3d2b1f]">Data Load</h2>
            <p className="text-xs text-[#7a6652] mt-0.5">Bulk upload customers and orders from Excel/CSV</p>
          </div>
          <button onClick={() => navigate('/')} className="text-xs text-[#7a6652] hover:text-[#3d2b1f] px-2 py-1.5">← Dashboard</button>
        </div>

        {msg.text && (
          <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg.text}</div>
        )}

        {/* Mode tabs */}
        <div className="bg-white border border-[#e0d5c5] rounded-xl p-1 flex gap-1 mb-4 max-w-md">
          <button onClick={() => switchMode('customers')}
            className={`flex-1 text-sm font-bold px-4 py-2 rounded-lg transition-all ${mode === 'customers' ? 'bg-[#8b6914] text-white shadow' : 'text-[#7a6652] hover:bg-[#faf7f2]'}`}>
            Customers
          </button>
          <button onClick={() => switchMode('orders')}
            className={`flex-1 text-sm font-bold px-4 py-2 rounded-lg transition-all ${mode === 'orders' ? 'bg-[#8b6914] text-white shadow' : 'text-[#7a6652] hover:bg-[#faf7f2]'}`}>
            Orders
          </button>
        </div>

        {/* Step 1: Template */}
        <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm p-4 sm:p-5 mb-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#8b6914] text-white text-xs font-bold flex items-center justify-center">1</span>
              <h3 className="text-sm font-bold text-[#3d2b1f]">Download Template</h3>
            </div>
            <button onClick={downloadTemplate}
              className="bg-[#8b6914] hover:bg-[#a07a1a] text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Download .xlsx
            </button>
          </div>
          <ul className="text-xs text-[#7a6652] space-y-1 list-disc list-inside">
            {template.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>

        {/* Step 2: Upload */}
        <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm p-4 sm:p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-[#8b6914] text-white text-xs font-bold flex items-center justify-center">2</span>
            <h3 className="text-sm font-bold text-[#3d2b1f]">Upload File</h3>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-[#8b6914] bg-[#faf7f2]' : 'border-[#d4c5b0] hover:border-[#8b6914] hover:bg-[#faf7f2]'}`}>
            <svg className="w-10 h-10 mx-auto text-[#8b6914] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
            <p className="text-sm font-semibold text-[#3d2b1f]">
              {fileName ? <>Selected: <span className="text-[#8b6914]">{fileName}</span></> : 'Tap or drop a file here'}
            </p>
            <p className="text-xs text-[#7a6652] mt-1">.xlsx, .xls, or .csv (max 8 MB, 2000 rows)</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>

          {parseError && (
            <div className="mt-3 text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200">{parseError}</div>
          )}

          {fileName && parsedRows.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-[#7a6652]">
              <span><b className="text-[#3d2b1f]">{parsedRows.length}</b> rows parsed</span>
              <button onClick={reset} className="text-red-600 hover:text-red-700 font-semibold">Clear</button>
            </div>
          )}
        </div>

        {/* Step 3: Preview */}
        {parsedRows.length > 0 && (
          <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm p-4 sm:p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#8b6914] text-white text-xs font-bold flex items-center justify-center">3</span>
              <h3 className="text-sm font-bold text-[#3d2b1f]">Preview (first 5 rows)</h3>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-xs min-w-max">
                <thead className="bg-[#faf7f2] border-y border-[#e0d5c5]">
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider">#</th>
                    {previewCols.map(c => (
                      <th key={c} className="text-left px-3 py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wider whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8dfd4]">
                  {parsedRows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="hover:bg-[#faf7f2]">
                      <td className="px-3 py-2 text-[#7a6652]">{i + 2}</td>
                      {previewCols.map(c => (
                        <td key={c} className="px-3 py-2 text-[#3d2b1f] whitespace-nowrap">{String(r[c] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <p className="text-xs text-[#7a6652]">Validate first to see how many rows would be created vs duplicates/errors.</p>
              <button onClick={handleValidate} disabled={validating}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl whitespace-nowrap">
                {validating ? 'Validating…' : 'Validate (Dry Run)'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Validation Summary + Commit */}
        {validation && (
          <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm p-4 sm:p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#8b6914] text-white text-xs font-bold flex items-center justify-center">4</span>
              <h3 className="text-sm font-bold text-[#3d2b1f]">Validation Summary</h3>
            </div>

            {mode === 'customers' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
                <SummaryTile label="Total rows"      value={validation.total} color="text-[#3d2b1f]" />
                <SummaryTile label="Will be created" value={validation.created} color="text-emerald-600" />
                <SummaryTile label="Duplicates"      value={validation.duplicatesInFile + validation.duplicatesInDb} color="text-amber-600" />
                <SummaryTile label="Errors"          value={validation.errors} color="text-red-600" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
                <SummaryTile label="Total rows"        value={validation.total} color="text-[#3d2b1f]" />
                <SummaryTile label="Orders to create"  value={validation.ordersCreated} color="text-emerald-600" />
                <SummaryTile label="Items to import"   value={validation.itemsImported} color="text-blue-600" />
                <SummaryTile label="Errors"            value={validation.errors} color="text-red-600" />
              </div>
            )}

            {/* Sample errors */}
            {validation.details && validation.details.filter(d => d.status === 'error' || d.status?.startsWith('duplicate')).slice(0, 5).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-[#7a6652] uppercase tracking-wider mb-1.5">Issues (first 5)</p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 max-h-40 overflow-y-auto">
                  {validation.details.filter(d => d.status === 'error' || d.status?.startsWith('duplicate')).slice(0, 5).map((d, i) => (
                    <div key={i} className="text-xs text-[#3d2b1f] py-1">
                      <b>Row {d.row}</b> · <span className="text-amber-700">{d.status}</span> · {d.reason || d.name || ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <p className="text-xs text-[#7a6652]">
                {(mode === 'customers' ? validation.created : validation.ordersCreated) > 0
                  ? 'Ready to import. Click below to commit.'
                  : 'Nothing to import. Fix errors and re-validate.'}
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setValidation(null)} className="text-[#7a6652] hover:text-[#3d2b1f] text-sm px-3 py-2.5">Re-edit</button>
                <button onClick={handleCommit} disabled={committing || (mode === 'customers' ? validation.created : validation.ordersCreated) === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl whitespace-nowrap">
                  {committing ? 'Importing…' : 'Confirm Import'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function SummaryTile({ label, value, color }) {
  return (
    <div className="bg-[#faf7f2] border border-[#e0d5c5] rounded-xl p-3 text-center">
      <p className={`text-xl sm:text-2xl font-black ${color}`}>{value}</p>
      <p className="text-[10px] text-[#7a6652] uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
