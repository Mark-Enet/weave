// ── TIMELINE MULTI-LANE ──────────────────────────────
function renderTimeline(parent,sorted,orientation){
  var sySet=new Set();
  sorted.forEach(function(e){sySet.add(e.system);(e.interactions||[]).forEach(function(i){if(i.target)sySet.add(i.target);});});
  var sysArr=getSysArray(sySet), N=sysArr.length, isH=orientation==='horizontal';
  var minT=sorted[0].timestamp, maxT=sorted[0].timestamp;
  sorted.forEach(function(e){
    minT=Math.min(minT,e.timestamp); maxT=Math.max(maxT,e.timestamp);
    (e.interactions||[]).forEach(function(i){maxT=Math.max(maxT,e.timestamp+(i.delay||0));});
  });
  if(minT===maxT) maxT=minT+60000;
  var LANE=isH?110:150, mg={top:65,right:80,bottom:65,left:165};
  var plotW=isH?Math.max(1200,N*LANE*2):N*LANE, plotH=isH?N*LANE:Math.max(600,sorted.length*100);
  var W=plotW+mg.left+mg.right, H=plotH+mg.top+mg.bottom;
  var sc=scale1d(minT,maxT,0,isH?plotW:plotH);
  function lp(i){return i*LANE+LANE/2;}
  var svg=mkSVG(W,H), rid=svg._rid, g=sv('g',{transform:'translate('+mg.left+','+mg.top+')'});
  svg.appendChild(g);
  var showDate=document.getElementById('show-date').checked;
  // grid ticks
  for(var ti=0;ti<=5;ti++){
    var tv=minT+(maxT-minT)*ti/5, sp=sc(tv), lbl=fmtTs(tv,showDate);
    if(isH){aL(g,sp,0,sp,plotH,{stroke:svgColors().grid,'stroke-width':1,'stroke-dasharray':'4,4'});
      aT(g,sp,plotH+16,lbl,{'text-anchor':'middle','font-size':'10','fill':svgColors().label,'font-family':'DM Mono,monospace'});}
    else{aL(g,0,sp,plotW,sp,{stroke:svgColors().grid,'stroke-width':1,'stroke-dasharray':'4,4'});
      aT(g,-8,sp,lbl,{'text-anchor':'end','dominant-baseline':'middle','font-size':'10','fill':svgColors().label,'font-family':'DM Mono,monospace'});}
  }
  // lanes
  sysArr.forEach(function(sys,i){
    var pos=lp(i);
    if(i%2===0) aR(g,isH?-mg.left:pos-LANE/2,isH?pos-LANE/2:-mg.top,isH?plotW+mg.left+mg.right:LANE,isH?LANE:plotH+mg.top+mg.bottom,{fill:svgColors().laneAlt});
    if(isH){aT(g,-8,pos,sys,{'text-anchor':'end','dominant-baseline':'middle','font-weight':'600','font-size':'12','fill':svgColors().label});}
    else{aT(g,pos,-16,sys,{'text-anchor':'middle','font-weight':'600','font-size':'12','fill':svgColors().label});}
    if(isH) aL(g,0,pos,plotW,pos,{stroke:svgColors().grid,'stroke-width':1});
    else     aL(g,pos,0,pos,plotH,{stroke:svgColors().grid,'stroke-width':1});
  });
  // legend
  [['push \u2192',svgColors().accent],['pull \u2190',svgColors().teal],['process',svgColors().proc]].forEach(function(item,li){
    var lx=plotW-130, ly=-40+li*16;
    aL(g,lx,ly+5,lx+18,ly+5,{stroke:item[1],'stroke-width':2});
    aT(g,lx+22,ly+9,item[0],{'font-size':'10','fill':svgColors().label,'font-family':'DM Mono,monospace'});
  });
  // interactions (drawn under nodes, sorted by order)
  var NODE_R=13; // circle radius
  sorted.forEach(function(e){
    var si=sysArr.indexOf(e.system), tp=sc(e.timestamp), bp=lp(si);
    var sortedI=[...(e.interactions||[])].sort(function(a,b){return (a.order||0)-(b.order||0);});
    sortedI.forEach(function(inter,iIdx){
      var ti2=sysArr.indexOf(inter.target); if(ti2===-1) return;
      var tLane=lp(ti2), tTP=sc(e.timestamp+(inter.delay||0));
      var ic=inter.nature==='push'?svgColors().accent:inter.nature==='pull'?svgColors().teal:svgColors().proc;
      var isPull=inter.nature==='pull';

      // Source node center and target node center
      var sx=isH?tp:bp, sy=isH?bp:tp;
      var tx=isH?tTP:tLane, ty=isH?tLane:tTP;

      // Clip endpoints to node circle edges so arrowheads sit on the circle border
      // clipCircle: returns point on circle at (cx,cy) with radius r, on the side facing (ox,oy)
      function clipCircle(cx,cy,ox,oy,r){
        var dx=ox-cx, dy=oy-cy, dist=Math.sqrt(dx*dx+dy*dy)||1;
        return {x:cx+dx/dist*r, y:cy+dy/dist*r};
      }

      var x1,y1,x2,y2,mEnd;
      if(isPull){
        // Line goes FROM target circle edge TOWARD source circle edge
        // Arrowhead (marker-end) lands on source circle edge
        var p1=clipCircle(tx,ty,sx,sy,NODE_R+2); // exit target facing source
        var p2=clipCircle(sx,sy,tx,ty,NODE_R+2); // source edge facing target (arrowhead lands here)
        x1=p1.x; y1=p1.y; x2=p2.x; y2=p2.y;
        mEnd='url(#arr-pull-'+rid+')';
      } else {
        // Line goes FROM source circle edge TOWARD target circle edge
        var p1=clipCircle(sx,sy,tx,ty,NODE_R+2); // exit source facing target
        var p2=clipCircle(tx,ty,sx,sy,NODE_R+2); // target edge facing source (arrowhead lands here)
        x1=p1.x; y1=p1.y; x2=p2.x; y2=p2.y;
        mEnd='url(#arr-'+inter.nature+'-'+rid+')';
      }
      if(inter.nature==='process') mEnd='';

      aL(g,x1,y1,x2,y2,{stroke:ic,'stroke-width':2,'stroke-dasharray':inter.nature==='process'?'5,3':'','marker-end':mEnd});
      var lbl=inter.label||(appMode==='timeline'&&inter.delay?inter.nature+' +'+inter.delay+'ms':'');
      var mx=(x1+x2)/2+(isH?0:5), my=(y1+y2)/2-14;
      aT(g,mx,my,lbl,{'text-anchor':'middle','font-size':'9','fill':ic,'font-family':'DM Mono,monospace'});
      // Sequence badge
      var bmx=(x1+x2)/2, bmy=(y1+y2)/2;
      aC(g,bmx,bmy,9,{fill:ic,opacity:.9});
      aT(g,bmx,bmy+4,String(iIdx+1),{'text-anchor':'middle','font-size':'8','fill':'#fff','font-weight':'800','font-family':'DM Mono,monospace'});
    });
  });
  // nodes
  sorted.forEach(function(e){
    var si=sysArr.indexOf(e.system), tp=sc(e.timestamp), bp=lp(si);
    var cx=isH?tp:bp, cy=isH?bp:tp, color=COLORS_ARR()[si%COLORS_ARR().length];
    aC(g,cx,cy,13,{fill:svgColors().nodeFill,stroke:color,'stroke-width':'2.5'});
    aT(g,cx,cy+4,initials(e.actor),{'text-anchor':'middle','font-size':'9','fill':svgColors().actor,'font-weight':'700','font-family':'DM Mono,monospace'});
    aT(g,isH?cx:cx+17,isH?cy+26:cy+4,trunc(e.desc,30),{'text-anchor':isH?'middle':'start','font-size':'11','fill':svgColors().label});
  });
  parent.appendChild(svg);
}
