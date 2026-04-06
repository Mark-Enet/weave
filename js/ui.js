// ── UI ──────────────────────────────────────────────

// ABOUT MODAL
function openAbout(){
  document.getElementById('about-version-num').textContent=APP_VERSION;
  document.getElementById('about-year').textContent=new Date().getFullYear();
  document.getElementById('about-modal').classList.add('open');
}
function closeAbout(){
  document.getElementById('about-modal').classList.remove('open');
}


// THEME TOGGLE
function toggleTheme(){
  var isDark=document.documentElement.classList.toggle('dark');
  document.getElementById('theme-icon-sun').style.display=isDark?'none':'block';
  document.getElementById('theme-icon-moon').style.display=isDark?'block':'none';
  localStorage.setItem('weave-theme',isDark?'dark':'light');
  render();
}
function applyStoredTheme(){
  var t=localStorage.getItem('weave-theme')||'dark';
  if(t==='light') document.documentElement.classList.remove('dark');
  else document.documentElement.classList.add('dark');
  document.getElementById('theme-icon-sun').style.display=t==='dark'?'none':'block';
  document.getElementById('theme-icon-moon').style.display=t==='dark'?'block':'none';
}


// LEGEND TOGGLE
function updateLegendColors(){
  var c=svgColors();
  var lp=document.getElementById('leg-push');
  var ll=document.getElementById('leg-pull');
  var lc=document.getElementById('leg-proc');
  if(lp) lp.style.borderColor=c.accent;
  if(ll) ll.style.borderColor=c.teal;
  if(lc) lc.style.borderColor=c.proc;
}
function toggleLegend(){
  var leg=document.getElementById('diagram-legend');
  var btn=document.getElementById('legend-toggle-btn');
  var hidden=leg.classList.toggle('legend-hidden');
  btn.classList.toggle('active',!hidden);
  localStorage.setItem('weave-legend-hidden',hidden?'1':'0');
}
function initLegend(){
  var hidden=localStorage.getItem('weave-legend-hidden')==='1';
  var leg=document.getElementById('diagram-legend');
  var btn=document.getElementById('legend-toggle-btn');
  leg.classList.toggle('legend-hidden',hidden);
  btn.classList.toggle('active',!hidden);
  updateLegendColors();
}


// MODE SWITCH
function switchAppMode(m){
  appMode=m;
  document.getElementById('banner-tab-timeline').classList.toggle('active',m==='timeline');
  document.getElementById('banner-tab-flow').classList.toggle('active',m==='flow');
  document.getElementById('ts-fg').classList.toggle('hidden',m==='flow');
  document.getElementById('tl-ctrl').style.display=m==='timeline'?'flex':'none';
  document.getElementById('fl-ctrl').style.display=m==='flow'?'flex':'none';
  updateCompactBtn();
  document.getElementById('mode-badge').innerHTML=m==='timeline'
    ?'<span class="mind tl"><span class="mdot"></span>Timeline</span>'
    :'<span class="mind fl"><span class="mdot"></span>Causal Flow</span>';
  document.querySelectorAll('.iblock').forEach(function(b){
    var id=b.dataset.id;
    var dr=document.getElementById('dr-'+id), tr=document.getElementById('tr-'+id);
    if(dr) dr.style.display=m==='flow'?'none':'';
    if(tr) tr.style.display=m==='flow'?'':'none';
  });
  render();
}

// COMPACT TIMELINE TOGGLE
function toggleTimelineCompact(){
  timelineCompact=!timelineCompact;
  localStorage.setItem('weave-timeline-compact',timelineCompact?'true':'false');
  updateCompactBtn();
  render();
}
function updateCompactBtn(){
  var btn=document.getElementById('tl-compact-btn'); if(!btn) return;
  btn.textContent=timelineCompact?'Normal':'Compact';
  btn.classList.toggle('filter-toggle-active',timelineCompact);
  // Only relevant for multi-lane timeline view
  var vm=document.getElementById('view-mode');
  btn.style.display=(vm&&vm.value==='multi')?'':'none';
}

