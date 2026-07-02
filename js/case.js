/* ============================================================
   SENTINEL AML — Case Investigation Page Logic
   Workflow: Open → [Analyze] → Export PDF → Close / Escalate
   ============================================================ */

const CasePage = {
  alert: null, customer: null, transactions: [],
  notes: [], rfiRequest: null, rfiResponse: null,
  analystAnalysis: '',
};

document.addEventListener('DOMContentLoaded', async () => {
  await SentinelData.loadAll();
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get('id');
  const alert = SentinelData.getCaseById(caseId) || SentinelData.getCases()[0];

  if (!alert) {
    document.getElementById('caseRoot').innerHTML = `<div class="empty-state"><div class="t">Case not found</div><div>Return to the alert queue.</div></div>`;
    return;
  }

  CasePage.alert = alert;
  CasePage.customer = SentinelData.getCustomerById(alert.customerId);
  CasePage.transactions = SentinelData.getTransactionsFor(alert.customerId);

  // Load any saved state from localStorage
  const saved = CaseStore.get(alert.caseId);
  if (saved) {
    if (saved.analystNote) CasePage.analystAnalysis = saved.analystNote;
    if (saved.rfiRequest) CasePage.rfiRequest = saved.rfiRequest;
    if (saved.rfiResponse) CasePage.rfiResponse = saved.rfiResponse;
  }

  renderCaseHeader();
  renderCustomerProfile();
  renderRiskSummary();
  renderTransactions();
  wireTabs();
  renderNetworkGraph();
  wireNotes();
  wireAnalystAnalysis();
  wireWorkflowButtons();
  wireAIChatInput();
  seedAIWelcome();
  restoreRFIBlocks();
  updateWorkflowState();
});

/* ---------- Header ---------- */
function renderCaseHeader() {
  const { alert, customer } = CasePage;
  const effStatus = CaseStore.getStatus(alert.caseId) || 'Open';
  document.getElementById('caseTitle').textContent = customer.name;
  document.getElementById('caseSub').textContent = `${alert.alertId} · ${alert.caseId} · Opened ${fmtDate(alert.date)}`;
  document.getElementById('caseIconInitials').textContent = initials(customer.name);
  document.getElementById('caseRiskPill').innerHTML = `<span class="pill ${riskPillClass(customer.riskRating)}">${customer.riskRating} Risk</span>`;
  document.getElementById('caseStatusPill').innerHTML = `<span class="status-pill ${statusClass(effStatus)}">${effStatus}</span>`;
  document.getElementById('caseTypologyTag').innerHTML = `<span class="typology-tag">${alert.typology}</span>`;
}

/* ---------- Customer profile ---------- */
function renderCustomerProfile() {
  const c = CasePage.customer;
  const rows = [
    ['Customer ID', c.customerId], ['Occupation', c.occupation],
    ['Country', c.country], ['Nationality', c.nationality],
    ['Risk Rating', c.riskRating], ['PEP Status', c.pepStatus],
    ['Sanctions', c.sanctionsStatus], ['Previous SAR', c.previousSar],
    ['Source of Wealth', c.sourceOfWealth], ['Source of Funds', c.sourceOfFunds],
    ['Expected Monthly Activity', c.expectedMonthlyActivity],
    ['KYC Level', c.kycLevel], ['Account Opened', fmtDate(c.accountOpenDate)],
  ];
  document.getElementById('customerProfileRows').innerHTML = rows.map(([k, v]) =>
    `<div class="profile-row"><span class="k">${k}</span><span class="v">${v}</span></div>`
  ).join('');
}

/* ---------- Risk summary ---------- */
function renderRiskSummary() {
  const { customer, alert } = CasePage;
  const score = customer.riskScore;
  const gaugeEl = document.getElementById('riskGauge');
  if (gaugeEl) gaugeEl.innerHTML = buildGaugeSVG(score);
  document.getElementById('riskScoreLabel').textContent = score;
  const band = score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low';
  const bandColor = score >= 70 ? 'var(--risk-high)' : score >= 45 ? 'var(--risk-medium)' : 'var(--risk-low)';
  const bandEl = document.getElementById('riskBandLabel');
  bandEl.textContent = band + ' Risk Band';
  bandEl.style.color = bandColor;
  document.getElementById('riskFlagsList').innerHTML = alert.redFlags.map(f => `
    <div class="flag-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/></svg>
      <span>${f}</span>
    </div>`).join('');
  document.getElementById('typologyValue').textContent = alert.typology;
  document.getElementById('recommendedActionText').textContent = alert.recommendedAction;
}

