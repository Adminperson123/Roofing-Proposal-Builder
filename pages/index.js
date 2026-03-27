import { useEffect } from 'react'
import Head from 'next/head'
import Script from 'next/script'

export default function Home() {
  useEffect(() => {
    /* ═══════ SETTINGS ═══════ */
    function getSettings(){
      const def={shingle:{good:680,better:780,best:900},tile:{good:600,better:700,best:850},adders:{steep:50,story2:40,layer:25,decking:85},addons:{icewater:350,ridgevent:450,boots:65,chimney:550,skylight:400,drip:280,gutters:1200,solar:850},company:{name:'Good People Roofing Inc.',lic:'C39 #1126880',phone:'(844) ROOFS-09',email:'info@goodpeoplehi.com',web:'goodpeopleroofinginc.com'},whSecret:''};
      try{return Object.assign(def,JSON.parse(localStorage.getItem('gpr_settings')||'{}'));}catch(e){return def;}
    }
    function saveSettings(){
      const s={shingle:{good:+gi('s-shingle-good'),better:+gi('s-shingle-better'),best:+gi('s-shingle-best')},tile:{good:+gi('s-tile-good'),better:+gi('s-tile-better'),best:+gi('s-tile-best')},adders:{steep:+gi('s-steep'),story2:+gi('s-story2'),layer:+gi('s-layer'),decking:+gi('s-decking')},addons:{icewater:+gi('ao-icewater'),ridgevent:+gi('ao-ridgevent'),boots:+gi('ao-boots'),chimney:+gi('ao-chimney'),skylight:+gi('ao-skylight'),drip:+gi('ao-drip'),gutters:+gi('ao-gutters'),solar:+gi('ao-solar')},company:{name:gv('s-co-name'),lic:gv('s-co-lic'),phone:gv('s-co-phone'),email:gv('s-co-email'),web:gv('s-co-web')},whSecret:gv('s-wh-secret')};
      localStorage.setItem('gpr_settings',JSON.stringify(s));
    }
    function loadSettingsUI(){
      const s=getSettings();
      sv('s-shingle-good',s.shingle.good);sv('s-shingle-better',s.shingle.better);sv('s-shingle-best',s.shingle.best);
      sv('s-tile-good',s.tile.good);sv('s-tile-better',s.tile.better);sv('s-tile-best',s.tile.best);
      sv('s-steep',s.adders.steep);sv('s-story2',s.adders.story2);sv('s-layer',s.adders.layer);sv('s-decking',s.adders.decking);
      sv('ao-icewater',s.addons.icewater);sv('ao-ridgevent',s.addons.ridgevent);sv('ao-boots',s.addons.boots);
      sv('ao-chimney',s.addons.chimney);sv('ao-skylight',s.addons.skylight);sv('ao-drip',s.addons.drip);
      sv('ao-gutters',s.addons.gutters);sv('ao-solar',s.addons.solar);
      sv('s-co-name',s.company.name);sv('s-co-lic',s.company.lic);sv('s-co-phone',s.company.phone);
      sv('s-co-email',s.company.email);sv('s-co-web',s.company.web);sv('s-wh-secret',s.whSecret||'');
    }
    /* ═══════ PROPOSALS DB ═══════ */
    function getProposals(){try{return JSON.parse(localStorage.getItem('gpr_proposals')||'[]');}catch(e){return[];}}
    function saveProposal(p){const all=getProposals();const idx=all.findIndex(x=>x.id===p.id);if(idx>=0)all[idx]=p;else all.unshift(p);localStorage.setItem('gpr_proposals',JSON.stringify(all));}
    function renderProposalsTable(){
      const wrap=document.getElementById('proposals-table-wrap');if(!wrap)return;
      const all=getProposals();const q=(document.getElementById('proposal-search')||{}).value?.toLowerCase()||'';
      const filtered=q?all.filter(p=>(p.customerName||'').toLowerCase().includes(q)||(p.propNum||'').toLowerCase().includes(q)):all;
      if(!filtered.length){wrap.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><div style="font-weight:700;margin-bottom:6px">No proposals yet</div><div style="font-size:13px;color:var(--text-light)">Create your first proposal in the Builder tab</div></div>`;return;}
      const tc={'good':'#4A5568','better':'#B01E17','best':'#D4960E','essential':'#4A5568','performance':'#B01E17','signature':'#D4960E'};
      wrap.innerHTML=`<table class="proposals-table"><thead><tr><th>Proposal #</th><th>Customer</th><th>Address</th><th>Roof Type</th><th>Tier</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>${filtered.map(p=>`<tr><td style="font-weight:700;font-family:monospace">${p.propNum}</td><td><div style="font-weight:600">${p.customerName}</div><div style="font-size:11px;color:var(--text-light)">${p.repName||''}</div></td><td style="font-size:12px;color:var(--text-mid)">${(p.address||'').substring(0,30)}</td><td style="font-size:12px">${p.roofType==='tile'?'🏛️ Tile':'🏠 Shingle'} ${p.squares}sq</td><td><span class="tier-pill" style="background:${tc[p.pkgTier]||'#aaa'}">${(p.pkgLabel||'').toUpperCase()}</span></td><td style="font-weight:800;color:var(--navy)">$${(p.totalPrice||0).toLocaleString()}</td><td><span class="status-badge status-${p.status||'draft'}">${p.status||'draft'}</span></td><td style="font-size:11px;color:var(--text-light)">${p.date||''}</td><td><button class="btn btn-outline btn-sm" onclick="window._app.redownloadPDF('${p.id}')" style="margin-right:4px">⬇️</button><button class="btn btn-sm" style="background:#fee2e2;color:#991b1b;border:none" onclick="window._app.deleteProposal('${p.id}')">🗑</button></td></tr>`).join('')}</tbody></table>`;
    }
    function deleteProposal(id){if(!confirm('Delete this proposal?'))return;localStorage.setItem('gpr_proposals',JSON.stringify(getProposals().filter(p=>p.id!==id)));renderProposalsTable();}
    function exportAllCSV(){
      const all=getProposals();if(!all.length){alert('No proposals to export.');return;}
      const hdr=['Proposal #','Customer','Phone','Email','Address','Rep','Roof Type','Squares','Tier','Total','Status','Date'];
      const rows=all.map(p=>[p.propNum,p.customerName,p.phone,p.email,p.address,p.repName||'',p.roofType,p.squares,p.pkgLabel,p.totalPrice,p.status||'draft',p.date]);
      const csv=[hdr,...rows].map(r=>r.map(c=>`"${(c||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
      const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='GPR_Proposals_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
    }
    function redownloadPDF(id){alert('Re-download: open proposal record and recreate PDF. (Re-generation from stored data coming in v2.)');}
    /* ═══════ STATE ═══════ */
    var S={step:0,customer:{},roofType:null,tileType:'flat',squares:14,pitch:5,stories:1,decking:0,layers:1,permit:0,addons:{},pkg:null,overridePrice:null,discount:0,discountNote:''};
    var propNum=newPropNum();
    var todayStr=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    function newPropNum(){return 'GP-'+Date.now().toString().slice(-6);}
    /* ═══════ ADDON DEFS ═══════ */
    var ADDON_DEFS=[{id:'icewater',label:'Ice & Water Shield Upgrade',icon:'🧊'},{id:'ridgevent',label:'Ridge Vent (full length)',icon:'💨'},{id:'boots',label:'Pipe Boot Replacements',icon:'🔩'},{id:'chimney',label:'Chimney Flashing',icon:'🏗️'},{id:'skylight',label:'Skylight Flashing/Cricket',icon:'🔆'},{id:'drip',label:'Drip Edge Upgrade',icon:'💧'},{id:'gutters',label:'Gutter Remove & Replace',icon:'🌧️'},{id:'solar',label:'Solar Panel Remove/Reset',icon:'☀️'}];
    /* ═══════ PKG DEFS ═══════ */
    function getPkgDefs(roofType){
      const s=getSettings();const p=roofType==='tile'?s.tile:s.shingle;const isT=roofType==='tile';
      return[
        {tier:'essential',label:'Essential',tag:'Solid Protection',clr:'#4A5568',psf:p.good,mat:isT?'Concrete Flat Tile':'Architectural Shingle',brand:isT?'Standard flat/S-type':'Owens Corning WeatherGuard / GAF HDZ',warr:'10-Year Workmanship Warranty',feats:['Full tear-off & haul away','Inspect & repair decking (1sq/3 sheets incl.)','New synthetic underlayment','Drip edge install','Ridge cap install','All flashings replaced','Daily site cleanup','10-yr workmanship warranty']},
        {tier:'performance',label:'Performance',tag:'Enhanced Durability',clr:'#B01E17',psf:p.better,mat:isT?'Premium S-Type Tile':'Owens Corning Duration® Premium COOL',brand:isT?'Medium-grade S-type':'Energy Star® / Title 24 qualified',warr:'25-Year Manufacturer + 5-Year Workmanship',feats:['All Essential inclusions','Enhanced ice & water shield','Starter strip shingles full perimeter','Upgraded ridge cap','All pipe boots replaced','Full flashing re-seal w/ white mastic','Attic inspection report','25-yr mfg + 5-yr labor warranty']},
        {tier:'signature',label:'Signature',tag:'Lifetime Peace of Mind',clr:'#D4960E',psf:p.best,mat:isT?'Premium Tile w/ Underlayment Upgrade':'GAF Timberline UHDZ® / OC Duration COOL',brand:isT?'Top-grade manufacturer':'15-yr WindProven™ + 25-yr StainGuard Plus™',warr:'Lifetime System Warranty + 10-Year Labor',feats:['All Performance inclusions','Full synthetic underlayment upgrade','Power attic ventilation','Premium ridge cap system','Copper/premium flashings','Post-install drone inspection','10-yr labor guarantee','Priority scheduling & follow-up']},
      ];
    }
    /* ═══════ PRICE CALC ═══════ */
    function calcBasePrice(roofType){
      const s=getSettings();const sq=parseFloat(gi('f-squares')||S.squares)||14;const pit=parseFloat(gi('f-pitch')||S.pitch)||5;const sto=parseInt(gi('f-stories')||S.stories)||1;const lay=parseInt(gi('f-layers')||S.layers)||1;const perm=parseFloat((document.getElementById('f-permit')||{}).value||S.permit)||0;
      let adder=0;if(pit>=7)adder+=s.adders.steep;if(sto>=2)adder+=s.adders.story2;if(lay>=2)adder+=s.adders.layer*(lay-1);
      const prices=roofType==='tile'?s.tile:s.shingle;
      return{sq,pit,sto,lay,perm,adder,good:Math.round((prices.good+adder)*sq)+perm,better:Math.round((prices.better+adder)*sq)+perm,best:Math.round((prices.best+adder)*sq)+perm};
    }
    function calcAddonsTotal(){const s=getSettings();return ADDON_DEFS.reduce((t,a)=>S.addons[a.id]?t+(s.addons[a.id]||0):t,0);}
    function recalc(){S.squares=parseFloat(gi('f-squares'))||14;S.pitch=parseFloat(gi('f-pitch'))||5;S.stories=parseInt(gi('f-stories'))||1;S.layers=parseInt(gi('f-layers'))||1;S.permit=parseFloat((document.getElementById('f-permit')||{}).value)||0;renderPkgs();}
    /* ═══════ PRICE MODAL ═══════ */
    var _editingPkg=null;
    function openPriceModal(tier){
      _editingPkg=tier;const pkgs=getPkgDefs(S.roofType||'shingle');const pkg=pkgs.find(p=>p.tier===tier);
      const calc=calcBasePrice(S.roofType||'shingle');const addT=calcAddonsTotal();
      const base=calc[tier==='essential'?'good':tier==='performance'?'better':'best']+addT;
      document.getElementById('modal-item-name').textContent=pkg.label+' Package';
      document.getElementById('modal-price-input').value=S.overridePrice?.tier===tier?S.overridePrice.amount:base;
      document.getElementById('modal-discount-input').value=S.discount||0;
      document.getElementById('modal-note-input').value=S.discountNote||'';
      document.getElementById('price-modal').classList.add('open');
    }
    function applyPriceEdit(){
      const amt=parseFloat(document.getElementById('modal-price-input').value)||0;
      const disc=parseFloat(document.getElementById('modal-discount-input').value)||0;
      const note=document.getElementById('modal-note-input').value;
      S.overridePrice={tier:_editingPkg,amount:amt};S.discount=disc;S.discountNote=note;
      closePriceModal();renderPkgs();if(S.pkg)renderPriceSummary();
    }
    function closePriceModal(){document.getElementById('price-modal').classList.remove('open');}
    /* ═══════ PROGRESS ═══════ */
    var LABELS=['Customer Info','Roof & Scope','Choose Package','Review & Sign'];
    function renderProg(){
      const el=document.getElementById('prog-inner');if(!el)return;
      el.innerHTML='';
      LABELS.forEach((lbl,i)=>{
        const wrap=document.createElement('div');wrap.style.cssText='display:flex;align-items:center;'+(i<LABELS.length-1?'flex:1':'');
        const col=document.createElement('div');col.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px';
        const circ=document.createElement('div');circ.className='prog-circle'+(i<S.step?' done':i===S.step?' active':'');circ.textContent=i<S.step?'✓':i+1;
        const label=document.createElement('div');label.className='prog-label'+(i<S.step?' done':i===S.step?' active':'');label.textContent=lbl;
        col.appendChild(circ);col.appendChild(label);wrap.appendChild(col);
        if(i<LABELS.length-1){const line=document.createElement('div');line.className='prog-line'+(i<S.step?' done':'');wrap.appendChild(line);}
        el.appendChild(wrap);
      });
    }
    /* ═══════ NAVIGATION ═══════ */
    function nav(to){
      if(to>=1){const n=gv('f-name'),p=gv('f-phone'),e=gv('f-email'),a=gv('f-address'),r=gv('f-rep');if(!n||!p||!e||!a||!r){alert('Please fill in Name, Phone, Email, Address, and Rep Name.');return;}S.customer={name:n,phone:p,email:e,address:a,rep:r,ghlId:gv('f-ghl-id'),notes:gv('f-notes')};}
      if(to>=2&&!S.roofType){alert('Please select a roof type.');return;}
      document.getElementById('step-'+S.step).classList.remove('active');S.step=to;document.getElementById('step-'+to).classList.add('active');
      renderProg();if(to===2){recalc();}if(to===3){populateReview();}window.scrollTo({top:0,behavior:'smooth'});
    }
    /* ═══════ ROOF TYPE ═══════ */
    function selectRoofType(t){
      S.roofType=t;S.pkg=null;S.overridePrice=null;
      document.querySelectorAll('.roof-type-card').forEach((c,i)=>{c.classList.toggle('selected',(i===0&&t==='shingle')||(i===1&&t==='tile'));});
      const ds=document.getElementById('rt-dot-shingle');const dt=document.getElementById('rt-dot-tile');
      if(ds){ds.className='radio-dot'+(t==='shingle'?' sel':'');ds.innerHTML=t==='shingle'?'<div class="radio-inner"></div>':'';}
      if(dt){dt.className='radio-dot'+(t==='tile'?' sel':'');dt.innerHTML=t==='tile'?'<div class="radio-inner"></div>':'';}
      const tw=document.getElementById('tile-subtype-wrap');if(tw)tw.style.display=t==='tile'?'':'none';
    }
    /* ═══════ ADD-ONS ═══════ */
    function renderAddons(){
      const s=getSettings();const el=document.getElementById('addon-grid');if(!el)return;el.innerHTML='';
      ADDON_DEFS.forEach(a=>{
        const on=!!S.addons[a.id];const div=document.createElement('div');div.className='addon-item'+(on?' checked':'');
        div.innerHTML=`<div class="addon-left"><div class="addon-chk${on?' on':''}" id="adchk-${a.id}"></div><span class="addon-name">${a.icon} ${a.label}</span></div><span class="addon-price">+$${(s.addons[a.id]||0).toLocaleString()}</span>`;
        div.onclick=()=>{S.addons[a.id]=!S.addons[a.id];renderAddons();recalc();};el.appendChild(div);
      });
    }
    /* ═══════ PACKAGES ═══════ */
    function renderPkgs(){
      const el=document.getElementById('pkg-grid');if(!el)return;
      const rt=S.roofType||'shingle';const pkgs=getPkgDefs(rt);const calc=calcBasePrice(rt);const addT=calcAddonsTotal();
      el.innerHTML='';const calMap={essential:'good',performance:'better',signature:'best'};
      pkgs.forEach((pkg,idx)=>{
        const pop=idx===1;const sel=S.pkg===pkg.tier;
        const base=calc[calMap[pkg.tier]]+addT;const displayPrice=S.overridePrice?.tier===pkg.tier?S.overridePrice.amount:base;
        const finalPrice=displayPrice-(sel||S.overridePrice?.tier===pkg.tier?S.discount||0:0);
        const card=document.createElement('div');card.className='pkg-card'+(pop?' pop':'')+(sel?' selected':'');card.style.borderColor=sel?pkg.clr:'var(--border)';
        const featsHTML=pkg.feats.map(f=>`<div class="pkg-feat"><span class="feat-chk" style="color:${pkg.clr}">✓</span><span>${f}</span></div>`).join('');
        card.innerHTML=`${pop?'<div class="pop-badge">⭐ Most Popular</div>':''}<div class="pkg-body"><div class="pkg-tier-row"><div><div class="pkg-tier" style="color:${pkg.clr}">${pkg.label}</div><div class="pkg-tag">${pkg.tag}</div></div><div style="display:flex;gap:6px;align-items:center;"><button class="ps-edit" onclick="event.stopPropagation();window._app.openPriceModal('${pkg.tier}')" style="font-size:10px;padding:2px 7px;background:none;border:1px solid #ddd;border-radius:5px;cursor:pointer;color:#888;">✏️</button><div class="radio-dot${sel?' sel':''}">${sel?'<div class="radio-inner"></div>':''}</div></div></div><div class="pkg-price-row"><div class="pkg-price">$${finalPrice.toLocaleString()}</div><div class="pkg-per">$${pkg.psf}/sq · ${calc.sq} squares</div></div><div class="pkg-mat"><div class="mat-lbl">Material</div><div class="mat-name">${pkg.mat}</div><div class="mat-brand">${pkg.brand}</div></div><div class="pkg-warr" style="color:${pkg.clr}">🛡 ${pkg.warr}</div><div class="pkg-feats">${featsHTML}</div></div>`;
        card.onclick=()=>{S.pkg=pkg.tier;renderPkgs();renderPriceSummary();const b=document.getElementById('btn-2-next');if(b)b.disabled=false;};el.appendChild(card);
      });
      if(S.pkg)renderPriceSummary();
    }
    function renderPriceSummary(){
      const el=document.getElementById('price-summary');if(!el)return;
      const rt=S.roofType||'shingle';const pkgs=getPkgDefs(rt);const pkg=pkgs.find(p=>p.tier===S.pkg);if(!pkg){el.innerHTML='';return;}
      const s=getSettings();const sq=S.squares;const calc=calcBasePrice(rt);const addT=calcAddonsTotal();
      const baseTotal=Math.round((pkg.psf+calc.adder)*sq);
      const displayBase=S.overridePrice?.tier===S.pkg?S.overridePrice.amount-addT-calc.perm:baseTotal;
      const subtotal=displayBase+addT+calc.perm;const disc=S.discount||0;const total=subtotal-disc;
      const checkedAddons=ADDON_DEFS.filter(a=>S.addons[a.id]);
      el.innerHTML=`<div class="ps-title">💰 Price Breakdown — ${pkg.label} Package</div><div class="ps-row sub"><span>Base (${sq} sq × $${pkg.psf}/sq)</span><span>$${baseTotal.toLocaleString()}</span></div>${calc.adder>0?`<div class="ps-row sub"><span>Pitch/Story/Layer Adder (+$${calc.adder}/sq)</span><span>+$${Math.round(calc.adder*sq).toLocaleString()}</span></div>`:''} ${checkedAddons.map(a=>`<div class="ps-row sub"><span>${a.label}</span><span>+$${(s.addons[a.id]||0).toLocaleString()}</span></div>`).join('')}${calc.perm>0?`<div class="ps-row sub"><span>Permit</span><span>+$${calc.perm.toLocaleString()}</span></div>`:''} ${disc>0?`<div class="ps-row disc"><span>Discount${S.discountNote?' ('+S.discountNote+')':''}</span><span>−$${disc.toLocaleString()}</span></div>`:''}<div class="ps-row total"><span>TOTAL</span><div style="display:flex;align-items:center;gap:12px;"><button class="ps-edit" onclick="window._app.openPriceModal('${S.pkg}')">✏️ Edit Price</button><span>$${total.toLocaleString()}</span></div></div>`;
    }
    /* ═══════ REVIEW ═══════ */
    function populateReview(){
      const rt=S.roofType||'shingle';const pkgs=getPkgDefs(rt);const pkg=pkgs.find(p=>p.tier===S.pkg);
      const calc=calcBasePrice(rt);const calMap={essential:'good',performance:'better',signature:'best'};
      const addT=calcAddonsTotal();const base=calc[calMap[S.pkg]]+addT;
      const displayPrice=S.overridePrice?.tier===S.pkg?S.overridePrice.amount:base;const total=displayPrice-(S.discount||0);
      set('rv-propnum',propNum);set('rv-date',todayStr);set('rv-name',S.customer.name);set('rv-email',S.customer.email);
      set('rv-phone',S.customer.phone);set('rv-addr',S.customer.address);set('rv-rep','👤 Rep: '+S.customer.rep);
      set('rv-rooftype',rt==='tile'?'🏛️ Tile Roofing ('+S.tileType+')':'🏠 Architectural Shingle');
      set('rv-scope-detail',pkg.mat+' — '+pkg.brand);set('rv-squares',S.squares+' squares (≈'+(S.squares*100).toLocaleString()+' sq ft)');
      set('rv-pitch','Pitch: '+S.pitch+'/12'+(S.pitch>=7?' (steep charge applies)':''));set('rv-stories',S.stories+' stor'+(S.stories>1?'ies':'y'));
      const addonNames=ADDON_DEFS.filter(a=>S.addons[a.id]).map(a=>a.label).join(', ');
      set('rv-addons-preview',addonNames||'No add-ons selected');
      const pkgBox=document.getElementById('rv-pkg-box');
      if(pkgBox){pkgBox.style.borderColor=pkg.clr;pkgBox.style.background=pkg.clr+'12';}
      const badge=document.getElementById('rv-pkg-badge');if(badge){badge.textContent=pkg.label+' Package';badge.style.background=pkg.clr;}
      set('rv-pkg-mat',pkg.mat+' — '+pkg.brand);
      const warr=document.getElementById('rv-pkg-warr');if(warr){warr.textContent='🛡 '+pkg.warr;warr.style.color=pkg.clr;}
      set('rv-pkg-price','$'+total.toLocaleString());set('rv-pkg-per','$'+pkg.psf+'/sq · '+S.squares+' squares');
      const featsEl=document.getElementById('rv-pkg-feats');if(featsEl)featsEl.innerHTML=pkg.feats.map(f=>`<div class="pp-feat"><span style="color:${pkg.clr};font-weight:700">✓</span><span>${f}</span></div>`).join('');
      const nb=document.getElementById('rv-notes-box');if(nb){if(S.customer.notes){nb.style.display='';set('rv-notes-txt',S.customer.notes);}else nb.style.display='none';}
      // All 3 packages comparison
      const allEl=document.getElementById('rv-all-pkgs');
      if(allEl){
        allEl.innerHTML=pkgs.map(p=>{
          const pBase=calc[calMap[p.tier]]+addT;const pPrice=S.overridePrice?.tier===p.tier?S.overridePrice.amount:pBase;
          const pFinal=pPrice-(S.pkg===p.tier?S.discount||0:0);const isSel=S.pkg===p.tier;
          return `<div style="border:2px solid ${isSel?p.clr:'var(--border)'};border-radius:10px;overflow:hidden;background:${isSel?p.clr+'0f':'var(--warm-bg)'}"><div style="background:${p.clr};color:#fff;text-align:center;padding:7px 6px;font-size:10px;font-weight:700">${p.label.toUpperCase()}${isSel?' ★ SELECTED':''}</div><div style="padding:11px 10px 13px"><div style="font-size:22px;font-weight:800;color:${p.clr}">$${pFinal.toLocaleString()}</div><div style="font-size:10px;color:var(--text-light);margin-bottom:6px">$${p.psf}/sq · ${S.squares} squares</div><div style="font-size:10px;color:var(--text-mid);font-weight:600;margin-bottom:2px">${p.mat}</div><div style="font-size:10px;color:var(--text-mid);margin-bottom:6px">${p.brand}</div><div style="font-size:10px;font-weight:700;color:${p.clr};margin-bottom:8px">🛡 ${p.warr}</div><div style="border-top:1px solid var(--border);padding-top:8px">${p.feats.map(f=>`<div style="font-size:10px;color:var(--text-mid);margin-bottom:3px;display:flex;gap:5px"><span style="color:${p.clr};font-weight:700">✓</span><span>${f}</span></div>`).join('')}</div></div></div>`;
        }).join('');
      }
      clearSig();const agr=document.getElementById('agree');if(agr)agr.checked=false;
      const bdl=document.getElementById('btn-dl');if(bdl)bdl.disabled=true;
    }
    /* ═══════ SIGNATURE ═══════ */
    var sigCanvas,sigCtx,drawing=false,sigFilled=false;
    function initSig(){
      sigCanvas=document.getElementById('sig-pad');if(!sigCanvas)return;sigCtx=sigCanvas.getContext('2d');
      const r=sigCanvas.getBoundingClientRect();sigCanvas.width=r.width*devicePixelRatio;sigCanvas.height=r.height*devicePixelRatio;
      sigCtx.scale(devicePixelRatio,devicePixelRatio);sigCtx.strokeStyle='#0C1C38';sigCtx.lineWidth=2.2;sigCtx.lineCap='round';sigCtx.lineJoin='round';
      const pt=e=>{const b=sigCanvas.getBoundingClientRect();return e.touches?{x:e.touches[0].clientX-b.left,y:e.touches[0].clientY-b.top}:{x:e.clientX-b.left,y:e.clientY-b.top};};
      sigCanvas.addEventListener('mousedown',e=>{drawing=true;const p=pt(e);sigCtx.beginPath();sigCtx.moveTo(p.x,p.y);});
      sigCanvas.addEventListener('mousemove',e=>{if(!drawing)return;const p=pt(e);sigCtx.lineTo(p.x,p.y);sigCtx.stroke();sigFilled=true;checkReady();});
      sigCanvas.addEventListener('mouseup',()=>drawing=false);sigCanvas.addEventListener('mouseleave',()=>drawing=false);
      sigCanvas.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;const p=pt(e);sigCtx.beginPath();sigCtx.moveTo(p.x,p.y);},{passive:false});
      sigCanvas.addEventListener('touchmove',e=>{e.preventDefault();if(!drawing)return;const p=pt(e);sigCtx.lineTo(p.x,p.y);sigCtx.stroke();sigFilled=true;checkReady();},{passive:false});
      sigCanvas.addEventListener('touchend',()=>drawing=false);
    }
    function clearSig(){if(sigCtx)sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height);sigFilled=false;checkReady();}
    function checkReady(){const ok=sigFilled&&document.getElementById('agree')?.checked;const btn=document.getElementById('btn-dl');if(btn)btn.disabled=!ok;}
    /* ═══════ PDF ═══════ */
    function hex3(hex){return[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];}
    async function downloadPDFOnly(){await makePDF(false);}
    async function makePDF(withSign=true){
      const btn=document.getElementById('btn-dl');if(btn){btn.textContent='⏳ Generating…';btn.disabled=true;}
      await new Promise(r=>setTimeout(r,60));
      try{
        const{jsPDF}=window.jspdf;const doc=new jsPDF('p','pt','letter');
        const W=612,M=40;const rt=S.roofType||'shingle';const pkgs=getPkgDefs(rt);const pkg=pkgs.find(p=>p.tier===S.pkg);
        const calc=calcBasePrice(rt);const addT=calcAddonsTotal();const calMap={essential:'good',performance:'better',signature:'best'};
        const base=calc[calMap[S.pkg]]+addT;const displayPrice=S.overridePrice?.tier===S.pkg?S.overridePrice.amount:base;const total=displayPrice-(S.discount||0);
        const pc=hex3(pkg.clr);const s=getSettings();
        const fc=(...c)=>doc.setFillColor(...c);const tc=(...c)=>doc.setTextColor(...c);const lc=(...c)=>doc.setDrawColor(...c);
        const fnt=(sz,w='normal')=>{doc.setFontSize(sz);doc.setFont('helvetica',w);};
        const txt=(t,x,y,opt)=>doc.text(t,x,y,opt||{});const rr=(x,y,w,h,f)=>doc.roundedRect(x,y,w,h,5,5,f||'F');
        fc(12,28,56);doc.rect(0,0,W,90,'F');fc(176,30,23);doc.rect(0,87,W,3,'F');
        tc(240,180,41);fnt(20,'bold');txt('GOOD PEOPLE ROOFING',M,34);
        tc(150,170,200);fnt(8,'normal');txt('HOME IMPROVEMENT  |  '+s.company.web+'  |  '+s.company.phone,M,48);
        txt(s.company.email+'  |  CA Lic. '+s.company.lic,M,62);txt('Medina Pro Roofing / Good People Roofing Inc.',M,76);
        tc(140,155,180);fnt(8,'normal');txt('PROPOSAL',W-M,28,{align:'right'});
        tc(255,255,255);fnt(13,'bold');txt(propNum,W-M,44,{align:'right'});
        fnt(9,'normal');tc(150,165,185);txt(todayStr,W-M,58,{align:'right'});tc(100,210,160);txt('Valid 14 days',W-M,72,{align:'right'});
        let y=110;const bw=248,bh=100;
        fc(247,246,243);rr(M,y,bw,bh);tc(150,160,175);fnt(8,'bold');txt('PREPARED FOR',M+12,y+16);
        tc(26,26,46);fnt(12,'bold');txt(S.customer.name,M+12,y+30);tc(74,85,104);fnt(9,'normal');
        txt(S.customer.email,M+12,y+44);txt(S.customer.phone,M+12,y+58);const aL=doc.splitTextToSize(S.customer.address,bw-24);txt(aL,M+12,y+72);
        const rb=W-M-bw;fc(247,246,243);rr(rb,y,bw,bh);tc(150,160,175);fnt(8,'bold');txt('PREPARED BY',rb+12,y+16);
        tc(26,26,46);fnt(12,'bold');txt(s.company.name,rb+12,y+30);tc(74,85,104);fnt(9,'normal');
        txt('Medina Pro Roofing / '+s.company.name,rb+12,y+44);txt('CA Lic. '+s.company.lic,rb+12,y+58);
        tc(176,30,23);fnt(9,'bold');txt('Rep: '+S.customer.rep,rb+12,y+72);y+=bh+14;
        fc(247,246,243);rr(M,y,W-M*2,52);tc(150,160,175);fnt(8,'bold');txt('SCOPE OF WORK',M+12,y+14);
        tc(74,85,104);fnt(9,'normal');
        txt((rt==='tile'?'Tile Roofing ('+S.tileType+')':'Architectural Shingle')+'  |  '+S.squares+' Squares  |  Pitch: '+S.pitch+'/12  |  '+S.stories+' stor'+(S.stories>1?'ies':'y'),M+12,y+30);
        txt('Add-ons: '+(ADDON_DEFS.filter(a=>S.addons[a.id]).map(a=>a.label).join(', ')||'None'),M+12,y+44);y+=66;
        const pkBg=pkg.tier==='essential'?[238,240,245]:pkg.tier==='performance'?[255,240,239]:[255,249,232];const phH=190;
        fc(...pkBg);lc(...pc);doc.setLineWidth(2);doc.roundedRect(M,y,W-M*2,phH,6,6,'FD');doc.setLineWidth(1);
        fc(...pc);rr(M+14,y+12,80,18);tc(255,255,255);fnt(10,'bold');txt(pkg.label+' Package',M+54,y+24,{align:'center'});
        tc(74,85,104);fnt(10,'normal');txt(pkg.mat+' — '+pkg.brand,M+14,y+44);
        tc(...pc);fnt(10,'bold');txt('🛡 '+pkg.warr,M+14,y+60);
        tc(26,26,46);fnt(28,'bold');txt('$'+total.toLocaleString(),W-M-14,y+46,{align:'right'});
        tc(156,163,175);fnt(9,'normal');txt('$'+pkg.psf+'/sq · '+S.squares+' squares',W-M-14,y+60,{align:'right'});
        if(S.discount>0){tc(200,50,50);fnt(9,'normal');txt('Discount: −$'+S.discount.toLocaleString(),W-M-14,y+74,{align:'right'});}
        lc(226,224,219);doc.setLineWidth(0.5);doc.line(M+14,y+80,W-M-14,y+80);
        const feats=pkg.feats;const half=Math.ceil(feats.length/2);const cw=(W-M*2-28)/2;
        feats.slice(0,half).forEach((f,i)=>{tc(...pc);fnt(10,'bold');txt('✓',M+14,y+96+i*16);tc(74,85,104);fnt(9,'normal');txt(f,M+27,y+96+i*16);});
        feats.slice(half).forEach((f,i)=>{tc(...pc);fnt(10,'bold');txt('✓',M+14+cw,y+96+i*16);tc(74,85,104);fnt(9,'normal');txt(f,M+27+cw,y+96+i*16);});
        y+=phH+12;
        fc(12,28,56);rr(M,y,W-M*2,22);tc(240,180,41);fnt(8,'bold');txt('PRICE BREAKDOWN',M+12,y+15);y+=28;
        const lineItems=[['Base Roofing ('+S.squares+' sq × $'+pkg.psf+'/sq)',Math.round(pkg.psf*S.squares)],...(calc.adder>0?[['Pitch/Story/Layer Adder',Math.round(calc.adder*S.squares)]]:[] ),...ADDON_DEFS.filter(a=>S.addons[a.id]).map(a=>['Add-on: '+a.label,s.addons[a.id]||0]),...(calc.perm>0?[['City Permit',calc.perm]]:[] )];
        lineItems.forEach(([label,amt],i)=>{if(i%2===0){fc(250,250,250);doc.rect(M,y-10,W-M*2,18,'F');}tc(74,85,104);fnt(9,'normal');txt(label,M+10,y+2);txt('$'+amt.toLocaleString(),W-M-10,y+2,{align:'right'});y+=18;});
        if(S.discount>0){tc(200,50,50);fnt(9,'bold');txt('Discount'+(S.discountNote?' ('+S.discountNote+')':''),M+10,y+2);txt('−$'+S.discount.toLocaleString(),W-M-10,y+2,{align:'right'});y+=18;}
        fc(12,28,56);doc.rect(M,y-2,W-M*2,20,'F');tc(240,180,41);fnt(11,'bold');txt('TOTAL',M+10,y+12);txt('$'+total.toLocaleString(),W-M-10,y+12,{align:'right'});y+=30;
        fc(247,246,243);rr(M,y,W-M*2,46);tc(150,160,175);fnt(7,'bold');txt('PAYMENT TERMS',M+12,y+12);
        tc(74,85,104);fnt(8,'normal');txt('Deposit: $1,000 or 10% (whichever is less) due upon signing   |   50% due at start   |   Balance due upon completion',M+12,y+26);
        txt('Late payments: 1.5%/month (18% APR).',M+12,y+38);y+=58;
        if(S.customer.notes&&y<700){fc(247,246,243);rr(M,y,W-M*2,44);tc(150,160,175);fnt(7,'bold');txt('INSPECTION NOTES',M+12,y+12);tc(74,85,104);fnt(8,'normal');const nl=doc.splitTextToSize(S.customer.notes,W-M*2-24);txt(nl,M+12,y+24);y+=56;}
        lc(226,224,219);doc.setLineWidth(0.5);doc.line(M,y,W-M,y);y+=10;
        tc(156,163,175);fnt(7.5,'normal');const terms='Terms: Valid 14 days. Payment per schedule above. Wood/extra layers/permits added via Change Order. CA Lic. '+s.company.lic+'. Fully licensed & insured.';
        const tl=doc.splitTextToSize(terms,W-M*2);txt(tl,M,y);y+=tl.length*10+12;
        if(withSign){
          const sh=120;fc(240,244,252);rr(M,y,W-M*2,sh);tc(26,26,46);fnt(10,'bold');txt('CUSTOMER SIGNATURE & AUTHORIZATION',M+14,y+18);
          tc(74,85,104);fnt(8,'normal');txt('By signing below, customer authorizes work at quoted price and agrees to all terms above.',M+14,y+30);
          try{doc.addImage(sigCanvas.toDataURL('image/png'),'PNG',M+14,y+34,W-M*2-28,54);}catch(_){}
          lc(180,180,180);doc.setLineWidth(0.8);doc.line(M+14,y+96,W/2-8,y+96);doc.line(W/2+8,y+96,W-M-14,y+96);
          tc(156,163,175);fnt(7.5,'normal');txt('Customer Signature',M+14,y+106);txt('Date: '+todayStr,M+14,y+115);
          txt('Authorized Rep — Good People Roofing Inc.',W/2+8,y+106);txt('Date: '+todayStr,W/2+8,y+115);y+=sh+10;
        }
        lc(226,224,219);doc.setLineWidth(0.5);doc.line(M,758,W-M,758);
        tc(156,163,175);fnt(7.5,'normal');txt(s.company.name+'  |  '+s.company.web+'  |  '+s.company.phone+'  |  CA Lic. '+s.company.lic,W/2,770,{align:'center'});
        const fn=`GPR_Proposal_${propNum}_${S.customer.name.replace(/\s+/g,'_')}.pdf`;doc.save(fn);
        const record={id:propNum+'_'+Date.now(),propNum,date:todayStr,customerName:S.customer.name,phone:S.customer.phone,email:S.customer.email,address:S.customer.address,repName:S.customer.rep,ghlId:S.customer.ghlId||'',roofType:rt,tileType:S.tileType,squares:S.squares,pitch:S.pitch,stories:S.stories,pkgTier:S.pkg,pkgLabel:pkg.label,totalPrice:total,discount:S.discount||0,status:withSign?'signed':'draft',filename:fn};
        saveProposal(record);if(withSign)showSuccess(record,fn);else{if(btn){btn.textContent='⬇️ PDF Only';btn.disabled=false;}}
      }catch(err){console.error(err);alert('PDF generation failed: '+err.message);if(btn){btn.textContent=withSign?'✅ Sign & Download PDF':'⬇️ PDF Only';btn.disabled=false;}}
    }
    /* ═══════ SUCCESS ═══════ */
    function showSuccess(rec,fn){
      const rb=document.getElementById('review-body');if(rb)rb.style.display='none';
      const sc=document.getElementById('success');if(sc)sc.style.display='block';
      const ss=document.getElementById('suc-summary');
      if(ss)ss.innerHTML=`<div class="suc-row"><div class="suc-row-lbl">Customer</div><div class="suc-row-val">${rec.customerName}</div></div><div class="suc-row"><div class="suc-row-lbl">Address</div><div class="suc-row-val">${rec.address}</div></div><div class="suc-row"><div class="suc-row-lbl">Proposal #</div><div class="suc-row-val" style="font-family:monospace">${rec.propNum}</div></div><div class="suc-row"><div class="suc-row-lbl">Package</div><div class="suc-row-val">${rec.pkgLabel} — $${rec.totalPrice.toLocaleString()}</div></div><div style="margin-top:14px;padding:10px 12px;background:rgba(16,185,129,.1);border:1px solid var(--success);border-radius:8px;font-size:12px;color:#065F46;">✅ <strong>Next step:</strong> Upload <code>${fn}</code> to the GHL contact's <strong>Estimates / Docs</strong> section.</div>`;
      const pw=document.getElementById('prog-wrap');if(pw)pw.style.display='none';window.scrollTo({top:0,behavior:'smooth'});
    }
    /* ═══════ RESET ═══════ */
    function resetApp(){
      S.step=0;S.customer={};S.roofType=null;S.pkg=null;S.overridePrice=null;S.discount=0;S.discountNote='';
      S.squares=14;S.pitch=5;S.stories=1;S.decking=0;S.layers=1;S.permit=0;S.addons={};
      propNum=newPropNum();todayStr=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
      ['f-name','f-phone','f-email','f-rep','f-address','f-ghl-id','f-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
      const rb=document.getElementById('review-body');if(rb)rb.style.display='';const sc=document.getElementById('success');if(sc)sc.style.display='none';
      const pw=document.getElementById('prog-wrap');if(pw)pw.style.display='';
      document.querySelectorAll('.step').forEach((s,i)=>s.classList.toggle('active',i===0));
      const b=document.getElementById('btn-2-next');if(b)b.disabled=true;
      selectRoofType('shingle');renderProg();renderAddons();
      const tw=document.getElementById('tile-subtype-wrap');if(tw)tw.style.display='none';
      sv('f-squares','14');sv('f-pitch','5');sv('f-stories','1');sv('f-decking','0');sv('f-layers','1');
      switchTab('builder');window.scrollTo({top:0,behavior:'smooth'});
    }
    /* ═══════ TABS ═══════ */
    function switchTab(name){
      document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      const tc=document.getElementById('tab-'+name);if(tc)tc.classList.add('active');
      const idx=['builder','proposals','settings'].indexOf(name);
      document.querySelectorAll('.tab-btn')[idx]?.classList.add('active');
      if(name==='proposals')renderProposalsTable();
    }
    /* ═══════ ADJUSTER ═══════ */
    function adj(id,delta){const el=document.getElementById(id);if(!el)return;const min=parseFloat(el.min)||0;let v=parseFloat(el.value)||0;v=Math.max(min,v+delta);el.value=v;recalc();}
    /* ═══════ WEBHOOK LOG ═══════ */
    var webhookLog=[];
    function logWebhook(msg,ok=true){
      const t=new Date().toLocaleTimeString();webhookLog.unshift({t,msg,ok});if(webhookLog.length>50)webhookLog.pop();
      const el=document.getElementById('webhook-log');
      if(el)el.innerHTML=webhookLog.map(e=>`<div class="wl-entry"><span class="wl-time">${e.t}</span><span class="${e.ok?'wl-ok':'wl-err'}">${e.msg}</span></div>`).join('');
    }
    function clearWebhookLog(){webhookLog.length=0;const el=document.getElementById('webhook-log');if(el)el.innerHTML='<div class="wl-entry"><span style="color:rgba(255,255,255,.3)">Log cleared.</span></div>';}
    function applyWebhookContact(data){
      sv('f-name',data.name||data.full_name||data.firstName||'');sv('f-phone',data.phone||'');sv('f-email',data.email||'');
      sv('f-address',data.address||data.full_address||'');sv('f-ghl-id',data.id||data.contact_id||'');sv('f-rep',data.assigned_to||'');
      logWebhook('✅ Contact auto-filled: '+(data.name||data.full_name||data.firstName||'Unknown'));
      const b=document.getElementById('webhook-banner');
      if(b){b.style.background='linear-gradient(135deg,#065F46,#047857)';setTimeout(()=>{if(b)b.style.background='';},3000);}
    }
    function simulateWebhook(){
      const fake={name:'Maria Gonzalez',phone:'(909) 555-0198',email:'maria.g@email.com',address:'8821 Sunset Dr, Yucaipa, CA 92399',id:'GHL-SIM-001',assigned_to:'Carlos M.'};
      applyWebhookContact(fake);logWebhook('🧪 Simulated GHL webhook received');switchTab('builder');
    }
    /* ═══════ UTILS ═══════ */
    function gv(id){return(document.getElementById(id)||{}).value?.trim()||'';}
    function gi(id){return document.getElementById(id)?.value||'';}
    function sv(id,val){const el=document.getElementById(id);if(el)el.value=val;}
    function set(id,txt){const el=document.getElementById(id);if(el)el.textContent=txt;}
    /* ═══════ EXPOSE TO WINDOW ═══════ */
    window._app={nav,switchTab,selectRoofType,adj,recalc,openPriceModal,applyPriceEdit,closePriceModal,clearSig,checkReady,downloadPDFOnly,makePDF,resetApp,renderProposalsTable,exportAllCSV,redownloadPDF,deleteProposal,saveSettings,clearWebhookLog,simulateWebhook};
    // Also expose top-level for inline onclick compatibility
    window.nav=nav;window.switchTab=switchTab;window.selectRoofType=selectRoofType;window.adj=adj;window.recalc=recalc;
    window.openPriceModal=openPriceModal;window.applyPriceEdit=applyPriceEdit;window.closePriceModal=closePriceModal;
    window.clearSig=clearSig;window.checkReady=checkReady;window.downloadPDFOnly=downloadPDFOnly;window.makePDF=makePDF;
    window.resetApp=resetApp;window.renderProposalsTable=renderProposalsTable;window.exportAllCSV=exportAllCSV;
    window.redownloadPDF=redownloadPDF;window.deleteProposal=deleteProposal;window.saveSettings=saveSettings;
    window.clearWebhookLog=clearWebhookLog;window.simulateWebhook=simulateWebhook;
    /* ═══════ INIT ═══════ */
    loadSettingsUI();renderProg();renderAddons();
    // Signature canvas observer
    var sigObs=new MutationObserver(()=>{const s3=document.getElementById('step-3');if(s3&&s3.classList.contains('active')&&!sigCanvas)initSig();});
    var mc=document.getElementById('main-card');if(mc)sigObs.observe(mc,{attributes:true,subtree:true,attributeFilter:['class']});
    // BroadcastChannel for webhook relay
    var bc=new BroadcastChannel('gpr_webhook');
    bc.onmessage=e=>{try{const data=JSON.parse(e.data);if(data.type==='ghl_contact')applyWebhookContact(data.contact||data);logWebhook('📡 GHL Webhook received via relay');}catch(err){logWebhook('❌ Webhook parse error: '+err.message,false);}};
    // Poll /api/webhook for server-side GHL contacts
    var pollInt=setInterval(async()=>{
      try{const res=await fetch('/api/webhook');const data=await res.json();if(data.success&&data.contact){applyWebhookContact(data.contact);}}catch(_){}
    },3000);
    // Also poll localStorage relay
    var lsInt=setInterval(()=>{const raw=localStorage.getItem('gpr_incoming_webhook');if(raw){localStorage.removeItem('gpr_incoming_webhook');try{const d=JSON.parse(raw);applyWebhookContact(d);}catch(e){}}},2000);
    return()=>{sigObs.disconnect();bc.close();clearInterval(pollInt);clearInterval(lsInt);};
  },[]);

  return (
    <>
      <Head>
        <title>Good People Roofing — Proposal Builder</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta charSet="UTF-8" />
      </Head>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="afterInteractive" />

      {/* NAV */}
      <nav className="top-nav">
        <div className="brand">
          <div id="brand-fallback" style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'44px',height:'44px',background:'var(--crimson)',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px'}}>🏠</div>
            <div>
              <div style={{color:'var(--gold-light)',fontWeight:'800',fontSize:'16px',letterSpacing:'.5px'}}>GOOD PEOPLE</div>
              <div className="brand-sub">Roofing Home Improvement</div>
            </div>
          </div>
        </div>
        <div className="nav-badge" id="webhook-status-badge">⬤ Listening for GHL</div>
      </nav>

      {/* TABS */}
      <div className="tab-bar">
        <button className="tab-btn active" onClick={() => window.switchTab('builder')}>📋 Proposal Builder</button>
        <button className="tab-btn" onClick={() => window.switchTab('proposals')}>📁 All Proposals</button>
        <button className="tab-btn" onClick={() => window.switchTab('settings')}>⚙️ Pricing Settings</button>
      </div>

      {/* BUILDER TAB */}
      <div className="tab-content active" id="tab-builder">
        <div className="prog-wrap" id="prog-wrap"><div className="prog-inner" id="prog-inner"></div></div>
        <div className="main">
          <div className="card" id="main-card">

            {/* STEP 0 */}
            <div className="step active" id="step-0">
              <h2 className="step-title">Customer Information</h2>
              <p className="step-sub">Enter lead details — or wait for GHL to auto-fill via webhook.</p>
              <div className="webhook-banner" id="webhook-banner">
                <div className="wb-dot"></div>
                <div><div className="wb-text">GHL Webhook Listener Active</div><div className="wb-sub">New contact data from GHL will auto-populate this form</div></div>
                <div className="wb-badge">LIVE</div>
              </div>
              <div className="section-label">Contact Details</div>
              <div className="form-grid">
                <div className="form-group"><label className="form-label">Full Name <span>*</span></label><input className="form-input" id="f-name" type="text" placeholder="Jane Smith" /></div>
                <div className="form-group"><label className="form-label">Phone Number <span>*</span></label><input className="form-input" id="f-phone" type="tel" placeholder="(909) 555-0100" /></div>
                <div className="form-group"><label className="form-label">Email Address <span>*</span></label><input className="form-input" id="f-email" type="email" placeholder="jane@email.com" /></div>
                <div className="form-group"><label className="form-label">Sales Rep Name <span>*</span></label><input className="form-input" id="f-rep" type="text" placeholder="Enter rep name" /></div>
                <div className="form-group full"><label className="form-label">Property Address <span>*</span></label><input className="form-input" id="f-address" type="text" placeholder="123 Main St, Yucaipa, CA 92399" /></div>
                <div className="form-group full"><label className="form-label">GHL Contact ID <span style={{color:'var(--text-light)',fontWeight:'400'}}>(auto-filled via webhook)</span></label><input className="form-input" id="f-ghl-id" type="text" placeholder="Auto-populated from GHL" /></div>
                <div className="form-group full"><label className="form-label">Project Notes / Inspection Summary</label><textarea className="form-area" id="f-notes" rows={3} placeholder="e.g. 2-story home, 8/12 pitch, HOA approval pending…"></textarea></div>
              </div>
              <div className="step-nav"><div></div><button className="btn btn-primary" onClick={() => window.nav(1)}>Next: Roof Type & Scope →</button></div>
            </div>

            {/* STEP 1 */}
            <div className="step" id="step-1">
              <h2 className="step-title">Roof Type & Scope of Work</h2>
              <p className="step-sub">Select material type, enter measurements, and choose add-ons.</p>
              <div className="section-label">Roof Material Type</div>
              <div className="roof-type-grid" id="roof-type-grid">
                <div className="roof-type-card" onClick={() => window.selectRoofType('shingle')}>
                  <div className="rt-icon">🏠</div>
                  <div className="rt-info"><div className="rt-name">Architectural Shingle</div><div className="rt-desc">Composition asphalt — most common in SoCal</div></div>
                  <div className="radio-dot" id="rt-dot-shingle"></div>
                </div>
                <div className="roof-type-card" onClick={() => window.selectRoofType('tile')}>
                  <div className="rt-icon">🏛️</div>
                  <div className="rt-info"><div className="rt-name">Tile Roofing</div><div className="rt-desc">Flat tile or S-type tile</div></div>
                  <div className="radio-dot" id="rt-dot-tile"></div>
                </div>
              </div>
              <div id="tile-subtype-wrap" style={{display:'none',marginBottom:'18px'}}>
                <div className="form-group"><label className="form-label">Tile Style</label><select className="form-select" id="f-tile-type"><option value="flat">Flat Tile</option><option value="s-type">S-Type Tile</option></select></div>
              </div>
              <div className="section-label">Measurements</div>
              <div className="scope-grid">
                <div className="scope-box"><div className="scope-box-label">Total Squares</div><div className="scope-num"><button onClick={() => window.adj('f-squares',-1)}>−</button><input id="f-squares" type="number" defaultValue="14" min="1" onInput={() => window.recalc()} /><button onClick={() => window.adj('f-squares',1)}>+</button></div><div style={{fontSize:'10px',color:'var(--text-light)',marginTop:'5px'}}>1 sq = 100 sq ft</div></div>
                <div className="scope-box"><div className="scope-box-label">Pitch (x/12)</div><div className="scope-num"><button onClick={() => window.adj('f-pitch',-1)}>−</button><input id="f-pitch" type="number" defaultValue="5" min="1" max="20" onInput={() => window.recalc()} /><button onClick={() => window.adj('f-pitch',1)}>+</button></div><div style={{fontSize:'10px',color:'var(--text-light)',marginTop:'5px'}}>Steep charge ≥7/12</div></div>
                <div className="scope-box"><div className="scope-box-label">Stories</div><div className="scope-num"><button onClick={() => window.adj('f-stories',-1)}>−</button><input id="f-stories" type="number" defaultValue="1" min="1" max="4" onInput={() => window.recalc()} /><button onClick={() => window.adj('f-stories',1)}>+</button></div><div style={{fontSize:'10px',color:'var(--text-light)',marginTop:'5px'}}>2+ story adder applies</div></div>
                <div className="scope-box"><div className="scope-box-label">Bad Decking (sheets)</div><div className="scope-num"><button onClick={() => window.adj('f-decking',-1)}>−</button><input id="f-decking" type="number" defaultValue="0" min="0" onInput={() => window.recalc()} /><button onClick={() => window.adj('f-decking',1)}>+</button></div><div style={{fontSize:'10px',color:'var(--text-light)',marginTop:'5px'}}>$85/sheet (change order)</div></div>
                <div className="scope-box"><div className="scope-box-label">Layers (tearoff)</div><div className="scope-num"><button onClick={() => window.adj('f-layers',-1)}>−</button><input id="f-layers" type="number" defaultValue="1" min="1" max="4" onInput={() => window.recalc()} /><button onClick={() => window.adj('f-layers',1)}>+</button></div><div style={{fontSize:'10px',color:'var(--text-light)',marginTop:'5px'}}>2+ layers = +$25/sq</div></div>
                <div className="scope-box"><div className="scope-box-label">Permit Required?</div><div style={{marginTop:'6px'}}><select className="form-select" id="f-permit" onChange={() => window.recalc()} style={{fontSize:'12px',padding:'7px 10px'}}><option value="0">No Permit</option><option value="850">Yes — ~$850</option><option value="500">Yes — ~$500</option><option value="1200">Yes — ~$1,200</option></select></div></div>
              </div>
              <div className="section-label">Add-Ons & Upgrades</div>
              <div className="addon-grid" id="addon-grid"></div>
              <div className="step-nav"><button className="btn btn-back" onClick={() => window.nav(0)}>← Back</button><button className="btn btn-primary" onClick={() => window.nav(2)}>Next: Choose Package →</button></div>
            </div>

            {/* STEP 2 */}
            <div className="step" id="step-2">
              <h2 className="step-title">Choose Package</h2>
              <p className="step-sub">Price auto-calculated from your scope. Select the tier to present.</p>
              <div className="pkg-grid" id="pkg-grid"></div>
              <div className="price-summary" id="price-summary"></div>
              <div className="step-nav"><button className="btn btn-back" onClick={() => window.nav(1)}>← Back</button><button className="btn btn-primary" id="btn-2-next" onClick={() => window.nav(3)} disabled>Review Proposal →</button></div>
            </div>

            {/* STEP 3 */}
            <div className="step" id="step-3">
              <div id="review-body">
                <h2 className="step-title">Review & Sign</h2>
                <p className="step-sub">Confirm details, draw signature, then download PDF.</p>
                <div className="preview">
                  <div className="prev-head">
                    <div><div className="prev-co">GOOD PEOPLE</div><div className="prev-sub">Roofing Home Improvement · (844) ROOFS-09 · goodpeopleroofinginc.com</div></div>
                    <div style={{textAlign:'right'}}><div className="prev-num-lbl">Proposal No.</div><div className="prev-num" id="rv-propnum"></div><div className="prev-date" id="rv-date"></div><div style={{fontSize:'10px',color:'rgba(100,210,160,.8)',marginTop:'2px'}}>Valid 14 days</div></div>
                  </div>
                  <div className="prev-body">
                    <div className="prev-row">
                      <div className="prev-box"><div className="pbox-lbl">Prepared For</div><div className="pbox-name" id="rv-name">—</div><div className="pbox-line" id="rv-email">—</div><div className="pbox-line" id="rv-phone">—</div><div className="pbox-line" style={{marginTop:'4px'}} id="rv-addr">—</div></div>
                      <div className="prev-box"><div className="pbox-lbl">Prepared By</div><div className="pbox-name">Good People Roofing Inc.</div><div className="pbox-line">Medina Pro Roofing | Good People Roofing</div><div className="pbox-line">CA Lic. C39 #1126880</div><div className="pbox-line" id="rv-rep" style={{marginTop:'4px',fontWeight:'600',color:'var(--crimson)'}}></div></div>
                    </div>
                    <div className="prev-row">
                      <div className="prev-box"><div className="pbox-lbl">Roof Type</div><div className="pbox-name" id="rv-rooftype">—</div><div className="pbox-line" id="rv-scope-detail">—</div></div>
                      <div className="prev-box"><div className="pbox-lbl">Scope Summary</div><div className="pbox-line" id="rv-squares">—</div><div className="pbox-line" id="rv-pitch">—</div><div className="pbox-line" id="rv-stories">—</div><div className="pbox-line" id="rv-addons-preview">—</div></div>
                    </div>
                    <div className="pkg-preview" id="rv-pkg-box" style={{border:'2px solid #ccc'}}>
                      <div className="pp-top"><div><span id="rv-pkg-badge" style={{borderRadius:'5px',padding:'3px 11px',fontSize:'11px',fontWeight:'700',color:'#fff',background:'#ccc'}}>Package</span><div className="pbox-line" id="rv-pkg-mat" style={{marginTop:'6px',fontSize:'12px'}}></div><div id="rv-pkg-warr" style={{fontSize:'12px',fontWeight:'600',marginTop:'2px'}}></div></div><div style={{textAlign:'right'}}><div className="pp-price" id="rv-pkg-price">—</div><div className="pp-per" id="rv-pkg-per">—</div></div></div>
                      <div className="pp-feats" id="rv-pkg-feats"></div>
                    </div>
                    <div style={{marginBottom:'14px'}}>
                      <div className="section-label" style={{marginTop:'18px',marginBottom:'10px'}}>Compare All Packages — Good · Better · Best</div>
                      <div id="rv-all-pkgs" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px'}}></div>
                    </div>
                    <div className="prev-box" id="rv-notes-box" style={{display:'none',marginBottom:'14px'}}><div className="pbox-lbl">Inspection Notes</div><div className="pbox-line" id="rv-notes-txt"></div></div>
                    <div className="prev-box" style={{marginBottom:'14px',borderLeft:'3px solid var(--gold)'}}>
                      <div className="pbox-lbl">Wood Repair Schedule (Change Order if Needed)</div>
                      <div className="pbox-line" style={{fontSize:'11px',lineHeight:'1.6'}}>Plywood 15/32: $85/sheet · Fascia 2×6=$12 2×8=$14 2×10=$16 2×12=$20<br />Slats: 1×4=$8 1×6=$9 1×8=$10 · Shiplap: 1×4=$10 1×6=$12 1×8=$14<br />Raftertail: $80 each / $35 per ln ft. <em>Not included in contract price.</em></div>
                    </div>
                    <div className="prev-terms"><strong style={{color:'var(--text-mid)'}}>Terms & Conditions:</strong> This proposal is valid for 14 days. Payment: $1,000 or 10% deposit due upon signing · 50% at start · balance upon completion. Late payments accrue 1.5%/month. Wood repairs, extra layers, and permit costs added via signed Change Order. CA Lic. C39 #1126880. Fully licensed &amp; insured.</div>
                    <div className="sig-wrap">
                      <div className="sig-title">✍️ Customer Signature</div>
                      <canvas id="sig-pad"></canvas>
                      <div className="sig-bar"><span className="sig-hint">Draw signature with mouse or finger</span><button className="sig-clear" onClick={() => window.clearSig()}>Clear</button></div>
                      <label className="agree-row"><input type="checkbox" id="agree" onChange={() => window.checkReady()} /><span className="agree-lbl">I have read and agree to the Terms & Conditions above and authorize Good People Roofing Inc. / Medina Pro Roofing to proceed with the described work at the quoted price.</span></label>
                    </div>
                  </div>
                </div>
                <div className="step-nav"><button className="btn btn-back" onClick={() => window.nav(2)}>← Back</button><div style={{display:'flex',gap:'10px'}}><button className="btn btn-outline" onClick={() => window.downloadPDFOnly()}>⬇️ PDF Only</button><button className="btn btn-success" id="btn-dl" onClick={() => window.makePDF(true)} disabled>✅ Sign & Download PDF</button></div></div>
              </div>
              <div id="success">
                <div className="suc-icon">✅</div><h2 className="suc-title">Proposal Complete!</h2>
                <p className="suc-sub">PDF saved to your device. Upload it to GHL Estimates/Docs section.</p>
                <div className="suc-card" id="suc-summary"></div>
                <div className="suc-actions"><button className="btn btn-primary" onClick={() => window.resetApp()}>+ New Proposal</button><button className="btn btn-outline" onClick={() => window.switchTab('proposals')}>📁 View All Proposals</button></div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* PROPOSALS TAB */}
      <div className="tab-content" id="tab-proposals">
        <div className="main"><div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
            <div><h2 className="step-title">All Proposals</h2><p className="step-sub">Local database — stored in this browser.</p></div>
            <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
              <input className="form-input" id="proposal-search" type="text" placeholder="Search by name or #…" onInput={() => window.renderProposalsTable()} style={{width:'200px',padding:'8px 12px',fontSize:'13px'}} />
              <button className="btn btn-primary btn-sm" onClick={() => { window.switchTab('builder'); window.resetApp(); }}>+ New</button>
              <button className="btn btn-outline btn-sm" onClick={() => window.exportAllCSV()}>📊 Export CSV</button>
            </div>
          </div>
          <div id="proposals-table-wrap"></div>
        </div></div>
      </div>

      {/* SETTINGS TAB */}
      <div className="tab-content" id="tab-settings">
        <div className="main"><div className="card">
          <h2 className="step-title" style={{marginBottom:'4px'}}>Pricing Settings</h2>
          <p className="step-sub" style={{marginBottom:'24px'}}>Adjust base rates — all proposals calculate live from these values.</p>
          <div className="settings-section">
            <div className="settings-section-title">🏠 Shingle Pricing (per square)</div>
            <table className="price-table"><thead><tr><th>Tier</th><th>Price / Square</th><th>Label</th></tr></thead><tbody>
              <tr><td>Essential (Good)</td><td><input id="s-shingle-good" type="number" defaultValue="680" onInput={() => window.saveSettings()} /></td><td style={{color:'var(--text-light)',fontSize:'11px'}}>Owens Corning Standard / GAF HDZ</td></tr>
              <tr><td>Performance (Better)</td><td><input id="s-shingle-better" type="number" defaultValue="780" onInput={() => window.saveSettings()} /></td><td style={{color:'var(--text-light)',fontSize:'11px'}}>Owens Corning Premium COOL / GAF UHDZ</td></tr>
              <tr><td>Signature (Best)</td><td><input id="s-shingle-best" type="number" defaultValue="900" onInput={() => window.saveSettings()} /></td><td style={{color:'var(--text-light)',fontSize:'11px'}}>Owens Corning Duration COOL / GAF Lifetime</td></tr>
            </tbody></table>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">🏛️ Tile Pricing (per square)</div>
            <table className="price-table"><thead><tr><th>Tier</th><th>Price / Square</th><th>Note</th></tr></thead><tbody>
              <tr><td>Essential (Good)</td><td><input id="s-tile-good" type="number" defaultValue="600" onInput={() => window.saveSettings()} /></td><td style={{color:'var(--text-light)',fontSize:'11px'}}>Flat or S-type</td></tr>
              <tr><td>Performance (Better)</td><td><input id="s-tile-better" type="number" defaultValue="700" onInput={() => window.saveSettings()} /></td><td style={{color:'var(--text-light)',fontSize:'11px'}}></td></tr>
              <tr><td>Signature (Best)</td><td><input id="s-tile-best" type="number" defaultValue="850" onInput={() => window.saveSettings()} /></td><td style={{color:'var(--text-light)',fontSize:'11px'}}></td></tr>
            </tbody></table>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">⚡ Automatic Adders</div>
            <table className="price-table"><thead><tr><th>Condition</th><th>Amount</th><th>Unit</th></tr></thead><tbody>
              <tr><td>Steep Pitch (≥7/12)</td><td><input id="s-steep" type="number" defaultValue="50" onInput={() => window.saveSettings()} /></td><td style={{fontSize:'12px',color:'var(--text-mid)'}}>per square added</td></tr>
              <tr><td>2nd Story Adder</td><td><input id="s-story2" type="number" defaultValue="40" onInput={() => window.saveSettings()} /></td><td style={{fontSize:'12px',color:'var(--text-mid)'}}>per square added</td></tr>
              <tr><td>Extra Layer Tearoff</td><td><input id="s-layer" type="number" defaultValue="25" onInput={() => window.saveSettings()} /></td><td style={{fontSize:'12px',color:'var(--text-mid)'}}>per square per extra layer</td></tr>
              <tr><td>Decking (plywood)</td><td><input id="s-decking" type="number" defaultValue="85" onInput={() => window.saveSettings()} /></td><td style={{fontSize:'12px',color:'var(--text-mid)'}}>per sheet</td></tr>
            </tbody></table>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">🔧 Add-On Prices</div>
            <table className="price-table"><thead><tr><th>Add-On</th><th>Price ($)</th></tr></thead><tbody>
              <tr><td>Ice & Water Shield Upgrade</td><td><input id="ao-icewater" type="number" defaultValue="350" onInput={() => window.saveSettings()} /></td></tr>
              <tr><td>Ridge Vent (full length)</td><td><input id="ao-ridgevent" type="number" defaultValue="450" onInput={() => window.saveSettings()} /></td></tr>
              <tr><td>Pipe Boot Replacements (ea)</td><td><input id="ao-boots" type="number" defaultValue="65" onInput={() => window.saveSettings()} /></td></tr>
              <tr><td>Chimney Flashing</td><td><input id="ao-chimney" type="number" defaultValue="550" onInput={() => window.saveSettings()} /></td></tr>
              <tr><td>Skylight Flashing / Cricket</td><td><input id="ao-skylight" type="number" defaultValue="400" onInput={() => window.saveSettings()} /></td></tr>
              <tr><td>Drip Edge Upgrade (aluminum)</td><td><input id="ao-drip" type="number" defaultValue="280" onInput={() => window.saveSettings()} /></td></tr>
              <tr><td>Gutter Removal & Replace</td><td><input id="ao-gutters" type="number" defaultValue="1200" onInput={() => window.saveSettings()} /></td></tr>
              <tr><td>Solar Panel Removal/Reset</td><td><input id="ao-solar" type="number" defaultValue="850" onInput={() => window.saveSettings()} /></td></tr>
            </tbody></table>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">🏢 Company Info</div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Company Name</label><input className="form-input" id="s-co-name" type="text" defaultValue="Good People Roofing Inc." onInput={() => window.saveSettings()} /></div>
              <div className="form-group"><label className="form-label">License #</label><input className="form-input" id="s-co-lic" type="text" defaultValue="C39 #1126880" onInput={() => window.saveSettings()} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" id="s-co-phone" type="text" defaultValue="(844) ROOFS-09" onInput={() => window.saveSettings()} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" id="s-co-email" type="text" defaultValue="info@goodpeoplehi.com" onInput={() => window.saveSettings()} /></div>
              <div className="form-group full"><label className="form-label">Website</label><input className="form-input" id="s-co-web" type="text" defaultValue="goodpeopleroofinginc.com" onInput={() => window.saveSettings()} /></div>
              <div className="form-group full"><label className="form-label">GHL Webhook Secret (optional)</label><input className="form-input" id="s-wh-secret" type="text" placeholder="Leave blank to accept all" onInput={() => window.saveSettings()} /></div>
            </div>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">📡 Webhook Activity Log</div>
            <div className="webhook-log" id="webhook-log"><div className="wl-entry"><span className="wl-time">--:--:--</span><span style={{color:'rgba(255,255,255,.4)'}}>Waiting for incoming GHL webhooks…</span></div></div>
            <div style={{marginTop:'10px',display:'flex',gap:'10px'}}>
              <button className="btn btn-outline btn-sm" onClick={() => window.clearWebhookLog()}>Clear Log</button>
              <button className="btn btn-primary btn-sm" onClick={() => window.simulateWebhook()}>🧪 Simulate GHL Webhook</button>
            </div>
          </div>
          <div style={{marginTop:'10px'}}><button className="btn btn-success" onClick={() => alert('Settings auto-saved to localStorage.')}>✅ Settings Saved</button></div>
        </div></div>
      </div>

      {/* MODAL */}
      <div className="modal-overlay" id="price-modal">
        <div className="modal">
          <div className="modal-title">✏️ Edit Price</div>
          <div className="modal-row"><div className="modal-label">Line Item</div><div id="modal-item-name" style={{fontWeight:'700',fontSize:'14px',marginBottom:'4px'}}></div></div>
          <div className="modal-row"><div className="modal-label">Override Amount ($)</div><input className="modal-input" id="modal-price-input" type="number" placeholder="Enter custom amount" /></div>
          <div className="modal-row"><div className="modal-label">Discount ($)</div><input className="modal-input" id="modal-discount-input" type="number" placeholder="0" defaultValue="0" /></div>
          <div className="modal-row"><div className="modal-label">Note (shown in proposal)</div><input className="modal-input" id="modal-note-input" type="text" placeholder="e.g. Loyalty discount" /></div>
          <div className="modal-btns"><button className="btn btn-primary" style={{flex:'1'}} onClick={() => window.applyPriceEdit()}>Apply</button><button className="btn btn-back" style={{flex:'1'}} onClick={() => window.closePriceModal()}>Cancel</button></div>
        </div>
      </div>
    </>
  )
}
