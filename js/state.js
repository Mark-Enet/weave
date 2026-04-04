// ── STATE ───────────────────────────────────────────────
var APP_VERSION = '2026.04.03';
var events=[], editIdx=-1, iCount=0, scenName='', scenDesc='', appMode='timeline';
var sysOrder={}; // { systemName: orderNumber } — lower = earlier in diagram
var systemsRegistry=[]; // [{name,desc,order}]
var actorsRegistry=[];  // [{name,desc}]
var knownSys=new Set();
var displayConfig={showLevel:true,showEventCode:true,showManagedIntegrationCode:true};
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
    actor:    dark?'#fff':'#fff',
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
function toDTL(iso){return iso?iso.replace('Z','').slice(0,19):'';}

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
