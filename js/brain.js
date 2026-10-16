/* The brain view, rebuilt for the page from Liberty's brain spec (sample Halvorsen brain, brain-data.js).
   A turning wireframe brain: files on the cortex, lanes on the frontal lobe, reports as dust on the cerebellum,
   robots as lamps down the stem, hooks as gates, gold threads for cross-references, a 24 hour clock around it.
   Projection from the spec: rotate by yaw then pitch; s = scale * 3.6 / (3.6 - z). */
(function () {
  'use strict';
  var D = window.KV_BRAIN;
  if (!D) return;
  var GREEN = '82,255,94', GOLD = '255,204,102', SOFT = '255,225,168';
  var TAU = Math.PI * 2;

  function ring(fn, n) { var a = []; for (var i = 0; i <= n; i++) a.push(fn(i / n)); return a; }

  // geometry, built once in model space
  var G = (function () {
    var rings = [];
    // cortex: latitude rings with folds
    for (var k = 0; k < 22; k++) {
      var v = -0.5 + k * (1.46 / 21);
      rings.push({ kind: 'c', pts: ring(function (u) {
        var th = u * TAU, q = Math.sqrt(Math.max(0, 1 - v * v));
        var rr = q * (1 + .05 * Math.sin(7 * th + 5 * v) + .03 * Math.sin(13 * th - 3 * v));
        var x = 1.0 * rr * Math.cos(th), z = 1.38 * rr * Math.sin(th);
        var y = .12 + .78 * v - (v > .3 ? .07 * Math.exp(-(x * x) / .02) : 0);
        return [x, y, z];
      }, 120) });
    }
    // meridians
    for (var m = 0; m < 10; m++) {
      var th0 = m / 10 * TAU;
      rings.push({ kind: 'm', pts: ring(function (u) {
        var v = -0.5 + u * 1.46, q = Math.sqrt(Math.max(0, 1 - v * v));
        var rr = q * (1 + .05 * Math.sin(7 * th0 + 5 * v));
        return [1.0 * rr * Math.cos(th0), .12 + .78 * v, 1.38 * rr * Math.sin(th0)];
      }, 60) });
    }
    // cerebellum
    for (var c = 0; c < 9; c++) {
      var w = -0.85 + c * (1.7 / 8);
      rings.push({ kind: 'b', pts: ring(function (u) {
        var th = u * TAU, q = Math.sqrt(Math.max(0, 1 - w * w));
        return [.56 * q * Math.cos(th) * (1 + .04 * Math.sin(9 * th)), -.46 + .24 * w, -.82 + .42 * q * Math.sin(th)];
      }, 60) });
    }
    // stem helix
    rings.push({ kind: 's', pts: ring(function (u) {
      var th = u * TAU * 7;
      return [.1 * Math.cos(th), -.42 - u * 1.08, -.36 + .1 * Math.sin(th)];
    }, 240) });
    return rings;
  })();

  var byId = {};
  D.nodes.forEach(function (n) { byId[n.id] = n; });
  var links = D.links.map(function (l) { return { a: byId[l[0]], b: byId[l[1]], t: Math.random(), sp: .045 + Math.random() * .055, hot: 0 }; })
    .filter(function (l) { return l.a && l.b; });

  function BrainView(canvas, opts) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.mini = !!(opts && opts.mini);
    this.yaw = this.mini ? 1.0 : .85; this.pitch = this.mini ? .06 : .28;
    this.running = false; this.last = 0; this.t = 0; this.focus = null; this.bloom = 0; this.reveal = 1;
    this.onNode = opts && opts.onNode;
    this.readIdx = 0; this.readT = 0; this.readEvery = 2.4;
    var self = this;
    this._loop = function (now) { if (!self.running) return; requestAnimationFrame(self._loop); self.draw(now); };
  }
  BrainView.prototype.resize = function () {
    var r = { width: this.cv.offsetWidth, height: this.cv.offsetHeight }, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!r.width) return;
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
  };
  BrainView.prototype.start = function () { if (this.running) return; this.running = true; this.last = 0; this.resize(); requestAnimationFrame(this._loop); };
  BrainView.prototype.stop = function () { this.running = false; };
  BrainView.prototype.proj = function (p) {
    var cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    var x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1];
    var y2 = y * cp - z * sp, z2 = y * sp + z * cp;
    var s = this.sc * 3.6 / (3.6 - z2);
    return [this.cx + x * s, this.cy - y2 * s, z2];
  };
  BrainView.prototype.draw = function (now) {
    var dt = this.last ? Math.min(.05, (now - this.last) / 1000) : 0; this.last = now; this.t += dt;
    if (!this.W || this.cv.offsetWidth !== this.W) this.resize();
    var g = this.g, W = this.W, H = this.H, mini = this.mini;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    this.yaw += dt * (mini ? .12 : .0483 * 2.2);
    var phone = W < 560;
    this.cx = W * (mini ? .5 : phone ? .5 : .43); this.cy = H * (mini ? .52 : phone ? .44 : .55);
    this.sc = mini ? Math.min(W, H) * .3 : phone ? Math.min(W, H) * .24 : Math.min(W * .62, H) * .25;
    var rv = this.reveal;
    // clock ring
    if (!mini) {
      var RC = this.sc * 1.5;
      g.strokeStyle = 'rgba(' + GREEN + ',.16)'; g.lineWidth = 1;
      g.beginPath(); g.arc(this.cx, this.cy, RC, 0, TAU); g.stroke();
      for (var h = 0; h < 96; h++) {
        var an = h / 96 * TAU - Math.PI / 2, L = h % 24 === 0 ? 10 : h % 4 === 0 ? 5 : 2.5;
        g.beginPath(); g.moveTo(this.cx + Math.cos(an) * RC, this.cy + Math.sin(an) * RC);
        g.lineTo(this.cx + Math.cos(an) * (RC - L), this.cy + Math.sin(an) * (RC - L)); g.stroke();
      }
      if (!phone) {
        g.fillStyle = 'rgba(200,220,200,.55)'; g.font = '10px JBM, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
        [['12 AM', 0], ['6 AM', .25], ['12 PM', .5], ['6 PM', .75]].forEach(function (l) {
          var a = l[1] * TAU - Math.PI / 2; g.fillText(l[0], this.cx + Math.cos(a) * (RC + 22), this.cy + Math.sin(a) * (RC + 22));
        }, this);
      }
      // the robots on the clock, and the now hand at 4:20 PM
      var nowA = (16 + 20 / 60) / 24 * TAU - Math.PI / 2;
      g.strokeStyle = 'rgba(' + GOLD + ',.85)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(this.cx + Math.cos(nowA) * (RC - 14), this.cy + Math.sin(nowA) * (RC - 14)); g.lineTo(this.cx + Math.cos(nowA) * (RC + 8), this.cy + Math.sin(nowA) * (RC + 8)); g.stroke();
      D.sats.forEach(function (s) {
        var m = /(\d+):(\d+):\d+ (AM|PM)/.exec(s.next); if (!m) return;
        var hr = (+m[1] % 12) + (m[3] === 'PM' ? 12 : 0) + (+m[2]) / 60, a = hr / 24 * TAU - Math.PI / 2;
        var br = .5 + .5 * Math.sin(this.t * 2.4 + hr);
        g.fillStyle = 'rgba(' + GREEN + ',' + (.55 + .45 * br) + ')';
        g.beginPath(); g.arc(this.cx + Math.cos(a) * RC, this.cy + Math.sin(a) * RC, 3, 0, TAU); g.fill();
      }, this);
    }
    // rings, front and back passes
    var self = this;
    G.forEach(function (rg) {
      var col = rg.kind === 'b' ? SOFT : GREEN, k = rg.kind === 'm' ? .5 : rg.kind === 's' ? .8 : 1;
      var pts = rg.pts.map(function (p) { return self.proj(p); });
      for (var pass = 0; pass < 2; pass++) {
        g.beginPath(); var on = false;
        for (var i = 0; i < pts.length; i++) {
          var front = pts[i][2] > -0.05;
          if (front === (pass === 1)) { if (!on) { g.moveTo(pts[i][0], pts[i][1]); on = true; } else g.lineTo(pts[i][0], pts[i][1]); }
          else on = false;
        }
        g.strokeStyle = 'rgba(' + col + ',' + ((pass ? .32 : .08) * k * rv) + ')'; g.lineWidth = pass ? 1 : 1;
        g.stroke();
      }
    });
    if (mini) {
      // the scan beam only, as the rail panel shows
      var rgB = G[(Math.floor(this.t * 2) % 22)].pts, hi = Math.floor((this.t * 170) % rgB.length);
      g.beginPath();
      for (var bI = 0; bI < 40; bI++) { var pp = this.proj(rgB[(hi - bI + rgB.length) % rgB.length]); if (!bI) g.moveTo(pp[0], pp[1]); else g.lineTo(pp[0], pp[1]); }
      g.strokeStyle = 'rgba(214,255,208,.9)'; g.lineWidth = 1.6; g.stroke();
      return;
    }
    // threads with a moving dot
    links.forEach(function (l) {
      var a = self.proj(l.a.p), b = self.proj(l.b.p), z = (a[2] + b[2]) / 2, hot = l.hot;
      l.t = (l.t + dt * (l.sp + hot / 2.6)) % 1; l.hot = hot * Math.pow(.5, dt / 1.2);
      g.strokeStyle = 'rgba(' + GOLD + ',' + ((z > 0 ? .16 : .06) + hot * .6) * rv + ')'; g.lineWidth = .8 + hot;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      var dx = a[0] + (b[0] - a[0]) * l.t, dy = a[1] + (b[1] - a[1]) * l.t;
      g.fillStyle = 'rgba(' + GOLD + ',' + (.5 + hot * .5) * rv + ')'; g.fillRect(dx - 1, dy - 1, 2, 2);
    });
    // cycle the reader through every node, oldest to newest, blooming the node it reads
    this.readT += dt;
    if (this.readT > this.readEvery) { this.readT = 0; this.readIdx = (this.readIdx + 1) % D.nodes.length; this.fire(); }
    var cur = D.nodes[this.readIdx];
    // nodes
    D.nodes.forEach(function (n) {
      var p = self.proj(n.p), z = p[2], fa = (z > -0.2 ? 1 : .45) * rv, isCur = n === cur;
      var r, col, lab = null, labCol;
      if (n.k === 'lane') { r = 3.6; col = GOLD; lab = n.l; labCol = 'rgba(' + GOLD + ',' + .95 * fa + ')'; }
      else if (n.k === 'file') { r = 2.7; col = '237,237,239'; lab = n.l; labCol = 'rgba(237,237,239,' + .85 * fa + ')'; }
      else if (n.k === 'report') { r = 1.6; col = SOFT; lab = phone ? null : n.l.slice(11); labCol = 'rgba(' + SOFT + ',' + .5 * fa + ')'; }
      else if (n.k === 'robot') { r = 2.4; col = GREEN; lab = phone ? null : n.l; labCol = 'rgba(' + GREEN + ',' + .7 * fa + ')'; }
      else { // gate: a small hexagon
        g.strokeStyle = 'rgba(237,237,239,' + .7 * fa + ')'; g.lineWidth = 1; g.beginPath();
        for (var h = 0; h <= 6; h++) { var an = h / 6 * TAU; var hx = p[0] + Math.cos(an) * 4, hy = p[1] + Math.sin(an) * 4; if (!h) g.moveTo(hx, hy); else g.lineTo(hx, hy); }
        g.stroke(); r = 0; lab = isCur ? n.l : null; labCol = '#fff';
      }
      if (r) { g.fillStyle = 'rgba(' + col + ',' + fa + ')'; g.beginPath(); g.arc(p[0], p[1], r, 0, TAU); g.fill(); }
      if (isCur) {
        var bt = self.readT / 3.6, e = 1 - Math.pow(1 - Math.min(1, bt), 2);
        g.strokeStyle = 'rgba(' + GOLD + ',' + (.8 * Math.pow(1 - Math.min(1, bt), 1.5)) + ')'; g.lineWidth = 1.4;
        g.beginPath(); g.arc(p[0], p[1], 4 + 40 * e, 0, TAU); g.stroke();
        g.beginPath(); g.arc(p[0], p[1], 4 + 22 * e, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(p[0], p[1], 7, 0, TAU); g.stroke();
        labCol = '#fff';
        if (!lab) lab = n.l;
      }
      if (lab) {
        g.font = (n.k === 'lane' || isCur ? '600 ' : '') + (phone ? 9.5 : 10.5) + 'px JBM, monospace';
        g.fillStyle = labCol; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(lab, p[0] + 7, p[1]);
      }
    });
    if (this.onNode && this._shown !== cur) { this._shown = cur; this.onNode(cur, this.readIdx); }
  };
  BrainView.prototype.fire = function () {
    var n = D.nodes[this.readIdx];
    links.forEach(function (l) { if (l.a === n || l.b === n) l.hot = 1; });
  };
  window.KVBrainView = BrainView;
})();
