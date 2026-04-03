// ── FLOW DIAGRAM ────────────────────────────────────
function renderFlow(parent,direction,showSeq){
  ensureIds();
  var sySet=new Set();
  events.forEach(function(e){sySet.add(e.system);(e.interactions||[]).forEach(function(i){if(i.target)sySet.add(i.target);});});
  var sysArr=getSysArray(sySet);
  var evMap={}; events.forEach(function(e){evMap[e._id]=e;});
  var edges=[];
  events.forEach(function(src){
    (src.interactions||[]).forEach(function(inter){
      if(inter.triggerEventId&&evMap[inter.triggerEventId]) edges.push({from:src._id,to:inter.triggerEventId,inter:inter});
    });
  });
  // topo sort
  var inDeg={}; events.forEach(function(e){inDeg[e._id]=0;});
  edges.forEach(function(ed){inDeg[ed.to]=(inDeg[ed.to]||0)+1;});
  var queue=events.filter(function(e){return!inDeg[e._id];}).map(function(e){return e._id;});
  var order=[], vis=new Set();
  while(queue.length){
    var nid=queue.shift(); if(vis.has(nid)) continue; vis.add(nid); order.push(nid);
    edges.filter(function(ed){return ed.from===nid;}).forEach(function(ed){if(--inDeg[ed.to]===0)queue.push(ed.to);});
  }
  events.forEach(function(e){if(!vis.has(e._id)) order.push(e._id);});
  var isLR=direction==='lr';
  var seqOf={}; order.forEach(function(id,i){seqOf[id]=i;});
  var rowOf={}; events.forEach(function(e){rowOf[e._id]=sysArr.indexOf(e.system);});
  var BW=170,BH=58,LG=isLR?105:210,SG=isLR?215:165;
  function bC(id){
    var row=rowOf[id]!==undefined?rowOf[id]:0, seq=seqOf[id]!==undefined?seqOf[id]:0;
    return isLR?{x:seq*SG+BW/2+20,y:row*LG+BH/2+20}:{x:row*SG+BW/2+20,y:seq*LG+BH/2+20};
  }
  var mg={top:70,right:60,bottom:40,left:160};
  var pW=isLR?order.length*SG+60:sysArr.length*SG+60, pH=isLR?sysArr.length*LG+60:order.length*LG+60;
  var W=pW+mg.left+mg.right, H=pH+mg.top+mg.bottom;
  var svg=mkSVG(W,H), rid=svg._rid, g=sv('g',{transform:'translate('+mg.left+','+mg.top+')'}); svg.appendChild(g);
  // lanes
  sysArr.forEach(function(sys,i){
    var lp=isLR?i*LG:i*SG, ls=isLR?LG:SG;
    if(i%2===0) aR(g,isLR?-mg.left:lp-10,isLR?lp-10:-mg.top,isLR?pW+mg.left+mg.right:ls+20,isLR?ls+20:pH+mg.top+mg.bottom,{fill:svgColors().laneAlt});
    if(isLR) aT(g,-10,lp+BH/2+20,sys,{'text-anchor':'end','dominant-baseline':'middle','font-weight':'600','font-size':'12','fill':svgColors().label});
    else     aT(g,lp+BW/2+10,-20,sys,{'text-anchor':'middle','font-weight':'600','font-size':'12','fill':svgColors().label});
  });
  // causal edges (sorted by order within each source event)
  var sortedEdges=[...edges].sort(function(a,b){return (a.inter.order||0)-(b.inter.order||0);});
  // Group by source to number per-source
  var edgeOrderByFrom={};
  sortedEdges.forEach(function(ed){
    if(!edgeOrderByFrom[ed.from]) edgeOrderByFrom[ed.from]=0;
    ed._seqLabel=edgeOrderByFrom[ed.from]+1;
    edgeOrderByFrom[ed.from]++;
  });
  sortedEdges.forEach(function(ed){
    var src=bC(ed.from), dst=bC(ed.to);
    var color=ed.inter.nature==='push'?svgColors().accent:ed.inter.nature==='pull'?svgColors().teal:svgColors().proc;
    var isPull=ed.inter.nature==='pull';

    var PAD=6, HW=BW/2+PAD, HH=BH/2+PAD;
    function clipToBox(from,to,hw,hh){
      var dx=to.x-from.x, dy=to.y-from.y;
      if(dx===0&&dy===0) return {x:from.x,y:from.y};
      var t=Math.min(hw/Math.abs(dx||1),hh/Math.abs(dy||1));
      return {x:from.x+dx*t, y:from.y+dy*t};
    }

    var p1,p2,mEnd;
    if(isPull){
      p1=clipToBox(dst,src,HW,HH);
      p2=clipToBox(src,dst,HW,HH);
      mEnd='url(#arr-pull-'+rid+')';
    } else {
      p1=clipToBox(src,dst,HW,HH);
      p2=clipToBox(dst,src,HW,HH);
      mEnd='url(#arr-'+ed.inter.nature+'-'+rid+')';
    }
    if(ed.inter.nature==='process') mEnd='';

    // Straight line — arrowhead tangent is always perfectly aligned
    aL(g,p1.x,p1.y,p2.x,p2.y,{
      stroke:color,'stroke-width':2,
      'stroke-dasharray':ed.inter.nature==='process'?'5,4':'',
      'marker-end':mEnd
    });

    // Label and badge at midpoint
    var mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
    aT(g,mx,my-12,ed.inter.label||'',
      {'text-anchor':'middle','font-size':'9','fill':color,'font-family':'DM Mono,monospace'});
    aC(g,mx,my,9,{fill:color,opacity:.9});
    aT(g,mx,my+3,String(ed._seqLabel||''),{'text-anchor':'middle','font-size':'8','fill':'#fff','font-weight':'800','font-family':'DM Mono,monospace'});
  });
  // system-only interactions (sorted by order)
  events.forEach(function(srcEv){
    var src=bC(srcEv._id);
    var sortedSysI=[...(srcEv.interactions||[])].sort(function(a,b){return (a.order||0)-(b.order||0);});
    sortedSysI.forEach(function(inter,iIdx){
      if(inter.triggerEventId||!inter.target) return;
      var ti2=sysArr.indexOf(inter.target); if(ti2===-1) return;
      var color=inter.nature==='push'?svgColors().accent:inter.nature==='pull'?svgColors().teal:svgColors().proc;
      var isPull=inter.nature==='pull';

      // Target lane centre (approximate — no specific event, just the lane midpoint)
      var tLP=isLR?ti2*LG+BH/2+20:ti2*SG+BW/2+10;
      var tx=isLR?src.x+60:tLP, ty=isLR?tLP:src.y+80;

      // Clip from src box edge toward target
      var PAD=6, HW=BW/2+PAD, HH=BH/2+PAD;
      function clipBox(cx,cy,ox,oy){
        var dx=ox-cx,dy=oy-cy;
        if(dx===0&&dy===0) return {x:cx,y:cy};
        var t=Math.min(HW/Math.abs(dx||1),HH/Math.abs(dy||1));
        return {x:cx+dx*t,y:cy+dy*t};
      }

      var x1,y1,x2,y2,mEnd;
      if(isPull){
        // Arrow from target lane toward src box edge
        x1=tx; y1=ty;
        var clip=clipBox(src.x,src.y,tx,ty);
        x2=clip.x; y2=clip.y;
        mEnd='url(#arr-pull-'+rid+')';
      } else {
        var clip=clipBox(src.x,src.y,tx,ty);
        x1=clip.x; y1=clip.y;
        x2=tx; y2=ty;
        mEnd='url(#arr-'+inter.nature+'-'+rid+')';
      }

      if(inter.nature==='process') mEnd='';
      aL(g,x1,y1,x2,y2,{stroke:color,'stroke-width':1.5,'stroke-dasharray':'4,3','marker-end':mEnd});
      var lmx=(x1+x2)/2, lmy=(y1+y2)/2;
      aT(g,lmx,lmy-8,inter.label||'',{'text-anchor':'middle','font-size':'9','fill':color,'font-family':'DM Mono,monospace'});
      aC(g,lmx,lmy+4,8,{fill:color,opacity:.9});
      aT(g,lmx,lmy+7,String(iIdx+1),{'text-anchor':'middle','font-size':'7','fill':'#fff','font-weight':'800','font-family':'DM Mono,monospace'});
    });
  });
  // event boxes
  order.forEach(function(evId,seqIdx){
    var ev=evMap[evId]; if(!ev) return;
    var c=bC(evId), bx=c.x-BW/2, by=c.y-BH/2, row=rowOf[evId]||0, color=COLORS_ARR()[row%COLORS_ARR().length];
    aR(g,bx-2,by-2,BW+4,BH+4,{rx:11,fill:'none',stroke:color,'stroke-width':2,opacity:.25});
    aR(g,bx,by,BW,BH,{rx:9,fill:svgColors().nodeFill,stroke:color,'stroke-width':1.5});
    if(showSeq){
      aR(g,bx,by,26,BH,{rx:9,fill:color,opacity:.15});
      aT(g,bx+13,c.y+4,String(seqIdx+1),{'text-anchor':'middle','font-size':'10','fill':color,'font-weight':'800','font-family':'DM Mono,monospace'});
    }
    var tx=showSeq?bx+30:bx+9;
    aT(g,tx,by+17,trunc(ev.system,20),{'font-size':'8','fill':color,'font-family':'DM Mono,monospace','font-weight':'700'});
    aT(g,tx,by+32,trunc(ev.desc,22),{'font-size':'11','fill':svgColors().listDesc,'font-weight':'600'});
    if(ev.actor) aT(g,tx,by+46,trunc(ev.actor,22),{'font-size':'9','fill':svgColors().listTs});
  });
  // legend
  [['push \u2192',svgColors().accent],['pull \u2190',svgColors().teal],['process',svgColors().proc]].forEach(function(item,li){
    var lx=pW-120, ly=-50+li*16;
    aL(g,lx,ly+5,lx+18,ly+5,{stroke:item[1],'stroke-width':2});
    aT(g,lx+22,ly+9,item[0],{'font-size':'10','fill':svgColors().label,'font-family':'DM Mono,monospace'});
  });
  parent.appendChild(svg);
}

