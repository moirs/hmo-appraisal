import {financialMetrics} from './financial.js';

export const gateLabels={funding:'Committed funding and cash buffer',feasibility:'Planning, licensing, building regulations, fire safety and occupancy feasibility',valuation:'Credible GDV / refinance valuation evidence',lender:'Lender eligibility, terms and achievable LTV'};
export const criterionLabels={profit:'Development profit on cost',recycled:'Estimated capital recycled',cashflow:'Monthly net cash flow',dscr:'DSCR',stress:'Downside resilience'};
const keys=Object.keys(criterionLabels);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export const viabilityDefaults=()=>({version:1,weights:{profit:20,recycled:30,cashflow:20,dscr:15,stress:15},thresholds:{profit:20,recycled:90,cashflow:1500,dscr:1.5},bands:{review:40,go:75},equityPolicy:'allowModelled',zeroDebtPolicy:'review',downside:{gdvDrop:10,buildIncrease:10,rentDrop:10,operatingIncrease:10,ltvDrop:5,extraMonths:3},options:[0,1].map(()=>({committedEquity:null,cashBuffer:0,gates:Object.fromEntries(Object.keys(gateLabels).map(k=>[k,{status:'unknown',notes:'',evidence:'',date:''}]))}))});

/** Persisted deal settings, deliberately strict: malformed settings never silently pass. */
export function validateViability(value){
 const v=structuredClone(value);
 if(!v||v.version!==1)throw Error('Unsupported viability settings.');
 const nonnegative=(x,label)=>{if(!finite(x)||x<0||x>1e12)throw Error(label+' must be a non-negative finite number.');};
 for(const k of keys)nonnegative(v.weights?.[k],'Weight '+k);
 if(Math.abs(keys.reduce((s,k)=>s+v.weights[k],0)-100)>1e-8)throw Error('Viability weights must total 100.');
 for(const k of ['profit','recycled','cashflow','dscr'])nonnegative(v.thresholds?.[k],'Threshold '+k);
 if(v.thresholds.recycled>100)throw Error('Capital recycling threshold cannot exceed 100%.');
 nonnegative(v.bands?.review,'Review band');nonnegative(v.bands?.go,'GO band');
 if(v.bands.review>=v.bands.go||v.bands.go>100)throw Error('Score bands must satisfy 0 ≤ review < GO ≤ 100.');
 if(!['requireActual','allowModelled'].includes(v.equityPolicy)||!['review','passPositiveNoi'].includes(v.zeroDebtPolicy))throw Error('Invalid viability evidence policy.');
 for(const k of Object.keys(viabilityDefaults().downside))nonnegative(v.downside?.[k],'Downside '+k);
 for(const k of ['gdvDrop','rentDrop','ltvDrop'])if(v.downside[k]>100)throw Error(k+' cannot exceed 100%.');
 if(v.downside.extraMonths>600)throw Error('Downside extension cannot exceed 600 months.');
 if(!Array.isArray(v.options)||v.options.length!==2)throw Error('Viability requires two finance option assessments.');
 for(const o of v.options){
  for(const k of ['committedEquity','cashBuffer'])if(o[k]!==null)nonnegative(o[k],k);
  for(const k of Object.keys(gateLabels)){
   const g=o.gates?.[k];if(!g||!['confirmed','failed','unknown'].includes(g.status))throw Error('Invalid mandatory gate '+k+'.');
   for(const f of ['notes','evidence','date'])if(typeof g[f]!=='string'||g[f].length>4000)throw Error('Invalid gate '+f+'.');
   if(g.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(g.date)||!finite(Date.parse(g.date))||new Date(g.date).toISOString().slice(0,10)!==g.date))throw Error('Invalid gate evidence date.');
  }
 }
 return v;
}

/** Solve cash left = equity - (gross loan - fees - redemptions) = 0.
 * Fixed fees already in total cost are not added to that total a second time. */