function switchTab(tab){
  if(tab==='scenario') setTimeout(refreshSysOrderUI,50);
  if(tab==='systems') setTimeout(refreshSystemsUI,50);
  if(tab==='datasource') setTimeout(dsUpdatePanelStatus,50);
  ['add','events','scenario','systems','datasource'].forEach(function(t){
    document.getElementById('stab-'+t).classList.toggle('active',t===tab);
    document.getElementById('panel-'+t).classList.toggle('active',t===tab);
  });
}

// SYSTEM DATALIST
function refreshDL(){
  var sorted=[...knownSys].sort();
  function fill(dl){dl.innerHTML='';sorted.forEach(function(s){var o=document.createElement('option');o.value=s;dl.appendChild(o);});}
  var main=document.getElementById('system-dl'); if(main) fill(main);
  document.querySelectorAll('[id^="tdl-"]').forEach(function(dl){fill(dl);});
}

// TRIGGER DROPDOWN
function fillTD(sel,cur,filterSystem){
  sel.innerHTML='<option value="">None (root event)</option>';
  events.forEach(function(ev){
    // If a target system is specified, only show events from that system
    if(filterSystem && ev.system !== filterSystem) return;
    var o=document.createElement('option'); o.value=ev._id||'';
    o.textContent=(filterSystem?'':('['+esc(ev.system||'?')+'] '))+trunc(ev.desc||'',40);
    if(ev._id===cur) o.selected=true; sel.appendChild(o);
  });
  // If current selection is no longer valid, reset it
  if(cur && sel.value==='' && cur!=='') sel.value='';
}

// INTERACTION FIELDS
function addIField(tgt,delay,nature,trigEvt,order,label){
  tgt=tgt||''; delay=delay||0; nature=nature||'push'; trigEvt=trigEvt||'';
  iCount++; var id=iCount;
  var c=document.getElementById('ic'), b=document.createElement('div');
  b.className='iblock'; b.id='ib-'+id; b.dataset.id=id;
  b.innerHTML=
    '<div class="ih">'+
      '<div class="iblock-header-left">'+
        '<div class="reorder-btns">'+
          '<button class="reorder-btn" onclick="moveI(\''+id+'\',\'up\')" title="Move up">\u25B4</button>'+
          '<button class="reorder-btn" onclick="moveI(\''+id+'\',\'down\')" title="Move down">\u25BE</button>'+
        '</div>'+
        '<span class="seq-badge" id="sbadge-'+id+'">?</span>'+
        '<span class="il">Interaction</span>'+
      '</div>'+
      '<button class="btn btn-d" onclick="removeI('+id+')">\u2715 Remove</button>'+
    '</div>'+
    '<div class="fg"><label class="fl">Target System</label>'+
    '<input type="text" id="ti-'+id+'" list="tdl-'+id+'" placeholder="Type or pick a system\u2026" autocomplete="off" oninput="refreshTriggerDD('+id+')">'+
    '<datalist id="tdl-'+id+'"></datalist></div>'+
    '<div class="fg"><label class="fl">Label (optional)</label>'+
    '<input type="text" id="ilbl-'+id+'" placeholder="Describe this interaction\u2026"></div>'+
    '<div class="mgrid">'+
    '<div class="fg" id="dr-'+id+'" style="'+(appMode==='flow'?'display:none':'')+'">'+
    '<label class="fl">Delay (ms)</label>'+
    '<input type="number" id="dl-'+id+'" value="'+delay+'" min="0" placeholder="0"></div>'+
    '<div class="fg"><label class="fl">Type</label>'+
    '<select id="nt-'+id+'">'+
    '<option value="push"'+(nature==='push'?' selected':'')+'>push \u2192</option>'+
    '<option value="pull"'+(nature==='pull'?' selected':'')+'>pull \u2190</option>'+
    '<option value="process"'+(nature==='process'?' selected':'')+'>process</option>'+
    '</select></div></div>'+
    '<div class="fg" id="tr-'+id+'" style="'+(appMode==='timeline'?'display:none':'')+'">'+
    '<label class="fl">Triggers Event (Flow mode)</label>'+
    '<select id="te-'+id+'"></select>'+
    '<span class="hint" style="margin-top:3px">Which event does this interaction trigger?</span></div>';
  c.appendChild(b);
  if(tgt) document.getElementById('ti-'+id).value=tgt;
  if(label) document.getElementById('ilbl-'+id).value=label;
  var tdl=document.getElementById('tdl-'+id);
  [...knownSys].sort().forEach(function(s){var o=document.createElement('option');o.value=s;tdl.appendChild(o);});
  // Populate trigger dropdown filtered to the target system
  var tSys=tgt||'';
  fillTD(document.getElementById('te-'+id),trigEvt,tSys||null);
  renumberIBlocks();
}

