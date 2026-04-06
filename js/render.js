// ── SVG BUILDER ─────────────────────────────────────────
var NS='http://www.w3.org/2000/svg';
function sv(tag,attrs,txt){
  var el=document.createElementNS(NS,tag);
  for(var k in attrs) if(attrs.hasOwnProperty(k)) el.setAttribute(k,String(attrs[k]));
  if(txt!=null) el.textContent=txt; return el;
}
var _renderId=0;
function mkSVG(W,H){
  _renderId++;
  var rid=_renderId;
  var svg=sv('svg',{width:'100%',height:H,viewBox:'0 0 '+W+' '+H,preserveAspectRatio:'xMidYMid meet'});
  var defs=sv('defs');

  // Standard arrowhead marker.
  // viewBox '0 0 10 10', tip at (10,5).
  // refX=10,refY=5 anchors the tip exactly to the line endpoint.
  // markerUnits=strokeWidth: marker scales with line width automatically.
  // markerWidth/Height=6: arrowhead = 6× strokeWidth in size.
  // orient=auto: rotates to match line direction.
  [
    ['push',    svgColors().accent, 'arr-push-'+rid],
    ['pull',    svgColors().teal,   'arr-pull-'+rid],
    ['process', svgColors().proc,   'arr-process-'+rid],
  ].forEach(function(p){
    var m=sv('marker',{
      id:p[2],
      viewBox:'0 0 10 10',
      refX:10, refY:5,
      markerUnits:'strokeWidth',
      markerWidth:6, markerHeight:6,
      orient:'auto'
    });
    m.appendChild(sv('path',{d:'M0,0 L10,5 L0,10 Z', fill:p[1], stroke:'none'}));
    defs.appendChild(m);
  });

  svg.appendChild(defs);
  svg.appendChild(sv('rect',{width:W,height:H,fill:svgColors().bg}));
  svg._rid=rid;
  return svg;
}
function scale1d(d0,d1,r0,r1){var f=(d1===d0)?0:(r1-r0)/(d1-d0);return function(v){return r0+(v-d0)*f;};}
function levelColor(level){
  if(level==='error')     return svgColors().accent;
  if(level==='warning')   return '#f5a623';
  if(level==='info')      return svgColors().teal;
  if(level==='debug')     return svgColors().debug;
  if(level==='comment')   return svgColors().cmnt;
  if(level==='work_note') return svgColors().note;
  return svgColors().label;
}
function drawLevelIcon(g,cx,cy,level,color){
  var sw={'stroke':color,'stroke-width':'2','stroke-linecap':'round','fill':'none'};
  var sw3={'stroke':color,'stroke-width':'2.5','stroke-linecap':'round','fill':'none'};
  if(level==='info'){
    aC(g,cx,cy-5,1.5,{fill:color,stroke:'none'});
    aL(g,cx,cy-2,cx,cy+6,sw);
  }else if(level==='warning'){
    aL(g,cx,cy-5,cx,cy+1,sw);
    aC(g,cx,cy+5,1.5,{fill:color,stroke:'none'});
  }else if(level==='error'){
    aL(g,cx-5,cy-5,cx+5,cy+5,sw3);
    aL(g,cx+5,cy-5,cx-5,cy+5,sw3);
  }else if(level==='debug'){
    aP(g,'M '+cx+' '+(cy-7)+' L '+(cx+6)+' '+cy+' L '+cx+' '+(cy+7)+' L '+(cx-6)+' '+cy+' Z',{fill:color,stroke:'none'});
  }else if(level==='comment'){
    aC(g,cx-4,cy,1.5,{fill:color,stroke:'none'});
    aC(g,cx,cy,1.5,{fill:color,stroke:'none'});
    aC(g,cx+4,cy,1.5,{fill:color,stroke:'none'});
  }else if(level==='work_note'){
    aL(g,cx-5,cy-4,cx+5,cy-4,sw);
    aL(g,cx-5,cy,cx+5,cy,sw);
    aL(g,cx-5,cy+4,cx+5,cy+4,sw);
  }else{
    aT(g,cx,cy+5,'?',{'text-anchor':'middle','font-size':'14','fill':color,'font-weight':'700','font-family':'DM Mono,monospace'});
  }
}
function aT(p,x,y,t,a){var e=sv('text',Object.assign({x:x,y:y},a));e.textContent=t;p.appendChild(e);return e;}
function aL(p,x1,y1,x2,y2,a){p.appendChild(sv('line',Object.assign({x1:x1,y1:y1,x2:x2,y2:y2},a)));return p;}
function aC(p,cx,cy,r,a){p.appendChild(sv('circle',Object.assign({cx:cx,cy:cy,r:r},a)));return p;}
function aR(p,x,y,w,h,a){p.appendChild(sv('rect',Object.assign({x:x,y:y,width:w,height:h},a)));return p;}
function aP(p,d,a){p.appendChild(sv('path',Object.assign({d:d},a)));return p;}

