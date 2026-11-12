import {defaults,calculate,validate} from './model.js';
import {readWorkbook,mapTemplate} from './xlsx.js';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
const precise=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const compact=n=>(n<0?'−':'')+'£'+(Math.abs(n)>=1000?(Math.abs(n)/1000).toFixed(Math.abs(n)>=100000?0:1)+'k':Math.abs(n).toFixed(0));
const signed=n=>(n>0?'+':'')+n+'%';
const months=n=>n===null?'Not recoverable':n.toFixed(1)+' months';
const cashState=v=>Math.abs(v)<0.005?'all cash recovered':v>0?'remaining':'released';
const cashText=(v,format=money)=>`${format(Math.abs(v))} ${cashState(v)}`;
const metricText=(k,v)=>k==='monthsToAllOut'?months(v):k==='left'?cashText(v):money(v);
const metricMarkup=(k,v)=>k==='left'?`<span class="cash-amount">${money(Math.abs(v))}</span><small class="cash-state">${cashState(v)}</small>`:metricText(k,v);
const key='hmo-appraisal-v1';let project=defaults(),active=0,tab='property',shift=0,delay=0;
try{const saved=localStorage.getItem(key);if(saved)project=validate(JSON.parse(saved));}catch{try{localStorage.removeItem(key);}catch{}}
function notice(message,error=false){const n=$('#notice');n.textContent=message;n.classList.toggle('error',error);n.hidden=false;}
function persist(){try{localStorage.setItem(key,JSON.stringify(project));$('.privacy').innerHTML='<i></i> Saved on this device';}catch{$('.privacy').textContent='Use Save project to keep changes';}}
const field=(path,label,{unit='£',step='any',min=0,max='',hint='',optional=false}={})=>{
 const parts=path.split('.');let val=project;for(const p of parts)val=val[p];
 return `<label class="field"><span>${label}</span><div class="input-wrap">${unit==='£'?'<b>£</b>':''}<input type="number" data-path="${path}" aria-label="${label}" value="${val??''}" min="${optional?'0.01':min}" ${max!==''?`max="${max}"`:''} step="${step}" ${optional?'':'required'} class="${unit==='£'?'money':unit?'has-suffix':''}" placeholder="${optional?'Use calculated value':''}">${unit&&unit!=='£'?`<b class="suffix">${unit}</b>`:''}</div>${hint?`<small>${hint}</small>`:''}</label>`;
};
function renderInputs(){
 let html='';
 if(tab==='property')html=`<div class="field-section">Acquisition</div>${field('purchase','Purchase price')}${field('stamp','Stamp duty')}${field('architect','Architects & design')}<div class="field-section">Conversion</div>${field('build','Build cost')}${field('projectFee','Project / Habiti fee')}${field('misc','Miscellaneous allowance')}<div class="small">Legal and valuation fees differ by finance option. Edit them under Finance.</div>`;
 if(tab==='income')html=`<div class="field-section">Letting assumptions</div><div class="field-row">${field('rooms','Rooms',{unit:'',step:1,min:1})}${field('rent','Rent / room / month')}</div>${field('occupancy','Occupancy',{unit:'%',max:100,hint:'Affects collected rent, not the valuation.'})}${field('management','Management charge',{unit:'%',max:100,hint:'Percentage of rent actually collected.'})}${field('bills','Monthly bills')}<div class="field-section">Refinance valuation</div>${field('multiplier','Annual rent multiplier',{unit:'×'})}${field('valuationOverride','Valuation override',{optional:true,hint:'Leave blank to use full-occupancy annual rent × multiplier.'})}${field('refinanceLtv','Refinance loan-to-value',{unit:'%',max:100})}${field('mortgageRate','Mortgage annual interest',{unit:'%',hint:'Interest-only, matching the workbook.'})}`;
 if(tab==='finance')html=`<div class="small" style="padding-top:16px;line-height:1.7">Simple interest on the full loan from day one. Fees are a combined entry and exit percentage.</div>`+project.options.map((o,i)=>`<div class="finance-option-title">${esc(o.name)}</div><div class="field-section">Borrowing</div>${field(`options.${i}.purchaseLtv`,'Purchase loan-to-value',{unit:'%',max:100})}${field(`options.${i}.buildFunding`,'Build cost funded',{unit:'%',max:100})}<div class="field-row">${field(`options.${i}.monthlyRate`,'Monthly interest',{unit:'%'})}${field(`options.${i}.fees`,'Combined fees',{unit:'%'})}</div>${field(`options.${i}.months`,'Planned bridging term',{unit:'mo',step:1})}<div class="field-row">${field(`options.${i}.legal`,'Legal fees')}${field(`options.${i}.valuation`,'Valuation fee')}</div>`).join('');
 $('#inputPanel').innerHTML=html;
 $$('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===tab));b.tabIndex=b.dataset.tab===tab?0:-1;});
}
function deltaText(now,base,unit=''){const diff=now-base;return Math.abs(diff)<.01?'Base case'+unit:`${diff>0?'+':'−'}${money(Math.abs(diff))} versus base${unit}`;}
function renderKpis(r,b){
 const cards=[['Total project cost',r.allIn,b.allIn,'Including bridging finance',false],['Monthly rental surplus',r.net,b.net,'Before tax',false],['Bridging finance cost',r.bridge,b.bridge,`${r.duration} months total borrowing`,false]];
 $('#kpis').innerHTML=cards.map(([label,v,base,desc,featured])=>`<article class="kpi ${featured?'featured':''}" title="${esc(precise(v))}"><div class="kpi-label">${label}</div><div class="kpi-value">${money(v)}</div><div class="kpi-change">${featured&&r.extraReleased>0?desc:shift===0&&delay===0?desc:deltaText(v,base)}</div></article>`).join('');
}
function renderGdv(r){
 const values={gdvValue:r.value,gdvLoan:r.refinance,gdvEquity:r.equity,gdvCashbackBefore:r.cashbackBeforeBridge,gdvCashbackAfter:r.surplus,gdvCashReturned:r.cashReturned};
 for(const [id,v] of Object.entries(values)){const el=$('#'+id);el.textContent=money(v);el.title=precise(v);}
 $('#valuationBadge').textContent=project.valuationOverride===null?'Calculated valuation':'Manual override';
 $('#gdvCalculated').textContent='Rent-based GDV: '+money(r.calculatedValue);
 if(document.activeElement!==$('#summaryLtv'))$('#summaryLtv').value=Number(project.refinanceLtv.toFixed(4));
 $('#gdvMonths').textContent=months(r.monthsToAllOut);
 $('#gdvMonthsNote').textContent=r.monthsToAllOut===null?'Monthly rental surplus must be positive':`${money(r.recoveryCash)} initial cash ÷ ${money(r.net)} monthly surplus`;
}
function lineChart(){
 const changes=[...new Set([-10,0,10,shift])].sort((a,b)=>a-b),data=changes.map(c=>({change:c,value:calculate(project,active,c,delay).left}));
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
 const durations=[0,1,3,6],values=durations.map(d=>calculate(project,active,shift,d).bridge),w=450,h=210,l=59,right=15,t=25,b=34,pw=w-l-right,ph=h-t-b,max=Math.max(...values,1)*1.2;
 let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Bridging costs for no delay and one, three, six extra months"><title>Total bridging cost by overrun</title>`;
 for(let i=0;i<4;i++){const v=max*i/3,y=t+ph-v/max*ph;svg+=`<line x1="${l}" x2="${w-right}" y1="${y}" y2="${y}" stroke="#e8ede4"/><text x="${l-10}" y="${y+4}" text-anchor="end" font-size="10" fill="#8a9584">${compact(v)}</text>`;}
 values.forEach((v,i)=>{const x=l+pw*(i+.5)/4,barH=v/max*ph;svg+=`<rect x="${x-22}" y="${t+ph-barH}" width="44" height="${barH}" rx="4" fill="${delay===durations[i]?'#b98859':'#e9d9c9'}"><title>${durations[i]} extra months: ${precise(v)}</title></rect><text x="${x}" y="${t+ph-barH-9}" text-anchor="middle" font-size="10" fill="#927354">${compact(v)}</text><text x="${x}" y="${h-9}" text-anchor="middle" font-size="10" fill="#7e8e78">${i===0?'No delay':'+'+durations[i]+' mo'}</text>`;});
 return svg+'</svg>';
}
function renderMatrix(){const metric=$('#matrixMetric').value;
 $('#matrix').innerHTML=`<table><thead><tr><th scope="col">Bridging overrun</th>${[-10,0,10].map(c=>`<th scope="col">${c===0?'Base rent':signed(c)+' rent'}<br><span class="small">${money(project.rent*(1+c/100))} / room</span></th>`).join('')}</tr></thead><tbody>${[0,1,3,6].map(d=>`<tr><td>${d===0?'No delay':'+'+d+' month'+(d>1?'s':'')}</td>${[-10,0,10].map(c=>{const v=calculate(project,active,c,d)[metric];return `<td><button class="matrix-cell ${d===delay&&c===shift?'selected':''} ${((['net','surplus'].includes(metric)&&v<0)||(metric==='left'&&v>0)||(metric==='monthsToAllOut'&&v===null))?'negative':''}" data-cell-rent="${c}" data-cell-delay="${d}" title="${metric==='monthsToAllOut'?months(v):metric==='left'?cashText(v,precise):precise(v)}" aria-label="${signed(c)} rent, ${d} extra months: ${metricText(metric,v)}">${metricMarkup(metric,v)}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
 $('.matrix-panel .section-title p').textContent=$('#matrixMetric').selectedOptions[0].text+' · select a cell to explore';
 $('#cashGuide').hidden=metric!=='left';
}
function renderCompare(){const results=[calculate(project,0,shift,delay),calculate(project,1,shift,delay)],rows=[['Property & conversion costs','cost'],['Total borrowing','borrowed'],['Bridging finance cost','bridge'],['Total project cost','allIn'],['Refinance proceeds','refinance'],['Refinance surplus / shortfall','surplus'],['Initial cash (template basis)','initial'],['Cash left invested','left'],['Collected rent / month','collectedRent'],['Management / month','management'],['Mortgage interest / month','mortgage'],['Monthly rental surplus','net']];
 rows.splice(4,0,['GDV used','value'],['Equity retained','equity']);
 rows.splice(8,0,['Cashback before bridging','cashbackBeforeBridge'],['Cash returned at refinance','cashReturned']);
 rows.push(['Initial cash for income recovery (25% deposit + fees)','recoveryCash'],['Months of income to all money out','monthsToAllOut']);
 for(const row of rows){if(row[1]==='initial')row[0]='Cash contributed (including miscellaneous)';if(row[1]==='left'){row[0]='Cash left invested';row[1]='remaining';}if(row[1]==='surplus')row[0]='Cashback after bridging / shortfall';}
 $('#comparison').innerHTML=`<table class="compare-table"><thead><tr><th scope="col">Appraisal measure</th><th scope="col">Option A${active===0?' · selected':''}</th><th scope="col">Option B${active===1?' · selected':''}</th></tr></thead><tbody>${rows.map(([label,k])=>`<tr class="${['allIn','remaining','net'].includes(k)?'emphasis':''}"><td>${label}</td>${results.map(r=>`<td title="${k==='monthsToAllOut'?months(r[k]):precise(r[k])}">${metricText(k,r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 $('#comparisonSubtitle').textContent=`${signed(shift)} room rent · ${delay===0?'no overrun':delay+' extra bridging month'+(delay>1?'s':'')} · ${project.occupancy}% occupancy`;
 for(const row of $$('#comparison tr')){Array.from(row.children).forEach((cell,i)=>{cell.style.backgroundColor=i===active+1?'#f5f8f1':'transparent';});}
}
function render(){const o=project.options[active],r=calculate(project,active,shift,delay),base=calculate(project,active);
 $('#projectName').value=project.name;
 $$('[data-option]').forEach(b=>{b.classList.toggle('active',+b.dataset.option===active);b.setAttribute('aria-pressed',String(+b.dataset.option===active));});
 $$('[data-delay]').forEach(b=>{b.classList.toggle('active',+b.dataset.delay===delay);b.setAttribute('aria-pressed',String(+b.dataset.delay===delay));});
 $('#rentShift').value=shift;$('#rentShiftLabel').textContent=signed(shift);
 $('#financeSummary').textContent=`${o.monthlyRate}% / month · ${o.fees}% fees · ${o.months}-month base term`;
 renderKpis(r,base);renderGdv(r);$('#rentChart').innerHTML=lineChart();$('#bridgeChart').innerHTML=barChart();renderMatrix();renderCompare();
 $('#scenarioNote').textContent=`${money(project.rent*(1+shift/100))} per room · ${project.occupancy}% occupancy · ${money(r.collectedRent)} collected monthly. ${project.valuationOverride===null?'Calculated':'Manual'} valuation: ${money(r.value)}. ${delay?'Extra bridging interest: '+money(r.extraInterest)+'. ':''}Rent begins after completion, modelled at month ${r.duration}.`;
 $('#methodology').innerHTML=`<ul><li>Full-occupancy annual rent = room rent × rooms × 12. Valuation = annual rent × multiplier, unless a manual valuation is entered. Occupancy only reduces rent collected.</li><li>Monthly surplus = collected rent − management (${project.management}% of collected rent) − monthly bills − interest-only mortgage cost. Mortgage interest is based on the refinance loan.</li><li>Bridge = purchase borrowing + funded build cost. Finance cost = full loan × (combined fees + monthly rate × total months). Interest is simple and the full loan is assumed drawn from day one.</li><li>Each extra month adds bridging interest and postpones letting until completion. Delays do not change the eventual monthly rental surplus. No rent is earned during the bridging term in this simplified model. Additional holding costs and late-payment penalties are excluded.</li><li>Refinance surplus / shortfall = refinance proceeds − property and conversion costs − bridging cost. Cashback before bridging = refinance loan − property and conversion costs. Cashback after bridging = refinance loan − all project costs. Positive cashback after bridging means all contributed cash has been recovered, with additional cash released.</li><li>Cash contributed = property and conversion costs (including miscellaneous) − bridge principal. Cash returned at refinance = refinance loan − bridge principal − bridging cost. Net cash remaining = cash contributed − cash returned. Cash left invested in the financing comparison shows a minimum of zero. The chart and scenario grid label money still invested as remaining, and extra cash returned after recovering the contribution as released. Amounts are shown without minus signs.</li><li>Months of income to all money out = (25% of purchase price + stamp duty + architects + solicitors + valuation fee + Habiti / project fee) ÷ net monthly rental surplus. This uses a fixed 25% purchase deposit and excludes miscellaneous costs, build costs and bridging charges. Cashback and cash returned at refinance are not deducted. It measures months of rental income after letting starts, separately from cash left invested. It is not recoverable from rent if the initial cash basis is positive and monthly surplus is zero or negative. Rental surplus is assumed constant, with no growth or discounting.</li><li>All amounts are GBP and before tax. Bills remain fixed. Maintenance, void-related costs beyond occupancy, licensing, refinance fees, mortgage capital repayments and tax are excluded unless you include them in the editable costs.</li></ul><p>Excel import supports the original and corrected Habiti template layouts. It reads stored values, not Excel formulas or macros. Use a recently saved workbook. Amounts on screen are rounded to whole pounds; hover over results for pence.</p>`;
}
function refresh(){renderInputs();render();persist();}
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset.path)return;if(!el.checkValidity()){notice('Please enter a valid value for '+el.getAttribute('aria-label')+'.',true);return;}
 const path=el.dataset.path.split('.'),candidate=structuredClone(project);let obj=candidate;for(const k of path.slice(0,-1))obj=obj[k];obj[path.at(-1)]=el.value===''?null:Number(el.value);
 try{project=validate(candidate);$('#notice').hidden=true;render();if(el.id==='summaryLtv'&&tab==='income')renderInputs();persist();}catch(err){notice(err.message,true);}
});
$('#projectName').addEventListener('input',e=>{project.name=e.target.value;persist();});
$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;renderInputs();}));
$('.input-tabs').addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const buttons=$$('[data-tab]');let idx=buttons.findIndex(b=>b.dataset.tab===tab);idx=e.key==='Home'?0:e.key==='End'?2:(idx+(e.key==='ArrowRight'?1:2))%3;tab=buttons[idx].dataset.tab;renderInputs();buttons[idx].focus();});
$$('[data-option]').forEach(b=>b.addEventListener('click',()=>{active=+b.dataset.option;render();}));
$$('[data-delay]').forEach(b=>b.addEventListener('click',()=>{delay=+b.dataset.delay;render();}));
$('#rentShift').addEventListener('input',e=>{shift=Number(e.target.value);render();});
$('#baseScenario').addEventListener('click',()=>{shift=0;delay=0;render();});
$('#matrixMetric').addEventListener('change',renderMatrix);
$('#matrix').addEventListener('click',e=>{const b=e.target.closest('[data-cell-rent]');if(b){shift=+b.dataset.cellRent;delay=+b.dataset.cellDelay;render();}});
$('#reset').addEventListener('click',()=>{if(confirm('Replace the current project with the starter example? Save a project file first if you want to keep your changes.')){project=defaults();shift=0;delay=0;active=0;refresh();notice('Starter example restored.');}});
$('#print').addEventListener('click',()=>window.print());
$('#saveProject').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(project.name.replace(/[^a-z0-9 _-]/gi,'').trim()||'hmo-project')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Project file saved. You can share it and use Open project to load it on another device.');});
$('#openProject').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>1024*1024)throw Error('Project file is too large.');const p=validate(JSON.parse(await f.text()));project=p;shift=0;delay=0;refresh();notice('Project opened.');}catch(err){notice(err.message,true);}e.target.value='';});
$('#excelFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;notice('Reading your workbook locally…');try{if(f.size>10*1024*1024)throw Error('Please use an Excel file smaller than 10 MB.');const {project:p,warnings}=mapTemplate(await readWorkbook(f),defaults);project=validate(p);shift=0;delay=0;refresh();notice('Excel imported. '+warnings.join(' '));}catch(err){notice(err.message,true);}e.target.value='';});
for(const label of $$('label.button')){label.setAttribute('role','button');label.tabIndex=0;label.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();label.querySelector('input').click();}});}
refresh();
