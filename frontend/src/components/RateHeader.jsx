import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function RateHeader({ onRatesLoaded, editable = false }) {
  const [market22k, setMarket22k] = useState(null);
  const [market24k, setMarket24k] = useState(null);
  const [goldRateInput, setGoldRateInput] = useState('');
  const [silverRateInput, setSilverRateInput] = useState('');
  const [savedRate, setSavedRate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });

  useEffect(() => {
    api.get('/rates/market/today').then(res => {
      if (res.data.success && res.data.data) {
        setMarket22k(res.data.data.current22k || null);
        setMarket24k(res.data.data.current24k || null);
      }
    }).catch(() => {});
    api.get('/rates/today').then(res => {
      if (res.data.rate) {
        setSavedRate(res.data.rate);
        setGoldRateInput(res.data.rate.goldRate?.toString() || '');
        setSilverRateInput(res.data.rate.silverRate?.toString() || '');
      }
      if (onRatesLoaded) onRatesLoaded(res.data.rate || null);
    }).catch(() => {
      if (onRatesLoaded) onRatesLoaded(null);
    });
  }, []);

  const flash = (text, ok = false) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: '', ok: false }), 3000); };

  const handleSave = async () => {
    if (!goldRateInput) { flash('Enter gold rate'); return; }
    setSaving(true);
    try {
      const res = await api.post('/rates', { goldRate: Number(goldRateInput), silverRate: Number(silverRateInput) || 0, gold24K: market24k ? Math.round(market24k) : undefined });
      setSavedRate(res.data.rate);
      if (onRatesLoaded) onRatesLoaded(res.data.rate);
      flash('Saved!', true);
    } catch (err) { flash(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const goldRate = savedRate?.goldRate || 0;
  const silverRate = savedRate?.silverRate || 0;

  const Badge = ({ label, value, color }) => (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold">{label}</span>
      <span className={`text-xs font-bold px-2 py-0.5 rounded ${color}`}>
        {value || '—'}
      </span>
    </div>
  );

  return (
    <div className="sticky top-14 z-20 bg-[#f5f0e8] border-b border-[#e0d5c5] print:hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-x-3 gap-y-1.5 flex-wrap text-xs">
        <Badge label="22K" value={market22k ? `₹${Math.round(market22k).toLocaleString('en-IN')}` : null} color="bg-[#8b6914]/10 text-[#8b6914]" />
        <Badge label="24K" value={market24k ? `₹${Math.round(market24k).toLocaleString('en-IN')}` : null} color="bg-[#6b7280]/10 text-[#6b7280]" />

        <div className="h-4 w-px bg-[#d4c5b0] hidden sm:block" />

        {editable ? (
          <div className="flex items-center gap-x-2 gap-y-1.5 flex-wrap w-full sm:w-auto">
            <div className="flex items-center gap-1.5 flex-1 sm:flex-none min-w-0">
              <label className="font-semibold text-[#7a6652] text-[10px] uppercase tracking-wider shrink-0">Gold/gm</label>
              <input type="number" inputMode="decimal" value={goldRateInput}
                onChange={e => setGoldRateInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="min-w-0 flex-1 sm:flex-none sm:w-24 bg-white border border-[#d4c5b0] rounded-lg px-2 py-1 text-sm font-bold text-[#8b6914] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/40 placeholder-[#c4b69e]"
                placeholder="₹" />
            </div>
            <div className="flex items-center gap-1.5 flex-1 sm:flex-none min-w-0">
              <label className="font-semibold text-[#7a6652] text-[10px] uppercase tracking-wider shrink-0">Silver/gm</label>
              <input type="number" inputMode="decimal" value={silverRateInput}
                onChange={e => setSilverRateInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="min-w-0 flex-1 sm:flex-none sm:w-24 bg-white border border-[#d4c5b0] rounded-lg px-2 py-1 text-sm font-bold text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#6b7280]/40 placeholder-[#c4b69e]"
                placeholder="₹" />
            </div>
            <button onClick={handleSave} disabled={saving}
              className="bg-[#8b6914] hover:bg-[#7a5c10] disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all shrink-0">
              {saving ? '...' : 'Save'}
            </button>
            {msg.text && <span className={`text-xs font-semibold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
          </div>
        ) : (
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            {goldRate > 0 && <Badge label="Billing" value={`₹${goldRate.toLocaleString('en-IN')}/gm`} color="bg-[#8b6914]/10 text-[#8b6914]" />}
            {silverRate > 0 && <Badge label="Silver" value={`₹${silverRate.toLocaleString('en-IN')}/gm`} color="bg-[#6b7280]/10 text-[#6b7280]" />}
            {!goldRate && <span className="text-[#8b6914]/60 text-xs">No rate set today</span>}
          </div>
        )}
      </div>
    </div>
  );
}
