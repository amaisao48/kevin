/* KEVIN sky: one set of points that (1) shatter out of the failing chat window, (2) fly together into the KEVIN
   letters, (3) drift out into the faint star field that stays behind the rest of the page.
   The main timeline drives it by writing to KVSky.st (shatter, gather, solid, release, stars). */
(function () {
  'use strict';
  var cv = document.getElementById('sky');
  if (!cv || !cv.getContext || document.documentElement.className.indexOf('js') < 0) return;
  var ctx = cv.getContext('2d');
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  var W = 0, H = 0, phone = false;
  var P = [];           // particles
  var sprite;           // one round point, drawn once
  var st = { shatter: 0, gather: 0, solid: 0, release: 0, stars: 0, word: 0, hush: 0, chat: null, kv: null };
  var word = null;      // the solid KEVIN, drawn from the SAME glyph picture the points are sampled from
  var t0 = performance.now();
  var scrollY = 0;
  // ?kv=burst: every star is born in the KEVIN letters and blown out into place (the extra points stay as faint stars)
  var BURST = /[?&]kv=burst/.test(location.search);

  function makeSprite() {
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = 32;
    var g = sprite.getContext('2d');
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function eo(t) { return 1 - Math.pow(1 - t, 3); }
  function eio(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function size() {
    var r = cv.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height);
    if (w === W && Math.abs(h - H) < 2) return false;
    W = w; H = h; phone = W < 760;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    return true;
  }

  function build() {
    var n = phone ? 1500 : 2800;
    P = [];
    // even coverage: one star per jittered grid cell
    var cols = Math.ceil(Math.sqrt(n * W / H)), rows = Math.ceil(n / cols), k = 0;
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      if (k++ >= n) break;
      P.push({
        sx: (x + rnd(.1, .9)) / cols, sy: (y + rnd(.1, .9)) / rows,
        sr: Math.random() < .08 ? rnd(1.1, 1.6) : rnd(.45, .95),
        sa: Math.random() < .1 ? rnd(.55, .85) : rnd(.14, .42),
        ph: rnd(0, 6.28), sp: rnd(.25, .9), dep: rnd(.2, 1),
        ox: 0, oy: 0, row: 0, col: Math.random() < .55 ? '#2A2E37' : Math.random() < .6 ? '#4A4F5B' : '#C9CCD3', vx: rnd(-1, 1), vy: rnd(-1.4, .2), tx: 0, ty: 0, hasT: false, d: rnd(0, .32), cell: 4
      });
    }
    // shuffle so letter targets are spread across the star field
    for (var i = P.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = P[i]; P[i] = P[j]; P[j] = t; }
    // only the original page's number of stars stays behind (Anthony 2026-10-15: "it shouldn't add more stars")
    var keep = Math.round(W * H / (phone ? 4200 : 6800));
    for (var q0 = 0; q0 < P.length; q0++) {
      var pk = P[q0];
      if (q0 < keep) { var z = Math.random(), big = Math.random() < .07; pk.sr = (big ? .95 : .38 + z * .5) * (phone ? 1.08 : 1); pk.sa = big ? .8 : (phone ? .22 : .12) + z * (phone ? .5 : .42); pk.col = '#C9CCD3'; }
      else pk.sa = 0;
    }
    // extra points that only live for the KEVIN moment (Anthony 2026-10-15: more granular, one solid piece).
    // They are invisible as stars (sa 0), so the star field after the letters stays as calm as before.
    var nx = phone ? 2600 : 5200;
    for (var e = 0; e < nx; e++) P.push({ sx: Math.random(), sy: Math.random(), sr: rnd(.35, .7), sa: 0, ph: rnd(0, 6.28), sp: rnd(.25, .9), dep: rnd(.2, 1),
      ox: 0, oy: 0, row: 0, col: Math.random() < .5 ? '#2A2E37' : '#4A4F5B', vx: rnd(-1, 1), vy: rnd(-1.4, .2), tx: 0, ty: 0, hasT: false, d: 0, arc: 0, cell: 4, ex: true });
    // mix the extras into the chat grid so the shatter is even
    for (var i2 = P.length - 1; i2 > 0; i2--) { var j2 = (Math.random() * (i2 + 1)) | 0; var t2 = P[i2]; P[i2] = P[j2]; P[j2] = t2; }
    // the chat window is light (the original page's chat, 2026-10-16): its tiles break off in its own colours
    for (var c3 = 0; c3 < P.length; c3++) { var u = Math.random(); P[c3].cc = u < .72 ? '#F4F4F6' : u < .9 ? '#E4E5E9' : '#B9BCC4'; }
    if (st.chat) setChat(st.chat);
    if (st.kv) setLetters(st.kv);
  }

  // origins: a grid across the gray chat window
  function setChat(r) {
    st.chat = r;
    var n = P.length, cols = Math.max(8, Math.round(Math.sqrt(n * r.w / r.h))), rows = Math.ceil(n / cols);
    var cw = r.w / cols, ch = r.h / rows;
    for (var i = 0; i < n; i++) {
      var c = i % cols, ro = (i / cols) | 0, p = P[i];
      p.ox = r.x + (c + .5) * cw; p.oy = r.y + (ro + .5) * ch; p.row = (ro + .5) / rows; p.cell = Math.max(2, Math.min(cw, ch) * .9);
      // where it hangs after the blast: the window's grid blown up to fill the whole screen, centred on the screen
      // (2026-10-16: on phones the cloud drifted up and left dead space at the bottom)
      p.hx0 = W / 2 + (p.ox - (r.x + r.w / 2)) * (W * 1.02 / r.w) + rnd(-.07, .07) * W;
      p.hy0 = H / 2 + (p.oy - (r.y + r.h / 2)) * (H * .96 / r.h) + rnd(-.05, .05) * H;
    }
  }

  // targets: pixels inside the KEVIN letters, drawn with the same font, size and box as the on-screen word
  function setLetters(kv) {
    st.kv = kv;
    var R = Math.min(3, window.devicePixelRatio || 1);
    var off = document.createElement('canvas'), w = Math.ceil(kv.len + 40), h = Math.ceil(kv.fs * 1.2);
    off.width = Math.ceil(w * R); off.height = Math.ceil(h * R);
    var g = off.getContext('2d');
    g.scale(R, R);
    g.fillStyle = '#EDEEF2';
    g.font = '900 expanded ' + kv.fs + 'px Archivo';
    if (g.font.indexOf('expanded') < 0) g.font = '900 ' + kv.fs + 'px Archivo';
    try { g.fontStretch = 'expanded'; } catch (e) {}
    g.textBaseline = 'alphabetic';
    var mw = g.measureText('KEVIN').width;
    g.save(); g.translate(20, kv.fs); g.scale(kv.len / mw, 1); g.fillText('KEVIN', 0, 0); g.restore();
    word = { img: off, x: kv.x - 20, y: kv.y - kv.fs, w: w, h: h };
    var data = g.getImageData(0, 0, off.width, off.height).data, pts = [], step = phone ? 2 : 3, OW = off.width;
    for (var y = 0; y < h; y += step) for (var x = 0; x < w; x += step) if (data[((Math.round(y * R)) * OW + Math.round(x * R)) * 4 + 3] > 140) pts.push([x - 20 + kv.x, y - kv.fs + kv.y]);
    for (var i = pts.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = pts[i]; pts[i] = pts[j]; pts[j] = t; }
    var k = 0, reach = Math.min(W, H) * .42;
    for (var q = 0; q < P.length; q++) {
      var p = P[q];
      p.hasT = false;
      if (k >= pts.length || (!BURST && !p.ex && Math.random() > .5)) continue;
      p.tx = pts[k][0] + rnd(-.4, .4); p.ty = pts[k][1] + rnd(-.4, .4); p.hasT = true; k++;
      var fx = clamp((p.tx - kv.x) / kv.len);
      p.d = .03 + fx * .5 + rnd(0, .05);
      p.arc = -reach * rnd(.08, .16);
      var bx = p.tx - (kv.x + kv.len / 2), by = p.ty - (kv.y - kv.fs * .36);
      p.bd = Math.min(1, Math.sqrt(bx * bx + by * by) / (kv.len * .55));
    }
    for (var q2 = 0; q2 < P.length; q2++) if (!P[q2].hasT) P[q2].d = rnd(0, .32);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    var t = (now - t0) / 1000;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var s = st.shatter, g = st.gather, so = st.solid, re = st.release, sk = st.stars;
    if (s <= 0 && sk <= 0) return;
    var reach = Math.min(W, H) * .42, par = scrollY * .025;
    var active = s > 0 && re < 1;
    for (var i = 0, n = P.length; i < n; i++) {
      var p = P[i];
      if (!active && p.sa <= 0) continue;   // the letter-only points are gone once the shatter is over
      // star position with a slow drift and a little scroll parallax
      var sx = p.sx * W + Math.sin(t * .05 * p.sp + p.ph) * 6 * p.dep;
      var sy = ((p.sy * H - par * p.dep) % H + H) % H;
      var tw = .72 + .28 * Math.sin(t * p.sp * 1.3 + p.ph);
      var starA = p.sa * tw * sk, x = sx, y = sy, a = starA, r = p.sr, sq = 0;
      if (active) {
        var ls = clamp((s - (1 - p.row) * .55) / .45), el = eo(ls);
        var hx = p.ox + (p.hx0 - p.ox) * el + Math.sin(t * .6 + p.ph) * 8 * el;
        var hy = p.oy + (p.hy0 - p.oy) * el + Math.cos(t * .5 + p.ph) * 5 * el;
        var sa = ls > 0 ? .9 : 0;
        x = hx; y = hy; a = sa; sq = 1 - clamp(ls * 1.6); r = p.cell * .5 * (1 - el) + 1.1 * el;
        if (g > 0) {
          var lg = p.hasT ? eio(clamp((g - p.d) / .44)) : eio(clamp((g - p.d) / .68));
          if (p.hasT) { x = hx + (p.tx - hx) * lg; y = hy + (p.ty - hy) * lg + Math.sin(lg * Math.PI) * p.arc; r = r + ((phone ? .75 : .85) - r) * lg; a = (.55 + .4 * lg) * (1 - so * .9); }
          else { x = hx + (sx - hx) * lg; y = hy + (sy - hy) * lg; a = sa + (starA - sa) * lg; r = r + (p.sr - r) * lg; }
          sq = sq * (1 - lg);
        }
        if (re > 0 && p.hasT) {
          var lr = BURST ? eo(clamp((re - p.bd * .28) / .72)) : eio(clamp((re - p.d * .6) / .8));
          x = x + (sx - x) * lr; y = y + (sy - y) * lr; a = a + (starA - a) * lr; r = r + (p.sr - r) * lr;
        }
        if (re > 0 && !p.hasT) { a = starA; }
        if (p.ex && !p.hasT && g > 0) a = a * (1 - eio(clamp(g * 1.6)));
      }
      if (active && st.hush > 0) a *= 1 - st.hush * .72;
      if (a <= .01) continue;
      ctx.globalAlpha = a > 1 ? 1 : a;
      if (sq > .5) { ctx.fillStyle = p.cc; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
      else ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    }
    if (word && st.word > 0) { ctx.globalAlpha = st.word > 1 ? 1 : st.word; ctx.drawImage(word.img, word.x, word.y, word.w, word.h); }
    ctx.globalAlpha = 1;
  }

  // the same letters as a mask picture (the window HOME shows through, and the camera flies through its I)
  function letterMask() {
    if (!word) return null;
    var R = Math.min(3, window.devicePixelRatio || 1), c = document.createElement('canvas');
    c.width = Math.round(W * R); c.height = Math.round(H * R);
    c.getContext('2d').drawImage(word.img, word.x * R, word.y * R, word.w * R, word.h * R);
    return c.toDataURL('image/png');
  }

  window.addEventListener('scroll', function () { scrollY = window.scrollY || 0; }, { passive: true });
  // width change: rebuild everything; height only (phone toolbars): re-centre the cloud on the new screen
  window.addEventListener('resize', function () { var wOld = W; if (size()) { if (Math.abs(W - wOld) > 1) build(); else if (st.chat) setChat(st.chat); } });
  makeSprite(); size(); build();
  requestAnimationFrame(frame);
  window.KVSky = { st: st, setChat: setChat, setLetters: setLetters, rebuild: build, mask: letterMask, wordPic: function () { return word; }, size: function () { return { w: W, h: H }; } };
})();