function refreshTriggerDD(id){
  var ti=document.getElementById('ti-'+id);
  var te=document.getElementById('te-'+id);
  if(!ti||!te) return;
  var sys=ti.value.trim();
  var cur=te.value;
  fillTD(te,cur,sys||null);
}

function renumberIBlocks(){
  document.querySelectorAll('.iblock').forEach(function(b,i){
    var badge=document.getElementById('sbadge-'+b.dataset.id);
    if(badge) badge.textContent=String(i+1);
  });
}

function moveI(id,dir){
  var c=document.getElementById('ic'), block=document.getElementById('ib-'+id);
  if(!block) return;
  if(dir==='up'&&block.previousElementSibling) c.insertBefore(block,block.previousElementSibling);
  else if(dir==='down'&&block.nextElementSibling) c.insertBefore(block.nextElementSibling,block);
  renumberIBlocks();
}

function removeI(id){var b=document.getElementById('ib-'+id);if(b)b.remove();renumberIBlocks();}
function clearI(){document.getElementById('ic').innerHTML='';iCount=0;}

// SAVE / EDIT / DELETE
function saveDisplayConfig(){
  displayConfig.showLevel=document.getElementById('dc-level').checked;
  displayConfig.showEventCode=document.getElementById('dc-event-code').checked;
  displayConfig.showManagedIntegrationCode=document.getElementById('dc-managed-integration-code').checked;
  displayConfig.showActor=document.getElementById('dc-actor').checked;
  displayConfig.showDate=document.getElementById('dc-show-date').checked;
  displayConfig.showSeq=document.getElementById('dc-show-seq').checked;
  render();
}
function saveEvent(){
  var desc=(document.getElementById('desc').value||'').trim();
  if(!desc){toast('Please enter a description','\u26a0');return;}
  var sys=(document.getElementById('system-input').value||'').trim();
  if(!sys){toast('Please specify a system / context','\u26a0');return;}
  var ts=null, tsStr='';
  if(appMode==='timeline'){
    var v=document.getElementById('ts').value;
    if(!v){toast('Please select a timestamp','\u26a0');return;}
    ts=fromDTL(v); tsStr=new Date(ts).toISOString();
  }
  knownSys.add(sys);
  var ints=[];
  var iOrder=0;
  document.querySelectorAll('.iblock').forEach(function(block){
    var id=block.dataset.id;
    var ti=document.getElementById('ti-'+id); var tval=(ti?ti.value:'').trim();
    var dl=parseInt((document.getElementById('dl-'+id)||{}).value)||0;
    var nt=(document.getElementById('nt-'+id)||{}).value||'push';
    var te=(document.getElementById('te-'+id)||{}).value||'';
    var ilbl=(document.getElementById('ilbl-'+id)||{}).value||'';
    if(tval){knownSys.add(tval);ints.push({target:tval,delay:dl,nature:nt,triggerEventId:te,order:iOrder++,label:ilbl.trim()});}
  });
  var ev={
    _id:editIdx>=0?events[editIdx]._id:'evt-'+Date.now(),
    desc:desc,system:sys,actor:(document.getElementById('actor').value||'').trim(),
    level:(document.getElementById('event-level').value||'')||null,
    eventCode:(document.getElementById('event-code').value||'').trim()||null,
    managedIntegrationCode:(document.getElementById('managed-integration-code').value||'').trim()||null,
    timestamp:ts,timestampStr:tsStr,interactions:ints,mode:appMode
  };
  if(editIdx>=0){events[editIdx]=ev;toast('Event updated','\u270f');}
  else{events.push(ev);toast('Event saved','\u2713');}
  refreshDL(); clearForm(); render(); updateList(); refreshFilterBar();
}
function editEvent(idx){
  var e=events[idx]; editIdx=idx; switchTab('add');
  document.getElementById('desc').value=e.desc||'';
  document.getElementById('actor').value=e.actor||'';
  document.getElementById('system-input').value=e.system||'';
  document.getElementById('event-level').value=e.level||'';
  document.getElementById('event-code').value=e.eventCode||'';
  document.getElementById('managed-integration-code').value=e.managedIntegrationCode||'';
  if(appMode==='timeline'&&(e.timestampStr||e.timestamp)) document.getElementById('ts').value=toDTL(e.timestampStr||new Date(e.timestamp).toISOString());
  clearI();
  var sortedInts=[...( e.interactions||[])].sort(function(a,b){return (a.order||0)-(b.order||0);});
  sortedInts.forEach(function(i,idx){addIField(i.target,i.delay||0,i.nature,i.triggerEventId||'',idx,i.label||'');});
  document.getElementById('cancel-edit').style.display='inline-flex';
  updateList();
}
function deleteEvent(idx){
  if(!confirm('Delete this event?')) return;
  events.splice(idx,1);
  if(editIdx===idx) clearForm(); else if(editIdx>idx) editIdx--;
  render(); updateList(); refreshFilterBar(); toast('Deleted','\uD83D\uDDD1');
}
function clearForm(){
  document.getElementById('desc').value='';
  document.getElementById('actor').value='';
  document.getElementById('system-input').value='';
  document.getElementById('ts').value='';
  document.getElementById('event-level').value='';
  document.getElementById('event-code').value='';
  document.getElementById('managed-integration-code').value='';
  clearI(); editIdx=-1;
  document.getElementById('cancel-edit').style.display='none';
  updateList();
}
function saveScenario(){
  scenName=document.getElementById('scenario-name').value.trim();
  scenDesc=document.getElementById('scenario-desc').value.trim();
  render(); toast('Scenario saved','\u2713');
}
function clearAll(){
  if(!confirm('Delete ALL events? Cannot be undone.')) return;
  events=[]; editIdx=-1; clearForm(); clearFilters(); render(); updateList(); toast('Cleared','X');
}

