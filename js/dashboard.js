/* ============================================================
   SENTINEL AML — Dashboard / Alert Queue / Cases / Reports
   ============================================================ */
const TYPOLOGY_COLORS = [
  '#2563eb','#7c3aed','#db2777','#dc2626','#d97706',
  '#059669','#0891b2','#4f46e5','#be185d','#16a34a',
  '#b45309','#0f766e','#9333ea'
];
const TYPOLOGY_ICONS = {
  'Structuring':'<path d="M12 2v20M2 12h20"/>',
  'Layering':'<path d="m6 9 6-6 6 6"/><path d="m6 15 6 6 6-6"/>',
  'Smurfing':'<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>',
  'Trade Based Money Laundering':'<path d="M16 3h5v5M4 20 21 3"/><path d="M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  'Crypto Transfers':'<path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727"/>',
  'Money Mule':'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'High Risk Jurisdiction':'<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  'PEP':'<path d="M12 2 3 6v6c0 5.25 3.84 9.74 9 11 5.16-1.26 9-5.75 9-11V6l-9-4Z"/>',
  'Sanctions':'<path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  'Shell Company':'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  'Cash Intensive Business':'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  'Human Trafficking':'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/>',
  'Terrorist Financing':'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
};

const DashState = {
  cases:[],customers:[],
  sort:{key:'date',dir:'desc'},
  filters:{q:'',risk:'all',status:'all',typology:'all'},
};

document.addEventListener('DOMContentLoaded',async()=>{
  await SentinelData.loadAll();
  DashState.cases=SentinelData.getCases();
  DashState.customers=SentinelData.getCustomers();
  wireNav(); applyDeepLink();
  renderKPIs(); renderRiskDonut(); renderTypologyGrid();
  renderTypologyBars(); renderInvestigatorPerf();
  renderRecentAlerts(); renderLatestCases();
  renderAlertQueue(); renderCasesGrid();
  wireAlertQueueControls();
});

/* ---- Nav ---- */
function wireNav(){
  document.querySelectorAll('[data-view]').forEach(el=>{
    el.addEventListener('click',e=>{e.preventDefault();switchView(el.getAttribute('data-view'));});
  });
}
function switchView(view){
  document.querySelectorAll('.view-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-view]').forEach(n=>n.classList.remove('active'));
  const sec=document.getElementById('view-'+view);
  if(sec)sec.classList.add('active');
  document.querySelectorAll(`.nav-item[data-view="${view}"]`).forEach(n=>n.classList.add('active'));
  window.scrollTo({top:0});
}
function applyDeepLink(){
  const p=new URLSearchParams(window.location.search);
  const view=p.get('view'); const q=p.get('q'); const typ=p.get('typology');
  if(q)DashState.filters.q=q;
  if(typ)DashState.filters.typology=typ;
  switchView(view||(typ?'alerts':'dashboard'));
}

/* ---- KPIs (reads localStorage status overrides) ---- */
function getEffectiveStatus(c){
  return CaseStore.getStatus(c.caseId)||c.status;
}
function renderKPIs(){
  const cases=DashState.cases;
  const total=cases.length;
  const high=cases.filter(c=>c.riskLevel==='High').length;
  const medium=cases.filter(c=>c.riskLevel==='Medium').length;
  const low=cases.filter(c=>c.riskLevel==='Low').length;
  const open=cases.filter(c=>getEffectiveStatus(c)==='Open').length;
  const closed=cases.filter(c=>getEffectiveStatus(c)!=='Open').length;
  setText('kpiTotal',fmtNumber(total));setText('kpiHigh',fmtNumber(high));
  setText('kpiMedium',fmtNumber(medium));setText('kpiLow',fmtNumber(low));
  setText('kpiOpen',fmtNumber(open));setText('kpiClosed',fmtNumber(closed));
}
function setText(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}

/* ---- Typology grid (clickable) ---- */
function renderTypologyGrid(){
  const el=document.getElementById('typologyGrid');if(!el)return;
  const typologies=['Structuring','Layering','Smurfing','Trade Based Money Laundering','Crypto Transfers','Money Mule','High Risk Jurisdiction','PEP','Sanctions','Shell Company','Cash Intensive Business','Human Trafficking','Terrorist Financing'];
  const counts={};
  DashState.cases.forEach(c=>counts[c.typology]=(counts[c.typology]||0)+1);
  el.innerHTML=typologies.map((typ,i)=>{
    const color=TYPOLOGY_COLORS[i%TYPOLOGY_COLORS.length];
    const icon=TYPOLOGY_ICONS[typ]||'<circle cx="12" cy="12" r="10"/>';
    const count=counts[typ]||0;
    const openCount=DashState.cases.filter(c=>c.typology===typ&&getEffectiveStatus(c)==='Open').length;
    return `<div class="typ-card" onclick="filterByTypology('${typ.replace(/'/g,"\\'")}')">
      <div class="typ-icon" style="background:${color}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
      </div>
      <div class="typ-count">${count}</div>
      <div class="typ-label">${typ}</div>
      <div class="typ-sub">${openCount} open · Click to view</div>
    </div>`;
  }).join('');
}
function filterByTypology(typ){
  DashState.filters.typology=typ;
  const sel=document.getElementById('filterTypology');
  if(sel)sel.value=typ;
  renderAlertQueue();
  switchView('alerts');
}