function buildGaugeSVG(score) {
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const circumference = Math.PI * 60;
  const dash = pct * circumference;
  const color = score >= 70 ? 'var(--risk-high)' : score >= 45 ? 'var(--risk-medium)' : 'var(--risk-low)';
  return `<svg width="150" height="92" viewBox="0 0 150 92">
    <path d="M 15 75 A 60 60 0 0 1 135 75" fill="none" stroke="var(--bg-elevated-2)" stroke-width="14" stroke-linecap="round"/>
    <path d="M 15 75 A 60 60 0 0 1 135 75" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
      stroke-dasharray="${dash} ${circumference - dash}"/>
  </svg>`;
}

/* ---------- Transactions ---------- */
function renderTransactions() {
  const tbody = document.getElementById('txnTableBody');
  if (!tbody) return;
  const txns = CasePage.transactions;
  const suspCount = txns.filter(t => t.suspicious).length;
  const lbl = document.getElementById('txnCountLabel');
  if (lbl) lbl.textContent = `${txns.length} transactions · ${suspCount} flagged suspicious`;
  tbody.innerHTML = txns.map(t => `
    <tr class="${t.suspicious ? 'suspicious-row' : ''}">
      <td class="cell-id">${t.txnId}</td>
      <td>${fmtDate(t.date)}</td>
      <td class="cell-amount" style="color:${t.direction==='Credit'?'var(--risk-low)':'var(--text-primary)'}">${t.direction==='Credit'?'+':'−'}${fmtCurrency(t.amount, t.currency)}</td>
      <td>${t.currency}</td><td>${t.counterparty}</td><td>${t.country}</td><td>${t.channel}</td>
      <td style="white-space:normal;max-width:260px;">${t.description}${t.suspicious?'<span class="pill pill-high" style="margin-left:6px;">Flagged</span>':''}</td>
    </tr>`).join('');
}

/* ---------- Tabs ---------- */
function wireTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

/* ---------- Case Notes ---------- */
function wireNotes() {
  const addBtn = document.getElementById('addNoteBtn');
  const input = document.getElementById('noteEditor');
  if (addBtn && input) {
    addBtn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      CasePage.notes.unshift({ text, time: new Date() });
      input.value = '';
      renderNotes();
      saveCurrentState();
      showToast('Note added', 'Case note saved.');
    });
  }
  renderNotes();
}
function renderNotes() {
  const list = document.getElementById('notesList');
  if (!list) return;
  if (!CasePage.notes.length) {
    list.innerHTML = `<div class="empty-state" style="padding:24px 10px;"><div class="t">No notes yet</div><div>Add an investigation note above.</div></div>`;
    return;
  }
  list.innerHTML = CasePage.notes.map(n => `
    <div class="note-entry">
      <div class="meta"><span>Investigator (A. Whitfield)</span><span>${n.time.toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div>
      <div class="body">${escapeHtml(n.text)}</div>
    </div>`).join('');
}

/* ---------- Analyst Analysis ---------- */
function wireAnalystAnalysis() {
  const textarea = document.getElementById('analystAnalysisText');
  if (!textarea) return;
  if (CasePage.analystAnalysis) textarea.value = CasePage.analystAnalysis;
  textarea.addEventListener('input', () => {
    CasePage.analystAnalysis = textarea.value;
    saveCurrentState();
  });
}

