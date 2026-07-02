/* ============================================================
   SENTINEL AML — Shared utilities + localStorage state layer
   ============================================================ */

const SentinelData = (() => {
  let _cases=null,_customers=null,_transactions=null;
  async function loadAll(){
    if(_cases&&_customers&&_transactions) return {cases:_cases,customers:_customers,transactions:_transactions};
    const [cr,csr,tr]=await Promise.all([fetch('data/cases.json'),fetch('data/customers.json'),fetch('data/transactions.json')]);
    _cases=await cr.json(); _customers=await csr.json(); _transactions=await tr.json();
    return {cases:_cases,customers:_customers,transactions:_transactions};
  }
  function getCases(){return _cases||[];}
  function getCustomers(){return _customers||[];}
  function getTransactionsFor(id){return(_transactions&&_transactions[id])||[];}
  function getCustomerById(id){return(_customers||[]).find(c=>c.customerId===id);}
  function getCaseById(id){return(_cases||[]).find(c=>c.caseId===id||c.alertId===id);}
  return{loadAll,getCases,getCustomers,getTransactionsFor,getCustomerById,getCaseById};
})();

/* ---- Case state stored in localStorage ---- */
const CaseStore = {
  _key: id => `sentinel_case_${id}`,

  get(caseId){
    try{ const v=localStorage.getItem(this._key(caseId)); return v?JSON.parse(v):null; }
    catch(e){ return null; }
  },

  save(caseId, data){
    try{ localStorage.setItem(this._key(caseId), JSON.stringify(data)); return true; }
    catch(e){ return false; }
  },

  getStatus(caseId){
    const d=this.get(caseId);
    return d&&d.status ? d.status : 'Open';
  },

  isExported(caseId){
    const d=this.get(caseId); return !!(d&&d.exported);
  },

  markExported(caseId, exportData){
    const existing=this.get(caseId)||{};
    this.save(caseId,{...existing, exported:true, exportedAt:new Date().toISOString(), exportData});
  },

  setStatus(caseId, status, analystNote, aiHistory){
    const existing=this.get(caseId)||{};
    this.save(caseId,{...existing, status, closedAt:new Date().toISOString(), analystNote:analystNote||'', aiChatHistory:aiHistory||[]});
  },

  getAllClosed(){
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k&&k.startsWith('sentinel_case_')){
        try{
          const v=JSON.parse(localStorage.getItem(k));
          if(v&&v.status&&v.status!=='Open') keys.push(v);
        }catch(e){}
      }
    }
    return keys;
  }
};

/* ---- Formatting helpers ---- */
function fmtCurrency(amount,currency='USD'){
  try{return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:0}).format(amount);}
  catch(e){return `$${Math.round(amount).toLocaleString()}`;}
}
function fmtNumber(n){return Number(n).toLocaleString('en-US');}
function fmtDate(d){
  const date=new Date(d); if(isNaN(date))return d;
  return date.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
}
function fmtDateFull(d){
  const date=new Date(d); if(isNaN(date))return d;
  return date.toLocaleString('en-US',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
function statusClass(s){return 'status-'+s.replace(/\s+/g,'-').replace(/[^A-Za-z-]/g,'');}
function riskPillClass(l){
  const r=(l||'').toLowerCase();
  return r==='high'?'pill-high':r==='medium'?'pill-medium':'pill-low';
}
function initials(name){return name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();}

/* Random date within a few days of today for RFI responses */
function rfiResponseDate(){
  const d=new Date();
  d.setDate(d.getDate()+Math.floor(Math.random()*6+3));
  return d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
}

/* ---- Topbar clock ---- */
function startClock(){
  const el=document.getElementById('topbarClock');
  if(!el)return;
  function tick(){el.textContent=new Date().toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});}
  tick(); setInterval(tick,1000);
}

/* ---- Toasts ---- */
function showToast(title,message,opts={}){
  let stack=document.querySelector('.toast-stack');
  if(!stack){stack=document.createElement('div');stack.className='toast-stack';document.body.appendChild(stack);}
  const t=document.createElement('div');t.className='toast';
  if(opts.color)t.style.borderLeftColor=opts.color;
  t.innerHTML=`<strong>${title}</strong><span>${message}</span>`;
  stack.appendChild(t);
  setTimeout(()=>{t.style.transition='opacity 0.3s,transform 0.3s';t.style.opacity='0';t.style.transform='translateX(10px)';setTimeout(()=>t.remove(),300);},(opts.duration||3200));
}

function wireGlobalSearch(){
  const input=document.getElementById('globalSearchInput');
  if(!input)return;
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&input.value.trim())
      window.location.href=`dashboard.html?view=alerts&q=${encodeURIComponent(input.value.trim())}`;
  });
}

document.addEventListener('DOMContentLoaded',()=>{startClock();wireGlobalSearch();});
