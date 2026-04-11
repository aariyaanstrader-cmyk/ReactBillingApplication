import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import Navbar from '../components/Navbar';
import RateHeader from '../components/RateHeader';
import api from '../utils/api';

const emptyItem = {
  displayName: '',
  metal: 'Gold',
  grossWeight: '',
  waste: '',
  stoneValue: '',
  makingCharge: '',
  makingChargeWaived: false,
  qty: 1,
};

const defaultExtras = [
  { id: 'handling',    name: 'Handling Charges', amount: '', waived: false },
  { id: 'delivery',   name: 'Delivery Charges',  amount: '', waived: false },
  { id: 'travel',     name: 'Travel Charges',    amount: '', waived: false },
  { id: 'qualityTest',name: 'Quality Test',      amount: '', waived: false },
];

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function NewBill() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;

  // ── Rates
  const [goldRate, setGoldRate] = useState(0);
  const [silverRate, setSilverRate] = useState(0);
  const [rateLoading, setRateLoading] = useState(true);

  // ── Bill fields
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [exchangeItems, setExchangeItems] = useState([{ description: '', metal: 'Gold', grossWeight: '', purity: 22, exchangeRate: '', exchangeValue: 0 }]);
  const [extraCharges, setExtraCharges] = useState(defaultExtras.map(e => ({ ...e })));
  const [discount, setDiscount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');

  // ── Customer
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const custTimer = useRef(null);

  // ── Item search
  const [itemSearchResults, setItemSearchResults] = useState({});
  const [activeItemSearch, setActiveItemSearch] = useState(-1);
  const itemTimer = useRef(null);

  // ── UI state
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState('');
  const [showExchange, setShowExchange] = useState(true);
  const [draftLoaded, setDraftLoaded] = useState(!isEdit);
  const [editStatus, setEditStatus] = useState(null); // 'draft' or 'confirmed'
  const [summaryOpen, setSummaryOpen] = useState(true);

  const handleRatesLoaded = (rate) => {
    if (rate) {
      setGoldRate(rate.goldRate || 0);
      setSilverRate(rate.silverRate || 0);
    }
    setRateLoading(false);
  };

  // Safety timeout: if rates never load, stop blocking the page
  useEffect(() => {
    if (!rateLoading) return;
    const t = setTimeout(() => setRateLoading(false), 8000);
    return () => clearTimeout(t);
  }, [rateLoading]);

  // ── Load draft for editing
  useEffect(() => {
    if (!editId) return;
    api.get(`/orders/${editId}`).then(res => {
      const o = res.data.order;
      if (!o) return;
      setItems(o.items.map(it => ({
        displayName: it.displayName || '',
        metal: it.metal || 'Gold',
        grossWeight: it.grossWeight || '',
        waste: it.waste || '',
        stoneValue: it.stoneValue || '',
        makingCharge: it.makingCharge || '',
        makingChargeWaived: it.makingChargeWaived || false,
        qty: it.qty || 1,
        itemRef: it.itemRef,
        hsnCode: it.hsnCode || '',
        category: it.category || '',
      })));
      setCustomer({ name: o.customer.name, phone: o.customer.phone || '', address: o.customer.address || '', ref: o.customer.ref });
      setCustomerSearch(o.customer.name);
      setExchangeItems(o.exchangeItems || []);
      setShowExchange(o.exchangeItems?.length > 0);
      setDiscount(o.discount ? String(o.discount) : '');
      setPaymentMode(o.paymentMode || 'cash');
      setAmountPaid(o.amountPaid ? String(o.amountPaid) : '');
      setNotes(o.notes || '');
      const savedExtras = o.extraCharges || [];
      const extras = defaultExtras.map(de => {
        const found = savedExtras.find(se => se.name === de.name);
        return found ? { ...de, amount: String(found.amount || ''), waived: found.waived || false } : { ...de };
      });
      savedExtras.forEach(se => {
        if (!defaultExtras.find(de => de.name === se.name)) {
          extras.push({ id: se.name, name: se.name, amount: String(se.amount || ''), waived: se.waived || false });
        }
      });
      setExtraCharges(extras);
      if (o.goldRate) setGoldRate(o.goldRate);
      if (o.silverRate) setSilverRate(o.silverRate);
      setEditStatus(o.status || 'draft');
      setDraftLoaded(true);
    }).catch(() => {
      setError('Failed to load order');
      setDraftLoaded(true);
    });
  }, [editId]);

  // ── Auto-add new row when last item is filled
  const lastItem = items[items.length - 1];
  const shouldAutoAdd = lastItem?.displayName?.trim() && Number(lastItem?.grossWeight) > 0;

  useEffect(() => {
    if (shouldAutoAdd) {
      setItems(prev => [...prev, { ...emptyItem }]);
    }
  }, [shouldAutoAdd]);

  // ── Calculations
  const calcTotals = () => {
    let goldValueTotal = 0, silverValueTotal = 0, stoneValueTotal = 0;
    let makingChargesTotal = 0, makingChargesWaived = 0;

    items.forEach(item => {
      const isSilver = item.metal === 'Silver';
      const rate = isSilver ? silverRate : goldRate;
      const gw = Number(item.grossWeight) || 0;
      const waste = Number(item.waste) || 0;
      const qty = Number(item.qty) || 1;
      const mc = Number(item.makingCharge) || 0;
      const sv = Number(item.stoneValue) || 0;
      const metalVal = (gw + waste) * rate * qty;

      if (isSilver) silverValueTotal += metalVal;
      else goldValueTotal += metalVal;

      stoneValueTotal += sv * qty;
      if (item.makingChargeWaived) makingChargesWaived += mc * qty;
      else makingChargesTotal += mc * qty;
    });

    const metalValueTotal = goldValueTotal + silverValueTotal;

    let extraTotal = 0, extraWaived = 0;
    extraCharges.forEach(ec => {
      const amt = Number(ec.amount) || 0;
      if (ec.waived) extraWaived += amt;
      else extraTotal += amt;
    });

    const exchangeTotal = exchangeItems.reduce((s, e) => s + (Number(e.exchangeValue) || 0), 0);
    const discountAmt = Number(discount) || 0;
    const subTotal = metalValueTotal + makingChargesTotal + stoneValueTotal;
    const grandTotal = subTotal + extraTotal - discountAmt;
    const netPayable = grandTotal - exchangeTotal;

    return { goldValueTotal, silverValueTotal, metalValueTotal, stoneValueTotal,
             makingChargesTotal, makingChargesWaived,
             extraTotal, extraWaived,
             exchangeTotal, discountAmt, subTotal, grandTotal, netPayable };
  };

  const t = calcTotals();

  // ── Item helpers
  const updateItem = (i, field, value) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: value };
    setItems(updated);
  };
  const removeItem = (i) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== i));
    const sr = { ...itemSearchResults };
    delete sr[i];
    setItemSearchResults(sr);
  };

  // ── Item search (debounced)
  const searchItems = (i, q) => {
    updateItem(i, 'displayName', q);
    if (itemTimer.current) clearTimeout(itemTimer.current);
    if (q.length < 1) {
      const sr = { ...itemSearchResults };
      delete sr[i];
      setItemSearchResults(sr);
      setActiveItemSearch(-1);
      return;
    }
    setActiveItemSearch(i);
    itemTimer.current = setTimeout(async () => {
      try {
        const r = await api.get('/items?search=' + encodeURIComponent(q));
        setItemSearchResults(prev => ({ ...prev, [i]: r.data.items || [] }));
      } catch {}
    }, 300);
  };

  const selectItem = (i, masterItem) => {
    const updated = [...items];
    updated[i] = {
      ...updated[i],
      displayName: masterItem.displayName,
      metal: masterItem.metal || 'Gold',
      itemRef: masterItem._id,
      hsnCode: masterItem.hsnCode || '',
      category: masterItem.category || '',
      makingCharge: masterItem.hasMakingCharge === false ? 0 : updated[i].makingCharge,
    };
    setItems(updated);
    const sr = { ...itemSearchResults };
    delete sr[i];
    setItemSearchResults(sr);
    setActiveItemSearch(-1);
  };

  // ── Exchange helpers
  const emptyExchange = { description: '', metal: 'Gold', grossWeight: '', purity: 22, exchangeRate: '', exchangeValue: 0 };

  const updateExchange = (i, field, value) => {
    const updated = [...exchangeItems];
    updated[i] = { ...updated[i], [field]: value };
    const metal = updated[i].metal || 'Gold';
    const gw = parseFloat(updated[i].grossWeight) || 0;
    const pur = parseFloat(updated[i].purity) || (metal === 'Silver' ? 100 : 22);
    const defaultRate = metal === 'Silver' ? silverRate : goldRate;
    const rate = parseFloat(updated[i].exchangeRate) || defaultRate || 0;
    // For silver, no purity conversion
    updated[i].exchangeValue = metal === 'Silver'
      ? Math.round(gw * rate)
      : Math.round(gw * (pur / 22) * rate);
    setExchangeItems(updated);
  };
  const addExchange = () => setExchangeItems(prev => [...prev, { ...emptyExchange, exchangeRate: goldRate || '' }]);
  const removeExchange = (i) => {
    if (exchangeItems.length <= 1) return;
    setExchangeItems(exchangeItems.filter((_, idx) => idx !== i));
  };

  // Auto-add exchange row when last is filled
  const lastEx = exchangeItems[exchangeItems.length - 1];
  const shouldAutoAddEx = showExchange && lastEx?.description?.trim() && Number(lastEx?.grossWeight) > 0;
  useEffect(() => {
    if (shouldAutoAddEx) {
      const defaultRate = lastEx?.metal === 'Silver' ? silverRate : goldRate;
      setExchangeItems(prev => [...prev, { ...emptyExchange, exchangeRate: defaultRate || '' }]);
    }
  }, [shouldAutoAddEx]);

  // ── Extra charge helpers
  const updateExtra = (i, field, value) => {
    const updated = [...extraCharges];
    updated[i] = { ...updated[i], [field]: value };
    setExtraCharges(updated);
  };

  // ── Customer search (debounced)
  const searchCustomer = (q) => {
    setCustomerSearch(q);
    setCustomer(c => ({ ...c, name: q, ref: undefined }));
    if (custTimer.current) clearTimeout(custTimer.current);
    if (q.length < 1) { setCustomerResults([]); return; }
    custTimer.current = setTimeout(async () => {
      try {
        const r = await api.get('/customers?search=' + encodeURIComponent(q) + '&limit=5');
        setCustomerResults(r.data.customers || []);
      } catch {}
    }, 300);
  };
  const selectCustomer = (c) => {
    setCustomer({ name: c.name, phone: c.phone || '', address: c.address || '', ref: c._id });
    setCustomerSearch(c.name);
    setCustomerResults([]);
  };

  // ── Build payload
  const buildPayload = () => {
    const filledItems = items.filter(i => i.displayName && (Number(i.grossWeight) > 0));
    const allExtras = [...extraCharges.filter(ec => Number(ec.amount) > 0 || ec.waived)];
    return {
      customer,
      items: filledItems,
      exchangeItems: exchangeItems.filter(e => e.description?.trim() && Number(e.grossWeight) > 0),
      extraCharges: allExtras,
      discount: Number(discount) || 0,
      paymentMode,
      amountPaid: Number(amountPaid) || 0,
      notes,
    };
  };

  const isEditConfirmed = isEdit && editStatus === 'confirmed';

  // ── Submit (confirm or update)
  const handleSubmit = async () => {
    if (!customer.name.trim()) { setError('Customer name is required'); return; }
    const filledItems = items.filter(i => i.displayName && (Number(i.grossWeight) > 0));
    if (filledItems.length === 0) { setError('Add at least one item with name and weight'); return; }
    setSaving(true); setError('');
    try {
      const payload = buildPayload();
      let res;
      if (isEdit) {
        res = await api.put(`/orders/${editId}`, { ...payload, confirmBill: !isEditConfirmed });
      } else {
        res = await api.post('/orders', payload);
      }
      navigate('/bills/' + res.data.order._id);
      if (!isEditConfirmed) confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#f59e0b', '#10b981', '#8b5cf6', '#ec4899'] });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  // ── Save as Draft
  const handleSaveDraft = async () => {
    if (!customer.name.trim()) { setError('Customer name is required'); return; }
    const filledItems = items.filter(i => i.displayName && (Number(i.grossWeight) > 0));
    if (filledItems.length === 0) { setError('Add at least one item'); return; }
    setSavingDraft(true); setError('');
    try {
      const payload = buildPayload();
      let res;
      if (isEdit) {
        res = await api.put(`/orders/${editId}`, payload);
      } else {
        res = await api.post('/orders', { ...payload, saveAsDraft: true });
      }
      navigate('/bills/' + res.data.order._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  if (rateLoading || !draftLoaded) return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar />
      <RateHeader onRatesLoaded={handleRatesLoaded} />
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-[#8b6914] border-t-transparent rounded-full animate-spin mr-3" />
        <span className="text-[#7a6652] text-sm">Loading rates…</span>
      </div>
    </div>
  );

  if (!goldRate) return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar />
      <RateHeader editable={true} onRatesLoaded={handleRatesLoaded} />
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <h2 className="text-lg font-semibold text-[#3d2b1f] mb-1">No Billing Rate for Today</h2>
        <p className="text-[#7a6652] text-sm mb-6">Set the 1gm billing rate in the bar above before creating an order.</p>
      </div>
    </div>
  );

  // Helper: get computed values for an item row
  const getItemComputed = (item) => {
    const rate = item.metal === 'Silver' ? silverRate : goldRate;
    const gw = Number(item.grossWeight) || 0;
    const waste = Number(item.waste) || 0;
    const qty = Number(item.qty) || 1;
    const mc = item.makingChargeWaived ? 0 : (Number(item.makingCharge) || 0);
    const sv = Number(item.stoneValue) || 0;
    const metalVal = (gw + waste) * rate;
    const lineTotal = (metalVal + mc + sv) * qty;
    return { rate, gw, waste, qty, metalVal, lineTotal };
  };

  const inputCls = "w-full bg-[#faf7f2] border border-[#d4c5b0] rounded-lg px-2 py-1.5 text-sm text-[#3d2b1f] placeholder-[#b0a090] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/30";
  const inputClsStriked = "w-full bg-[#f0ebe3] border border-[#e0d5c5] rounded-lg px-2 py-1.5 text-sm text-[#b0a090] line-through focus:outline-none focus:ring-2 focus:ring-[#8b6914]/30";

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar />
      <RateHeader editable={true} onRatesLoaded={handleRatesLoaded} />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/')} className="text-[#7a6652] hover:text-[#3d2b1f]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-[#3d2b1f]">{isEditConfirmed ? 'Edit Order' : isEdit ? 'Edit Draft' : 'New Order'}</h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* ── LEFT: Form (col-span 3) ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Customer */}
            <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm p-3 sm:p-4">
              <h3 className="text-xs font-extrabold text-[#3d2b1f] uppercase tracking-wider mb-3">Customer</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <label className="block text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold mb-1">Name *</label>
                  <input placeholder="Search customer…" value={customerSearch}
                    onChange={e => searchCustomer(e.target.value)}
                    className={inputCls} />
                  {customerResults.length > 0 && (
                    <div className="absolute z-20 bg-white border border-[#d4c5b0] rounded-xl shadow-lg w-full mt-1 overflow-hidden max-h-48 overflow-y-auto">
                      {customerResults.map(c => (
                        <button key={c._id} onClick={() => selectCustomer(c)}
                          className="w-full text-left px-3 py-2 hover:bg-[#faf7f2] text-sm border-b border-[#e0d5c5] last:border-0">
                          <span className="font-medium text-[#3d2b1f]">{c.name}</span>
                          {c.phone && <span className="text-[#7a6652] ml-2 text-xs">{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold mb-1">Phone</label>
                  <input placeholder="Phone" value={customer.phone}
                    onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold mb-1">Address</label>
                  <input placeholder="Address" value={customer.address}
                    onChange={e => setCustomer({ ...customer, address: e.target.value })}
                    className={inputCls} />
                </div>
              </div>
            </div>

            {/* ── Items Table ── */}
            <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm overflow-visible">
              <div className="px-4 py-2.5 border-b border-[#e0d5c5]">
                <h3 className="text-xs font-extrabold text-[#3d2b1f] uppercase tracking-wider">Items</h3>
              </div>

              {/* Table Header */}
              <div className="hidden sm:grid grid-cols-[64px_1fr_68px_64px_68px_68px_40px_44px_24px] gap-1.5 px-3 py-2 bg-[#f5f0e8] border-b border-[#e0d5c5] items-center">
                <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Metal</span>
                <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Item Name</span>
                <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Gross (g)</span>
                <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Waste (g)</span>
                <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Stone (₹)</span>
                <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">MC (₹)</span>
                <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Waive</span>
                <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Qty</span>
                <span></span>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-[#e0d5c5]">
                {items.map((item, i) => {
                  const isGold = item.metal !== 'Silver';
                  const { metalVal, lineTotal, qty, waste: itemWaste } = getItemComputed(item);
                  const isFilled = item.displayName.trim() && Number(item.grossWeight) > 0;
                  const isLastEmpty = i === items.length - 1 && !item.displayName.trim();

                  return (
                    <div key={i} className={`${isLastEmpty ? 'opacity-60' : ''}`}>
                      {/* Desktop row */}
                      <div className="hidden sm:grid grid-cols-[64px_1fr_68px_64px_68px_68px_40px_44px_24px] gap-1.5 px-3 py-1.5 items-center">
                        {/* Metal */}
                        <select value={item.metal} onChange={e => updateItem(i, 'metal', e.target.value)}
                          className={`w-full border rounded-lg px-1 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#8b6914]/30 ${
                            isGold ? 'border-[#8b6914]/30 bg-[#8b6914]/5 text-[#8b6914]' : 'border-[#6b7280]/30 bg-[#6b7280]/5 text-[#6b7280]'
                          }`}>
                          <option value="Gold">Gold</option>
                          <option value="Silver">Silver</option>
                        </select>

                        {/* Item Name with search */}
                        <div className="relative">
                          <input
                            placeholder={isLastEmpty ? 'Type to search item…' : 'Item name'}
                            value={item.displayName}
                            onChange={e => searchItems(i, e.target.value)}
                            onFocus={() => setActiveItemSearch(i)}
                            onBlur={() => setTimeout(() => setActiveItemSearch(-1), 400)}
                            className={inputCls} />
                          {activeItemSearch === i && itemSearchResults[i]?.length > 0 && (
                            <div className="absolute z-30 bg-white border border-[#d4c5b0] rounded-xl shadow-lg w-full mt-1 overflow-hidden max-h-56 overflow-y-auto">
                              {itemSearchResults[i].map(mi => (
                                <button key={mi._id}
                                  onMouseDown={(e) => { e.preventDefault(); selectItem(i, mi); }}
                                  className="w-full text-left px-3 py-2.5 hover:bg-[#faf7f2] text-sm border-b border-[#e0d5c5] last:border-0 active:bg-[#f5f0e8]">
                                  <span className="font-medium text-[#3d2b1f]">{mi.displayName}</span>
                                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${mi.metal === 'Gold' ? 'bg-[#8b6914]/10 text-[#8b6914]' : 'bg-[#6b7280]/10 text-[#6b7280]'}`}>
                                    {mi.metal}
                                  </span>
                                  {mi.category && <span className="text-[#7a6652] text-xs ml-1">{mi.category}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Gross Weight */}
                        <input type="number" step="0.001" placeholder="0.000"
                          value={item.grossWeight}
                          onChange={e => updateItem(i, 'grossWeight', e.target.value)}
                          className={inputCls} />

                        {/* Waste (g) */}
                        <input type="number" step="0.001" placeholder="0.000"
                          value={item.waste}
                          onChange={e => updateItem(i, 'waste', e.target.value)}
                          className={inputCls} />

                        {/* Stone Value (₹) */}
                        <input type="number" step="1" placeholder="0"
                          value={item.stoneValue}
                          onChange={e => updateItem(i, 'stoneValue', e.target.value)}
                          className={inputCls} />

                        {/* Making Charge */}
                        <input type="number" step="1" placeholder="0"
                          value={item.makingCharge}
                          onChange={e => updateItem(i, 'makingCharge', e.target.value)}
                          className={item.makingChargeWaived ? inputClsStriked : inputCls} />

                        {/* Waive MC */}
                        <div className="flex justify-center">
                          <input type="checkbox"
                            checked={item.makingChargeWaived}
                            onChange={e => updateItem(i, 'makingChargeWaived', e.target.checked)}
                            className="w-4 h-4 accent-[#8b6914] cursor-pointer" />
                        </div>

                        {/* Qty */}
                        <input type="number" min="1" value={item.qty}
                          onChange={e => updateItem(i, 'qty', e.target.value)}
                          className={inputCls} />

                        {/* Remove */}
                        {items.length > 1 && !isLastEmpty ? (
                          <button onClick={() => removeItem(i)} className="text-[#b0a090] hover:text-red-500 transition-colors flex justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        ) : <span />}
                      </div>

                      {/* Computed info bar for filled items */}
                      {isFilled && (
                        <div className="hidden sm:flex px-3 pb-1.5 gap-4 text-[10px]">
                          <span className="ml-[70px]" />
                          <span className={`font-semibold ${isGold ? 'text-[#8b6914]' : 'text-[#6b7280]'}`}>
                            {itemWaste > 0
                              ? `Wt: ${Number(item.grossWeight).toFixed(3)} + ${itemWaste.toFixed(3)} = ${(Number(item.grossWeight) + itemWaste).toFixed(3)}g`
                              : `Net: ${Number(item.grossWeight).toFixed(3)}g`}
                          </span>
                          <span className={`font-semibold ${isGold ? 'text-[#8b6914]' : 'text-[#6b7280]'}`}>
                            {isGold ? 'Gold' : 'Silver'}: {fmt(metalVal * qty)}
                          </span>
                          <span className="font-bold text-[#3d2b1f]">
                            Line Total: {fmt(lineTotal)}
                          </span>
                        </div>
                      )}

                      {/* Mobile card layout */}
                      <div className="sm:hidden p-3 space-y-2">
                        <div className="flex gap-2">
                          <select value={item.metal} onChange={e => updateItem(i, 'metal', e.target.value)}
                            className={`w-20 border rounded-lg px-1.5 py-1.5 text-xs font-semibold focus:outline-none ${
                              isGold ? 'border-[#8b6914]/30 bg-[#8b6914]/5 text-[#8b6914]' : 'border-[#6b7280]/30 bg-[#6b7280]/5 text-[#6b7280]'
                            }`}>
                            <option value="Gold">Gold</option>
                            <option value="Silver">Silver</option>
                          </select>
                          <div className="flex-1 relative">
                            <input placeholder={isLastEmpty ? 'Type to search item…' : 'Item name'}
                              value={item.displayName}
                              onChange={e => searchItems(i, e.target.value)}
                              onFocus={() => setActiveItemSearch(i)}
                              onBlur={() => setTimeout(() => setActiveItemSearch(-1), 400)}
                              className={inputCls} />
                            {activeItemSearch === i && itemSearchResults[i]?.length > 0 && (
                              <div className="absolute z-30 bg-white border border-[#d4c5b0] rounded-xl shadow-lg w-full mt-1 overflow-hidden max-h-56 overflow-y-auto">
                                {itemSearchResults[i].map(mi => (
                                  <button key={mi._id}
                                    onMouseDown={(e) => { e.preventDefault(); selectItem(i, mi); }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-[#faf7f2] text-sm border-b border-[#e0d5c5] last:border-0 active:bg-[#f5f0e8]">
                                    <span className="font-medium text-[#3d2b1f]">{mi.displayName}</span>
                                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${mi.metal === 'Gold' ? 'bg-[#8b6914]/10 text-[#8b6914]' : 'bg-[#6b7280]/10 text-[#6b7280]'}`}>
                                      {mi.metal}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {items.length > 1 && !isLastEmpty && (
                            <button onClick={() => removeItem(i)} className="text-[#b0a090] hover:text-red-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] uppercase text-[#7a6652] font-bold mb-0.5">Gross (g)</label>
                            <input type="number" step="0.001" value={item.grossWeight}
                              onChange={e => updateItem(i, 'grossWeight', e.target.value)} className={inputCls} />
                          </div>
                          <div>
                            <label className="block text-[9px] uppercase text-[#7a6652] font-bold mb-0.5">Waste (g)</label>
                            <input type="number" step="0.001" value={item.waste}
                              onChange={e => updateItem(i, 'waste', e.target.value)} className={inputCls} />
                          </div>
                          <div>
                            <label className="block text-[9px] uppercase text-[#7a6652] font-bold mb-0.5">Stone (₹)</label>
                            <input type="number" step="1" value={item.stoneValue}
                              onChange={e => updateItem(i, 'stoneValue', e.target.value)} className={inputCls} />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[9px] uppercase text-[#7a6652] font-bold mb-0.5">MC (₹)</label>
                            <div className="flex items-center gap-1.5">
                              <input type="number" step="1" placeholder="0" value={item.makingCharge}
                                onChange={e => updateItem(i, 'makingCharge', e.target.value)}
                                className={item.makingChargeWaived ? inputClsStriked : inputCls} />
                              <input type="checkbox"
                                checked={item.makingChargeWaived}
                                onChange={e => updateItem(i, 'makingChargeWaived', e.target.checked)}
                                className="w-4 h-4 accent-[#8b6914] cursor-pointer shrink-0"
                                title="Waive off" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] uppercase text-[#7a6652] font-bold mb-0.5">Qty</label>
                            <input type="number" min="1" value={item.qty}
                              onChange={e => updateItem(i, 'qty', e.target.value)} className={inputCls} />
                          </div>
                        </div>
                        {isFilled && (
                          <div className="flex justify-between text-[10px] pt-1">
                            <span className={`font-semibold ${isGold ? 'text-[#8b6914]' : 'text-[#6b7280]'}`}>
                              {isGold ? 'Gold' : 'Silver'}: {fmt(metalVal * qty)}
                            </span>
                            <span className="font-bold text-[#3d2b1f]">Total: {fmt(lineTotal)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Items count footer */}
              {items.filter(i => i.displayName.trim() && Number(i.grossWeight) > 0).length > 0 && (
                <div className="px-3 py-1.5 bg-[#f5f0e8] border-t border-[#e0d5c5] flex justify-between items-center">
                  <span className="text-[10px] text-[#7a6652] font-medium">
                    {items.filter(i => i.displayName.trim() && Number(i.grossWeight) > 0).length} item(s)
                  </span>
                  <span className="text-xs font-semibold text-[#3d2b1f]">
                    Total: {fmt(t.metalValueTotal + t.makingChargesTotal + t.stoneValueTotal)}
                  </span>
                </div>
              )}
            </div>

            {/* Extra Charges */}
            <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm p-4">
              <h3 className="text-xs font-extrabold text-[#3d2b1f] uppercase tracking-wider mb-3">Additional Charges</h3>
              <div className="space-y-2">
                {extraCharges.map((ec, i) => (
                  <div key={ec.id} className="flex items-center gap-3">
                    <span className="w-36 text-xs text-[#7a6652] font-medium shrink-0">{ec.name}</span>
                    <div className="flex-1">
                      <input type="number" step="1" placeholder="₹ amount"
                        value={ec.amount}
                        onChange={e => updateExtra(i, 'amount', e.target.value)}
                        className={ec.waived ? inputClsStriked : inputCls} />
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                      <input type="checkbox"
                        checked={ec.waived}
                        onChange={e => updateExtra(i, 'waived', e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#8b6914]" />
                      <span className="text-xs text-[#7a6652]">Waive</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Exchange items — table format like Items */}
            <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm overflow-visible">
              <div className="px-4 py-2.5 border-b border-[#e0d5c5]">
                <h3 className="text-xs font-extrabold text-[#3d2b1f] uppercase tracking-wider">Old Exchange</h3>
              </div>
                  {/* Table Header */}
                  <div className="hidden sm:grid grid-cols-[68px_1fr_80px_65px_80px_80px_28px] gap-1.5 px-3 py-2 bg-[#f5f0e8] border-b border-[#e0d5c5] items-center">
                    <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Metal</span>
                    <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Description</span>
                    <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Weight (g)</span>
                    <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Purity</span>
                    <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider">Rate/gm</span>
                    <span className="text-[10px] font-extrabold text-[#7a6652] uppercase tracking-wider text-right">Value</span>
                    <span></span>
                  </div>

                  {/* Exchange Rows */}
                  <div className="divide-y divide-[#f0ebe3]">
                    {exchangeItems.map((ex, i) => {
                      const isLastEmpty = i === exchangeItems.length - 1 && !ex.description?.trim();
                      const isGold = ex.metal !== 'Silver';
                      return (
                        <div key={i} className={isLastEmpty ? 'opacity-60' : ''}>
                          {/* Desktop row */}
                          <div className="hidden sm:grid grid-cols-[68px_1fr_80px_65px_80px_80px_28px] gap-1.5 px-3 py-1.5 items-center">
                            <select value={ex.metal} onChange={e => { updateExchange(i, 'metal', e.target.value); if (e.target.value === 'Silver') updateExchange(i, 'exchangeRate', silverRate || ''); else updateExchange(i, 'exchangeRate', goldRate || ''); }}
                              className={`w-full border rounded-lg px-1 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#8b6914]/30 ${isGold ? 'border-[#8b6914]/30 bg-[#8b6914]/5 text-[#8b6914]' : 'border-[#6b7280]/30 bg-[#6b7280]/5 text-[#6b7280]'}`}>
                              <option value="Gold">Gold</option>
                              <option value="Silver">Silver</option>
                            </select>

                            <input placeholder={isLastEmpty ? 'Type description to add…' : 'Old Ring, Chain etc.'} value={ex.description}
                              onChange={e => updateExchange(i, 'description', e.target.value)}
                              className={inputCls} />

                            <input type="number" step="0.001" placeholder="0.000" value={ex.grossWeight}
                              onChange={e => updateExchange(i, 'grossWeight', e.target.value)}
                              className={inputCls} />

                            {isGold ? (
                              <input type="number" placeholder="22" value={ex.purity}
                                onChange={e => updateExchange(i, 'purity', e.target.value)}
                                className={inputCls} />
                            ) : (
                              <span className="text-xs text-[#7a6652] text-center">—</span>
                            )}

                            <input type="number" placeholder="Rate" value={ex.exchangeRate}
                              onChange={e => updateExchange(i, 'exchangeRate', e.target.value)}
                              className={inputCls} />

                            <span className="text-xs font-semibold text-[#3d2b1f] text-right">
                              {Number(ex.exchangeValue) > 0 ? fmt(ex.exchangeValue) : '—'}
                            </span>

                            {exchangeItems.length > 1 && !isLastEmpty ? (
                              <button onClick={() => removeExchange(i)} className="text-[#b0a090] hover:text-red-500 transition-colors flex justify-center">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            ) : <span />}
                          </div>

                          {/* Computed info bar — desktop */}
                          {!isLastEmpty && Number(ex.grossWeight) > 0 && (
                            <div className="hidden sm:flex px-3 pb-1.5 gap-4 text-[10px]">
                              <span className="ml-[74px]" />
                              <span className={`font-semibold ${isGold ? 'text-[#8b6914]/70' : 'text-[#6b7280]/70'}`}>
                                {isGold ? `${Number(ex.grossWeight).toFixed(3)}g @ ${ex.purity || 22}K` : `${Number(ex.grossWeight).toFixed(3)}g`}
                              </span>
                              <span className={`font-semibold ${isGold ? 'text-[#8b6914]/70' : 'text-[#6b7280]/70'}`}>
                                Rate: {fmt(ex.exchangeRate || (isGold ? goldRate : silverRate))}
                              </span>
                              <span className="font-bold text-[#3d2b1f]">
                                Value: {fmt(ex.exchangeValue)}
                              </span>
                            </div>
                          )}

                          {/* Mobile layout */}
                          <div className="sm:hidden p-3 space-y-2">
                            <div className="flex gap-2">
                              <select value={ex.metal} onChange={e => { updateExchange(i, 'metal', e.target.value); if (e.target.value === 'Silver') updateExchange(i, 'exchangeRate', silverRate || ''); else updateExchange(i, 'exchangeRate', goldRate || ''); }}
                                className={`w-20 border rounded-lg px-1.5 py-1.5 text-xs font-semibold focus:outline-none ${isGold ? 'border-[#8b6914]/30 bg-[#8b6914]/5 text-[#8b6914]' : 'border-[#6b7280]/30 bg-[#6b7280]/5 text-[#6b7280]'}`}>
                                <option value="Gold">Gold</option><option value="Silver">Silver</option>
                              </select>
                              <input placeholder={isLastEmpty ? 'Type to add…' : 'Description'} value={ex.description}
                                onChange={e => updateExchange(i, 'description', e.target.value)} className={`flex-1 ${inputCls}`} />
                              {exchangeItems.length > 1 && !isLastEmpty && (
                                <button onClick={() => removeExchange(i)} className="text-[#b0a090] hover:text-red-500">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[9px] uppercase text-[#7a6652] font-bold mb-0.5">Weight (g)</label>
                                <input type="number" step="0.001" value={ex.grossWeight} onChange={e => updateExchange(i, 'grossWeight', e.target.value)} className={inputCls} />
                              </div>
                              {isGold ? (
                                <div>
                                  <label className="block text-[9px] uppercase text-[#7a6652] font-bold mb-0.5">Purity (K)</label>
                                  <input type="number" value={ex.purity} onChange={e => updateExchange(i, 'purity', e.target.value)} className={inputCls} />
                                </div>
                              ) : <div />}
                              <div>
                                <label className="block text-[9px] uppercase text-[#7a6652] font-bold mb-0.5">Rate/gm</label>
                                <input type="number" value={ex.exchangeRate} onChange={e => updateExchange(i, 'exchangeRate', e.target.value)} className={inputCls} />
                              </div>
                            </div>
                            {Number(ex.exchangeValue) > 0 && (
                              <div className="text-right text-xs font-bold text-[#3d2b1f]">Value: {fmt(ex.exchangeValue)}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Exchange total footer */}
                  {exchangeItems.filter(e => Number(e.exchangeValue) > 0).length > 0 && (
                    <div className="px-3 py-1.5 bg-[#f5f0e8] border-t border-[#e0d5c5] flex justify-between items-center">
                      <span className="text-[10px] text-[#7a6652] font-medium">
                        {exchangeItems.filter(e => Number(e.exchangeValue) > 0).length} exchange item(s)
                      </span>
                      <span className="text-xs font-semibold text-[#3d2b1f]">
                        Exchange Total: {fmt(exchangeItems.reduce((s, e) => s + (Number(e.exchangeValue) || 0), 0))}
                      </span>
                    </div>
                  )}
            </div>

            {/* Notes */}
            <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm p-4">
              <label className="block text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold mb-1">Notes (optional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any remarks for this order…"
                className={inputCls} />
            </div>

          </div>

          {/* ── RIGHT: Order Summary (col-span 2) ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Order Summary - sticky on desktop */}
            <div className="lg:sticky lg:top-28 space-y-4">

              {/* Summary Breakdown */}
              <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setSummaryOpen(!summaryOpen)}
                  className="w-full bg-[#4a1c1c] text-white px-4 py-2.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide">Order Summary</p>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#f0c040]">{fmt(t.netPayable)}</span>
                    <svg className={`w-4 h-4 transition-transform ${summaryOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {summaryOpen && (
                  <div className="p-4 space-y-1.5 text-sm bg-white">
                    {t.goldValueTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#7a6652]">Gold Value</span>
                        <span className="font-medium text-[#8b6914]">{fmt(t.goldValueTotal)}</span>
                      </div>
                    )}

                    {t.silverValueTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#7a6652]">Silver Value</span>
                        <span className="font-medium text-[#6b7280]">{fmt(t.silverValueTotal)}</span>
                      </div>
                    )}

                    {t.stoneValueTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#7a6652]">Stone Value</span>
                        <span className="font-medium text-[#3d2b1f]">{fmt(t.stoneValueTotal)}</span>
                      </div>
                    )}

                    {(t.makingChargesTotal > 0 || t.makingChargesWaived > 0) && (
                      <div className="flex justify-between">
                        <span className="text-[#7a6652]">Making Charges</span>
                        <div className="text-right">
                          <span className="font-medium text-[#3d2b1f]">{fmt(t.makingChargesTotal)}</span>
                          {t.makingChargesWaived > 0 && (
                            <span className="ml-2 text-xs text-emerald-600 font-medium">
                              (Waived {fmt(t.makingChargesWaived)})
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-[#e0d5c5] my-1.5 pt-1.5">
                      <div className="flex justify-between font-semibold">
                        <span className="text-[#3d2b1f]">Sub Total</span>
                        <span className="text-[#3d2b1f]">{fmt(t.subTotal)}</span>
                      </div>
                    </div>

                    {/* Extra charges */}
                    {extraCharges.some(ec => Number(ec.amount) > 0) && (
                      <div className="bg-[#faf7f2] rounded-xl p-2.5 space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold mb-1.5">Additional</p>
                        {extraCharges.map((ec, i) => {
                          const amt = Number(ec.amount) || 0;
                          if (!amt) return null;
                          return (
                            <div key={i} className="flex justify-between">
                              <span className={`text-xs ${ec.waived ? 'line-through text-[#b0a090]' : 'text-[#7a6652]'}`}>{ec.name}</span>
                              <div className="text-right">
                                <span className={`text-sm font-medium ${ec.waived ? 'text-[#b0a090] line-through' : 'text-[#3d2b1f]'}`}>
                                  {fmt(amt)}
                                </span>
                                {ec.waived && <span className="ml-1 text-xs text-emerald-600 font-medium">Waived</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {showExchange && t.exchangeTotal > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span className="text-xs font-medium">Exchange Credit</span>
                        <span className="text-sm font-semibold">- {fmt(t.exchangeTotal)}</span>
                      </div>
                    )}
                    {t.discountAmt > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span className="text-xs font-medium">Discount</span>
                        <span className="text-sm font-semibold">- {fmt(t.discountAmt)}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-bold text-base border-t border-[#e0d5c5] pt-2.5 mt-1.5">
                      <span className="text-[#3d2b1f]">Net Payable</span>
                      <span className="text-[#8b6914]">{fmt(t.netPayable)}</span>
                    </div>

                    {(t.makingChargesWaived > 0 || t.extraWaived > 0) && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mt-2">
                        <p className="text-xs font-semibold text-emerald-600 mb-1">Customer Savings</p>
                        {t.makingChargesWaived > 0 && <p className="text-xs text-emerald-600/80">Making Charges: {fmt(t.makingChargesWaived)}</p>}
                        {t.extraWaived > 0 && <p className="text-xs text-emerald-600/80">Additional Charges: {fmt(t.extraWaived)}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Payment */}
              <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm p-4 space-y-3">
                <h3 className="text-xs font-extrabold text-[#3d2b1f] uppercase tracking-wider">Payment</h3>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold mb-0.5">Discount (₹)</label>
                  <input type="number" value={discount} onChange={e => setDiscount(e.target.value)}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold mb-0.5">Payment Mode</label>
                  <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
                    className="w-full bg-[#faf7f2] border border-[#d4c5b0] rounded-lg px-2.5 py-1.5 text-sm text-[#3d2b1f] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/30">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                    <option value="credit">Credit</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#7a6652] font-semibold mb-0.5">Amount Paid (₹)</label>
                  <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                    className={inputCls} />
                </div>
                {amountPaid && Number(amountPaid) > 0 && (
                  <div className={`flex justify-between text-sm font-semibold rounded-xl px-3 py-2 ${
                    t.netPayable - Number(amountPaid) <= 0
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-red-600'
                  }`}>
                    <span>Balance Due</span>
                    <span>{fmt(Math.max(0, t.netPayable - Number(amountPaid)))}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <button onClick={handleSubmit} disabled={saving || savingDraft}
                  className="w-full bg-[#8b6914] hover:bg-[#7a5c10] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                  {saving
                    ? <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving…
                      </span>
                    : isEditConfirmed ? 'Update Order' : 'Confirm Order'}
                </button>
                {!isEditConfirmed && <button onClick={handleSaveDraft} disabled={saving || savingDraft}
                  className="w-full border border-[#d4c5b0] text-[#7a6652] hover:bg-[#f5f0e8] font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {savingDraft
                    ? <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-[#7a6652] border-t-transparent rounded-full animate-spin" />
                        Saving Draft…
                      </span>
                    : isEdit ? 'Update Draft' : 'Save as Draft'}
                </button>}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