// ── RENDER DISPATCH ─────────────────────────────────────
function render(){
  var ca=document.getElementById('chart'); ca.innerHTML='';
  var te=document.getElementById('stitle');
  te.innerHTML=scenName?'<div class="sbanner">'+esc(scenName)+'<span class="ssub">'+esc(scenDesc)+'</span></div>':'';
  var active=getActiveEvents();
  if(!active.length){
    if(!events.length){
      ca.innerHTML='<div class="estate"><div class="estate-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div>'+
        '<h3>No events yet</h3><p>Add events in the sidebar, then they will appear here as a diagram.</p></div>';
    } else {
      ca.innerHTML='<div class="estate"><div class="estate-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div>'+
        '<h3>No events match filters</h3><p>Adjust or clear the active filters to see events.</p></div>';
    }
    if(typeof updateLegendColors==='function') updateLegendColors();
    return;
  }
  if(appMode==='timeline'){
    var sorted=[...active].sort(function(a,b){return(a.timestamp||0)-(b.timestamp||0);});
    var vm=document.getElementById('view-mode').value;
    if(vm==='single') renderList(ca,sorted);
    else if(vm==='table') renderTable(ca,sorted);
    else renderTimeline(ca,sorted,document.getElementById('orientation').value);
  }else{
    renderFlow(ca,document.getElementById('flow-dir').value,displayConfig.showSeq,active);
  }
  if(typeof updateLegendColors==='function') updateLegendColors();
}

// ── LIST VIEW ───────────────────────────────────────────
function renderList(parent,sorted){
  var wrap=document.createElement('div'); wrap.style.cssText='max-width:680px;margin:0 auto';
  sorted.forEach(function(e){
    var d=document.createElement('div');
    var c=svgColors();d.style.cssText='background:'+c.listBg+';border:1px solid '+c.listBdr+';border-radius:10px;padding:13px 15px;margin-bottom:10px;border-left:3px solid '+c.accent;
    var ts=new Date(e.timestamp).toISOString().slice(0,19).replace('T',' ');
    var levelHtml='';
    if(displayConfig.showLevel&&e.level){
      var lc=levelColor(e.level);
      levelHtml='<span style="display:inline-block;font-family:DM Mono,monospace;font-size:.65rem;font-weight:800;padding:1px 6px;border-radius:4px;background:'+lc+'22;color:'+lc+';margin-left:6px;vertical-align:middle">'+esc(e.level.toUpperCase())+'</span>';
    }
    var h='<div style="font-family:DM Mono,monospace;font-size:.7rem;color:'+c.listTs+';margin-bottom:5px">'+esc(ts)+'</div>'+
      '<div style="font-size:.93rem;font-weight:600;color:'+c.listDesc+';margin-bottom:3px">'+esc(e.desc)+levelHtml+'</div>'+
      '<div style="font-size:.77rem;color:'+c.listSys+'">'+esc(e.system||'')+(displayConfig.showActor&&e.actor?' &middot; '+esc(e.actor):'')+'</div>';
    if(displayConfig.showEventCode&&e.eventCode){
      h+='<div style="font-family:DM Mono,monospace;font-size:.72rem;color:'+c.listTs+';margin-top:3px">'+esc(e.eventCode)+(displayConfig.showManagedIntegrationCode&&e.managedIntegrationCode?' &middot; '+esc(e.managedIntegrationCode):'')+'</div>';
    } else if(displayConfig.showManagedIntegrationCode&&e.managedIntegrationCode){
      h+='<div style="font-family:DM Mono,monospace;font-size:.72rem;color:'+c.listTs+';margin-top:3px">'+esc(e.managedIntegrationCode)+'</div>';
    }
    if((e.interactions||[]).length){
      h+='<div style="margin-top:7px;font-size:.78rem;color:'+c.listInt+'">';
      e.interactions.forEach(function(i){h+='<span style="margin-right:9px">&rarr; '+esc(i.nature)+' '+esc(i.target)+(i.delay?' +'+i.delay+'ms':'')+'</span>';});
      h+='</div>';
    }
    d.innerHTML=h; wrap.appendChild(d);
  });
  parent.appendChild(wrap);
}

