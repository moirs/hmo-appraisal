// Read standard .xlsx ZIP/XML files locally, without uploading or executing formulas.
export async function readWorkbook(file){
 const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('Please choose a valid .xlsx workbook.');
 const entries=new Map(),decoder=new TextDecoder();let offset=view.getUint32(end+16,true),count=view.getUint16(end+10,true),expanded=0;
 if(count>2000)throw Error('Workbook has too many files.');
 for(let i=0;i<count;i++){
  if(view.getUint32(offset,true)!==0x02014b50)throw Error('Invalid workbook archive.');
  const method=view.getUint16(offset+10,true),size=view.getUint32(offset+20,true),unpacked=view.getUint32(offset+24,true),n=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true),name=decoder.decode(bytes.slice(offset+46,offset+46+n));
  expanded+=unpacked;if(expanded>30*1024*1024)throw Error('Workbook is too large to import.');
  entries.set(name,{method,size,local});offset+=46+n+extra+comment;
 }
 const text=async name=>{const e=entries.get(name);if(!e)return null;const start=e.local+30+view.getUint16(e.local+26,true)+view.getUint16(e.local+28,true),data=bytes.slice(start,start+e.size);if(e.method===0)return decoder.decode(data);if(e.method!==8)throw Error('Unsupported Excel compression.');try{return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();}catch{throw Error('This browser cannot decompress Excel files. Please use a current Chrome or Edge browser.');}};
 const xml=s=>{const d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror'))throw Error('Invalid Excel XML.');return d;};
 const elements=(root,name)=>Array.from(root.getElementsByTagNameNS('*',name));
 const sharedText=await text('xl/sharedStrings.xml'),shared=sharedText?elements(xml(sharedText),'si').map(si=>elements(si,'t').map(t=>t.textContent).join('')):[];
 const workbook=await text('xl/workbook.xml'),rels=await text('xl/_rels/workbook.xml.rels');if(!workbook||!rels)throw Error('Workbook structure is missing.');
 const targets=new Map(elements(xml(rels),'Relationship').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));const sheets=[];
 for(const sheet of elements(xml(workbook),'sheet')){
  const target=targets.get(sheet.getAttribute('r:id'));if(!target)continue;
  const parts=(target.startsWith('/')?target.slice(1):'xl/'+target).split('/'),clean=[];for(const p of parts){if(p==='..')clean.pop();else if(p!=='.')clean.push(p);}
  const content=await text(clean.join('/'));if(!content)continue;const cells={};
  for(const c of elements(xml(content),'c')){const t=c.getAttribute('t'),v=elements(c,'v')[0]?.textContent;let value=t==='s'?shared[Number(v)]:t==='inlineStr'?elements(c,'t').map(t=>t.textContent).join(''):v===undefined?null:t==='str'?v:Number(v);cells[c.getAttribute('r')]=value;}
  sheets.push({name:sheet.getAttribute('name'),cells});
 }
 return sheets;
}
export function mapTemplate(sheets,defaults){
 const supported=sheets.filter(s=>s.cells.D4==='Purchase price'&&s.cells.D9==='build');
 if(!supported.length)throw Error('This workbook does not match the Habiti template. Keep its original labels and cell layout.');
 const p=defaults(),warnings=[];p.name='Imported HMO appraisal';
 const first=supported[0].cells,num=(c,k)=>{const v=c[k];if(typeof v!=='number'||!Number.isFinite(v))throw Error(`Missing numeric input in ${k}. Open and save the workbook in Excel, then try again.`);return v;};
 Object.assign(p,{purchase:num(first,'C4'),stamp:num(first,'C5'),architect:num(first,'C6'),build:num(first,'C9'),projectFee:num(first,'C10'),misc:num(first,'C11'),bills:num(first,'F7')});
 const privateLayout=first.C15==='GDV CALCULATION',rentRow=privateLayout?16:15;
 Object.assign(p,{rent:num(first,'C'+rentRow),rooms:num(first,'C'+(rentRow+1)),multiplier:num(first,'C'+(rentRow+5))});
 p.management=typeof first.I16==='number'&&first.J16==='Management rate'?first.I16*100:8;
 p.valuationOverride=typeof first.I13==='number'&&first.I13>0?first.I13:null;
 const usedValuation=first['C'+(rentRow+7)],indicative=p.rent*p.rooms*12*p.multiplier;
 if(p.valuationOverride===null&&typeof usedValuation==='number'&&Math.abs(usedValuation-indicative)>0.01){p.valuationOverride=usedValuation;warnings.push('The worksheet valuation differs from rent × multiplier; its entered valuation is preserved in manual mode.');}
 p.extras.valuationMode=p.valuationOverride===null?'multiplier':'manual';p.extras.valuationModeExplicit=true;
 for(let i=0;i<2;i++){
  const s=supported[i];if(!s){warnings.push('Only one matching sheet found; Option B keeps the starter finance terms.');continue;}
  const c=s.cells,r=c.C15==='GDV CALCULATION'?16:15,bridge=num(c,'F'+(r+2));
  const rateText=String(c['G'+(r+5)]??''),match=rateText.match(/([\d.]+)\s*months?\s*x\s*([\d.]+)%/i);if(!match)throw Error(`Cannot read the bridging duration and rate on ${s.name}.`);
  Object.assign(p.options[i],{legal:num(c,'C7'),valuation:num(c,'C8'),months:Number(match[1]),monthlyRate:Number(match[2]),fees:num(c,'F'+(r+4))*100,purchaseLtv:p.purchase?num(c,'F'+r)/p.purchase*100:75,buildFunding:p.build?num(c,'F'+(r+1))/p.build*100:100});
  const refi=num(c,'C'+(r+8)),value=num(c,'C'+(r+7));
  if(i===0){p.refinanceLtv=value?refi/value*100:75;p.mortgageRate=refi?num(c,'F5')/refi*100:5;}
  for(const [k,cell] of Object.entries({purchase:'C4',stamp:'C5',architect:'C6',build:'C9',projectFee:'C10',misc:'C11'}))if(Math.abs(num(c,cell)-p[k])>0.01)warnings.push(`${s.name}: ${k} differs; the app uses the first sheet's shared property input.`);
  if(Math.abs(num(c,'C'+r)-p.rent)>0.01||num(c,'C'+(r+1))!==p.rooms)warnings.push(`${s.name}: rental inputs differ; the app uses the first sheet's room rent and count.`);
 }
 warnings.push('Occupancy starts at 100%. Review both finance options after import.');return {project:p,warnings};
}
