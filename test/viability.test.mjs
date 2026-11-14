import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,toFinancialInput,validate} from '../dist/model.js';
import {financialMetrics} from '../dist/financial.js';
import {viabilityDefaults,validateViability,assessDeal,downsideInput,recoveryThreshold} from '../dist/viability.js';
import {viabilityMarkup,viabilityEditor,fundingMarkup} from '../dist/viability-ui.js';
import {mapTemplate} from '../dist/xlsx.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);
const input=()=>toFinancialInput(defaults());
function ready(){const c=viabilityDefaults();c.equityPolicy='allowModelled';for(const g of Object.values(c.options[0].gates))g.status='confirmed';c.options[0].committedEquity=1000000;c.options[0].cashBuffer=20000;return c;}
test('worked fixture uses canonical costs, waterfall, DSCR and cash flow',()=>{
 const i=input();i.valuationMode='manual';i.manualValuation=907000;i.managementRate=0;i.fixedMonthlyExpenses={all:1600};i.paymentOverride=2834.375;
 const r=assessDeal(i);
 near(r.base.totalProjectCost,679543.75);near(r.base.developmentUplift,227456.25);near(r.base.profitOnCost,227456.25/679543.75);
 near(r.base.grossRefinanceLoan,680250);near(r.base.cashLeftInDeal,-706.25);near(r.minimumGdvForFullRecovery,906058.3333333333);near(r.gdvHeadroom,941.6666666667);
 near(r.base.noi,67200);near(r.base.annualDebtService,34012.5);near(r.base.dscr,67200/34012.5);near(r.base.monthlyCashFlow,2765.625);
 assert.equal(r.finalDecision,'REVIEW');assert.equal(r.criteria.find(c=>c.key==='recycled').status,'pass');assert.equal(r.criteria.find(c=>c.key==='stress').status,'unknown');
});
test('weights, thresholds, policies, bands and evidence validate strictly',()=>{
 assert.deepEqual(validateViability(viabilityDefaults()),viabilityDefaults());
 for(const mutate of [c=>c.weights.profit=-1,c=>c.weights.profit=NaN,c=>c.weights.profit=21,c=>c.thresholds.dscr=-1,c=>c.thresholds.cashflow=Infinity,c=>c.thresholds.recycled=101,c=>c.bands.go=39,c=>c.downside.gdvDrop=101,c=>c.options[0].gates.funding.status='yes',c=>c.options[0].gates.funding.date='2026-02-30']){const c=viabilityDefaults();mutate(c);assert.throws(()=>validateViability(c));}
});
test('optional evidence never changes the financial screen and remains independent for each option',()=>{
 const c=ready(),i=input();let r=assessDeal(i,c);assert.equal(r.score,100);assert.equal(r.finalDecision,'GO');
 c.options[0].gates.valuation.status='unknown';assert.equal(assessDeal(i,c).finalDecision,'GO');
 c.options[0].gates.funding.status='failed';assert.equal(assessDeal(i,c).finalDecision,'GO');assert.equal(assessDeal(i,c,1).finalDecision,'GO');assert.equal(c.options[1].gates.funding.status,'unknown');
});
test('financial score applies configurable bands, unknown criteria earn no points',()=>{
 const c=ready();c.thresholds.cashflow=999999;c.thresholds.profit=999;const r=assessDeal(input(),c);assert.equal(r.score,60);assert.equal(r.finalDecision,'REVIEW');
 c.thresholds.recycled=100;c.thresholds.dscr=999;c.options[0].committedEquity=0;assert.equal(assessDeal(input(),c).finalDecision,'REVIEW');
 c.thresholds.recycled=100;c.downside.rentDrop=100;assert.equal(assessDeal(input(),c).finalDecision,'NO_GO');
 const u=assessDeal(input());assert.ok(u.score<=100);assert.ok(u.criteria.filter(c=>c.status==='unknown').every(c=>c.points===0));
});
test('zero/invalid costs, missing GDV, zero equity and invalid LTV never produce invalid ratios',()=>{
 const zero=input();for(const k of Object.keys(zero.costs))zero.costs[k]=0;Object.assign(zero.bridge,{principal:0,facilityLimit:0,fixedFees:0});
 assert.equal(assessDeal(zero).minimumGdvForFullRecovery,null);assert.equal(assessDeal(zero).finalDecision,'REVIEW');
 const negative=input();negative.costs['Build budget']=-1;assert.equal(assessDeal(negative).base,null);
 const missing=input();missing.valuationMode='manual';missing.manualValuation=null;assert.equal(assessDeal(missing).minimumGdvForFullRecovery,null);
 const equity=input();equity.equityOverride=0;assert.equal(assessDeal(equity,ready()).capitalRecycledPercent,null);
 for(const ltv of [0,-.1,NaN]){const i=input();i.ltv=ltv;const r=assessDeal(i);assert.equal(r.minimumGdvForFullRecovery,null);assert.equal(r.finalDecision,'REVIEW');}
});
test('zero debt requires explicit policy; negative NOI always fails DSCR',()=>{
 const i=input(),c=ready();i.mortgageRate=0;let r=assessDeal(i,c);assert.equal(r.base.dscr,null);assert.equal(r.criteria[3].status,'unknown');
 c.zeroDebtPolicy='passPositiveNoi';assert.equal(assessDeal(i,c).criteria[3].status,'pass');i.fixedMonthlyExpenses={all:99999};assert.equal(assessDeal(i,c).criteria[3].status,'fail');
});
test('recovery fees counted once, caps and overrides explicit',()=>{
 const i=input();i.advanceFees=5000;i.closingCosts=2000;let r=financialMetrics(i),t=recoveryThreshold(i,r);near(t.minimumGdvForFullRecovery,r.totalProjectCost/i.ltv);
 const solved=structuredClone(i);solved.valuationMode='manual';solved.manualValuation=t.minimumGdvForFullRecovery;near(financialMetrics(solved).cashLeftInDeal,0);
 i.maxLoan=100;assert.match(recoveryThreshold(i).reason,/cap/);i.maxLoan=null;i.actualLoan=600000;assert.match(recoveryThreshold(i).reason,/override/);i.actualLoan=null;i.refinanceValuation=907000;assert.match(recoveryThreshold(i).reason,/separate/);
});
test('actual ledger, retained/paid/rolled bridge and debt reconcile at recovery threshold',()=>{
 const i=input();i.bridge.retainedInterest=1000;i.bridge.rolledFees=false;i.otherDebt=2000;i.equityMode='actual';i.equityContributions=[{month:0,amount:210000}];i.advanceFees=3000;
 const r=assessDeal(i,ready());assert.equal(r.equityVerified,true);const j=structuredClone(i);j.valuationMode='manual';j.manualValuation=r.minimumGdvForFullRecovery;near(financialMetrics(j).cashLeftInDeal,0);
 assert.ok(r.capitalRecycledPercent!==r.base.grossRefinanceLoan/210000*100);
});
test('cash extracted above 100% is displayed but score capped at 100%',()=>{
 const i=input();i.valuationMode='manual';i.manualValuation=2000000;const r=assessDeal(i,ready());assert.ok(r.capitalRecycledPercent>100);assert.equal(r.criteria[1].points,30);assert.ok(r.score<=100);
});
test('downside is immutable and independent shocks move canonical financials correctly',()=>{
 const i=input(),before=structuredClone(i),c=ready(),r=assessDeal(i,c),d=r.downside;
 assert.deepEqual(i,before);near(d.gdv,r.base.gdv*.9);near(d.grossAnnualRent,r.base.grossAnnualRent*.9);assert.ok(d.grossRefinanceLoan<r.base.grossRefinanceLoan);assert.ok(d.profitOnCost<r.base.profitOnCost);assert.ok(d.monthlyCashFlow<r.base.monthlyCashFlow);assert.ok(d.bridge.cost>r.base.bridge.cost);
 assert.equal(d.bridge.principal,r.base.bridge.principal);assert.ok(d.fundingRequirement>r.base.fundingRequirement);
 const onlyCosts={...c.downside,gdvDrop:0,buildIncrease:0,rentDrop:0,ltvDrop:0,extraMonths:0};const op=financialMetrics(downsideInput(i,onlyCosts));assert.ok(op.noi<r.base.noi);assert.ok(op.dscr<r.base.dscr);
 const di=downsideInput(i,{...onlyCosts,operatingIncrease:0,gdvDrop:10});assert.ok(recoveryThreshold(di).gdvHeadroom<r.gdvHeadroom);
});
test('downside cash-flow points ignore optional funds and flag fixed debt overrides',()=>{
 const c=ready(),i=input();let r=assessDeal(i,c);assert.equal(r.criteria[4].status,'pass');c.options[0].committedEquity=r.requiredFunds-1;assert.equal(assessDeal(i,c).criteria[4].status,'pass');
 c.options[0].cashBuffer=null;assert.equal(assessDeal(i,c).criteria[4].status,'pass');i.paymentOverride=1000;assert.match(assessDeal(i,c).criteria[4].explanation,/override/);assert.equal(assessDeal(i,c).fundingStatus,'not_assessed');
});
test('migration preserves old deals and JSON roundtrip retains settings/evidence',()=>{
 const old=defaults();delete old.viability;const p=validate(old);assert.deepEqual(p.viability,viabilityDefaults());
 p.viability.thresholds.cashflow=1700;p.viability.options[1].gates.lender={status:'confirmed',notes:'Terms reviewed',evidence:'Offer reference',date:'2026-11-14'};
 assert.deepEqual(validate(JSON.parse(JSON.stringify(p))),p);assert.deepEqual(validate(defaults()),defaults());
});
test('monthly holding allowance survives a zero-month base term for downside',()=>{
 const p=defaults();p.options[0].months=0;p.extras.monthlyHolding=1000;const i=toFinancialInput(p),d=downsideInput(i,viabilityDefaults().downside);near(d.holding,3000);
});
test('semantic summary shows financial-only labels, estimated recycling and accessible score',()=>{
 const r=assessDeal(input()),html=viabilityMarkup(r,'Option A <script>');
 assert.match(html,/aria-label="Financial screen score"/);assert.match(html,/<progress value="100" max="100"/);assert.match(html,/GO candidate/);assert.match(html,/Estimated capital recycled/);assert.match(html,/-£856/);assert.match(html,/scope="row"/);assert.match(html,/How calculated/);assert.match(html,/Option A &lt;script&gt;/);assert.doesNotMatch(html,/<script>|NaN|Infinity|Investment readiness|mandatory gates confirmed|Unknown evidence prevents GO/);
 const i=input();i.valuationMode='manual';i.manualValuation=null;i.equityOverride=0;const missing=viabilityMarkup(assessDeal(i),'Missing values');assert.match(missing,/N\/A/);assert.doesNotMatch(missing,/NaN|Infinity/);
});
test('spreadsheet import scores immediately with no evidence, contribution ledger or available funds',()=>{
 const cells={D4:'Purchase price',D9:'build',C4:295000,C5:19500,C6:7200,C7:6000,C8:1500,C9:250000,C10:60000,C11:5000,F7:1000,C15:'GDV CALCULATION',C16:900,C17:8,C21:10.5,F16:221250,F17:250000,F18:471250,F20:.025,G21:'4 months x 1.25% per month',C23:907200,C24:680400,F5:34020,I16:.08,J16:'Management rate'};
 const p=mapTemplate([{name:'A',cells}],defaults).project,r=assessDeal(toFinancialInput(p),p.viability);
 assert.equal(r.score,100);assert.equal(r.finalDecision,'GO');assert.equal(r.incomplete,false);assert.equal(r.equityVerified,false);assert.equal(r.fundingStatus,'not_assessed');assert.ok(r.criteria.every(c=>c.status==='pass'));assert.equal(p.viability.options[0].committedEquity,null);
});
test('funding coverage, gaps, zero funds, buffer and refinance top-up remain separate from score',()=>{
 const i=input(),c=viabilityDefaults(),start=assessDeal(i,c);near(start.requiredFunds,197950);assert.equal(start.cashBuffer,0);
 for(const [available,status] of [[null,'not_assessed'],[0,'gap'],[197949,'gap'],[197950,'covered'],[300000,'covered']]){c.options[0].committedEquity=available;const r=assessDeal(i,c);assert.equal(r.fundingStatus,status);assert.equal(r.score,start.score);assert.equal(r.finalDecision,start.finalDecision);}
 c.options[0].committedEquity=197950;c.options[0].cashBuffer=5000;let r=assessDeal(i,c);near(r.fundingGap,5000);near(r.requiredFunds,202950);assert.match(fundingMarkup(r),/Funding gap/);
 c.options[0].cashBuffer=null;r=assessDeal(i,c);near(r.requiredFunds,start.requiredFunds);assert.match(fundingMarkup(r),/no additional buffer assumed/);
 c.downside.gdvDrop=70;r=assessDeal(i,c);assert.ok(r.downside.additionalCashRequired>0);near(r.requiredFunds,Math.max(0,r.downside.fundingRequirement)+r.downside.additionalCashRequired);
});
test('estimated equity works despite preserved legacy requireActual policy; actual ledger is still respected',()=>{
 const i=input(),c=viabilityDefaults();c.equityPolicy='requireActual';let r=assessDeal(i,c);assert.equal(r.criteria[1].status,'pass');assert.equal(r.score,100);
 i.equityMode='actual';i.equityContributions=[];r=assessDeal(i,c);assert.equal(r.capitalRecycledPercent,null);assert.equal(r.criteria[1].status,'unknown');assert.equal(r.finalDecision,'REVIEW');
 i.equityContributions=[{month:0,amount:250000}];r=assessDeal(i,c);near(r.capitalRecycledPercent,r.base.cashReturnedToInvestor/250000*100);assert.equal(r.equityVerified,true);assert.match(viabilityMarkup(r,'Actual'),/Capital recycled \(actual ledger\)/);
});
test('legacy configuration, optional funding and evidence roundtrip unchanged',()=>{
 const p=defaults();p.viability.equityPolicy='requireActual';p.viability.options[0].cashBuffer=null;p.viability.options[0].committedEquity=250000;p.viability.thresholds.profit=25;p.viability.downside.gdvDrop=15;p.viability.weights={profit:25,recycled:25,cashflow:20,dscr:15,stress:15};p.viability.options[0].gates.valuation={status:'failed',notes:'Keep original notes',evidence:'Original reference',date:'2026-11-14'};
 const loaded=validate(JSON.parse(JSON.stringify(p)));assert.deepEqual(loaded,p);assert.equal(assessDeal(toFinancialInput(loaded),loaded.viability).finalDecision,'GO');
 const html=viabilityEditor(loaded.viability,0,'Option <A>');assert.match(html,/Optional due diligence checklist/);assert.match(html,/Keep original notes/);assert.match(html,/Original reference/);assert.match(html,/2026-11-14/);assert.match(html,/Option &lt;A&gt;/);assert.doesNotMatch(html,/data-v-detail="gates" open|Equity evidence policy/);
});