// ── TABLE VIEW ───────────────────────────────────────────
function renderTable(parent,sorted){
  var c=svgColors();
  var wrap=document.createElement('div');
  wrap.style.cssText='overflow-x:auto;width:100%;padding:10px 0';

  var tbl=document.createElement('table');
  tbl.style.cssText='width:100%;border-collapse:collapse;font-size:.83rem';

  // Header — first column is the expand-toggle column (no label)
  var thead=document.createElement('thead');
  var hrow=document.createElement('tr');
  var hcols=['expand','Timestamp','Description','Level','System','Actor','Event Code','Integration Code'];
  hcols.forEach(function(h){
    var th=document.createElement('th');
    th.textContent=h==='expand'?'':h; // expand column has no visible header text
    th.style.cssText='padding:8px 10px;text-align:left;font-family:DM Mono,monospace;font-size:.68rem;font-weight:700;'+
      'color:'+c.label+';border-bottom:2px solid '+c.grid+';white-space:nowrap;text-transform:uppercase;letter-spacing:.06em';
    hrow.appendChild(th);
  });
  thead.appendChild(hrow);
  tbl.appendChild(thead);

  var tbody=document.createElement('tbody');
  sorted.forEach(function(e,idx){
    var hasInts=(e.interactions||[]).length>0;
    var rowId='tbl-row-'+(e._id||idx);
    var isOdd=idx%2===1;
    var rowBg=isOdd?c.laneAlt:'transparent';

    // Main event row
    var tr=document.createElement('tr');
    tr.style.cssText='border-bottom:1px solid '+c.grid+';background:'+rowBg;

    // Expand toggle cell
    var tdTgl=document.createElement('td');
    tdTgl.style.cssText='padding:8px 6px;text-align:center;width:26px';
    if(hasInts){
      var btn=document.createElement('button');
      btn.textContent='+';
      btn.title='Show interactions';
      btn.style.cssText='background:none;border:1px solid '+c.accent+';color:'+c.accent+
        ';border-radius:4px;width:20px;height:20px;cursor:pointer;font-size:.8rem;line-height:1;padding:0;'+
        'display:inline-flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0';
      btn.onclick=(function(id,b){return function(){
        var sub=document.getElementById(id+'-sub');
        if(!sub) return;
        var open=sub.style.display!=='none';
        sub.style.display=open?'none':'';
        b.textContent=open?'+':'\u2212';
        b.title=open?'Show interactions':'Hide interactions';
      };})(rowId,btn);
      tdTgl.appendChild(btn);
    }
    tr.appendChild(tdTgl);

    // Timestamp
    var tdTs=document.createElement('td');
    tdTs.style.cssText='padding:8px 10px;font-family:DM Mono,monospace;font-size:.7rem;color:'+c.listTs+';white-space:nowrap';
    tdTs.textContent=e.timestamp?fmtTs(e.timestamp,displayConfig.showDate):'—';
    tr.appendChild(tdTs);

    // Description
    var tdDesc=document.createElement('td');
    tdDesc.style.cssText='padding:8px 10px;font-weight:600;color:'+c.listDesc;
    tdDesc.textContent=e.desc||'';
    tr.appendChild(tdDesc);

    // Level
    var tdLvl=document.createElement('td');
    tdLvl.style.cssText='padding:8px 10px;white-space:nowrap';
    if(e.level){
      var lc=levelColor(e.level);
      var lb=document.createElement('span');
      lb.textContent=e.level.toUpperCase();
      lb.style.cssText='font-family:DM Mono,monospace;font-size:.65rem;font-weight:800;padding:1px 6px;border-radius:4px;'+
        'background:'+lc+'22;color:'+lc;
      tdLvl.appendChild(lb);
    } else {
      tdLvl.style.cssText+='color:'+c.label;
      tdLvl.textContent='—';
    }
    tr.appendChild(tdLvl);

    // System
    var tdSys=document.createElement('td');
    tdSys.style.cssText='padding:8px 10px;color:'+c.listSys;
    tdSys.textContent=e.system||'—';
    tr.appendChild(tdSys);

    // Actor
    var tdAct=document.createElement('td');
    tdAct.style.cssText='padding:8px 10px;color:'+c.listSys;
    tdAct.textContent=e.actor||'—';
    tr.appendChild(tdAct);

    // Event Code
    var tdEc=document.createElement('td');
    tdEc.style.cssText='padding:8px 10px;font-family:DM Mono,monospace;font-size:.72rem;color:'+c.listTs;
    tdEc.textContent=e.eventCode||'—';
    tr.appendChild(tdEc);

    // Integration Code
    var tdIc=document.createElement('td');
    tdIc.style.cssText='padding:8px 10px;font-family:DM Mono,monospace;font-size:.72rem;color:'+c.listTs;
    tdIc.textContent=e.managedIntegrationCode||'—';
    tr.appendChild(tdIc);

    tbody.appendChild(tr);

    // Interactions sub-row (hidden by default)
    if(hasInts){
      var subTr=document.createElement('tr');
      subTr.id=rowId+'-sub';
      subTr.style.display='none';
      var subTd=document.createElement('td');
      subTd.colSpan=hcols.length;
      subTd.style.cssText='padding:4px 10px 10px 36px;background:'+c.subRowBg;

      // Sub-table header
      var subTbl=document.createElement('table');
      subTbl.style.cssText='width:100%;border-collapse:collapse;font-size:.77rem';
      var subThead=document.createElement('thead');
      var subHrow=document.createElement('tr');
      ['#','Target','Type','Delay','Label'].forEach(function(h){
        var th=document.createElement('th');
        th.textContent=h;
        th.style.cssText='padding:5px 8px;text-align:left;font-family:DM Mono,monospace;font-size:.65rem;font-weight:700;'+
          'color:'+c.listInt+';border-bottom:1px solid '+c.grid+';text-transform:uppercase;letter-spacing:.05em';
        subHrow.appendChild(th);
      });
      subThead.appendChild(subHrow);
      subTbl.appendChild(subThead);

      var subTbody=document.createElement('tbody');
      var sortedInts=[...(e.interactions||[])].sort(function(a,b){return(a.order||0)-(b.order||0);});
      sortedInts.forEach(function(i,ii){
        var itr=document.createElement('tr');
        itr.style.cssText='border-bottom:1px solid '+c.grid+'33';
        var natColor=i.nature==='push'?c.accent:i.nature==='pull'?c.teal:c.proc;
        [
          {text:String(ii+1),style:'font-family:DM Mono,monospace;font-size:.65rem;color:'+c.label+';width:24px'},
          {text:i.target||'—',style:'color:'+c.listSys+';font-weight:600'},
          {text:i.nature||'—',style:'font-family:DM Mono,monospace;color:'+natColor+';font-weight:700'},
          {text:i.delay?i.delay+'ms':'—',style:'font-family:DM Mono,monospace;color:'+c.listTs},
          {text:i.label||'—',style:'color:'+c.listDesc}
        ].forEach(function(cell){
          var td=document.createElement('td');
          td.textContent=cell.text;
          td.style.cssText='padding:5px 8px;'+cell.style;
          itr.appendChild(td);
        });
        subTbody.appendChild(itr);
      });
      subTbl.appendChild(subTbody);
      subTd.appendChild(subTbl);
      subTr.appendChild(subTd);
      tbody.appendChild(subTr);
    }
  });

  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  parent.appendChild(wrap);
}
