import {renderMetrics,advancedInputs,setupSensitivity,renderSensitivity,comparison} from './metrics-ui.js';
import {defaults,calculate,validate} from './model.js';
import {readWorkbook,mapTemplate} from './xlsx.js';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n===null||!Number.isFinite(n)?'N/A':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
const precise=n=>n===null||!Number.isFinite(n)?'N/A':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const compact=n=>(n<0?'−':'')+'£'+(Math.abs(n)>=1000?(Math.abs(n)/1000).toFixed(Math.abs(n)>=100000?0:1)+'k':Math.abs(n).toFixed(0));
const signed=n=>(n>0?'+':'')+n+'%';
const months=n=>n===null?'Not available':n.toFixed(1)+' months';
const cashState=v=>v===null?'not available':Math.abs(v)<0.005?'all cash recovered':v>0?'remaining':'released';
const cashText=(v,format=money)=>v===null?'N/A':`${format(Math.abs(v))} ${cashState(v)}`;
const metricText=(k,v)=>k==='monthsToAllOut'?months(v):k==='left'?cashText(v):money(v);
const metricMarkup=(k,v)=>v===null?'N/A':k==='left'?`<span class="cash-amount">${money(Math.abs(v))}</span><small class="cash-state">${cashState(v)}</small>`:metricText(k,v);
const key='hmo-appraisal-v1';let project=defaults(),active=0,tab='property',shift=0,delay=0,stress={};
try{const saved=localStorage.getItem(key);if(saved)project=validate(JSON.parse(saved));}catch{try{localStorage.setItem(key+'-backup',localStorage.getItem(key)||'');}catch{}}
function notice(message,error=false){const n=$('#notice');n.textContent=message;n.classList.toggle('error',error);n.hidden=false;}
function persist(){try{localStorage.setItem(key,JSON.stringify(project));$('.privacy').innerHTML='<i></i> Saved on this device';}catch{$('.privacy').textContent='Use Save project to keep changes';}}
const field=(path,label,{unit='£',step='any',min=0,max='',hint='',optional=false}={})=>{
 const parts=path.split('.');let val=project;for(const p of parts)val=val[p];
 return `<label class="field"><span>${label}</span><div class="input-wrap">${unit==='£'?'<b>£</b>':''}<input type="number" data-path="${path}" aria-label="${label}" value="${val??''}" min="${optional?'0.01':min}" ${max!==''?`max="${max}"`:''} step="${step}" ${optional?'':'required'} class="${unit==='£'?'money':unit?'has-suffix':''}" placeholder="${optional?'Use calculated value':''}">${unit&&unit!=='£'?`<b class="suffix">${unit}</b>`:''}</div>${hint?`<small>${hint}</small>`:''}</label>`;
};
function renderInputs(){
 let html='';
 if(tab==='property')html=`<div class="field-section">Acquisition</div>${field('purchase','Purchase price')}${field('stamp','Stamp duty')}${field('architect','Architects & design')}<div class="field-section">Conversion</div>${field('build','Build cost')}${field('projectFee','Project / Habiti fee')}${field('misc','Miscellaneous allowance')}<div class="small">Legal and valuation fees differ by finance option. Edit them under Finance.</div>`;
 if(tab==='income')html=`<div class="field-section">Letting assumptions</div><div class="field-row">${field('rooms','Rooms',{unit:'',step:1,min:1})}${field('rent','Rent / room / month')}</div>${field('occupancy','Occupancy',{unit:'%',max:100,hint:'Affects collected rent, not the valuation.'})}${field('management','Management charge',{unit:'%',max:100,hint:'Percentage of rent actually collected.'})}${field('bills','Monthly bills')}<div class="field-section">Refinance valuation</div>${field('multiplier','Annual rent multiplier',{unit:'×'})}${field('valuationOverride','Manual valuation (preserved)',{optional:true,hint:'Used in Manual valuation mode. Clear it or switch modes without overwriting the stored assumption.'})}${field('refinanceLtv','Refinance loan-to-value',{unit:'%',max:100})}${field('mortgageRate','Mortgage annual interest',{unit:'%',hint:'Annual nominal rate. Payment type and override are set below.'})}`;
 if(tab==='finance')html=`<div class="small" style="padding-top:16px;line-height:1.7">Simple interest on the full loan from day one. Fees are a combined entry and exit percentage.</div>`+project.options.map((o,i)=>`<div class="finance-option-title">${esc(o.name)}</div><div class="field-section">Borrowing</div>${field(`options.${i}.purchaseLtv`,'Purchase loan-to-value',{unit:'%',max:100})}${field(`options.${i}.buildFunding`,'Build cost funded',{unit:'%',max:100})}<div class="field-row">${field(`options.${i}.monthlyRate`,'Monthly interest',{unit:'%'})}${field(`options.${i}.fees`,'Combined fees',{unit:'%'})}</div>${field(`options.${i}.months`,'Planned bridging term',{unit:'mo',step:1})}<div class="field-row">${field(`options.${i}.legal`,'Legal fees')}${field(`options.${i}.valuation`,'Valuation fee')}</div>`).join('');
 $('#inputPanel').innerHTML=html+advancedInputs(project,tab);
 if(tab==='finance')for(const el of document.querySelectorAll('[data-path$="monthlyRate"]')){el.setAttribute('aria-label','Bridge interest rate '+project.options[Number(el.dataset.path.split('.')[1])].name);el.closest('label').querySelector('span').textContent='Bridge interest rate';}
 $$('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===tab));b.tabIndex=b.dataset.tab===tab?0:-1;});
}
function deltaText(now,base,unit=''){const diff=now-base;return Math.abs(diff)<.01?'Base case'+unit:`${diff>0?'+':'−'}${money(Math.abs(diff))} versus base${unit}`;}
function lineChart(){
 const changes=[...new Set([-10,0,10,shift])].sort((a,b)=>a-b),data=changes.map(c=>({change:c,value:calculate(project,active,c,delay,stress).left}));
 if(data.some(d=>d.value===null))return '<p class="small">Enter a valuation and equity contribution ledger to display this chart.</p>';
 const w=450,h=210,l=110,right=28,t=20,b=34,pw=w-l-right,ph=h-t-b;
 let lo=Math.min(...data.map(d=>d.value)),hi=Math.max(...data.map(d=>d.value));const pad=Math.max((hi-lo)*.18,1000);lo-=pad;hi+=pad;
 const xmin=Math.min(...changes),xmax=Math.max(...changes),x=n=>l+(n-xmin)/(xmax-xmin)*pw,y=n=>t+(hi-n)/(hi-lo)*ph;
 let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Cash remaining or released at different room rents"><title>Cash remaining in the deal or extra cash released at refinance</title>`;
 for(let i=0;i<4;i++){const v=lo+(hi-lo)*i/3,py=y(v);svg+=`<line x1="${l}" x2="${w-right}" y1="${py}" y2="${py}" stroke="#e8ede4"/><text x="${l-10}" y="${py+4}" text-anchor="end" font-size="10" fill="#8a9584">${cashText(v,compact)}</text>`;}
 if(lo<0&&hi>0)svg+=`<line x1="${l}" x2="${w-right}" y1="${y(0)}" y2="${y(0)}" stroke="#93a58b" stroke-dasharray="4 4"/><text x="${l+4}" y="${y(0)-5}" font-size="9" fill="#71806c">All cash recovered</text>`;
 svg+=`<path d="M ${x(data[0].change)} ${y(data[0].value)} ${data.slice(1).map(d=>`L ${x(d.change)} ${y(d.value)}`).join(' ')}" fill="none" stroke="#2c694f" stroke-width="2.5"/>`;
 for(const d of data){svg+=`<circle cx="${x(d.change)}" cy="${y(d.value)}" r="${d.change===shift?6:4}" fill="${d.change===shift?'#285f47':'white'}" stroke="#285f47" stroke-width="2"><title>${signed(d.change)} rent: ${cashText(d.value,precise)}</title></circle><text x="${x(d.change)}" y="${h-9}" text-anchor="middle" font-size="10" fill="#7e8e78">${signed(d.change)}</text>`;}
 return svg+'</svg>';
}
function barChart(){
 const durations=[0,1,3,6],values=durations.map(d=>calculate(project,active,shift,d,stress).bridge),w=450,h=210,l=59,right=15,t=25,b=34,pw=w-l-right,ph=h-t-b,max=Math.max(...values,1)*1.2;
 let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Bridging costs for no delay and one, three, six extra months"><title>Total bridging cost by overrun</title>`;
 for(let i=0;i<4;i++){const v=max*i/3,y=t+ph-v/max*ph;svg+=`<line x1="${l}" x2="${w-right}" y1="${y}" y2="${y}" stroke="#e8ede4"/><text x="${l-10}" y="${y+4}" text-anchor="end" font-size="10" fill="#8a9584">${compact(v)}</text>`;}
 values.forEach((v,i)=>{const x=l+pw*(i+.5)/4,barH=v/max*ph;svg+=`<rect x="${x-22}" y="${t+ph-barH}" width="44" height="${barH}" rx="4" fill="${delay===durations[i]?'#b98859':'#e9d9c9'}"><title>${durations[i]} extra months: ${precise(v)}</title></rect><text x="${x}" y="${t+ph-barH-9}" text-anchor="middle" font-size="10" fill="#927354">${compact(v)}</text><text x="${x}" y="${h-9}" text-anchor="middle" font-size="10" fill="#7e8e78">${i===0?'No delay':'+'+durations[i]+' mo'}</text>`;});
 return svg+'</svg>';
}
function renderMatrix(){const metric=$('#matrixMetric').value;
 $('#matrix').innerHTML=`<table><thead><tr><th scope="col">Bridging overrun</th>${[-10,0,10].map(c=>`<th scope="col">${c===0?'Base rent':signed(c)+' rent'}<br><span class="small">${money(project.rent*(1+c/100))} / room</span></th>`).join('')}</tr></thead><tbody>${[0,1,3,6].map(d=>`<tr><td>${d===0?'No delay':'+'+d+' month'+(d>1?'s':'')}</td>${[-10,0,10].map(c=>{const v=calculate(project,active,c,d,stress)[metric];return `<td><button class="matrix-cell ${d===delay&&c===shift?'selected':''} ${((['net','surplus'].includes(metric)&&v<0)||(metric==='left'&&v>0)||(metric==='monthsToAllOut'&&v===null))?'negative':''}" data-cell-rent="${c}" data-cell-delay="${d}" title="${metric==='monthsToAllOut'?months(v):metric==='left'?cashText(v,precise):precise(v)}" aria-label="${signed(c)} rent, ${d} extra months: ${metricText(metric,v)}">${metricMarkup(metric,v)}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
 $('.matrix-panel .section-title p').textContent=$('#matrixMetric').selectedOptions[0].text+' · select a cell to explore';
 $('#cashGuide').hidden=metric!=='left';
}
function render(){const o=project.options[active],r=calculate(project,active,shift,delay,stress),base=calculate(project,active);
 $('#projectName').value=project.name;
 $$('[data-option]').forEach(b=>{b.classList.toggle('active',+b.dataset.option===active);b.setAttribute('aria-pressed',String(+b.dataset.option===active));});
 $$('[data-delay]').forEach(b=>{b.classList.toggle('active',+b.dataset.delay===delay);b.setAttribute('aria-pressed',String(+b.dataset.delay===delay));});
 $('#rentShift').value=shift;$('#rentShiftLabel').textContent=signed(shift);
 $('#financeSummary').textContent=`${o.monthlyRate}% / ${o.interestFrequency==='annual'?'year':'month'} · ${o.fees}% combined fees · ${r.duration.toFixed(1)}-month bridge assumption`;
 renderMetrics(project,active,r);$('#rentChart').innerHTML=lineChart();$('#bridgeChart').innerHTML=barChart();renderMatrix();comparison(project,shift,delay,stress);renderSensitivity(project,active);
 $('#activeStress').textContent=Object.keys(stress).length?'Temporary stress: '+Object.entries(stress).map(([k,v])=>k+' '+v).join(', '):'Baseline assumptions · rent and delay controls below';
 $('#calcAnnouncement').textContent='Updated: monthly cash flow '+money(r.net)+', cash left in deal '+cashText(r.left)+', DSCR '+(r.dscr===null?'not available':r.dscr.toFixed(2));
 $('#scenarioNote').textContent=`${money(project.rent*(1+shift/100))} per room · ${project.occupancy}% occupancy · ${money(r.collectedRent)} collected monthly. ${r.input.valuationMode==='multiplier'?'Indicative':'Manual'} valuation: ${money(r.value)}. ${delay?'Extra bridging interest: '+money(r.extraInterest)+'. ':''}Stabilised letting after completion (month ${r.developmentDuration.toFixed(1)} assumption). Bridge duration ${r.duration.toFixed(1)} months; development-period rental cash is not forecast.`;
 $('#methodology').innerHTML=`<p>Development metrics describe estimated value uplift, not realised sale profit. Rent-multiplier GDV is indicative. Manual GDV is held fixed when rents change. No planning, licensing or mortgage eligibility is inferred from room count.</p><p>Refinance uses an explicit ledger: net bridge cash advanced, finance paid during development, retained charges and rolled charges are tracked separately. Cash left in deal = equity cash injected − signed cash available at refinance. The estimate is not an actual cash-payment ledger until you enter contributions in Finance. Missing optional costs are treated as zero for estimates and remain marked not entered.</p><p>NOI excludes finance and mortgage principal. Cash flow deducts full debt service and separately entered reserves. DSCR is N/A with no debt service; cash-on-cash is N/A if cash left is zero or negative. Break-even occupancy uses management and other variable costs at full occupancy and excludes separate reserves. The red DSCR indicator means below 1.00×; no lending threshold is otherwise implied.</p><p>Your income-recovery measure remains: (25% purchase deposit + stamp duty + architects + solicitors + valuation + Habiti fee) ÷ monthly cash flow. It does not deduct cash returned at refinance. It measures income months after letting starts. Delays alone change the finance cost and calendar timing, not stabilised monthly income.</p><p>Click any metric’s question mark for its formula and contributing line items. All figures are GBP, before tax. Loan/payment overrides and entered actual equity ledgers stay fixed in sensitivity cases. Excel import reads stored values from the established Habiti layouts; it does not run Excel formulas. Uploaded files and saved scenarios remain on your device.</p>`;
}
function refresh(){renderInputs();render();persist();}
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset.path)return;if(!el.checkValidity()){notice('Please enter a valid value for '+el.getAttribute('aria-label')+'.',true);return;}
 const path=el.dataset.path.split('.'),candidate=structuredClone(project);let obj=candidate;for(const k of path.slice(0,-1))obj=obj[k];obj[path.at(-1)]=el.dataset.kind==='boolean'?el.checked:el.dataset.kind==='string'?el.value:el.dataset.kind==='date'?(el.value||null):el.value===''?null:Number(el.value);
 if(el.dataset.path==='refinanceLtv'&&'ltv' in stress){stress={...stress};delete stress.ltv;}
 if(el.dataset.path==='extras.valuationMode')candidate.extras.valuationModeExplicit=true;
 if(el.dataset.path==='valuationOverride'&&el.value!==''){candidate.extras.valuationMode='manual';candidate.extras.valuationModeExplicit=true;}
 try{const checked=validate(candidate);calculate(checked,active,shift,delay,stress);project=checked;$('#notice').hidden=true;render();if(el.id==='summaryLtv'&&tab==='income')renderInputs();persist();}catch(err){notice(err.message,true);}
});
$('#toggleAssumptions').addEventListener('click',()=>{const open=document.querySelector('.inputs').classList.toggle('mobile-open');$('#toggleAssumptions').setAttribute('aria-expanded',String(open));$('#toggleAssumptions').textContent=open?'Hide assumptions':'Edit assumptions';});
$('#projectName').addEventListener('input',e=>{project.name=e.target.value;persist();});
$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;renderInputs();}));
$('.input-tabs').addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const buttons=$$('[data-tab]');let idx=buttons.findIndex(b=>b.dataset.tab===tab);idx=e.key==='Home'?0:e.key==='End'?2:(idx+(e.key==='ArrowRight'?1:2))%3;tab=buttons[idx].dataset.tab;renderInputs();buttons[idx].focus();});
$$('[data-option]').forEach(b=>b.addEventListener('click',()=>{active=+b.dataset.option;render();}));
$$('[data-delay]').forEach(b=>b.addEventListener('click',()=>{delay=+b.dataset.delay;render();}));
$('#rentShift').addEventListener('input',e=>{shift=Number(e.target.value);render();});
$('#baseScenario').addEventListener('click',()=>{shift=0;delay=0;stress={};render();});
$('#matrixMetric').addEventListener('change',renderMatrix);
$('#matrix').addEventListener('click',e=>{const b=e.target.closest('[data-cell-rent]');if(b){shift=+b.dataset.cellRent;delay=+b.dataset.cellDelay;render();}});
$('#reset').addEventListener('click',()=>{if(confirm('Replace the current project with the starter example? Save a project file first if you want to keep your changes.')){project=defaults();shift=0;delay=0;stress={};active=0;refresh();notice('Starter example restored.');}});
$('#print').addEventListener('click',()=>window.print());
let printStates=[];window.addEventListener('beforeprint',()=>{printStates=Array.from(document.querySelectorAll('.metric-section')).map(el=>({el,open:el.open}));for(const {el} of printStates)el.open=true;});window.addEventListener('afterprint',()=>{for(const {el,open} of printStates)el.open=open;});
$('#saveProject').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(project.name.replace(/[^a-z0-9 _-]/gi,'').trim()||'hmo-project')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Project file saved. You can share it and use Open project to load it on another device.');});
$('#openProject').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>1024*1024)throw Error('Project file is too large.');const p=validate(JSON.parse(await f.text()));project=p;shift=0;delay=0;stress={};refresh();notice('Project opened.');}catch(err){notice(err.message,true);}e.target.value='';});
$('#excelFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;notice('Reading your workbook locally…');try{if(f.size>10*1024*1024)throw Error('Please use an Excel file smaller than 10 MB.');const {project:p,warnings}=mapTemplate(await readWorkbook(f),defaults);project=validate(p);shift=0;delay=0;stress={};refresh();notice('Excel imported. '+warnings.join(' '));}catch(err){notice(err.message,true);}e.target.value='';});
for(const label of $$('label.button')){label.setAttribute('role','button');label.tabIndex=0;label.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();label.querySelector('input').click();}});}
setupSensitivity((kind,value)=>{if(kind==='rentChange'){shift=value;stress={};}else{shift=0;stress={[kind]:value};}delay=0;try{render();}catch(err){stress={};notice(err.message,true);render();}},error=>{if(error)notice(error,true);else renderSensitivity(project,active);});
$('#comparisonBasis').addEventListener('change',()=>render());
$('#comparisonSort').addEventListener('change',()=>render());
document.addEventListener('click',e=>{const button=e.target.closest('[data-apply-ledger]');if(!button)return;try{const path=button.dataset.applyLedger;const text=document.querySelector(`[data-ledger="${path}"]`).value;const rows=text.trim()?text.trim().split(/\n/).map(line=>{const parts=line.split(',').map(v=>v.trim());if(parts.length!==2||parts.some(v=>v===''))throw Error('Use month, amount on each line.');return {month:Number(parts[0]),amount:Number(parts[1])};}):[];const candidate=structuredClone(project);const keys=path.split('.');let target=candidate;for(const k of keys.slice(0,-1))target=target[k];target[keys.at(-1)]=rows;const checked=validate(candidate);calculate(checked,active,shift,delay,stress);project=checked;render();persist();notice('Ledger updated.');}catch(err){notice(err.message,true);}});
refresh();
