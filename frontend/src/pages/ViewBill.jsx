import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import RateHeader from '../components/RateHeader';
import api from '../utils/api';
import { generateInvoicePdf } from '../utils/invoicePdf';

// Plain number for table cells
const num = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
// Rs prefix for summary lines only
const rs = (n) => `Rs.${num(n)}`;

export default function ViewBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [whatsappBusy, setWhatsappBusy] = useState(false);
  const [showAttachHint, setShowAttachHint] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [payingSaving, setPayingSaving] = useState(false);

  useEffect(() => { api.get(`/orders/${id}`).then(res => setOrder(res.data.order)).catch(() => {}).finally(() => setLoading(false)); }, [id]);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    setCancelling(true); setCancelError('');
    try { await api.put(`/orders/${id}/cancel`); navigate('/bills'); }
    catch (err) { setCancelError(err.response?.data?.message || 'Failed'); }
    finally { setCancelling(false); }
  };
  const handleRecordPayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) return;
    setPayingSaving(true);
    try { const res = await api.put(`/orders/${id}/payment`, { amount: Number(payAmount), mode: payMode, notes: payNotes }); setOrder(res.data.order); setShowPayForm(false); setPayAmount(''); setPayMode('cash'); setPayNotes(''); }
    catch (err) { alert(err.response?.data?.message || 'Failed'); }
    finally { setPayingSaving(false); }
  };
  const handlePrint = async () => {
    try {
      const pdf = await generateInvoicePdf(order);
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) { alert('Print failed: ' + err.message); }
  };
  const handleDownloadPdf = async () => {
    if (!order || downloadingPdf) return; setDownloadingPdf(true);
    try { const pdf = await generateInvoicePdf(order); pdf.save(`${order.billNo}-Invoice.pdf`); }
    catch (err) { alert('PDF failed: ' + err.message); } finally { setDownloadingPdf(false); }
  };
  const handleWhatsApp = async () => {
    if (!order || whatsappBusy) return; setWhatsappBusy(true);
    try {
      const pdf = await generateInvoicePdf(order); const blob = pdf.output('blob');
      const fileName = `${order.billNo}-Invoice.pdf`; const file = new File([blob], fileName, { type: 'application/pdf' });
      let shared = false;
      try { if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: fileName }); shared = true; } } catch {}
      if (!shared) {
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        setShowAttachHint(true);
        setTimeout(() => {
          const phone = order.customer.phone?.replace(/\D/g, '') || '';
          const amt = Number(order.netPayable || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
          const msg = [`Hi ${order.customer.name},`, '', `Please find your ${order.billNo} attached.`, '', `*Net Payable: Rs.${amt}*`,
            order.balanceDue > 0 && order.amountPaid > 0 ? `*Balance Due: Rs.${Number(order.balanceDue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}*` : '', '', `Thank you!`].filter(Boolean).join('\n');
          window.open(phone ? `https://wa.me/91${phone.slice(-10)}?text=${encodeURIComponent(msg)}` : 'https://web.whatsapp.com/', '_blank');
        }, 800);
      }
    } catch (err) { alert('PDF failed: ' + err.message); } finally { setWhatsappBusy(false); }
  };

  if (loading) return (<div className="min-h-screen bg-[#faf7f2]"><Navbar /><RateHeader /><div className="flex items-center justify-center py-32 gap-2 text-[#7a6652]"><div className="w-5 h-5 border-2 border-[#d4c5b0] border-t-[#8b6914] rounded-full animate-spin" /><span className="text-xs">Loading...</span></div></div>);
  if (!order) return (<div className="min-h-screen bg-[#faf7f2]"><Navbar /><RateHeader /><div className="text-center py-24 text-[#7a6652] text-xs">Order not found.</div></div>);

  const cancelled = order.status === 'cancelled';
  const isDraft = order.status === 'draft';
  const hasGold = order.items?.some(i => i.metal !== 'Silver');
  const hasSilver = order.items?.some(i => i.metal === 'Silver');
  const hasStone = order.items?.some(i => (i.stoneValue || 0) > 0);
  const hasWaste = order.items?.some(i => (i.waste || 0) > 0);
  const multiItem = order.items?.length > 1;
  const hasExtras = order.extraCharges?.some(ec => ec.amount > 0 && !ec.waived);
  const hasDeductions = order.discount > 0 || order.exchangeTotal > 0 || hasExtras;
  const rateParts = [];
  if (hasGold) rateParts.push(`Gold: Rs.${num(order.goldRate)}/gm`);
  if (hasSilver && order.silverRate > 0) rateParts.push(`Silver: Rs.${num(order.silverRate)}/gm`);

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar /><RateHeader />

      {/* ACTION BAR */}
      <div className="bg-white border-b border-[#e0d5c5]">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
          <button onClick={() => navigate('/bills')} className="flex items-center gap-1 text-xs text-[#7a6652] hover:text-[#3d2b1f] shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Orders
          </button>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {cancelError && <span className="text-[10px] text-red-500 mr-1 w-full text-right sm:w-auto">{cancelError}</span>}
            {!cancelled && <button onClick={() => navigate(`/bills/${id}/edit`)} className="text-xs px-2 sm:px-2.5 py-1 rounded-lg border border-[#8b6914]/30 bg-[#8b6914]/10 text-[#8b6914]">Edit</button>}
            <button onClick={handlePrint} className="text-xs px-2 sm:px-2.5 py-1 rounded-lg border border-[#d4c5b0] text-[#3d2b1f] hover:bg-[#f5f0e8]">Print</button>
            <button onClick={handleDownloadPdf} disabled={downloadingPdf} className="text-xs px-2 sm:px-2.5 py-1 rounded-lg border border-[#8b6914]/30 bg-[#8b6914]/10 text-[#8b6914] disabled:opacity-50">{downloadingPdf ? '...' : 'PDF'}</button>
            <button onClick={handleWhatsApp} disabled={whatsappBusy} className="text-xs px-2 sm:px-2.5 py-1 rounded-lg bg-green-600 text-white disabled:opacity-50">{whatsappBusy ? '...' : 'WhatsApp'}</button>
            {!cancelled && !isDraft && <button onClick={handleCancel} disabled={cancelling} className="text-xs px-2 sm:px-2.5 py-1 rounded-lg text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50">{cancelling ? '...' : 'Cancel'}</button>}
          </div>
        </div>
      </div>

      {/* INVOICE */}
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className={`bg-white rounded-lg overflow-hidden relative ${cancelled ? 'opacity-60' : ''}`}>

          {cancelled && (<div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"><div className="border-4 border-red-300/40 text-red-300/30 font-black text-3xl px-5 py-1.5 rounded rotate-[-18deg] tracking-widest">CANCELLED</div></div>)}
          {isDraft && (<div className="bg-amber-50 border-b border-amber-200 px-4 py-1 text-center"><span className="text-xs font-semibold text-amber-700">DRAFT — Not confirmed</span></div>)}

          {/* Header */}
          <div className="bg-[#4a1c1c] text-white px-5 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold tracking-wide">MM Jewels</p>
                <p className="text-[9px] text-white/50 uppercase tracking-widest">Invoice</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{order.billNo}</p>
                <p className="text-[9px] text-white/50">FY {order.fy}</p>
              </div>
            </div>
          </div>

          <div className="px-3 sm:px-5 py-3 text-xs">

            {/* Customer | Date | Rate */}
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 pb-3 mb-3 border-b border-[#e8dfd4]">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#7a6652] font-bold mb-0.5">Bill To</p>
                <p className="font-semibold text-sm text-[#3d2b1f]">{order.customer.ref ? <span className="text-[#8b6914] cursor-pointer" onClick={() => navigate(`/customers/${order.customer.ref}`)}>{order.customer.name}</span> : order.customer.name}</p>
                {order.customer.phone && <p className="text-[#7a6652]">{order.customer.phone}</p>}
                {order.customer.address && <p className="text-[#7a6652]">{order.customer.address}</p>}
              </div>
              <div className="sm:text-right">
                <p className="font-medium text-[#3d2b1f]">{new Date(order.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                <p className="text-[#7a6652]">{rateParts.join(' · ')}</p>
              </div>
            </div>

            {/* ITEMS — desktop table */}
            <div className="hidden sm:block mb-3">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#e0d5c5] text-[#7a6652]">
                    <th className="text-left py-1.5 font-bold uppercase tracking-wider">Item</th>
                    <th className="text-center py-1.5 font-bold uppercase tracking-wider w-8">Qty</th>
                    <th className="text-right py-1.5 font-bold uppercase tracking-wider">Wt(g)</th>
                    {hasWaste && <th className="text-right py-1.5 font-bold uppercase tracking-wider">Waste(g)</th>}
                    <th className="text-right py-1.5 font-bold uppercase tracking-wider">Rate(Rs)</th>
                    {hasStone && <th className="text-right py-1.5 font-bold uppercase tracking-wider">Stone(Rs)</th>}
                    <th className="text-right py-1.5 font-bold uppercase tracking-wider">MC(Rs)</th>
                    <th className="text-right py-1.5 font-bold uppercase tracking-wider">Total(Rs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ebe3]">
                  {order.items.map((item, i) => {
                    const qty = item.qty || 1;
                    const wt = ((item.netWeight || 0) * qty).toFixed(3);
                    const wst = ((item.waste || 0) * qty);
                    const mc = item.makingChargeWaived ? 0 : (item.makingCharge || 0) * qty;
                    return (
                      <tr key={i}>
                        <td className="py-2 font-medium text-[#3d2b1f]">{item.metal === 'Silver' && <span className="text-[#7a6652] mr-0.5">[S]</span>}{item.displayName}</td>
                        <td className="py-2 text-center text-[#3d2b1f]">{qty}</td>
                        <td className="py-2 text-right font-medium text-[#3d2b1f]">{wt}g</td>
                        {hasWaste && <td className="py-2 text-right text-[#3d2b1f]">{wst > 0 ? `${wst.toFixed(3)}g` : '—'}</td>}
                        <td className="py-2 text-right text-[#7a6652]">{num(item.goldRate)}</td>
                        {hasStone && <td className="py-2 text-right text-[#3d2b1f]">{(item.stoneValue || 0) > 0 ? num(item.stoneValue) : '—'}</td>}
                        <td className="py-2 text-right text-[#3d2b1f]">{mc > 0 ? num(mc) : '—'}</td>
                        <td className="py-2 text-right font-semibold text-[#3d2b1f]">{num(item.lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {multiItem && (
                  <tfoot>
                    <tr className="border-t-2 border-[#e0d5c5]">
                      <td colSpan={5 + (hasStone ? 1 : 0) + (hasWaste ? 1 : 0)} className="py-2 text-right font-semibold text-[#7a6652]">Sub Total</td>
                      <td className="py-2 text-right font-bold text-[#3d2b1f]">{num(order.subTotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* ITEMS — mobile cards (screen only) */}
            <div className="sm:hidden space-y-2 mb-3">
              {order.items.map((item, i) => {
                const qty = item.qty || 1;
                const wt = ((item.netWeight || 0) * qty).toFixed(3);
                const wst = (item.waste || 0) * qty;
                const mc = item.makingChargeWaived ? 0 : (item.makingCharge || 0) * qty;
                return (
                  <div key={i} className="border-b border-[#f0ebe3] pb-2">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-[#3d2b1f]">{item.metal === 'Silver' && <span className="text-[#7a6652] mr-0.5">[S]</span>}{item.displayName}{qty > 1 && <span className="text-[#7a6652] ml-1">x{qty}</span>}</p>
                      <p className="font-semibold text-[#3d2b1f]">{num(item.lineTotal)}</p>
                    </div>
                    <p className="text-[10px] text-[#7a6652] mt-0.5">
                      {wt}g
                      {wst > 0 && <span> + Waste {wst.toFixed(3)}g</span>}
                      {' · '}{num(item.goldRate)}/gm
                      {mc > 0 && <span> · MC {num(mc)}</span>}
                      {(item.stoneValue || 0) > 0 && <span> · Stone {num(item.stoneValue)}</span>}
                    </p>
                  </div>
                );
              })}
              {multiItem && (
                <div className="flex justify-between font-bold text-[#3d2b1f] pt-1">
                  <span className="text-[#7a6652]">Sub Total</span><span>{num(order.subTotal)}</span>
                </div>
              )}
            </div>

            {/* Exchange */}
            {order.exchangeItems?.length > 0 && (
              <div className="border-t border-b border-blue-200 py-2 mb-3">
                <p className="font-semibold text-blue-700 uppercase tracking-wide text-[10px] mb-1">Old Gold Exchange</p>
                {order.exchangeItems.map((ex, i) => (
                  <div key={i} className="flex justify-between text-xs"><span className="text-blue-600">{ex.description} — {ex.grossWeight}g @ {ex.purity}K</span><span className="font-semibold text-blue-700">- {num(ex.exchangeValue)}</span></div>
                ))}
              </div>
            )}

            {/* TOTALS */}
            <div className="ml-auto max-w-[260px] pt-2">

              {hasDeductions && (
                <>
                  {order.extraCharges?.filter(ec => ec.amount > 0 && !ec.waived).map((ec, i) => (
                    <div key={i} className="flex justify-between py-0.5"><span className="text-[#7a6652]">{ec.name}</span><span className="text-[#3d2b1f]">{num(ec.amount)}</span></div>
                  ))}
                  {order.discount > 0 && <div className="flex justify-between py-0.5"><span className="text-[#7a6652]">Discount</span><span className="text-[#3d2b1f]">- {num(order.discount)}</span></div>}
                  {order.exchangeTotal > 0 && <div className="flex justify-between py-0.5"><span className="text-[#7a6652]">Exchange</span><span className="text-[#3d2b1f]">- {num(order.exchangeTotal)}</span></div>}
                  <div className="border-t border-[#e0d5c5] mt-1" />
                </>
              )}

              <div className="flex justify-between font-bold py-1.5 text-sm">
                <span className="text-[#3d2b1f]">Net Payable</span><span className="text-[#8b6914]">{rs(order.netPayable)}</span>
              </div>

              {order.amountPaid > 0 && (
                <div className="border-t border-[#f0ebe3] pt-1">
                  <div className="flex justify-between py-0.5"><span className="text-[#7a6652]">Paid ({order.paymentMode})</span><span className="text-emerald-600 font-semibold">{rs(order.amountPaid)}</span></div>
                  {order.balanceDue > 0 && (
                    <div className="flex justify-between py-0.5 font-semibold text-red-600"><span>Balance Due</span><span>{rs(order.balanceDue)}</span></div>
                  )}
                  {order.balanceDue <= 0 && <p className="text-emerald-600 font-semibold text-right">Paid in Full</p>}
                </div>
              )}
            </div>

            {/* Payment history + Record — screen only */}
            <div className="mt-2.5">
              {order.payments?.length > 0 && (
                <div className="mb-2">
                  <p className="font-semibold text-[#7a6652] mb-0.5">Payment History</p>
                  {order.payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-[#7a6652] bg-[#faf7f2] rounded px-2 py-0.5 mb-0.5">
                      <span>{new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {p.mode}{p.notes ? ` · ${p.notes}` : ''}</span>
                      <span className="font-medium text-[#3d2b1f]">{rs(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {order.balanceDue > 0 && !cancelled && (
                !showPayForm ? (
                  <button onClick={() => setShowPayForm(true)} className="w-full text-xs font-medium py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50">Record Payment</button>
                ) : (
                  <div className="border border-emerald-200 rounded-lg p-2.5 bg-emerald-50 space-y-1.5">
                    <div className="flex gap-1.5">
                      <input type="number" placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="flex-1 bg-white border border-[#d4c5b0] text-[#3d2b1f] rounded px-2 py-1 text-xs placeholder-[#b8a99a]" />
                      <select value={payMode} onChange={e => setPayMode(e.target.value)} className="bg-white border border-[#d4c5b0] text-[#3d2b1f] rounded px-1.5 py-1 text-xs"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="cheque">Cheque</option><option value="credit">Credit</option></select>
                    </div>
                    <input placeholder="Notes (optional)" value={payNotes} onChange={e => setPayNotes(e.target.value)} className="w-full bg-white border border-[#d4c5b0] text-[#3d2b1f] rounded px-2 py-1 text-xs placeholder-[#b8a99a]" />
                    <div className="flex gap-1.5">
                      <button onClick={handleRecordPayment} disabled={payingSaving || !payAmount} className="flex-1 bg-emerald-600 text-white text-xs font-medium py-1 rounded disabled:opacity-50">{payingSaving ? '...' : 'Save'}</button>
                      <button onClick={() => setShowPayForm(false)} className="px-2 py-1 text-xs text-[#7a6652]">Cancel</button>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-[#f0ebe3] flex justify-between text-[#7a6652]">
              <div>{order.notes && <p>Note: {order.notes}</p>}<p>By {order.createdBy?.name || '—'}</p></div>
              <p className="font-semibold">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