// EVENT LIST
function updateList(){
  var el=document.getElementById('elist'), n=events.length;
  document.getElementById('ecount').textContent=n+' event'+(n!==1?'s':'');
  if(!n){el.innerHTML='<p class="hint" style="text-align:center;padding:18px 0">No events yet.</p>';return;}
  var sorted=appMode==='timeline'?[...events].sort(function(a,b){return(a.timestamp||0)-(b.timestamp||0);}):events;
  el.innerHTML='';
  sorted.forEach(function(e,si){
    var ri=events.indexOf(e), div=document.createElement('div');
    div.className='eitem'+(ri===editIdx?' sel':'');
    var meta='<span class="etag">'+esc(e.system||'?')+'</span>';
    if(e.level) meta+='<span class="etag elevel-'+esc(e.level)+'">'+esc(e.level)+'</span>';
    if(appMode==='timeline'&&e.timestamp) meta+='<span class="etag">'+new Date(e.timestamp).toISOString().slice(11,19)+'</span>';
    if(appMode==='flow') meta+='<span class="etag">#'+(si+1)+'</span>';
    if(e.actor) meta+='<span class="etag">'+esc(e.actor)+'</span>';
    var dragHandle=appMode==='flow'?'<span class="drag-handle" title="Drag to reorder">&#x2630;</span>':'';
    div.innerHTML='<div class="edesc">'+dragHandle+esc(e.desc)+'</div>'+
      '<div class="emeta">'+meta+'</div>'+
      '<div class="emeta" style="margin-top:3px">'+((e.interactions||[]).length?'\u2194 '+e.interactions.length+' interaction(s)':'No interactions')+'</div>'+
      '<div class="eacts"><button class="btn btn-g btn-sm" onclick="editEvent('+ri+');event.stopPropagation()">Edit</button>'+
      '<button class="btn btn-d btn-sm" onclick="deleteEvent('+ri+');event.stopPropagation()">Delete</button></div>';
    if(appMode==='flow'){
      div.draggable=true;
      div.dataset.ri=ri;
      div.addEventListener('dragstart',function(ev){ev.dataTransfer.setData('text/plain',String(ri));div.classList.add('dragging');});
      div.addEventListener('dragend',function(){div.classList.remove('dragging');});
      div.addEventListener('dragover',function(ev){ev.preventDefault();div.classList.add('drag-over');});
      div.addEventListener('dragleave',function(){div.classList.remove('drag-over');});
      div.addEventListener('drop',function(ev){
        ev.preventDefault();div.classList.remove('drag-over');
        var fromIdx=parseInt(ev.dataTransfer.getData('text/plain'));
        var toIdx=parseInt(div.dataset.ri);
        if(fromIdx===toIdx||isNaN(fromIdx)||isNaN(toIdx)) return;
        var moved=events.splice(fromIdx,1)[0];
        events.splice(toIdx,0,moved);
        if(editIdx===fromIdx) editIdx=toIdx;
        else if(editIdx>fromIdx&&editIdx<=toIdx) editIdx--;
        else if(editIdx<fromIdx&&editIdx>=toIdx) editIdx++;
        render();updateList();
      });
    }
    div.onclick=function(){editEvent(ri);}; el.appendChild(div);
  });
}


