// ── STATE ───────────────────────────────────────────────
var APP_VERSION = '2026.04.06.171904';
var events=[], editIdx=-1, iCount=0, scenName='', scenDesc='', appMode='timeline';
var timelineCompact = localStorage.getItem('weave-timeline-compact') === 'true';
var sysOrder={}; // { systemName: orderNumber } — lower = earlier in diagram
var systemsRegistry=[]; // [{name,desc,order}]
var actorsRegistry=[];  // [{name,desc}]
var knownSys=new Set();
var displayConfig={showLevel:true,showEventCode:true,showManagedIntegrationCode:true,showActor:true,showDate:true,showSeq:true};
var filterConfig={text:'',systems:[],actors:[],levels:[],eventCodes:[],integrationCodes:[]};
var COLORS_L=['#e8604a','#3cbfbf','#f5a623','#7755cc','#c04535','#2a9d8f','#e76f51'];
var COLORS_D=['#f07060','#45d0d0','#f5b030','#8888cc','#e05050','#35b8b8','#f09070'];
function COLORS_ARR(){return document.documentElement.classList.contains('dark')?COLORS_D:COLORS_L;}

// THEME-AWARE SVG COLORS
function svgColors(){
  var dark=document.documentElement.classList.contains('dark');
  return {
    bg:       dark?'#13111e':'#fdf3e3',
    nodeFill: dark?'#1c1a2e':'#fff8f0',
    laneAlt:  dark?'rgba(240,112,96,0.04)':'rgba(232,96,74,0.03)',
    grid:     dark?'#2a2545':'#e8c990',
    label:    dark?'#a8a0cc':'#7a5c3a',
    desc:     dark?'#e8e2ff':'#5a3e28',
    listBg:   dark?'#1c1a2e':'#fff8f0',
    listBdr:  dark?'#3a3560':'#e8c990',
    listTs:   dark?'#7870aa':'#b08050',
    listDesc: dark?'#ccc8e8':'#3d2b1a',
    listSys:  dark?'#a8a0cc':'#7a5c3a',
    listInt:  dark?'#7870aa':'#b08050',
    accent:   dark?'#f07060':'#e8604a',
    teal:     dark?'#45d0d0':'#3cbfbf',
    proc:     dark?'#8888dd':'#1c8080',
    actor:    dark?'#fff':'#5a3e28',
    debug:    dark?'#99aacc':'#5566aa',
    subRowBg: dark?'rgba(30,26,50,.6)':'rgba(255,248,240,.9)',
  };
}

// UTILS
function toast(msg,icon){
  document.getElementById('tmsg').textContent=msg;
  document.getElementById('ticon').textContent=icon||'\u2713';
  var t=document.getElementById('toast'); t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},3000);
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function initials(s){return (s||'?').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,3);}
function trunc(s,n){s=s||'';return s.length>n?s.slice(0,n-1)+'\u2026':s;}
function fmtTs(ms,showDate){
  var d=new Date(ms), date=d.toISOString().slice(0,10), time=d.toISOString().slice(11,19);
  return showDate?date+' '+time:time;
}
function fromDTL(v){return v?new Date(v).getTime():null;}
function toDTL(iso){
  if(!iso) return '';
  var d=new Date(iso);
  // Adjust UTC time to local time so datetime-local input displays correctly.
  // getTimezoneOffset() returns (UTC - local) in minutes; subtracting it shifts
  // the UTC epoch into a "fake UTC" value that toISOString() will render as
  // local clock time — which is what the datetime-local input expects.
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19);
}

// SYSTEM ARRAY — sorted by sysOrder, then alphabetically
function getSysArray(sySet){
  var arr=[...sySet];
  arr.sort(function(a,b){
    var oa=sysOrder[a]!==undefined?sysOrder[a]:9999;
    var ob=sysOrder[b]!==undefined?sysOrder[b]:9999;
    if(oa!==ob) return oa-ob;
    return a<b?-1:a>b?1:0;
  });
  return arr;
}

// ENSURE IDS
function ensureIds(){events.forEach(function(ev,i){if(!ev._id) ev._id='evt-'+Date.now()+'-'+i;});}

// ACTIVE (FILTERED) EVENTS
function getActiveEvents(){
  var q=(filterConfig.text||'').trim().toLowerCase();
  return events.filter(function(ev){
    if(q){
      var hay=[ev.desc,ev.system,ev.actor,ev.eventCode,ev.managedIntegrationCode,ev.level].join(' ').toLowerCase();
      if(hay.indexOf(q)===-1) return false;
    }
    if(filterConfig.systems.length&&filterConfig.systems.indexOf(ev.system)===-1) return false;
    if(filterConfig.actors.length&&filterConfig.actors.indexOf(ev.actor||'')===-1) return false;
    if(filterConfig.levels.length&&filterConfig.levels.indexOf(ev.level||'')===-1) return false;
    if(filterConfig.eventCodes.length&&filterConfig.eventCodes.indexOf(ev.eventCode||'')===-1) return false;
    if(filterConfig.integrationCodes.length&&filterConfig.integrationCodes.indexOf(ev.managedIntegrationCode||'')===-1) return false;
    return true;
  });
}
function isFilterActive(){
  return !!(filterConfig.text.trim()||filterConfig.systems.length||filterConfig.actors.length||
    filterConfig.levels.length||filterConfig.eventCodes.length||filterConfig.integrationCodes.length);
}
