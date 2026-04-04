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
  var NODE_R=13, ARROW_OFFSET=8;

  // 1. Collect all arrows
  var arrows=[];
  sorted.forEach(function(e){
    var si=sysArr.indexOf(e.system), tp=sc(e.timestamp), bp=lp(si);
    var sortedI=[...(e.interactions||[])].sort(function(a,b){return (a.order||0)-(b.order||0);});
    sortedI.forEach(function(inter,iIdx){
      var ti2=sysArr.indexOf(inter.target); if(ti2===-1) return;
      var tLane=lp(ti2), tTP=sc(e.timestamp+(inter.delay||0));
      var ic=inter.nature==='push'?svgColors().accent:inter.nature==='pull'?svgColors().teal:svgColors().proc;
      var sx=isH?tp:bp, sy=isH?bp:tp;
      var tx=isH?tTP:tLane, ty=isH?tLane:tTP;
      arrows.push({
        sx:sx,sy:sy,tx:tx,ty:ty,
        nature:inter.nature,color:ic,isPull:inter.nature==='pull',
        label:inter.label||(appMode==='timeline'&&inter.delay?inter.nature+' +'+inter.delay+'ms':''),
        seqIdx:iIdx,_offset:0
      });
    });
  });

  // 2. Group by source/target pair and compute lateral offsets
  function pairKey(sx,sy,tx,ty){
    var a=Math.round(sx)+'_'+Math.round(sy), b=Math.round(tx)+'_'+Math.round(ty);
    return a<b?a+'|'+b:b+'|'+a;
  }
  function isFwd(sx,sy,tx,ty){
    var a=Math.round(sx)+'_'+Math.round(sy), b=Math.round(tx)+'_'+Math.round(ty);
    return a<=b;
  }
  var groups={};
  arrows.forEach(function(ar){
    var k=pairKey(ar.sx,ar.sy,ar.tx,ar.ty);
    if(!groups[k]) groups[k]=[];
    groups[k].push(ar);
  });
  Object.keys(groups).forEach(function(k){
    var grp=groups[k];
    if(grp.length<=1) return;
    var fwd=grp.filter(function(a){return isFwd(a.sx,a.sy,a.tx,a.ty);});
    var rev=grp.filter(function(a){return !isFwd(a.sx,a.sy,a.tx,a.ty);});
    if(fwd.length>0&&rev.length>0){
      fwd.forEach(function(a,i){a._offset=(i-(fwd.length-1)/2)*ARROW_OFFSET+ARROW_OFFSET/2;});
      rev.forEach(function(a,i){a._offset=(i-(rev.length-1)/2)*ARROW_OFFSET-ARROW_OFFSET/2;});
    } else {
      grp.forEach(function(a,i){a._offset=(i-(grp.length-1)/2)*ARROW_OFFSET;});
    }
  });

  // 3. Draw arrows with offsets applied
  function clipCircle(cx,cy,ox,oy,r){
    var dx=ox-cx, dy=oy-cy, dist=Math.sqrt(dx*dx+dy*dy)||1;
    return {x:cx+dx/dist*r, y:cy+dy/dist*r};
  }
  arrows.forEach(function(ar){
    // Compute perpendicular offset
    var dx=ar.tx-ar.sx, dy=ar.ty-ar.sy, dist=Math.sqrt(dx*dx+dy*dy)||1;
    var px=-dy/dist, py=dx/dist;
    var off=ar._offset;
    var osx=ar.sx+px*off, osy=ar.sy+py*off;
    var otx=ar.tx+px*off, oty=ar.ty+py*off;

    var x1,y1,x2,y2,mEnd;
    if(ar.isPull){
      var p1=clipCircle(ar.tx,ar.ty,osx,osy,NODE_R+2);
      var p2=clipCircle(ar.sx,ar.sy,otx,oty,NODE_R+2);
      x1=p1.x; y1=p1.y; x2=p2.x; y2=p2.y;
      mEnd='url(#arr-pull-'+rid+')';
    } else {
      var p1=clipCircle(ar.sx,ar.sy,otx,oty,NODE_R+2);
      var p2=clipCircle(ar.tx,ar.ty,osx,osy,NODE_R+2);
      x1=p1.x; y1=p1.y; x2=p2.x; y2=p2.y;
      mEnd='url(#arr-'+ar.nature+'-'+rid+')';
    }
    if(ar.nature==='process') mEnd='';

    aL(g,x1,y1,x2,y2,{stroke:ar.color,'stroke-width':2,'stroke-dasharray':ar.nature==='process'?'5,3':'','marker-end':mEnd});
    var mx=(x1+x2)/2+(isH?0:5), my=(y1+y2)/2-14;
    aT(g,mx,my,ar.label,{'text-anchor':'middle','font-size':'9','fill':ar.color,'font-family':'DM Mono,monospace'});
    var bmx=(x1+x2)/2, bmy=(y1+y2)/2;
    aC(g,bmx,bmy,9,{fill:ar.color,opacity:.9});
    aT(g,bmx,bmy+4,String(ar.seqIdx+1),{'text-anchor':'middle','font-size':'8','fill':'#fff','font-weight':'800','font-family':'DM Mono,monospace'});
  });

  // nodes
  sorted.forEach(function(e){
    var si=sysArr.indexOf(e.system), tp=sc(e.timestamp), bp=lp(si);
    var cx=isH?tp:bp, cy=isH?bp:tp, color=COLORS_ARR()[si%COLORS_ARR().length];
    aC(g,cx,cy,13,{fill:svgColors().nodeFill,stroke:color,'stroke-width':'2.5'});
    aT(g,cx,cy+4,initials(e.actor),{'text-anchor':'middle','font-size':'9','fill':svgColors().actor,'font-weight':'700','font-family':'DM Mono,monospace'});
    aT(g,isH?cx:cx+17,isH?cy+26:cy+4,trunc(e.desc,30),{'text-anchor':isH?'middle':'start','font-size':'11','fill':svgColors().label});
    if(displayConfig.showLevel&&e.level){
      var lc=levelColor(e.level);
      var lx=isH?cx:cx+17, ly=isH?cy+38:cy+17;
      aT(g,lx,ly,e.level.toUpperCase(),{'text-anchor':isH?'middle':'start','font-size':'8','fill':lc,'font-family':'DM Mono,monospace','font-weight':'700'});
    }
    var extraY=isH?cy+38:cy+17;
    if(displayConfig.showLevel&&e.level) extraY+=isH?12:12;
    if(displayConfig.showEventCode&&e.eventCode){
      aT(g,isH?cx:cx+17,extraY+(isH?0:0),trunc(e.eventCode,20),{'text-anchor':isH?'middle':'start','font-size':'9','fill':svgColors().listTs,'font-family':'DM Mono,monospace'});
      extraY+=12;
    }
    if(displayConfig.showManagedIntegrationCode&&e.managedIntegrationCode){
      aT(g,isH?cx:cx+17,extraY,trunc(e.managedIntegrationCode,20),{'text-anchor':isH?'middle':'start','font-size':'9','fill':svgColors().listInt,'font-family':'DM Mono,monospace'});
    }
  });
  parent.appendChild(svg);
}
