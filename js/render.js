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
  if(level==='error') return svgColors().accent;
  if(level==='warning') return '#f5a623';
  if(level==='info') return svgColors().teal;
  return svgColors().label;
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
  if(!events.length){
    ca.innerHTML='<div class="estate"><div class="estate-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div>'+
      '<h3>No events yet</h3><p>Add events in the sidebar, then they will appear here as a diagram.</p></div>';
    return;
  }
  if(appMode==='timeline'){
    var sorted=[...events].sort(function(a,b){return(a.timestamp||0)-(b.timestamp||0);});
    document.getElementById('view-mode').value==='single'?renderList(ca,sorted):renderTimeline(ca,sorted,document.getElementById('orientation').value);
  }else{
    renderFlow(ca,document.getElementById('flow-dir').value,displayConfig.showSeq);
  }
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