export function recoveryThreshold(i,r=financialMetrics(i)){
 let reason='';
 const effectiveLtv=i.ltv*(1-i.valuationHaircut);
 if(!(r.totalProjectCost>0)||!(r.gdv>0))reason='Positive project cost and expected GDV are required.';
 else if(i.actualLoan!==null)reason='An actual loan override fixes the advance independently of GDV.';
 else if(i.refinanceValuation!==null)reason='A separate refinance valuation fixes the advance independently of expected GDV.';
 else if(!(effectiveLtv>0))reason='A positive effective refinance LTV is required.';
 else if(r.totalEquityCashInjected===null||r.totalEquityCashInjected<0)reason='A valid equity funding ledger is required.';
 const requiredLoan=r.totalEquityCashInjected===null?null:r.totalEquityCashInjected+r.bridge.redemption+i.otherDebt+i.closingCosts+i.advanceFees;
 if(!reason&&i.maxLoan!==null&&i.maxLoan+0.005<requiredLoan)reason='The lender loan cap prevents full capital recovery at any GDV.';
 const minimum=reason?null:requiredLoan/effectiveLtv;
 const headroom=minimum===null?null:r.gdv-minimum;
 return {minimumGdvForFullRecovery:minimum,gdvHeadroom:headroom,gdvHeadroomPercent:headroom===null?null:headroom/r.gdv*100,requiredLoan,effectiveLtv,reason};
}

/** Independent GDV and rent shocks; existing facility is held fixed, overruns need equity. */
export function downsideInput(input,s){
 const i=structuredClone(input),r=financialMetrics(input),factor=1-s.gdvDrop/100;
 i.valuationMode='manual';i.manualValuation=r.gdv===null?null:r.gdv*factor;
 if(i.refinanceValuation!==null)i.refinanceValuation*=factor;
 i.grossMonthlyRent*=1-s.rentDrop/100;
 i.costs['Build budget']=(i.costs['Build budget']??0)*(1+s.buildIncrease/100);
 const operating=1+s.operatingIncrease/100;
 for(const k of Object.keys(i.fixedMonthlyExpenses))i.fixedMonthlyExpenses[k]*=operating;
 i.managementRate*=operating;i.variableRate*=operating;
 if(i.managementOverride!==null)i.managementOverride*=operating;
 const oldTerm=i.bridge.duration;
 i.bridge.duration+=s.extraMonths;i.developmentDuration=(i.developmentDuration??oldTerm)+s.extraMonths;
 // Holding is a period total; infer the existing monthly allowance where possible.
 i.holding=input.monthlyHolding!==undefined?input.monthlyHolding*i.bridge.duration:oldTerm>0?i.holding/oldTerm*i.bridge.duration:i.holding;
 i.ltv-=s.ltvDrop/100;
 return i;
}

