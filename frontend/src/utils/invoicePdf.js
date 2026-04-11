// MM Jewels — Classical A4 Invoice PDF
// Font system: 4 sizes only — 16 (title), 11 (heading), 9 (body), 7.5 (label)

const rs  = (n) => 'Rs.' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const num = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export async function generateInvoicePdf(order) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210, H = 297, M = 18, CW = W - M * 2;
  let y = 0;

  // Sizes
  const S = { title: 16, heading: 11, body: 9, label: 7.5 };

  // Colours
  const dk = [40, 30, 25];
  const md = [100, 85, 70];
  const lt = [170, 160, 148];
  const accent = [74, 28, 28];
  const wh = [255, 255, 255];

  const hasGold   = order.items?.some(i => i.metal !== 'Silver');
  const hasSilver = order.items?.some(i => i.metal === 'Silver');
  const hasStone  = order.items?.some(i => (i.stoneValue || 0) > 0);
  const hasWaste  = order.items?.some(i => (i.waste || 0) > 0);
  const multiItem = order.items?.length > 1;
  const hasExtras = order.extraCharges?.some(ec => ec.amount > 0 && !ec.waived);
  const hasDeductions = order.discount > 0 || order.exchangeTotal > 0 || hasExtras;

  const t = (s, x, yy, o = {}) => {
    doc.setFontSize(o.sz || S.body);
    doc.setFont('helvetica', o.b ? 'bold' : 'normal');
    doc.setTextColor(...(o.c || dk));
    doc.text(String(s), x, yy, { align: o.a || 'left' });
  };
  const hr = (yy) => {
    doc.setDrawColor(210, 200, 185); doc.setLineWidth(0.3); doc.line(M, yy, W - M, yy);
  };

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 24, 'F');
  t('MM Jewels', M + 2, 11, { sz: S.title, b: true, c: wh });
  t('INVOICE', M + 2, 17.5, { sz: S.label, c: [210, 195, 185] });
  t(order.billNo, W - M - 2, 11, { sz: S.title, b: true, c: wh, a: 'right' });
  t('FY ' + order.fy, W - M - 2, 17.5, { sz: S.label, c: [210, 195, 185], a: 'right' });

  // ── CUSTOMER & INFO ─────────────────────────────────────────────────────────
  y = 32;
  t('Bill To', M, y, { sz: S.label, b: true, c: md });
  y += 5;
  t(order.customer.name, M, y, { sz: S.heading, b: true });
  y += 5;
  if (order.customer.phone) { t(order.customer.phone, M, y, { c: md }); y += 4.5; }
  if (order.customer.address) { t(order.customer.address, M, y, { c: md }); y += 4.5; }

  const dateStr = new Date(order.billDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  t('Date', W - M, 32, { sz: S.label, b: true, c: md, a: 'right' });
  t(dateStr, W - M, 37, { sz: S.heading, b: true, a: 'right' });

  const rp = [];
  if (hasGold) rp.push('Gold Rs.' + num(order.goldRate) + '/gm');
  if (hasSilver && order.silverRate > 0) rp.push('Silver Rs.' + num(order.silverRate) + '/gm');
  if (rp.length) {
    t('Rate', W - M, 43, { sz: S.label, b: true, c: md, a: 'right' });
    t(rp.join('   |   '), W - M, 48, { c: md, a: 'right' });
  }

  y = Math.max(y, 53) + 3;
  hr(y); y += 7;

  // ── ITEMS TABLE ─────────────────────────────────────────────────────────────
  const c = { sno: M, item: M + 7, tot: W - M };
  if (hasStone && hasWaste) {
    Object.assign(c, { qty: 62, wt: 80, waste: 100, rate: 120, stone: 142, mc: 162 });
  } else if (hasWaste) {
    Object.assign(c, { qty: 70, wt: 90, waste: 112, rate: 134, mc: 158 });
  } else if (hasStone) {
    Object.assign(c, { qty: 72, wt: 92, rate: 114, stone: 138, mc: 160 });
  } else {
    Object.assign(c, { qty: 78, wt: 100, rate: 126, mc: 156 });
  }

  // Table header
  doc.setFillColor(245, 241, 234);
  doc.rect(M, y - 4, CW, 7, 'F');
  const hdr = [
    [c.sno, '#', 'left'], [c.item, 'ITEM', 'left'], [c.qty, 'QTY', 'center'],
    [c.wt, 'WT(g)', 'right'],
  ];
  if (hasWaste) hdr.push([c.waste, 'WASTE(g)', 'right']);
  hdr.push([c.rate, 'RATE(Rs)', 'right']);
  if (hasStone) hdr.push([c.stone, 'STONE(Rs)', 'right']);
  hdr.push([c.mc, 'MC(Rs)', 'right'], [c.tot, 'TOTAL(Rs)', 'right']);

  doc.setFontSize(S.label); doc.setFont('helvetica', 'bold'); doc.setTextColor(...md);
  hdr.forEach(([x, label, align]) => doc.text(label, x, y, { align }));
  y += 6;

  // Item rows — all body size
  order.items.forEach((item, idx) => {
    if (y > 260) { doc.addPage(); y = 20; }
    const qty = item.qty || 1;
    const wt = ((item.netWeight || 0) * qty).toFixed(3);
    const wst = (item.waste || 0) * qty;
    const mc = item.makingChargeWaived ? 0 : (item.makingCharge || 0) * qty;
    const name = (item.metal === 'Silver' ? '[S] ' : '') + item.displayName;

    if (idx % 2 === 0) {
      doc.setFillColor(252, 250, 246);
      doc.rect(M, y - 3.5, CW, 7, 'F');
    }

    t(String(idx + 1), c.sno, y, { c: md });
    t(name, c.item, y, { b: true });
    t(String(qty), c.qty, y, { a: 'center' });
    t(wt, c.wt, y, { a: 'right' });
    if (hasWaste) t(wst > 0 ? wst.toFixed(3) : '—', c.waste, y, { a: 'right', c: wst > 0 ? dk : lt });
    t(num(item.goldRate), c.rate, y, { a: 'right', c: md });
    if (hasStone) t((item.stoneValue || 0) > 0 ? num(item.stoneValue) : '—', c.stone, y, { a: 'right', c: (item.stoneValue || 0) > 0 ? dk : lt });
    t(mc > 0 ? num(mc) : '—', c.mc, y, { a: 'right', c: mc > 0 ? dk : lt });
    t(num(item.lineTotal), c.tot, y, { a: 'right', b: true });
    y += 7;
  });

  hr(y - 2);

  if (multiItem) {
    y += 3;
    t('Sub Total', c.mc, y, { b: true, c: md, a: 'right' });
    t(num(order.subTotal), c.tot, y, { b: true, a: 'right' });
    y += 6;
  } else {
    y += 4;
  }

  // ── EXCHANGE ────────────────────────────────────────────────────────────────
  if (order.exchangeItems?.length > 0) {
    y += 2;
    doc.setFillColor(242, 245, 252);
    const exH = 7 + order.exchangeItems.length * 6;
    doc.rect(M, y - 3, CW, exH, 'F');
    doc.setDrawColor(100, 120, 180); doc.setLineWidth(0.4);
    doc.line(M, y - 3, W - M, y - 3);

    t('Old Gold Exchange', M + 4, y + 1, { sz: S.label, b: true, c: [50, 60, 130] });
    y += 7;
    order.exchangeItems.forEach(ex => {
      t(`${ex.description} — ${ex.grossWeight}g @ ${ex.purity}K`, M + 4, y, { c: [50, 60, 130] });
      t('- ' + num(ex.exchangeValue), W - M - 4, y, { b: true, c: [50, 60, 130], a: 'right' });
      y += 6;
    });
    y += 2;
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  y += 4;
  const lx = 130, rx = W - M;
  const row = (label, value, o = {}) => {
    if (y > 270) { doc.addPage(); y = 20; }
    t(label, lx, y, { c: o.lc || md, b: o.b });
    t(value, rx, y, { c: o.vc || dk, b: o.b, a: 'right' });
    y += 6;
  };

  if (hasDeductions) {
    hr(y - 2); y += 4;
    if (order.extraCharges?.length > 0) {
      order.extraCharges.forEach(ec => {
        if (!ec.amount || ec.waived) return;
        row(ec.name, num(ec.amount));
      });
    }
    if (order.discount > 0) row('Discount', '- ' + num(order.discount));
    if (order.exchangeTotal > 0) row('Exchange', '- ' + num(order.exchangeTotal));
    hr(y - 1); y += 5;
  }

  // Net Payable
  doc.setFillColor(245, 241, 234);
  doc.rect(lx - 4, y - 5, rx - lx + 8, 10, 'F');
  doc.setDrawColor(...accent); doc.setLineWidth(0.5);
  doc.line(lx - 4, y - 5, lx - 4, y + 5);
  t('Net Payable', lx, y, { sz: S.heading, b: true, c: accent });
  t(rs(order.netPayable), rx, y, { sz: S.heading, b: true, a: 'right', c: accent });
  y += 12;

  // Payment
  if (order.amountPaid > 0) {
    row('Paid (' + (order.paymentMode || 'cash') + ')', rs(order.amountPaid));
    if (order.balanceDue > 0) {
      row('Balance Due', rs(order.balanceDue), { b: true, vc: [180, 50, 50] });
    } else {
      t('Paid in Full', rx, y, { b: true, a: 'right', c: [30, 120, 60] });
      y += 6;
    }
  }

  // ── FOOTER ──────────────────────────────────────────────────────────────────
  const footY = H - 28;
  if (order.notes) t('Note: ' + order.notes, M, footY - 8, { c: md });
  hr(footY - 3);
  t('Prepared by: ' + (order.createdBy?.name || '—'), M, footY + 3, { c: md });
  doc.setDrawColor(...md); doc.setLineWidth(0.3);
  doc.line(W - M - 50, footY + 1, W - M, footY + 1);
  t('Authorised Signatory', W - M, footY + 6, { a: 'right', c: md });
  t('Thank you for choosing MM Jewels', W / 2, footY + 14, { a: 'center', c: lt });

  return doc;
}
