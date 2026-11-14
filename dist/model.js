import {financialMetrics} from './financial.js';
/** Saved UI percentages stay compatible; toFinancialInput converts rates to fractions. */
export const extraDefaults=()=>({valuationMode:'multiplier',refinanceValuation:null,actualLoan:null,maxLoan:null,valuationHaircut:null,refinanceLenderFee:null,refinanceLegal:null,refinanceValuationFee:null,refinanceRetainedFee:null,closingCashCosts:null,otherDebt:null,otherSecuredDebt:null,mortgageType:'interestOnly',amortisationYears:25,paymentOverride:null,otherMonthlyDebt:null,managementOverride:null,variableOperatingRate:null,insurance:null,maintenance:null,compliance:null,broadband:null,cleaning:null,councilTax:null,otherOperating:null,reserves:null,acquisitionOther:null,planning:null,contingency:null,developmentOther:null,monthlyHolding:null,purchaseDate:null,completionDate:null,refinanceDate:null,timingMode:'months'});
export const optionDefaults=()=>({bridgeMode:'full',principalOverride:null,averageDrawnPercent:50,draws:[],interestFrequency:'monthly',compound:false,rolledInterest:true,rolledFees:true,retainedInterest:null,retainedFees:null,arrangementFee:null,exitFee:null,brokerFee:null,monitoringFee:null,fundingLegalFee:null,extensionFee:null,equityMode:'estimated',equityContributions:[],equityOverride:null});
export const defaults=()=>({version:1,name:'Eight-room HMO conversion',purchase:295000,stamp:19500,architect:7200,build:250000,projectFee:60000,misc:5000,rooms:8,rent:900,occupancy:100,bills:1000,management:8,multiplier:10.5,valuationOverride:null,refinanceLtv:75,mortgageRate:5,extras:extraDefaults(),options:[{...optionDefaults(),name:'Option A',legal:6000,valuation:1500,purchaseLtv:75,buildFunding:100,monthlyRate:1.25,fees:2.5,months:4},{...optionDefaults(),name:'Option B',legal:3000,valuation:2500,purchaseLtv:75,buildFunding:100,monthlyRate:1,fees:2,months:4}]});
export function migrate(p){
 if(!p||p.version!==1||!Array.isArray(p.options)||p.options.length!==2)throw Error('This is not a supported HMO project file.');
 const legacy=!p.extras;
 return {...structuredClone(p),extras:{...extraDefaults(),...(legacy?{valuationMode:p.valuationOverride===null?'multiplier':'manual'}:p.extras)},options:p.options.map(o=>({...optionDefaults(),...o}))};
}
const n=v=>v??0;
/** @param {ReturnType<typeof defaults>} p @param {number} index @param {number} rentChange @param {number} delay @param {Record<string,number>} stress @returns {import('./financial.js').FinancialInput} */
export function toFinancialInput(p,index=0,rentChange=0,delay=0,stress={}){
 const o={...optionDefaults(),...p.options[index]},e={...extraDefaults(),...p.extras};
 const duration=(stress.bridgeTerm??(e.timingMode==='dates'?(Date.parse(e.refinanceDate)-Date.parse(e.purchaseDate))/86400000/365.25*12:o.months))+delay;
 const build=p.build*(1+(stress.buildChange??0)/100),grossMonthlyRent=p.rent*p.rooms*(1+rentChange/100),gdvMode=e.valuationMode;
 const facilityLimit=p.purchase*o.purchaseLtv/100+build*o.buildFunding/100;
 const rawRate=o.monthlyRate/100,monthlyRate=o.interestFrequency==='annual'?rawRate/12:rawRate;
 const factor=1+(stress.valuationChange??0)/100;
 const manual=p.valuationOverride,baseEndValue=e.refinanceValuation??(gdvMode==='manual'?manual:grossMonthlyRent*12*p.multiplier);
 const refiValue='valuationChange' in stress?(baseEndValue===null?null:baseEndValue*factor):e.refinanceValuation;
 return {developmentDuration:e.timingMode==='dates'&&e.completionDate!==null?(Date.parse(e.completionDate)-Date.parse(e.purchaseDate))/86400000/365.25*12:duration,costs:{'Purchase price':p.purchase,'Stamp duty':p.stamp,'Architects':p.architect,'Acquisition legal':o.legal,'Acquisition valuation':o.valuation,'Build budget':build,'Project / Habiti fee':p.projectFee,'Miscellaneous allowance':p.misc,'Other acquisition costs':n(e.acquisitionOther),'Planning / licensing':n(e.planning),'Contingency':n(e.contingency),'Other development costs':n(e.developmentOther)},holding:n(e.monthlyHolding)*duration,grossMonthlyRent,occupancy:p.occupancy/100*(1+(stress.occupancyChange??0)/100),managementRate:p.management/100,managementOverride:e.managementOverride,variableRate:n(e.variableOperatingRate)/100,fixedMonthlyExpenses:{'Bills (existing aggregate)':p.bills,'Insurance':n(e.insurance),'Maintenance':n(e.maintenance),'Compliance':n(e.compliance),'Broadband':n(e.broadband),'Cleaning':n(e.cleaning),'Council tax':n(e.councilTax),'Other operating costs':n(e.otherOperating)},reserves:n(e.reserves),multiplier:p.multiplier,valuationMode:gdvMode,manualValuation:manual,refinanceValuation:refiValue,bridge:{facilityLimit,principal:o.principalOverride??facilityLimit,duration,monthlyRate,mode:o.bridgeMode,draws:o.draws,averageFraction:o.averageDrawnPercent/100,compound:o.compound,feeRate:o.fees/100,fixedFees:n(o.arrangementFee)+n(o.exitFee)+n(o.brokerFee)+n(o.monitoringFee)+n(o.fundingLegalFee)+n(o.extensionFee),retainedInterest:n(o.retainedInterest),retainedFees:n(o.retainedFees),rolledInterest:o.rolledInterest,rolledFees:o.rolledFees},equityMode:o.equityMode,equityContributions:o.equityContributions,equityOverride:o.equityOverride,ltv:(stress.ltv??p.refinanceLtv)/100,actualLoan:e.actualLoan,maxLoan:e.maxLoan,valuationHaircut:n(e.valuationHaircut)/100,advanceFees:n(e.refinanceLenderFee)+n(e.refinanceLegal)+n(e.refinanceValuationFee)+n(e.refinanceRetainedFee),closingCosts:n(e.closingCashCosts),otherDebt:n(e.otherDebt),otherSecuredDebt:n(e.otherSecuredDebt),mortgageRate:(p.mortgageRate+(stress.ratePoints??0))/100,mortgageType:e.mortgageType,amortisationYears:e.amortisationYears,paymentOverride:e.paymentOverride,otherMonthlyDebt:n(e.otherMonthlyDebt),recoveryCash:p.purchase*.25+p.stamp+p.architect+o.legal+o.valuation+p.projectFee};
}
export function calculate(p,index=0,rentChange=0,delay=0,stress={}){
 // Direct programmatic edits of the legacy override retain their established behaviour.
 if(p.valuationOverride!==null&&p.extras?.valuationMode==='multiplier'&&!p.extras?.valuationModeExplicit)p={...p,extras:{...p.extras,valuationMode:'manual'}};
 const input=toFinancialInput(p,index,rentChange,delay,stress),r=financialMetrics(input);
 const baseInterest=delay?financialMetrics(toFinancialInput(p,index,rentChange,0,stress)).bridge.interest:r.bridge.interest;
 return {...r,fullRent:input.grossMonthlyRent,collectedRent:r.effectiveAnnualRent/12,annualRent:r.grossAnnualRent,calculatedValue:r.indicativeGDV,value:r.gdv,refinance:r.grossRefinanceLoan,mortgage:r.monthlyMortgage,management:r.managementMonthly,cost:r.baseProjectCost,borrowed:r.bridge.principal,duration:r.bridge.duration,bridgeDetail:r.bridge,bridge:r.bridge.cost,allIn:r.totalProjectCost,surplus:r.cashLeftInDeal===null?null:-r.cashLeftInDeal,initial:r.totalEquityCashInjected,left:r.cashLeftInDeal,remaining:r.cashLeftInDeal===null?null:Math.max(0,r.cashLeftInDeal),extraReleased:r.cashLeftInDeal===null?null:Math.max(0,-r.cashLeftInDeal),cashReturned:r.cashReturnedToInvestor,recoveryCash:input.recoveryCash,cashbackBeforeBridge:r.grossRefinanceLoan===null?null:r.grossRefinanceLoan-r.baseProjectCost,equity:r.equityAfterRefinance,net:r.monthlyCashFlow,extraInterest:r.bridge.interest-baseInterest,delay,input};
}
export function validate(raw){
 const p=migrate(raw),base=defaults();
 if(typeof p.name!=='string'||p.name.length>200)throw Error('Invalid project name.');
 const check=(v,k,optional=false)=>{if(optional&&v===null)return;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e12)throw Error(`Invalid ${k}. Enter a non-negative finite number.`);};
 for(const k of Object.keys(base))if(typeof base[k]==='number')check(p[k],k);
 if(!Number.isInteger(p.rooms)||p.rooms<1)throw Error('Room count must be a positive whole number.');
 for(const k of ['occupancy','management','refinanceLtv'])if(p[k]>100)throw Error(`${k} must be between 0 and 100.`);
 check(p.valuationOverride,'manual valuation',true);if(p.valuationOverride===0)throw Error('The manual valuation must be positive or blank.');
 const strings=['valuationMode','mortgageType','timingMode','purchaseDate','completionDate','refinanceDate'];
 for(const [k,v] of Object.entries(extraDefaults()))if(!strings.includes(k))check(p.extras[k],k,v===null);
 for(const [k,values] of Object.entries({valuationMode:['manual','multiplier'],mortgageType:['interestOnly','repayment'],timingMode:['months','dates']}))if(!values.includes(p.extras[k]))throw Error(`Invalid ${k}.`);
 if(p.extras.amortisationYears<=0||p.extras.amortisationYears>100)throw Error('Amortisation term must be greater than zero and at most 100 years.');
 for(const k of ['variableOperatingRate','valuationHaircut'])if(n(p.extras[k])>100)throw Error(`${k} must be between 0 and 100.`);
 for(const k of ['purchaseDate','completionDate','refinanceDate'])if(p.extras[k]!==null){const v=p.extras[k],date=new Date(v);if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==v)throw Error(`Invalid ${k}.`);}
 if(p.extras.timingMode==='dates'){
  const start=Date.parse(p.extras.purchaseDate),end=Date.parse(p.extras.refinanceDate),complete=Date.parse(p.extras.completionDate);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw Error('Enter purchase and refinance dates, with refinance on or after purchase.');
  if(p.extras.completionDate!==null&&(!Number.isFinite(complete)||complete<start||complete>end))throw Error('Completion must be between purchase and refinance.');
 }
 for(const [idx,o] of p.options.entries()){
  if(typeof o.name!=='string')throw Error('Invalid option name.');
  const skip=['name','bridgeMode','draws','interestFrequency','compound','rolledInterest','rolledFees','equityMode','equityContributions'];
  for(const [k,v] of Object.entries(o))if(!skip.includes(k))check(v,k,['principalOverride','retainedInterest','retainedFees','arrangementFee','exitFee','brokerFee','monitoringFee','fundingLegalFee','extensionFee','equityOverride'].includes(k));
  for(const k of ['purchaseLtv','buildFunding','averageDrawnPercent'])if(o[k]>100)throw Error(`${k} must be between 0 and 100.`);
  if(o.months>600)throw Error('Bridge term must be at most 600 months.');
  if(!['full','average','schedule'].includes(o.bridgeMode)||!['monthly','annual'].includes(o.interestFrequency)||!['estimated','actual'].includes(o.equityMode))throw Error('Invalid finance mode.');
  if(o.bridgeMode==='schedule'&&o.draws.length===0)throw Error('Enter and apply a drawdown ledger before choosing schedule mode.');
  for(const k of ['compound','rolledInterest','rolledFees'])if(typeof o[k]!=='boolean')throw Error(`Invalid ${k}.`);
  for(const k of ['draws','equityContributions']){if(!Array.isArray(o[k])||o[k].length>500)throw Error(`Invalid ${k} ledger.`);for(const row of o[k]){check(row.amount,k+' amount');check(row.month,k+' month');}}
  const duration=toFinancialInput(p,idx).bridge.duration;
  if(o.draws.some(d=>d.month>duration)||o.equityContributions.some(d=>d.month>duration))throw Error('Drawdown month must be within the bridge term.');
  if(o.principalOverride!==null&&o.principalOverride>p.purchase*o.purchaseLtv/100+p.build*o.buildFunding/100+0.005)throw Error('Drawn principal cannot exceed the facility limit.');
 }
 return structuredClone(p);
}