/* ---------- RFI blocks restore ---------- */
function restoreRFIBlocks() {
  const saved = CaseStore.get(CasePage.alert.caseId);
  if (saved && saved.rfiRequest) {
    CasePage.rfiRequest = saved.rfiRequest;
    CasePage.rfiResponse = saved.rfiResponse;
    const rfiSection = document.getElementById('rfiSection');
    const reqEl = document.getElementById('rfiRequestText');
    const resEl = document.getElementById('rfiResponseText');
    const recvEl = document.getElementById('rfiReceivedBanner');
    if (rfiSection) rfiSection.style.display = 'block';
    if (reqEl) reqEl.textContent = saved.rfiRequest;
    if (resEl) resEl.textContent = saved.rfiResponse || '';
    if (recvEl && saved.rfiResponse) {
      const match = saved.rfiResponse.match(/Date Received:\s*(.+)/);
      if (match) recvEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg> Response received on ${match[1].trim()}`;
    }
  }
}

/* ---------- Workflow: Export → Close / Escalate ---------- */
function wireWorkflowButtons() {
  const exportBtn = document.getElementById('exportCasePDFBtn');
  const closeBtn = document.getElementById('closeCaseBtn');
  const escalateBtn = document.getElementById('escalateCaseBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportCasePDF);
  if (closeBtn) closeBtn.addEventListener('click', () => closeCase('Closed - No Action'));
  if (escalateBtn) escalateBtn.addEventListener('click', () => closeCase('Escalated'));
}

function updateWorkflowState() {
  const caseId = CasePage.alert.caseId;
  const exported = CaseStore.isExported(caseId);
  const effStatus = CaseStore.getStatus(caseId);
  const isClosed = effStatus !== 'Open';

  const closeBtn = document.getElementById('closeCaseBtn');
  const escalateBtn = document.getElementById('escalateCaseBtn');
  const exportBtn = document.getElementById('exportCasePDFBtn');
  const notice = document.getElementById('workflowNotice');
  const actionGrid = document.getElementById('actionGrid');

  if (isClosed) {
    // Case already resolved — lock everything
    if (closeBtn) { closeBtn.disabled = true; closeBtn.textContent = 'Case Closed'; }
    if (escalateBtn) { escalateBtn.disabled = true; }
    if (exportBtn) exportBtn.disabled = true;
    if (notice) notice.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg> This case has been <strong>${effStatus}</strong>. No further actions available.`;
    if (actionGrid) actionGrid.querySelectorAll('.action-btn').forEach(b => b.disabled = true);
    return;
  }

  if (!exported) {
    if (closeBtn) closeBtn.disabled = true;
    if (escalateBtn) escalateBtn.disabled = true;
    if (notice) notice.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/></svg> <strong>Export the case file first</strong> to enable Close and Escalate.`;
  } else {
    if (closeBtn) closeBtn.disabled = false;
    if (escalateBtn) escalateBtn.disabled = false;
    if (notice) notice.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg> Case file exported. <strong>Close or Escalate</strong> to finalise.`;
    if (notice) notice.style.background = 'rgba(5,150,105,0.07)';
    if (notice) notice.style.borderColor = 'rgba(5,150,105,0.25)';
    if (notice) notice.querySelector('svg').style.color = 'var(--risk-low)';
  }
}

/* ---------- Export Case PDF ---------- */
function exportCasePDF() {
  const { alert, customer, transactions, notes, analystAnalysis, rfiRequest, rfiResponse } = CasePage;
  const susp = transactions.filter(t => t.suspicious);

  // Build export data object stored in localStorage
  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: 'A. Whitfield',
    alert, customer,
    suspiciousTransactions: susp,
    totalFlagged: susp.reduce((s, t) => s + t.amount, 0),
    notes,
    analystAnalysis,
    rfiRequest: rfiRequest || null,
    rfiResponse: rfiResponse || null,
    aiChatHistory: typeof AIChatHistory !== 'undefined' ? AIChatHistory : [],
    caseId: alert.caseId,
  };

  CaseStore.markExported(alert.caseId, exportData);
  saveCurrentState();

  // Generate printable report in new window
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(buildPrintHTML(exportData));
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);

  showToast('Case Exported', 'PDF generated and case file saved. You may now Close or Escalate.', { color: 'var(--risk-low)', duration: 4000 });
  updateWorkflowState();
}