// SYSTEM ORDER UI
function refreshSysOrderUI(){
  var container=document.getElementById('sys-order-list');
  if(!container) return;
  // Collect all known systems from events
  var sySet=new Set();
  events.forEach(function(e){
    if(e.system) sySet.add(e.system);
    (e.interactions||[]).forEach(function(i){if(i.target) sySet.add(i.target);});
  });
  [...knownSys].forEach(function(s){sySet.add(s);});
  var arr=[...sySet].sort();
  container.innerHTML='';
  if(!arr.length){
    container.innerHTML='<span class="hint">No systems yet — add events first.</span>';
    return;
  }
  arr.forEach(function(sys){
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px';
    var lbl=document.createElement('span');
    lbl.style.cssText='flex:1;font-size:.83rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    lbl.textContent=sys;
    var inp=document.createElement('input');
    inp.type='number'; inp.min='1'; inp.step='1';
    inp.style.cssText='width:64px;flex-shrink:0;padding:5px 8px;font-size:.8rem';
    inp.placeholder='#';
    if(sysOrder[sys]!==undefined) inp.value=sysOrder[sys];
    inp.addEventListener('change',function(){
      var v=inp.value.trim();
      if(v==='') delete sysOrder[sys];
      else sysOrder[sys]=parseInt(v)||0;
      render();
    });
    row.appendChild(lbl); row.appendChild(inp);
    container.appendChild(row);
  });
}


// SYSTEMS & ACTORS REGISTRY

function refreshSystemsUI(){
  renderSystemsList();
  renderActorsList();
}

function renderSystemsList(){
  var el=document.getElementById('systems-list'); if(!el) return;
  var allSys=new Set([...knownSys]);
  systemsRegistry.forEach(function(s){allSys.add(s.name);});
  var arr=[...allSys].sort();
  if(!arr.length){el.innerHTML='<span class="hint">No systems yet.</span>';return;}
  el.innerHTML='';
  arr.forEach(function(name){
    var reg=systemsRegistry.find(function(s){return s.name===name;})||{name:name,desc:'',order:undefined};
    var row=document.createElement('div');
    row.style.cssText='background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 10px;display:flex;flex-direction:column;gap:6px';
    // Header row
    var hdr=document.createElement('div');
    hdr.style.cssText='display:flex;align-items:center;gap:6px';
    var lbl=document.createElement('span');
    lbl.style.cssText='flex:1;font-size:.83rem;font-weight:600;color:var(--text)';
    lbl.textContent=name;
    var orderInp=document.createElement('input');
    orderInp.type='number'; orderInp.min='1'; orderInp.placeholder='order';
    orderInp.style.cssText='width:58px;padding:3px 6px;font-size:.75rem';
    orderInp.title='Lane order';
    if(reg.order!==undefined) orderInp.value=reg.order;
    orderInp.addEventListener('change',function(){setSysOrder(name,orderInp.value);});
    var delBtn=document.createElement('button');
    delBtn.className='btn btn-d'; delBtn.style.cssText='padding:3px 8px;font-size:.7rem';
    delBtn.textContent='\u2715';
    delBtn.addEventListener('click',function(){deleteSystem(name);});
    hdr.appendChild(lbl); hdr.appendChild(orderInp); hdr.appendChild(delBtn);
    // Desc input
    var descInp=document.createElement('input');
    descInp.type='text'; descInp.placeholder='Description (optional)';
    descInp.style.cssText='font-size:.78rem;padding:5px 8px;width:100%;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);outline:none';
    descInp.value=reg.desc||'';
    descInp.addEventListener('change',function(){setSysDesc(name,descInp.value);});
    row.appendChild(hdr); row.appendChild(descInp);
    el.appendChild(row);
  });
}