/* ---- Donut ---- */
function renderRiskDonut(){
  const el=document.getElementById('riskDonut');if(!el)return;
  const cases=DashState.cases;
  const counts={High:cases.filter(c=>c.riskLevel==='High').length,Medium:cases.filter(c=>c.riskLevel==='Medium').length,Low:cases.filter(c=>c.riskLevel==='Low').length};
  const colors={High:'#dc2626',Medium:'#d97706',Low:'#059669'};
  const total=counts.High+counts.Medium+counts.Low;
  const r=70,cx=90,cy=90,circ=2*Math.PI*r;
  let offset=0,segs='';
  Object.entries(counts).forEach(([label,count])=>{
    const len=(total?count/total:0)*circ;
    segs+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[label]}" stroke-width="20" stroke-dasharray="${len} ${circ-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset+=len;
  });
  el.innerHTML=`<div class="donut-wrap"><svg width="180" height="180" viewBox="0 0 180 180">${segs}</svg><div class="donut-center"><div class="num">${total}</div><div class="lbl">Alerts</div></div></div><div class="chart-legend">${Object.entries(counts).map(([l,c])=>`<div class="legend-item"><span class="legend-dot" style="background:${colors[l]}"></span>${l} · ${c}</div>`).join('')}</div>`;
}

/* ---- Typology bars ---- */
function renderTypologyBars(){
  const el=document.getElementById('typologyBars');if(!el)return;
  const counts={};
  DashState.cases.forEach(c=>counts[c.typology]=(counts[c.typology]||0)+1);
  const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const max=Math.max(...entries.map(e=>e[1]),1);
  el.innerHTML=entries.map(([l,c])=>`<div class="bar-row"><div class="bar-label" title="${l}">${l}</div><div class="bar-track"><div class="bar-fill" style="width:${c/max*100}%;background:linear-gradient(90deg,var(--accent),#3b82f6);"></div></div><div class="bar-val">${c}</div></div>`).join('');
}

/* ---- Investigator perf ---- */
function renderInvestigatorPerf(){
  const el=document.getElementById('investigatorPerf');if(!el)return;
  const byInv={};
  DashState.cases.forEach(c=>{
    if(!byInv[c.investigator])byInv[c.investigator]={total:0,closed:0};
    byInv[c.investigator].total++;
    if(getEffectiveStatus(c)!=='Open')byInv[c.investigator].closed++;
  });
  const entries=Object.entries(byInv).sort((a,b)=>b[1].total-a[1].total);
  const max=Math.max(...entries.map(e=>e[1].total),1);
  el.innerHTML=entries.map(([n,s])=>`<div class="bar-row"><div class="bar-label" title="${n}">${n}</div><div class="bar-track"><div class="bar-fill" style="width:${s.total/max*100}%;background:linear-gradient(90deg,#4f46e5,#818cf8);"></div></div><div class="bar-val">${s.closed}/${s.total}</div></div>`).join('');
}

/* ---- Recent alerts widget ---- */
function renderRecentAlerts(){
  const el=document.getElementById('recentAlertsTable');if(!el)return;
  const recent=[...DashState.cases].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
  el.innerHTML=recent.map(c=>`<tr onclick="window.location.href='case.html?id=${c.caseId}'"><td class="cell-id">${c.alertId}</td><td class="cell-name">${c.customerName}</td><td><span class="pill ${riskPillClass(c.riskLevel)}">${c.riskLevel}</span></td><td><span class="typology-tag">${c.typology}</span></td><td class="cell-amount">${fmtCurrency(c.amount)}</td><td><span class="status-pill ${statusClass(getEffectiveStatus(c))}">${getEffectiveStatus(c)}</span></td></tr>`).join('');
}

/* ---- Latest cases grid ---- */
function renderLatestCases(){
  const el=document.getElementById('latestCasesList');if(!el)return;
  const latest=[...DashState.cases].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  el.innerHTML=latest.map(c=>`<div class="case-card" onclick="window.location.href='case.html?id=${c.caseId}'"><div class="row1"><span class="cell-id">${c.caseId}</span><span class="status-pill ${statusClass(getEffectiveStatus(c))}">${getEffectiveStatus(c)}</span></div><h4>${c.customerName}</h4><div class="text-muted" style="font-size:12px">${c.typology} · ${c.country}</div><div class="meta-line"><span class="pill ${riskPillClass(c.riskLevel)}">${c.riskLevel}</span><span>${fmtCurrency(c.amount)}</span><span>${fmtDate(c.date)}</span></div></div>`).join('');
}

