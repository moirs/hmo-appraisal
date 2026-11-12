export const defaults = () => ({version:1,name:'Eight-room HMO conversion',purchase:295000,stamp:19500,architect:7200,build:250000,projectFee:60000,misc:5000,rooms:8,rent:900,occupancy:100,bills:1000,management:8,multiplier:10.5,valuationOverride:null,refinanceLtv:75,mortgageRate:5,options:[{name:'Option A',legal:6000,valuation:1500,purchaseLtv:75,buildFunding:100,monthlyRate:1.25,fees:2.5,months:4},{name:'Option B',legal:3000,valuation:2500,purchaseLtv:75,buildFunding:100,monthlyRate:1,fees:2,months:4}]});
export function calculate(p,index=0,rentChange=0,delay=0){
 const o=p.options[index],fullRent=p.rent*p.rooms*(1+rentChange/100),collectedRent=fullRent*p.occupancy/100,annualRent=fullRent*12;
 const calculatedValue=annualRent*p.multiplier,value=p.valuationOverride===null?calculatedValue:p.valuationOverride;
 const refinance=value*p.refinanceLtv/100,mortgage=refinance*p.mortgageRate/100/12,management=collectedRent*p.management/100;
 const cost=p.purchase+p.stamp+p.architect+o.legal+o.valuation+p.build+p.projectFee+p.misc;
 const borrowed=p.purchase*o.purchaseLtv/100+p.build*o.buildFunding/100;
 const duration=o.months+delay,bridge=borrowed*(o.fees/100+duration*o.monthlyRate/100);
 const allIn=cost+bridge,surplus=refinance-allIn;
 const initial=cost-borrowed,cashReturned=refinance-borrowed-bridge;
 const left=initial-cashReturned,remaining=Math.max(0,left),extraReleased=Math.max(0,-left),net=collectedRent-management-p.bills-mortgage;
 // User-defined income recovery basis, independent of cash returned at refinance.
 const recoveryCash=p.purchase*0.25+p.stamp+p.architect+o.legal+o.valuation+p.projectFee;
 const monthsToAllOut=recoveryCash<0.005?0:net>0?recoveryCash/net:null;
 const cashbackBeforeBridge=refinance-cost,equity=value-refinance;
 return {fullRent,collectedRent,annualRent,calculatedValue,value,refinance,mortgage,management,cost,borrowed,duration,bridge,allIn,surplus,initial,left,remaining,extraReleased,cashReturned,recoveryCash,monthsToAllOut,cashbackBeforeBridge,equity,net,extraInterest:borrowed*o.monthlyRate/100*delay,delay};
}
export function validate(p){
 if(!p||p.version!==1||typeof p.name!=='string'||!Array.isArray(p.options)||p.options.length!==2)throw Error('This is not a supported HMO project file.');
 const base=defaults();
 for(const k of Object.keys(base))if(typeof base[k]==='number'&&(!Number.isFinite(p[k])||p[k]<0))throw Error(`Invalid ${k}.`);
 if(!Number.isInteger(p.rooms)||p.rooms<1)throw Error('Room count must be a positive whole number.');
 for(const k of ['occupancy','management','refinanceLtv'])if(p[k]>100)throw Error(`${k} must be between 0 and 100.`);
 if(p.valuationOverride!==null&&(!Number.isFinite(p.valuationOverride)||p.valuationOverride<=0))throw Error('The valuation override must be positive or blank.');
 for(const o of p.options){if(typeof o.name!=='string')throw Error('Invalid option name.');for(const k of Object.keys(base.options[0]))if(k!=='name'&&(!Number.isFinite(o[k])||o[k]<0))throw Error(`Invalid finance input: ${k}.`);for(const k of ['purchaseLtv','buildFunding'])if(o[k]>100)throw Error(`${k} must be between 0 and 100.`);}
 return structuredClone(p);
}