function buildPrintHTML(d) {
  const susp = d.suspiciousTransactions || [];
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Case Export — ${d.alert.caseId}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#1c1917;margin:0;padding:24px;}
    h1{font-size:18px;color:#1e3a8a;border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:18px;}
    h2{font-size:13px;color:#1d4ed8;margin:18px 0 8px;text-transform:uppercase;letter-spacing:0.05em;}
    table{width:100%;border-collapse:collapse;margin-bottom:14px;}
    th{background:#f0f4ff;text-align:left;padding:7px 10px;font-size:10px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #dbeafe;}
    td{padding:7px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;}
    tr:nth-child(even){background:#f9fafb;}
    .flag{background:#fef2f2;border-left:3px solid #dc2626;padding:6px 10px;margin-bottom:6px;border-radius:3px;}
    .meta{color:#6b7280;font-size:10px;margin-bottom:14px;}
    .analysis-box{background:#f0f4ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px;white-space:pre-wrap;line-height:1.6;}
    .rfi-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;white-space:pre-wrap;font-size:11px;line-height:1.65;}
    .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;}
    .badge-high{background:#fef2f2;color:#dc2626;} .badge-medium{background:#fffbeb;color:#d97706;} .badge-low{background:#f0fdf4;color:#059669;}
    @media print{body{padding:0;}}
  </style></head><body>
  <h1>SENTINEL AML — CASE INVESTIGATION REPORT</h1>
  <div class="meta">Case ID: ${d.alert.caseId} · Alert: ${d.alert.alertId} · Exported: ${fmtDateFull(d.exportedAt)} · By: ${d.exportedBy}</div>

  <h2>Customer Profile</h2>
  <table><tr><th>Field</th><th>Value</th></tr>
  ${[['Name',d.customer.name],['Customer ID',d.customer.customerId],['Occupation',d.customer.occupation],
    ['Country',d.customer.country],['Nationality',d.customer.nationality],
    ['Risk Rating',d.customer.riskRating+' ('+d.customer.riskScore+'/100)'],
    ['PEP Status',d.customer.pepStatus],['Sanctions',d.customer.sanctionsStatus],
    ['Previous SAR',d.customer.previousSar],['KYC Level',d.customer.kycLevel],
    ['Source of Wealth',d.customer.sourceOfWealth],['Expected Monthly Activity',d.customer.expectedMonthlyActivity]
  ].map(([k,v])=>`<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join('')}
  </table>

  <h2>Alert Summary</h2>
  <table><tr><th>Alert ID</th><th>Typology</th><th>Amount</th><th>Date</th><th>Investigator</th></tr>
  <tr><td>${d.alert.alertId}</td><td>${d.alert.typology}</td><td>$${Math.round(d.alert.amount).toLocaleString()}</td><td>${fmtDate(d.alert.date)}</td><td>${d.alert.investigator}</td></tr>
  </table>

  <h2>Red Flags</h2>
  ${d.alert.redFlags.map(f=>`<div class="flag">${f}</div>`).join('')}

  <h2>Suspicious Transactions (${susp.length})</h2>
  <table><tr><th>Date</th><th>Amount</th><th>Counterparty</th><th>Country</th><th>Channel</th><th>Description</th></tr>
  ${susp.map(t=>`<tr><td>${fmtDate(t.date)}</td><td>$${Math.round(t.amount).toLocaleString()} ${t.currency}</td><td>${t.counterparty}</td><td>${t.country}</td><td>${t.channel}</td><td>${t.description}</td></tr>`).join('')}
  </table>
  <p><strong>Total flagged amount:</strong> $${Math.round(d.totalFlagged).toLocaleString()}</p>

  ${d.analystAnalysis ? `<h2>Case Analysis by Analyst</h2><div class="analysis-box">${escapeHtml(d.analystAnalysis)}</div>` : ''}

  ${d.rfiRequest ? `<h2>RFI — Request Issued</h2><div class="rfi-box">${escapeHtml(d.rfiRequest)}</div>` : ''}
  ${d.rfiResponse ? `<h2>RFI — Customer Response Received</h2><div class="rfi-box">${escapeHtml(d.rfiResponse)}</div>` : ''}

  ${d.notes && d.notes.length ? `<h2>Case Notes</h2><table><tr><th>Time</th><th>Note</th></tr>${d.notes.map(n=>`<tr><td>${new Date(n.time).toLocaleString()}</td><td>${escapeHtml(n.text)}</td></tr>`).join('')}</table>` : ''}

  ${d.aiChatHistory && d.aiChatHistory.length ? `<h2>AI Analysis Log</h2><table><tr><th>Role</th><th>Action</th><th>Content</th></tr>${d.aiChatHistory.map(h=>`<tr><td>${h.role==='user'?'Investigator':'AI Assistant'}</td><td>${h.kind||'chat'}</td><td>${(h.text||'').slice(0,300)}${(h.text||'').length>300?'…':''}</td></tr>`).join('')}</table>` : ''}

  <div style="margin-top:30px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;">
    Sentinel AML Investigation Platform · Confidential — For Internal Use Only · Generated ${new Date().toLocaleString()}
  </div>
  </body></html>`;
}

/* ---------- Close / Escalate ---------- */
function closeCase(newStatus) {
  const { alert, analystAnalysis, notes } = CasePage;
  if (!CaseStore.isExported(alert.caseId)) {
    showToast('Export required', 'Please export the case PDF before closing.', { color: 'var(--risk-high)' });
    return;
  }
  const history = typeof AIChatHistory !== 'undefined' ? AIChatHistory : [];
  CaseStore.setStatus(alert.caseId, newStatus, analystAnalysis, history);

  // Update existing export data with final status
  const existing = CaseStore.get(alert.caseId) || {};
  if (existing.exportData) {
    existing.exportData.finalStatus = newStatus;
    existing.exportData.analystAnalysis = analystAnalysis;
    existing.exportData.notes = notes;
    existing.exportData.aiChatHistory = history;
    CaseStore.save(alert.caseId, existing);
  }

  showToast(
    newStatus === 'Escalated' ? 'Case Escalated' : 'Case Closed',
    newStatus === 'Escalated' ? 'Case escalated to compliance committee.' : 'Case closed with no further action.',
    { color: newStatus === 'Escalated' ? 'var(--risk-high)' : 'var(--risk-low)', duration: 4000 }
  );

  // Refresh header and workflow state
  renderCaseHeader();
  updateWorkflowState();
}

/* ---------- Save current state ---------- */
function saveCurrentState() {
  const { alert, analystAnalysis, notes, rfiRequest, rfiResponse } = CasePage;
  const existing = CaseStore.get(alert.caseId) || {};
  CaseStore.save(alert.caseId, {
    ...existing,
    analystNote: analystAnalysis,
    notes,
    rfiRequest: rfiRequest || existing.rfiRequest,
    rfiResponse: rfiResponse || existing.rfiResponse,
  });
}

/* ---------- Network graph ---------- */
function renderNetworkGraph() {
  const el = document.getElementById('networkGraph');
  if (!el) return;
  const { customer, transactions } = CasePage;
  const counterparties = [...new Set(transactions.filter(t => t.suspicious).map(t => t.counterparty))].slice(0, 6);
  if (!counterparties.length) {
    el.innerHTML = `<div class="empty-state" style="padding:28px 10px;"><div class="t">No flagged counterparties</div></div>`;
    return;
  }
  const cx = 260, cy = 160, R = 110;
  const nodes = counterparties.map((name, i) => {
    const angle = (i / counterparties.length) * 2 * Math.PI - Math.PI / 2;
    return { name, x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
  });
  let edges = '', nodeEls = '';
  nodes.forEach(n => {
    edges += `<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="#d4cdc0" stroke-width="1.5"/>`;
    nodeEls += `<g><circle cx="${n.x}" cy="${n.y}" r="30" fill="#fef2f2" stroke="#dc2626" stroke-width="1.5"/>
      <text x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="middle" fill="#1c1917" font-size="8.5" font-family="Inter,sans-serif">
        ${wrapText(n.name, 12).map((l, i) => `<tspan x="${n.x}" dy="${i === 0 ? -2 : 10}">${l}</tspan>`).join('')}
      </text></g>`;
  });
  el.innerHTML = `<svg width="100%" viewBox="0 0 520 320" style="max-width:100%;">
    ${edges}
    <circle cx="${cx}" cy="${cy}" r="38" fill="#eff6ff" stroke="#1d4ed8" stroke-width="2"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="#1e3a8a" font-size="9.5" font-weight="700" font-family="Inter,sans-serif">
      <tspan x="${cx}" dy="-3">${wrapText(customer.name, 14)[0] || ''}</tspan>
      <tspan x="${cx}" dy="11">${wrapText(customer.name, 14)[1] || ''}</tspan>
    </text>
    ${nodeEls}
  </svg>
  <div class="network-legend">
    <div class="legend-item"><span class="legend-dot" style="background:#1d4ed8;border-radius:50%;"></span>Subject account</div>
    <div class="legend-item"><span class="legend-dot" style="background:#dc2626;border-radius:50%;"></span>Flagged counterparty</div>
  </div>`;
}
function wrapText(text, maxLen) {
  const words = text.split(' '); const lines = []; let cur = '';
  words.forEach(w => {
    if ((cur + ' ' + w).trim().length > maxLen) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  });
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

/* ---------- Helpers ---------- */
function wireAIChatInput() {
  const input = document.getElementById('aiChatInput');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') sendAIChat(); });
}
function seedAIWelcome() {
  const body = document.getElementById('aiPanelBody');
  if (!body) return;
  const { alert, customer } = CasePage;
  const effStatus = CaseStore.getStatus(alert.caseId);
  const isClosed = effStatus !== 'Open';
  body.innerHTML = `<div class="ai-msg system">Context loaded: <strong>${customer.name}</strong> · ${alert.alertId} · ${alert.typology}${isClosed ? ` · <span style="color:var(--risk-high)">Case ${effStatus}</span>` : ''}</div>`;
}
function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