function renderActorsList(){
  var el=document.getElementById('actors-list'); if(!el) return;
  if(!actorsRegistry.length){el.innerHTML='<span class="hint">No actors defined yet.</span>';return;}
  el.innerHTML='';
  actorsRegistry.forEach(function(a,i){
    var row=document.createElement('div');
    row.style.cssText='background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 10px;display:flex;flex-direction:column;gap:6px';
    row.innerHTML=
      '<div style="display:flex;align-items:center;gap:6px">'+
        '<input type="text" style="flex:1;font-size:.83rem;font-weight:600;padding:4px 8px" '+
          'value="'+esc(a.name)+'" placeholder="Actor name" onchange="setActorName('+i+',this.value)">'+
        '<button class="btn btn-d" style="padding:3px 8px;font-size:.7rem" onclick="deleteActor('+i+')">&#x2715;</button>'+
      '</div>'+
      '<input type="text" placeholder="Description (optional)" style="font-size:.78rem;padding:5px 8px" '+
        'value="'+esc(a.desc||'')+'" onchange="setActorDesc('+i+',this.value)">';
    el.appendChild(row);
  });
}

function addSystem(){
  var name=prompt('System / Context name:');
  if(!name||!name.trim()) return;
  name=name.trim();
  if(!systemsRegistry.find(function(s){return s.name===name;}))
    systemsRegistry.push({name:name,desc:'',order:undefined});
  knownSys.add(name); refreshDL(); renderSystemsList();
}
function deleteSystem(name){
  if(!confirm('Remove "'+name+'" from the registry? (Does not delete events using it.)')) return;
  systemsRegistry=systemsRegistry.filter(function(s){return s.name!==name;});
  knownSys.delete(name); refreshDL(); renderSystemsList();
}
function setSysOrder(name,val){
  var reg=systemsRegistry.find(function(s){return s.name===name;});
  if(!reg){reg={name:name,desc:''};systemsRegistry.push(reg);}
  reg.order=val.trim()===''?undefined:parseInt(val)||0;
  sysOrder[name]=reg.order!==undefined?reg.order:9999;
  render();
}
function setSysDesc(name,val){
  var reg=systemsRegistry.find(function(s){return s.name===name;});
  if(!reg){reg={name:name,order:undefined};systemsRegistry.push(reg);}
  reg.desc=val;
}
function addActor(){
  var name=prompt('Actor / Component name:');
  if(!name||!name.trim()) return;
  actorsRegistry.push({name:name.trim(),desc:''});
  renderActorsList();
  // Refresh actor datalist
  refreshActorDL();
}
function deleteActor(i){
  actorsRegistry.splice(i,1); renderActorsList(); refreshActorDL();
}
function setActorName(i,v){actorsRegistry[i].name=v.trim();refreshActorDL();}
function setActorDesc(i,v){actorsRegistry[i].desc=v;}
function refreshActorDL(){
  var dl=document.getElementById('actor-dl');
  if(!dl) return;
  dl.innerHTML='';
  actorsRegistry.forEach(function(a){var o=document.createElement('option');o.value=a.name;dl.appendChild(o);});
}
// INIT
document.addEventListener('DOMContentLoaded',function(){
  applyStoredTheme();
  switchAppMode('timeline'); refreshDL(); refreshActorDL(); updateList(); render();
  initLegend();
  document.getElementById('dc-level').checked=displayConfig.showLevel;
  document.getElementById('dc-event-code').checked=displayConfig.showEventCode;
  document.getElementById('dc-managed-integration-code').checked=displayConfig.showManagedIntegrationCode;
  document.getElementById('dc-actor').checked=displayConfig.showActor;
  document.getElementById('dc-show-date').checked=displayConfig.showDate;
  document.getElementById('dc-show-seq').checked=displayConfig.showSeq;
  document.getElementById('about-modal').addEventListener('click',function(e){
    if(e.target===this) closeAbout();
  });
});
