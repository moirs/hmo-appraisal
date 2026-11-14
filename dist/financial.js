/** Pure GBP calculations. All rates in this module are decimal fractions. */
/** @typedef {{month:number, amount:number}} CashEntry */
/** @typedef {{facilityLimit:number, principal:number, duration:number, monthlyRate:number, mode:'full'|'average'|'schedule', draws:CashEntry[], averageFraction:number, compound:boolean, feeRate:number, fixedFees:number, retainedInterest:number, retainedFees:number, rolledInterest:boolean, rolledFees:boolean}} BridgeInput */
/** @typedef {{developmentDuration?:number, costs:Record<string,number>, holding:number, grossMonthlyRent:number, occupancy:number, managementRate:number, managementOverride:number|null, variableRate:number, fixedMonthlyExpenses:Record<string,number>, reserves:number, multiplier:number, valuationMode:'manual'|'multiplier', manualValuation:number|null, refinanceValuation:number|null, bridge:BridgeInput, equityMode:'estimated'|'actual', equityContributions:CashEntry[], equityOverride:number|null, ltv:number, actualLoan:number|null, maxLoan:number|null, valuationHaircut:number, advanceFees:number, closingCosts:number, otherDebt:number, otherSecuredDebt:number, mortgageRate:number, mortgageType:'interestOnly'|'repayment', amortisationYears:number, paymentOverride:number|null, otherMonthlyDebt:number, recoveryCash:number}} FinancialInput */
/** @param {number} a @param {number} b @returns {number|null} */
export const ratio=(a,b)=>b>0?a/b:null;
/** @param {number} principal @param {number} annualRate @param {'interestOnly'|'repayment'} type @param {number} years @returns {number} */
export function mortgagePayment(principal,annualRate,type='interestOnly',years=25){
 if(principal===0)return 0;
 if(type==='interestOnly')return principal*annualRate/12;
 const n=years*12,r=annualRate/12;
 return r===0?principal/n:principal*r/(-Math.expm1(-n*Math.log1p(r)));
}
/** @param {BridgeInput} b */
export function bridgeFinance(b){
 if([b.facilityLimit,b.principal,b.duration,b.monthlyRate,b.averageFraction,b.feeRate,b.fixedFees,b.retainedInterest,b.retainedFees].some(v=>!Number.isFinite(v)||v<0))throw Error('Bridge inputs must be non-negative and finite.');
 if(b.draws.some(d=>!Number.isFinite(d.month)||!Number.isFinite(d.amount)||d.month<0||d.month>b.duration||d.amount<0))throw Error('Each drawdown must have a valid month within the term and a non-negative amount.');
 const draws=b.mode==='schedule'?b.draws:[{month:0,amount:b.principal}];
 const principal=draws.reduce((sum,d)=>sum+d.amount,0);
 const interest=draws.reduce((sum,d)=>{const months=Math.max(0,b.duration-d.month),balance=d.amount*(b.mode==='average'?b.averageFraction:1);return sum+balance*(b.compound?Math.expm1(months*Math.log1p(b.monthlyRate)):months*b.monthlyRate);},0);
 const fees=principal*b.feeRate+b.fixedFees;
 if(!Number.isFinite(interest+fees))throw Error('Finance assumptions produce an amount outside the supported numeric range.');
 if(b.retainedInterest>interest+0.005)throw Error('Retained interest exceeds the calculated interest cost.');
 if(b.retainedFees>fees+0.005)throw Error('Retained fees exceed the calculated fee cost.');
 if(principal>b.facilityLimit+0.005)throw Error('Bridge drawdowns exceed the facility limit.');
 if(b.retainedInterest+b.retainedFees>principal+0.005)throw Error('Bridge retentions exceed drawn principal.');
 const netAdvance=principal-b.retainedInterest-b.retainedFees;
 const unretainedInterest=interest-b.retainedInterest,unretainedFees=fees-b.retainedFees;
 const paidInterest=b.rolledInterest?0:unretainedInterest,paidFees=b.rolledFees?0:unretainedFees;
 const rolledInterest=b.rolledInterest?unretainedInterest:0,rolledFees=b.rolledFees?unretainedFees:0;
 return {facilityLimit:b.facilityLimit,principal,netAdvance,interest,fees,cost:interest+fees,paidInterest,paidFees,rolledInterest,rolledFees,redemption:principal+rolledInterest+rolledFees,retainedInterest:b.retainedInterest,retainedFees:b.retainedFees,duration:b.duration};
}
/** An explicit equity/debt ledger and stabilised operating model.
 * @param {FinancialInput} i */