/* ============ ALERT QUEUE ============ */
function wireAlertQueueControls(){
  const q=document.getElementById('alertSearchInput');
  const risk=document.getElementById('filterRisk');
  const status=document.getElementById('filterStatus');
  const typology=document.getElementById('filterTypology');
  if(typology){
    const typs=[...new Set(DashState.cases.map(c=>c.typology))].sort();
    typology.innerHTML=`<option value="all">All Typologies</option>`+typs.map(t=>`<option value="${t}">${t}</option>`).join('');
    if(DashState.filters.typology!=='all')typology.value=DashState.filters.typology;
  }
  if(q){q.value=DashState.filters.q;q.addEventListener('input',()=>{DashState.filters.q=q.value;renderAlertQueue();});}
  if(risk)risk.addEventListener('change',()=>{DashState.filters.risk=risk.value;renderAlertQueue();});
  if(status)status.addEventListener('change',()=>{DashState.filters.status=status.value;renderAlertQueue();});
  if(typology)typology.addEventListener('change',()=>{DashState.filters.typology=typology.value;renderAlertQueue();});
  document.querySelectorAll('#alertQueueTable th[data-sort]').forEach(th=>{
    th.addEventListener('click',()=>{
      const key=th.getAttribute('data-sort');
      DashState.sort.dir=DashState.sort.key===key?(DashState.sort.dir==='asc'?'desc':'asc'):'asc';
      DashState.sort.key=key; renderAlertQueue();
    });
  });
}

function getFilteredCases(){
  const{q,risk,status,typology}=DashState.filters;
  let rows=DashState.cases.filter(c=>{
    const eff=getEffectiveStatus(c);
    if(risk!=='all'&&c.riskLevel!==risk)return false;
    if(status!=='all'&&eff!==status)return false;
    if(typology!=='all'&&c.typology!==typology)return false;
    if(q){const hay=`${c.alertId} ${c.customerName} ${c.country} ${c.typology} ${c.investigator}`.toLowerCase();if(!hay.includes(q.toLowerCase()))return false;}
    return true;
  });
  const{key,dir}=DashState.sort;
  rows.sort((a,b)=>{
    let av=a[key],bv=b[key];
    if(key==='date'){av=new Date(av);bv=new Date(bv);}
    if(typeof av==='string'){av=av.toLowerCase();bv=bv.toLowerCase();}
    return av<bv?(dir==='asc'?-1:1):av>bv?(dir==='asc'?1:-1):0;
  });
  return rows;
}

function renderAlertQueue(){
  const tbody=document.getElementById('alertQueueBody');if(!tbody)return;
  const rows=getFilteredCases();
  document.querySelectorAll('#alertQueueTable th[data-sort]').forEach(th=>{
    th.classList.toggle('sorted',th.getAttribute('data-sort')===DashState.sort.key);
    const a=th.querySelector('.sort-arrow');
    if(a)a.textContent=th.getAttribute('data-sort')===DashState.sort.key?(DashState.sort.dir==='asc'?'▲':'▼'):'↕';
  });
  const cnt=document.getElementById('alertResultCount');
  if(cnt)cnt.textContent=`${rows.length} of ${DashState.cases.length} alerts`;
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="10"><div class="empty-state"><div class="t">No alerts match your filters</div><div>Adjust search or filter criteria.</div></div></td></tr>`;return;}
  tbody.innerHTML=rows.map(c=>{
    const eff=getEffectiveStatus(c);
    return `<tr onclick="window.location.href='case.html?id=${c.caseId}'" class="${c.riskLevel==='High'?'suspicious-row':''}">
      <td class="cell-id">${c.alertId}</td>
      <td class="cell-name">${c.customerName}</td>
      <td><span class="pill ${riskPillClass(c.riskLevel)}">${c.riskLevel}</span></td>
      <td><span class="typology-tag">${c.typology}</span></td>
      <td>${c.country}</td>
      <td class="cell-amount">${fmtCurrency(c.amount)}</td>
      <td><span class="status-pill ${statusClass(eff)}">${eff}</span></td>
      <td>${c.investigator}</td>
      <td>${fmtDate(c.date)}</td>
      <td><button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();window.location.href='case.html?id=${c.caseId}'">Open →</button></td>
    </tr>`;
  }).join('');
}

/* ---- Cases grid ---- */
function renderCasesGrid(){
  const el=document.getElementById('casesGridAll');if(!el)return;
  el.innerHTML=DashState.cases.map(c=>`<div class="case-card" onclick="window.location.href='case.html?id=${c.caseId}'"><div class="row1"><span class="cell-id">${c.caseId}</span><span class="status-pill ${statusClass(getEffectiveStatus(c))}">${getEffectiveStatus(c)}</span></div><h4>${c.customerName}</h4><div class="text-muted" style="font-size:12px">${c.typology} · ${c.country}</div><div class="meta-line"><span class="pill ${riskPillClass(c.riskLevel)}">${c.riskLevel}</span><span>${fmtCurrency(c.amount)}</span><span>${c.investigator}</span></div></div>`).join('');
}