const band=(score,c)=>score>=c.bands.go?'GO':score>=c.bands.review?'REVIEW':'NO_GO';
/** @param {import('./financial.js').FinancialInput} input */
export function assessDeal(input,settings=viabilityDefaults(),optionIndex=0){
 const config=validateViability(settings),e=config.options[optionIndex];
 if(!e)throw Error('Unknown finance option.');
 let base=null,downside=null,stressError='';
 try{base=financialMetrics(input);}catch(err){stressError='Base financial inputs: '+err.message;}
 try{if(base)downside=financialMetrics(downsideInput(input,config.downside));}catch(err){stressError='Downside cannot be calculated: '+err.message;}
 const overrideProblem=input.paymentOverride!==null||input.actualLoan!==null;
 if(overrideProblem)stressError='Loan or payment override is fixed. Remove it to recalculate downside debt service reliably.';
 const cashBuffer=e.cashBuffer??0;
 const requiredFunds=downside&&!overrideProblem&&downside.additionalCashRequired!==null?Math.max(0,downside.fundingRequirement)+downside.additionalCashRequired+cashBuffer:null;
 const fundingGap=e.committedEquity!==null&&requiredFunds!==null?Math.max(0,requiredFunds-e.committedEquity):null;
 const fundingStatus=fundingGap===null?'not_assessed':fundingGap>0.005?'gap':'covered';
 const stressStatus=stressError||downside?.monthlyCashFlow==null?'unknown':downside.monthlyCashFlow>0?'pass':'fail';
 const stressExplanation=stressError||(!downside||downside.monthlyCashFlow===null?'Downside cash flow cannot be calculated.':stressStatus==='pass'?'Monthly cash flow remains positive under the configured downside. Funding availability is checked separately and does not affect this score.':'Downside monthly cash flow is not positive.');
 // Legacy equityPolicy is retained in saved files, but no longer blocks modeled recycling.
 const equityVerified=input.equityMode==='actual'&&input.equityContributions.length>0;
 const scoreCase=r=>{
  const recycled=r&&r.totalEquityCashInjected>0&&r.cashReturnedToInvestor!==null?r.cashReturnedToInvestor/r.totalEquityCashInjected*100:null;
  const values={profit:r?.profitOnCost==null?null:r.profitOnCost*100,recycled,cashflow:r?.monthlyCashFlow??null,dscr:r?.dscr??null,stress:downside?.monthlyCashFlow??null};
  const criteria=keys.map(k=>{
   const value=values[k],threshold=config.thresholds[k]??0,weight=config.weights[k];
   let status=finite(value)?(Math.min(k==='recycled'?100:Infinity,value)>=threshold?'pass':'fail'):'unknown';
   const display=n=>k==='dscr'?n.toFixed(2)+'×':['profit','recycled'].includes(k)?n.toFixed(1)+'%':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
   let explanation=status==='unknown'?'Required value is unavailable.':`${display(value)} ${status==='pass'?'meets':'is below'} the ${display(threshold)} threshold.`;
   if(k==='recycled')explanation+=equityVerified?' Uses the entered actual contribution ledger.':input.equityMode==='actual'?' The selected actual contribution ledger is incomplete.':' Uses estimated equity from the existing funding model; actual contributions are not required.';
   if(k==='dscr'&&r?.noi<0){status='fail';explanation='NOI is negative.';}
   else if(k==='dscr'&&r?.annualDebtService===0){status=config.zeroDebtPolicy==='passPositiveNoi'&&r.noi>0?'pass':'unknown';explanation=status==='pass'?'Debt-free case passes under the selected positive-NOI policy; DSCR remains N/A.':'No debt service: DSCR is N/A; review required under the selected policy.';}
   if(k==='stress'){status=stressStatus;explanation=stressExplanation;}
   return {key:k,label:k==='recycled'&&equityVerified?'Capital recycled (actual ledger)':criterionLabels[k],value,threshold,weight,status,points:status==='pass'?weight:0,explanation};
  });
  const score=criteria.reduce((s,c)=>s+c.points,0);
  return {criteria,score,financialScreen:band(score,config),capitalRecycledPercent:recycled};
 };
 const scored=scoreCase(base),downsideScore=scoreCase(downside);
 const recovery=base?recoveryThreshold(input,base):{minimumGdvForFullRecovery:null,gdvHeadroom:null,gdvHeadroomPercent:null,reason:stressError};
 const gaps=[];
 if(!base||!(base.totalProjectCost>0)||!(base.gdv>0)||!(input.ltv>0))gaps.push('Positive project cost, GDV and refinance LTV are required.');
 if(recovery.reason)gaps.push(recovery.reason);
 const incomplete=gaps.length>0||scored.criteria.some(c=>c.status==='unknown');
 const finalDecision=incomplete?'REVIEW':scored.financialScreen;
 const reasons=[...gaps,...scored.criteria.filter(c=>c.status!=='pass').map(c=>c.label+': '+c.explanation)];
 if(!reasons.length)reasons.push('All five configured financial criteria pass using the current appraisal assumptions.');
 return {...scored,...recovery,finalDecision,incomplete,gates:e.gates,reasons,base,downside,downsideScore:downside?downsideScore.score:null,downsideAssumptions:config.downside,requiredFunds,committedEquity:e.committedEquity,cashBuffer,bufferAssumed:e.cashBuffer===null||cashBuffer===0,fundingStatus,fundingGap,stressExplanation,equityVerified,overrideProblem};
}