export function financialMetrics(i){
 const verify=value=>{if(typeof value==='number'&&(!Number.isFinite(value)||value<0))throw Error('Financial inputs must be non-negative and finite.');if(value&&typeof value==='object')Object.values(value).forEach(verify);};verify(i);
 if(i.occupancy>1||i.ltv>1||i.managementRate>1||i.variableRate>1)throw Error('Occupancy, LTV and operating rates must be between zero and one.');
 const baseProjectCost=Object.values(i.costs).reduce((a,b)=>a+b,0),bridge=bridgeFinance(i.bridge);
 const totalProjectCost=baseProjectCost+bridge.cost+i.holding+i.advanceFees+i.closingCosts;
 const grossAnnualRent=i.grossMonthlyRent*12,effectiveAnnualRent=grossAnnualRent*i.occupancy;
 const indicativeGDV=grossAnnualRent*i.multiplier;
 const gdv=i.valuationMode==='manual'?i.manualValuation:indicativeGDV;
 const endValue=i.refinanceValuation??gdv;
 const supportedRefinanceValue=endValue===null?null:endValue*(1-i.valuationHaircut);
 const targetLoan=supportedRefinanceValue===null?null:supportedRefinanceValue*i.ltv;
 const grossRefinanceLoan=i.actualLoan??(targetLoan===null?null:i.maxLoan===null?targetLoan:Math.min(targetLoan,i.maxLoan));
 const netRefinanceFunds=grossRefinanceLoan===null?null:grossRefinanceLoan-i.advanceFees;
 const cashAvailableAtRefinance=netRefinanceFunds===null?null:netRefinanceFunds-bridge.redemption-i.otherDebt-i.closingCosts;
 const estimatedEquity=baseProjectCost+i.holding+bridge.paidInterest+bridge.paidFees-bridge.netAdvance;
 const totalEquityCashInjected=i.equityMode==='actual'?(i.equityContributions.length?i.equityContributions.reduce((sum,c)=>sum+c.amount,0):null):(i.equityOverride??estimatedEquity);
 const cashLeftInDeal=totalEquityCashInjected===null||cashAvailableAtRefinance===null?null:totalEquityCashInjected-cashAvailableAtRefinance;
 const cashReturnedToInvestor=cashAvailableAtRefinance===null?null:Math.max(0,cashAvailableAtRefinance);
 const additionalCashRequired=cashAvailableAtRefinance===null?null:Math.max(0,-cashAvailableAtRefinance);
 const capitalRecycled=totalEquityCashInjected===null||cashAvailableAtRefinance===null?null:ratio(cashAvailableAtRefinance,totalEquityCashInjected);
 const fixedAnnual=Object.values(i.fixedMonthlyExpenses).reduce((a,b)=>a+b,0)*12;
 const management=i.managementOverride===null?effectiveAnnualRent*i.managementRate:i.managementOverride*12;
 const variableAnnual=effectiveAnnualRent*i.variableRate+(i.managementOverride===null?management:0);
 const operatingFixed=fixedAnnual+(i.managementOverride??0)*12;
 const annualOperatingExpenses=operatingFixed+variableAnnual,noi=effectiveAnnualRent-annualOperatingExpenses;
 const calculatedPayment=grossRefinanceLoan===null?null:mortgagePayment(grossRefinanceLoan,i.mortgageRate,i.mortgageType,i.amortisationYears);
 const monthlyMortgage=i.paymentOverride??calculatedPayment;
 const annualDebtService=monthlyMortgage===null?null:(monthlyMortgage+i.otherMonthlyDebt)*12;
 const annualCashFlow=annualDebtService===null?null:noi-annualDebtService-i.reserves*12;
 const monthlyCashFlow=annualCashFlow===null?null:annualCashFlow/12;
 const developmentUplift=gdv===null?null:gdv-totalProjectCost;
 const breakEvenOccupancy=annualDebtService===null?null:ratio(operatingFixed+annualDebtService,grossAnnualRent*(1-i.variableRate-(i.managementOverride===null?i.managementRate:0)));
 const equityAfterRefinance=endValue===null||grossRefinanceLoan===null?null:endValue-grossRefinanceLoan-i.otherSecuredDebt;
 const monthsToAllOut=i.recoveryCash<0.005?0:monthlyCashFlow!==null&&monthlyCashFlow>0?i.recoveryCash/monthlyCashFlow:null;
 return {baseProjectCost,totalProjectCost,developmentUplift,profitOnCost:developmentUplift===null?null:ratio(developmentUplift,totalProjectCost),profitOnGDV:developmentUplift===null||gdv===null?null:ratio(developmentUplift,gdv),fundingRequirement:estimatedEquity,developmentDuration:i.developmentDuration??i.bridge.duration,gdv,indicativeGDV,refinanceValuation:endValue,supportedRefinanceValue,targetLoan,grossRefinanceLoan,netRefinanceFunds,cashAvailableAtRefinance,cashReturnedToInvestor,additionalCashRequired,totalEquityCashInjected,estimatedEquity,cashLeftInDeal,capitalRecycled,equityAfterRefinance,bridge,grossAnnualRent,effectiveAnnualRent,annualOperatingExpenses,fixedAnnualExpenses:operatingFixed,variableAnnualExpenses:variableAnnual,managementMonthly:management/12,noi,grossYield:gdv===null?null:ratio(grossAnnualRent,gdv),netOperatingYield:gdv===null?null:ratio(noi,gdv),annualDebtService,monthlyMortgage,calculatedPayment,annualCashFlow,monthlyCashFlow,dscr:annualDebtService===null?null:ratio(noi,annualDebtService),cashOnCash:cashLeftInDeal!==null&&annualCashFlow!==null?ratio(annualCashFlow,cashLeftInDeal):null,breakEvenOccupancy,monthsToAllOut};
}
