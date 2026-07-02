/* ============================================================
   SENTINEL AML — AI Assistant Layer
   Swap simulateAIResponse() for callAIProvider() to go live.
   ============================================================ */

const AI_PROVIDER_CONFIG = {
  provider: 'none',    // TODO: 'gemini' | 'openrouter' | 'groq'
  apiKey: '',          // TODO: your API key
  model: 'gemini-1.5-pro',
  endpoint: '',
};

// Chat history for current case session (saved on export/close)
let AIChatHistory = [];

async function callAIProvider(prompt, kind) {
  // TODO: Send prompt to Gemini:
  // const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AI_PROVIDER_CONFIG.model}:generateContent?key=${AI_PROVIDER_CONFIG.apiKey}`, {
  //   method:'POST', headers:{'Content-Type':'application/json'},
  //   body: JSON.stringify({contents:[{parts:[{text:prompt}]}]})
  // });
  // const data = await res.json();
  // const text = data.candidates[0].content.parts[0].text;
  // return { title: kindTitle(kind), html: markdownToHtml(text) };
  throw new Error('AI provider not configured.');
}

function markdownToHtml(md){
  let html=md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.*)$/gm,'<h4>$1</h4>').replace(/^## (.*)$/gm,'<h4>$1</h4>')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
  html=html.replace(/(?:^|\n)((?:- .*(?:\n|$))+)/g,block=>{
    const items=block.trim().split('\n').map(l=>`<li>${l.replace(/^- /,'')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  html=html.split(/\n{2,}/).map(p=>{
    if(p.startsWith('<h4>')||p.startsWith('<ul>'))return p;
    return `<p>${p.replace(/\n/g,'<br>')}</p>`;
  }).join('');
  return html;
}

/* ---- Panel helpers ---- */
function aiPanelBody(){return document.getElementById('aiPanelBody');}

function appendAILoading(label){
  const body=aiPanelBody(); if(!body)return null;
  const wrap=document.createElement('div');wrap.className='ai-msg';
  wrap.innerHTML=`<div class="ai-loading"><span class="spinner"></span><span>${label}</span><span class="typing-dots"><span></span><span></span><span></span></span></div>`;
  body.appendChild(wrap);body.scrollTop=body.scrollHeight;return wrap;
}

function renderAIResponse(loadingEl,kind,title,html){
  const body=aiPanelBody(); if(!body)return;
  const wrap=document.createElement('div');wrap.className='ai-msg';
  const time=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  wrap.innerHTML=`<div class="ai-card"><div class="tag-row"><span class="label">${title}</span><span class="time">${time}</span></div>${html}</div>`;
  if(loadingEl)loadingEl.replaceWith(wrap); else body.appendChild(wrap);
  body.scrollTop=body.scrollHeight;
  // Track history
  AIChatHistory.push({role:'assistant',kind,title,text:stripHtml(html),time:new Date().toISOString()});
}

function appendUserPrompt(text){
  const body=aiPanelBody();if(!body)return;
  const wrap=document.createElement('div');wrap.className='ai-msg';
  wrap.innerHTML=`<div class="ai-card user-card"><div class="tag-row"><span class="label" style="color:var(--accent)">Investigator</span></div><p style="margin:0">${text}</p></div>`;
  body.appendChild(wrap);body.scrollTop=body.scrollHeight;
  AIChatHistory.push({role:'user',text,time:new Date().toISOString()});
}

function stripHtml(html){return html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}

function getCurrentCaseContext(){
  if(typeof CasePage==='undefined'||!CasePage.alert)return null;
  return{alert:CasePage.alert,customer:CasePage.customer,transactions:CasePage.transactions};
}
function suspiciousTxns(txns){return(txns||[]).filter(t=>t.suspicious);}

/* ============================================================
   SIMULATED AI RESPONSE ENGINE
   ============================================================ */
async function simulateAIResponse(prompt,kind){
  const ctx=getCurrentCaseContext();
  await wait(900+Math.random()*700);
  if(!ctx)return{title:'Assistant',html:'<p>No active case loaded.</p>'};
  const{alert,customer,transactions}=ctx;
  const susp=suspiciousTxns(transactions);
  const totalSusp=susp.reduce((s,t)=>s+t.amount,0);

  switch(kind){
    case 'analyze': return{title:'Alert Analysis',html:markdownToHtml(
`**Alert ${alert.alertId}** involves **${customer.name}** (${customer.customerId}), a ${customer.occupation.toLowerCase()} based in ${customer.country}.

The account carries a **${customer.riskRating} risk** rating (score ${customer.riskScore}/100), and this alert was generated under the **${alert.typology}** typology.

Of ${transactions.length} transactions reviewed, **${susp.length}** were flagged as suspicious, totalling **${fmtCurrency(totalSusp)}** — a pattern consistent with the declared typology.

**Key observations:**
- ${alert.redFlags[0]}
- ${alert.redFlags[1]||'Transaction velocity is elevated relative to the expected monthly range of '+customer.expectedMonthlyActivity}
- PEP status: **${customer.pepStatus}** · Sanctions: **${customer.sanctionsStatus}** · Prior SAR: **${customer.previousSar}**

**Assessment:** The weight of evidence supports continued investigation. Review counterparty relationships and request source-of-funds documentation before filing a final disposition.`)};

    case 'summary': return{title:'Investigation Summary',html:markdownToHtml(
`### Case Overview
Alert **${alert.alertId}** was triggered on ${fmtDate(alert.date)} for **${customer.name}**, assigned to investigator ${alert.investigator} under the **${alert.typology}** typology.

### Customer Background
${customer.name} is a ${customer.occupation.toLowerCase()} domiciled in ${customer.country} (nationality: ${customer.nationality}). KYC level: **${customer.kycLevel}**. Declared source of wealth: ${customer.sourceOfWealth.toLowerCase()}.

### Transaction Findings
- Total reviewed: **${transactions.length}** transactions
- Flagged suspicious: **${susp.length}** (${fmtCurrency(totalSusp)})
- Primary channel: **${susp[0]?susp[0].channel:'N/A'}**

### Red Flags
${alert.redFlags.map(f=>`- ${f}`).join('\n')}

### Current Disposition
Status: **Open** — pending analyst review and closure decision.`)};

    case 'sar': return{title:'Draft SAR Narrative',html:markdownToHtml(
`**Suspicious Activity Report — Draft Narrative**

This report concerns account holder **${customer.name}** (Customer ID: ${customer.customerId}), whose account activity exhibits characteristics consistent with **${alert.typology}**.

During the review period, the subject conducted **${susp.length} transactions** totalling **${fmtCurrency(totalSusp)}**, which materially deviate from the expected monthly activity profile of ${customer.expectedMonthlyActivity}.

**Suspicious indicators identified:**
${alert.redFlags.map(f=>`- ${f}`).join('\n')}

**Subject profile:** Occupation: ${customer.occupation}; Country: ${customer.country}; PEP status: ${customer.pepStatus}; Sanctions screening: ${customer.sanctionsStatus}; Prior SAR history: ${customer.previousSar}.

**Filing recommendation:** Based on the totality of the evidence reviewed, filing a Suspicious Activity Report with the relevant Financial Intelligence Unit is recommended. This narrative must be reviewed and approved by a qualified BSA/AML compliance officer prior to submission.

*This is a draft generated for analyst review — not yet filed.*`)};

    case 'rfi': {
      // Generate RFI request then auto-trigger the response
      const rfiRequest = buildRFIRequest(alert, customer, susp);
      const rfiResponse = buildRFIResponse(alert, customer, susp);
      // Populate the dedicated RFI blocks on the page
      setTimeout(()=>populateRFIBlocks(rfiRequest, rfiResponse), 200);
      return{title:'RFI Generated',html:markdownToHtml(
`The **Request for Information** has been drafted and sent to ${customer.name}.

A simulated customer response has been received and is displayed in the **RFI Block** below the transaction history.

Review the response for completeness and consistency with the customer's declared source of funds.`)};
    }

    case 'explain': return{title:'Risk Score Explanation',html:markdownToHtml(
`**${customer.name}** carries a risk score of **${customer.riskScore}/100** (${customer.riskRating} Risk Band).

**Contributing factors:**
- **Typology:** ${alert.typology} — carries elevated inherent risk
- **Geography:** Account domiciled in ${customer.country}
- **PEP exposure:** ${customer.pepStatus}
- **Sanctions screening:** ${customer.sanctionsStatus}
- **Prior SAR:** ${customer.previousSar}
- **KYC tier:** ${customer.kycLevel}

Scores above **70** trigger enhanced due diligence and priority queue placement. PEP and sanctions hits apply multiplicative weighting. Jurisdictional risk is the single largest contributor for this case.`)};

    case 'recommend': return{title:'Recommended Next Steps',html:markdownToHtml(
`For alert **${alert.alertId}**, the following steps are recommended:

- **Step 1:** Issue a Request for Information (RFI) to ${customer.name} requesting documentation of source of funds for transactions exceeding ${fmtCurrency(Math.max(...susp.map(t=>t.amount),5000))}.
- **Step 2:** Conduct enhanced due diligence on counterparty **${susp[0]?susp[0].counterparty:'N/A'}**, verifying beneficial ownership.
- **Step 3:** Cross-reference the customer against internal watchlists and adverse media databases.
- **Step 4:** ${customer.previousSar==='Yes'?'Review prior SAR filings for pattern continuity.':'Document this as a first-time escalation event.'}
- **Step 5:** Complete the Case Analysis section, then export the case file before closing or escalating.
- **Step 6:** Route the completed case to ${customer.riskRating==='High'?'the compliance committee for escalation':'the senior investigator for sign-off'}.`)};

    case 'customer-summary': return{title:'Customer Profile Summary',html:markdownToHtml(
`**${customer.name}** (${customer.customerId}) is a **${customer.riskRating.toLowerCase()}-risk** customer, employed as a ${customer.occupation} in **${customer.country}** (nationality: ${customer.nationality}).

- **KYC:** ${customer.kycLevel}
- **Source of Wealth:** ${customer.sourceOfWealth}
- **Source of Funds:** ${customer.sourceOfFunds}
- **Expected Monthly Activity:** ${customer.expectedMonthlyActivity}
- **PEP:** ${customer.pepStatus} · **Sanctions:** ${customer.sanctionsStatus} · **Prior SAR:** ${customer.previousSar}
- **Account Opened:** ${fmtDate(customer.accountOpenDate)}

The combination of a ${customer.riskRating.toLowerCase()} risk score and the current **${alert.typology}** alert places this customer in the ${customer.riskRating==='High'?'highest':'standard'} monitoring intensity tier.`)};

    case 'network': return{title:'Network Analysis',html:markdownToHtml(
`Counterparty analysis for **${customer.name}** (${susp.length} flagged transactions):

${[...new Set(susp.map(t=>t.counterparty))].slice(0,5).map(cp=>{
  const cTxns=susp.filter(t=>t.counterparty===cp);
  const total=cTxns.reduce((s,t)=>s+t.amount,0);
  return `- **${cp}** — ${cTxns.length} flagged transaction(s) · ${fmtCurrency(total)} total · via ${cTxns[0].channel}`;
}).join('\n')}

**Interpretation:** The concentration of flagged activity across a small set of counterparties is consistent with **${alert.typology}** patterns, where funds are routed through a limited number of intermediaries to obscure the true source. See the Network Graph tab for a visual map.`)};

    case 'evaluate': return{title:'Decision Evaluation',html:markdownToHtml(
`**Current status:** Open — pending analyst decision.

**Evidence summary:**
- Risk score: **${customer.riskScore}/100** (${customer.riskRating})
- Flagged transactions: **${susp.length}** totalling **${fmtCurrency(totalSusp)}**
- PEP: ${customer.pepStatus} · Sanctions: ${customer.sanctionsStatus}

**Evaluation:** The evidence ${customer.riskScore>=70?'strongly supports escalation or a SAR filing':'is sufficient to warrant continued monitoring but does not yet compel immediate escalation'}.

**Recommended disposition:** ${customer.riskScore>=70?'Escalate to senior compliance officer and prepare SAR filing.':'Close with enhanced monitoring flag, or escalate if additional corroborating evidence emerges.'}

**Confidence level:** ${customer.riskScore>=70?'High':'Moderate'}.`)};

    default: return{title:'Assistant',html:'<p>Try one of the action buttons to generate an AI-assisted analysis for this case.</p>'};
  }
}

/* ---- RFI request + simulated customer response ---- */
function buildRFIRequest(alert, customer, susp){
  const topAmount = susp.length ? fmtCurrency(Math.max(...susp.map(t=>t.amount))) : fmtCurrency(10000);
  const cp = susp[0] ? susp[0].counterparty : 'the relevant counterparty';
  const today = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  return `To: ${customer.name}
Customer ID: ${customer.customerId}
Date: ${today}
Re: Account Review — Request for Supporting Documentation
Reference: ${alert.alertId}

Dear ${customer.name},

As part of our ongoing account monitoring programme, we are conducting a review of recent activity on your account. To assist us in completing this review, please provide the following documentation within ten (10) business days of the date of this letter:

1. Documentation confirming the source of funds for transactions exceeding ${topAmount}, including but not limited to bank statements, invoices, or contracts.

2. A written explanation of your business relationship with ${cp}, including the nature of the transactions conducted.

3. Updated evidence of your source of wealth, such as recent tax filings, business financial statements, or employment documentation.

4. Copies of any contracts, agreements, or purchase orders relevant to transactions occurring during the review period.

Please note that failure to respond within the specified timeframe may result in temporary restrictions being placed on your account pending resolution of this review.

This request is made in accordance with our obligations under applicable anti-money laundering legislation. All information provided will be treated with strict confidentiality.

Yours sincerely,

A. Whitfield
Senior AML Investigator
Sentinel Bank — Financial Crime Compliance Division`;
}

function buildRFIResponse(alert, customer, susp){
  const receivedDate = rfiResponseDate();
  const cp = susp[0] ? susp[0].counterparty : 'the counterparty referenced';
  const topAmount = susp.length ? fmtCurrency(Math.max(...susp.map(t=>t.amount))) : fmtCurrency(10000);

  // Build a plausible-sounding customer explanation
  const explanations = {
    "Import/Export Trader": `the transactions represent legitimate trade settlement payments arising from a supply contract with ${cp}. The amounts reflect standard commercial invoice values for goods delivered during the period. I enclose copies of the relevant commercial invoices and bill of lading documents.`,
    "Real Estate Developer": `the funds represent proceeds from a property sale and subsequent reinvestment. The transaction with ${cp} relates to a development project for which I can provide the relevant property sale agreement and development finance documentation.`,
    "Restaurant Owner": `the cash deposits reflect accumulated daily takings from my restaurant business. The volume of deposits corresponds to our peak trading season. I can provide our monthly sales reports and till reconciliation records as supporting evidence.`,
    "Freelance Consultant": `the transfers relate to payment for consulting services rendered to ${cp} under a professional services agreement. I enclose a copy of the signed contract and the corresponding invoices.`,
    "Crypto Asset Trader": `the transactions reflect proceeds from cryptocurrency trading activities conducted on regulated exchanges. The conversions were made in accordance with my trading strategy, and I am able to provide exchange statements and trade logs for the relevant period.`,
    "default": `the transactions in question arose from ordinary course business activities. The payments to and from ${cp} relate to contractual arrangements that I am pleased to provide documentation for. I have enclosed the relevant agreements and financial records in support of this response.`,
  };

  const explanation = explanations[customer.occupation] || explanations["default"];

  return `From: ${customer.name}
Customer ID: ${customer.customerId}
Date Received: ${receivedDate}
Re: Response to Account Review Request — Reference ${alert.alertId}

Dear A. Whitfield,

Thank you for your letter dated in connection with the above-referenced account review. I am writing to provide the requested documentation and clarification in respect of the transactions identified.

Regarding the nature of the transactions: ${explanation}

With respect to the amount of ${topAmount}: I confirm that this payment was made in the ordinary course of business and does not represent any unusual or irregular activity. The funds originate from my declared source of income, being ${customer.sourceOfWealth.toLowerCase()}.

I trust that the enclosed documentation is sufficient to resolve your enquiry. Should you require any further information, please do not hesitate to contact me directly.

I confirm that all information provided in this response is true and accurate to the best of my knowledge.

Yours sincerely,

${customer.name}
${customer.occupation}
${customer.country}`;
}

function populateRFIBlocks(requestText, responseText){
  const reqEl = document.getElementById('rfiRequestText');
  const resEl = document.getElementById('rfiResponseText');
  const recvEl = document.getElementById('rfiReceivedBanner');
  const rfiSection = document.getElementById('rfiSection');

  if(rfiSection) rfiSection.style.display='block';
  if(reqEl) reqEl.textContent = requestText;
  if(resEl) resEl.textContent = responseText;
  if(recvEl){
    // Parse received date from response
    const match = responseText.match(/Date Received:\s*(.+)/);
    if(match) recvEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg> Response received on ${match[1].trim()}`;
  }
  // Save to case page state
  if(typeof CasePage!=='undefined'){
    CasePage.rfiRequest = requestText;
    CasePage.rfiResponse = responseText;
  }
  showToast('RFI Complete','Request sent and customer response received.',{color:'var(--risk-low)'});
}

function wait(ms){return new Promise(r=>setTimeout(r,ms));}

/* ============================================================
   PUBLIC ACTION FUNCTIONS
   ============================================================ */
async function runAIAction(kind,label){
  const ctx=getCurrentCaseContext();
  if(!ctx){showToast('No case loaded','Open a case first.');return;}
  const loadingEl=appendAILoading(label);
  try{
    const prompt=`Action:${kind}\nAlert:${JSON.stringify(ctx.alert)}\nCustomer:${JSON.stringify(ctx.customer)}\nTransactions:${JSON.stringify(ctx.transactions)}`;
    // TODO: const result = await callAIProvider(prompt, kind);
    // TODO: Replace simulateAIResponse with callAIProvider once API key is set
    const result=await simulateAIResponse(prompt,kind);
    renderAIResponse(loadingEl,kind,result.title,result.html);
  }catch(err){
    renderAIResponse(loadingEl,kind,'Error',`<p style="color:var(--risk-high)">${err.message}</p>`);
  }
}

function analyzeAlert(){runAIAction('analyze','Analyzing alert…');}
function generateInvestigationSummary(){runAIAction('summary','Generating investigation summary…');}
function generateSAR(){runAIAction('sar','Drafting SAR narrative…');}
function generateRFI(){runAIAction('rfi','Generating RFI and awaiting customer response…');}
function explainRiskScore(){runAIAction('explain','Explaining risk score…');}
function recommendAction(){runAIAction('recommend','Generating recommendations…');}
function summarizeCustomer(){runAIAction('customer-summary','Summarizing customer…');}
function networkAnalysis(){runAIAction('network','Mapping transaction network…');}
function evaluateDecision(){runAIAction('evaluate','Evaluating current decision…');}

async function sendAIChat(){
  const input=document.getElementById('aiChatInput');
  if(!input||!input.value.trim())return;
  const text=input.value.trim(); input.value='';
  appendUserPrompt(text);
  const loadingEl=appendAILoading('Thinking…');
  const lower=text.toLowerCase();
  let kind='analyze';
  if(lower.includes('sar'))kind='sar';
  else if(lower.includes('rfi'))kind='rfi';
  else if(lower.includes('risk')||lower.includes('score'))kind='explain';
  else if(lower.includes('next step')||lower.includes('recommend'))kind='recommend';
  else if(lower.includes('customer')||lower.includes('profile'))kind='customer-summary';
  else if(lower.includes('network')||lower.includes('counterpart'))kind='network';
  else if(lower.includes('summary')||lower.includes('summarize'))kind='summary';
  else if(lower.includes('decision')||lower.includes('evaluate'))kind='evaluate';
  const result=await simulateAIResponse(text,kind);
  renderAIResponse(loadingEl,kind,result.title,result.html);
}
function quickChip(kind,label){runAIAction(kind,label);}
