// THE BRAIN, rebuilt in code from the Liberty Cockpit export (brain_spec.md + brain_nodes.json, sample data only).
// One shape, two modes: 'full' is the brain view (files, lanes, threads, robots, gates, the 24 hour clock),
// 'mini' is the right-rail panel (the brain's outline and the scan beam, never data).
// Drawn on a canvas at the device's pixel size, so it stays sharp at any zoom.
import { BRAIN } from './kvbrain-data.js';

const GREEN = '82,255,94', PALE = '214,255,208', GOLD = '255,204,102', GOLDS = '255,225,168', INK = '237,237,239';
const TAU = Math.PI * 2;
const K = { replay: 3.2, bloom: 3.6, hotHalf: 1.2, dotRush: 2.6, turn: 130, turnEase: 1.4, beamPts: 170, beamTail: 110, pulse: 2.4 };

// ---------- the shape (model space: x right, y up, z toward the face; the brain sits in about +-1) ----------
function hash(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
let CROWN = 1;
function surf(th, v, ring) {
  // a loaf-shaped brain: round crown, flatter and wider underneath, the front-lower lobe hanging lowest,
  // a fissure along the top, smooth folds on the sides and spiky folds on the crown
  const vv = Math.max(-.97, Math.min(.975, v)), av = Math.abs(vv);
  const g = vv >= 0 ? Math.sqrt(1 - vv * vv) : Math.pow(1 - Math.pow(av, 2.6), 1 / 2.6);
  const c = Math.cos(th), s = Math.sin(th);
  const ax = .97, az = s > 0 ? 1.36 : 1.27;
  const top = Math.max(0, vv - .3) / .7;
  const fiss = 1 - .14 * top * Math.exp(-(c * c) / .012);
  const ph = hash(ring + 1) * 6.283, ph2 = hash(ring + 7) * 6.283;
  const am = .024, ac = Math.pow(Math.max(0, (vv - .45) / .55), 1.3);
  const tri = x => 2 / Math.PI * Math.asin(Math.sin(x));                   // sharp V folds on the crown
  const n = am * (.6 * Math.sin(7 * th + ph + 2.1 * vv) + .4 * Math.sin(13 * th + ph2 - 3.3 * vv));
  const r = g * (1 + n) * fiss + .05 * CROWN * ac * tri(18 * th + ph);
  const yw = am * .9 * Math.sin(9 * th + ph2 + 2.3 * vv) + .1 * CROWN * ac * tri(18 * th + ph + 1.3);
  const sag = .16 * Math.pow(Math.max(0, s), 1.5) * Math.max(0, -vv) + .12 * Math.pow(Math.max(0, s), 6) * Math.max(0, -vv - .1);
  return [ax * r * c, .02 + (vv > 0 ? .78 : .74) * vv + yw - sag, az * r * s];
}
function cereb(th, v, ring) {
  const g = Math.sqrt(Math.max(0, 1 - v * v)), f = 1 + .008 * Math.sin(30 * th + ring * 1.7);
  return [.6 * g * f * Math.cos(th), -.46 + .2 * v, -.86 + .42 * g * f * Math.sin(th)];
}
export function buildShape(mode) {
  const full = mode === 'full';
  CROWN = full ? 1 : 1.9;
  const NL = full ? 24 : 20, PL = full ? 151 : 181, NM = full ? 10 : 4, PM = full ? 182 : 242, NC = 9, PC = full ? 71 : 91;
  const rings = [];
  for (let i = 0; i < NL; i++) {
    const v = -.95 + 1.92 * (i + .5) / NL, pts = [];
    for (let j = 0; j < PL; j++) pts.push(surf(TAU * j / (PL - 1), v, i));
    rings.push({ kind: 'cortex', pts });
  }
  for (let m = 0; m < NM; m++) {
    const th = Math.PI * m / NM + .13, pts = [], half = PM / 2;
    for (let j = 0; j < PM; j++) {
      const up = j < half, t = up ? j / (half - 1) : (j - half) / (half - 1);
      pts.push(surf(up ? th : th + Math.PI, up ? -.92 + 1.9 * t : .98 - 1.9 * t, 50 + m));
    }
    rings.push({ kind: 'meridian', pts });
  }
  for (let i = 0; i < NC; i++) {
    const v = -.85 + 1.7 * i / (NC - 1), pts = [];
    for (let j = 0; j < PC; j++) pts.push(cereb(TAU * j / (PC - 1), v, i));
    rings.push({ kind: 'cereb', pts });
  }
  if (full) {
    const pts = [];
    for (let j = 0; j < 241; j++) {
      const t = j / 240, a = t * 7 * TAU, rr = .12 - .04 * t;
      pts.push([rr * Math.cos(a), -.55 - 1.07 * t, -.36 + rr * Math.sin(a)]);
    }
    rings.push({ kind: 'stem', pts });
  }
  if (!full) for (const r of rings) r.pts = r.pts.map(p => [p[0] * .96, (p[1] - .02) * .9, p[2] * 1.08]);   // the cover shape reads longer and flatter
  const beam = [];
  for (const r of rings) if (full ? r.kind === 'cortex' : true) for (const p of r.pts) beam.push(p);
  return { rings, beam };
}

// ---------- projection ----------
function projector(cx, cy, sc, yaw, pitch) {
  const cy_ = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return p => {
    const x1 = p[0] * cy_ - p[2] * sy, z1 = p[0] * sy + p[2] * cy_;
    const y1 = p[1] * cp - z1 * sp, z2 = p[1] * sp + z1 * cp;
    const s = sc * 3.6 / (3.6 - z2);
    return [cx + x1 * s, cy - y1 * s, z2];
  };
}

function strokeRings(ctx, rings, P, passes, colorOf, multOf) {
  // split every polyline into its front and back halves, then stroke each pass as one path per kind
  const groups = new Map();
  for (const r of rings) {
    let g = groups.get(r.kind);
    if (!g) { g = { back: new Path2D(), front: new Path2D() }; groups.set(r.kind, g); }
    // a ring's near half is its front: compare each point with the ring's own centre depth
    if (!r.c) { const n = r.pts.length; r.c = r.pts.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]); }
    const zc = P(r.c)[2];
    let prev = null, prevSide = null;
    for (const p of r.pts) {
      const q = P(p), side = q[2] > zc - .02 ? 'front' : 'back';
      if (prev) {
        const path = g[prevSide === 'front' && side === 'front' ? 'front' : prevSide === 'back' && side === 'back' ? 'back' : 'back'];
        path.moveTo(prev[0], prev[1]); path.lineTo(q[0], q[1]);
      }
      prev = q; prevSide = side;
    }
  }
  for (const [kind, g] of groups) {
    const col = colorOf(kind), m = multOf(kind);
    for (const [side, w, a] of passes) {
      ctx.lineWidth = w; ctx.strokeStyle = `rgba(${col},${(a * m).toFixed(3)})`; ctx.stroke(g[side]);
    }
  }
}

// ---------- the brain view ----------
export class BrainView {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.mode = opts.mode || 'full';
    this.labelScale = opts.labelScale || 1;
    this.layout = opts.layout || null;          // (W,H) => {cx, cy, sc}
    this.onRow = opts.onRow || null;            // ledger row lit (index)
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.shape = buildShape(this.mode);
    this.W = 0; this.H = 0; this.px = 1;
    this.running = false; this.t = 0; this.yaw = .85; this.vel = 0;
    const B = BRAIN;
    this.byId = new Map(B.nodes.map(n => [n.id, n]));
    this.links = B.links.map((l, i) => ({ ...l, A: this.byId.get(l.a), B: this.byId.get(l.b), u: hash(i + 3), hot: 0 }));
    this.robots = B.nodes.filter(n => n.k === 'robot');
    this.open();
  }
  size(cssW, cssH, px) {
    px = Math.max(1, Math.min(px, 3));
    if (cssW === this.W && cssH === this.H && px === this.px) return;
    this.W = cssW; this.H = cssH; this.px = px;
    this.cv.width = Math.round(cssW * px); this.cv.height = Math.round(cssH * px);
    if (!this.running) this.draw(0);
  }
  open() {                                         // the overlay just appeared: newest event fires at once, drift eases in
    this.t = 0; this.yaw = .85; this.vel = 0; this.blooms = []; this.pulses = []; this.row = -1; this.nextRow = 0;
    this.beamHead = this.mode === 'full' ? 300 : 0; this.links.forEach(l => { l.hot = 0; });
    if (this.mode === 'full') this.fire();
  }
  fire() {
    const L = BRAIN.ledger, i = this.nextRow % L.length; this.nextRow++;
    const [, kind, id] = L[i]; this.row = i; if (this.onRow) this.onRow(i);
    if (kind === 'robot') { const r = this.byId.get(id); if (r) this.pulses.push({ n: r, t0: this.t }); return; }
    const n = this.byId.get(id); if (!n) return;
    this.blooms.push({ n, t0: this.t });
    for (const l of this.links) if (l.A === n || l.B === n) { l.hot = 1; l.u = l.A === n ? 0 : 1; l.dir = l.A === n ? 1 : -1; }
  }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); const f = now => { if (!this.running) return; const dt = Math.min(.05, (now - this.last) / 1000); this.last = now; this.step(this.reduce ? 0 : dt); this.draw(); this.raf = requestAnimationFrame(f); }; this.raf = requestAnimationFrame(f); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  step(dt) {
    if (this.mode === 'mini') { this.t += dt; this.beamHead += dt * 108; return; }
    const prevT = this.t; this.t += dt;
    if (this.reduce) { this.t = prevT + 1 / 60; }
    while (this.t >= this.nextRow * K.replay) this.fire();
    if (this.reduce) return;
    const target = TAU / K.turn;
    this.vel += (target - this.vel) * (1 - Math.exp(-3 * dt / K.turnEase));
    this.yaw += this.vel * dt;
    this.beamHead += dt * K.beamPts;
    const decay = Math.pow(.5, dt / K.hotHalf);
    for (const l of this.links) {
      const sp = l.v + l.hot / K.dotRush;
      l.u += (l.dir || 1) * sp * dt; l.u -= Math.floor(l.u);
      l.hot *= decay;
    }
    this.blooms = this.blooms.filter(b => this.t - b.t0 < K.bloom);
    this.pulses = this.pulses.filter(p => this.t - p.t0 < K.pulse);
  }
  draw() {
    const c = this.ctx, W = this.W, H = this.H; if (!W) return;
    c.setTransform(this.px, 0, 0, this.px, 0, 0);
    c.clearRect(0, 0, W, H);
    if (this.mode === 'mini') return this.drawMini(c, W, H);
    const L = this.layout ? this.layout(W, H) : { cx: W * .48, cy: H * .53, sc: Math.min(W, H) * .26 };
    const { cx, cy, sc } = L, RC = 1.5 * sc, ls = this.labelScale;
    const P = projector(cx, cy, sc, this.yaw, .28);
    c.lineCap = 'round'; c.lineJoin = 'round';
    // grid and haze
    c.strokeStyle = `rgba(${GREEN},.06)`; c.lineWidth = 1;
    for (const f of [.25, .5, .75]) { c.beginPath(); c.arc(cx, cy, RC * f, 0, TAU); c.stroke(); }
    c.beginPath(); c.moveTo(cx - RC, cy); c.lineTo(cx + RC, cy); c.moveTo(cx, cy - RC); c.lineTo(cx, cy + RC); c.stroke();
    const hz = c.createRadialGradient(cx, cy, 0, cx, cy, 1.4 * sc);
    hz.addColorStop(0, `rgba(${GREEN},.06)`); hz.addColorStop(1, `rgba(${GREEN},0)`);
    c.fillStyle = hz; c.fillRect(cx - 1.4 * sc, cy - 1.4 * sc, 2.8 * sc, 2.8 * sc);
    // the rings
    strokeRings(c, this.shape.rings, P, [['back', 3, .035], ['back', 1, .07], ['front', 2.6, .07], ['front', 1, .30]],
      k => k === 'cereb' ? GOLDS : GREEN, k => k === 'meridian' ? .5 : k === 'stem' ? .8 : 1);
    // the beam along the cortex
    this.drawBeam(c, P, this.shape.beam, K.beamTail, 1, 9);
    // threads and their dots
    const proj = new Map();
    for (const n of BRAIN.nodes) proj.set(n.id, P(n.p));
    for (const l of this.links) {
      const a = proj.get(l.a), b = proj.get(l.b); if (!a || !b) continue;
      const mid = P([(l.A.p[0] + l.B.p[0]) * .62, (l.A.p[1] + l.B.p[1]) * .62, (l.A.p[2] + l.B.p[2]) * .62]);
      const back = (a[2] + b[2]) / 2 < -.15, al = l.al * (back ? .35 : 1) + l.hot * .75;
      c.strokeStyle = `rgba(${GOLD},${Math.min(.95, al).toFixed(3)})`; c.lineWidth = l.w + l.hot * 1.1;
      c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(mid[0], mid[1], b[0], b[1]); c.stroke();
      const u = l.u, x = (1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * mid[0] + u * u * b[0], y = (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * mid[1] + u * u * b[1];
      c.fillStyle = `rgba(${GOLD},${Math.min(1, (back ? .3 : .7) + l.hot).toFixed(3)})`;
      c.beginPath(); c.arc(x, y, 1.5 + l.hot * 1.2, 0, TAU); c.fill();
    }
    // robot pulses climbing the stem
    for (const p of this.pulses) {
      const f = (this.t - p.t0) / K.pulse, e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      const a = p.n.p, q = P([a[0] * (1 - e), a[1] + (.1 - a[1]) * e, a[2] + (-.2 - a[2]) * e]);
      c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.arc(q[0], q[1], 3.5 - 1.5 * e, 0, TAU); c.fill();
    }
    // points
    const font = (w, s) => `${w} ${s * ls}px "JetBrains Mono", Mono, monospace`;
    const breath = (per) => .5 + .5 * Math.sin(this.t * TAU / per);
    for (const n of BRAIN.nodes) {
      const q = proj.get(n.id), back = q[2] < -.15, A = back ? .35 : 1;
      if (n.k === 'report') { c.fillStyle = `rgba(${GOLDS},${.6 * A})`; c.fillRect(q[0] - 1, q[1] - 1, 2, 2); }
      else if (n.k === 'robot') {
        c.fillStyle = `rgba(${GREEN},${A})`; c.beginPath(); c.arc(q[0], q[1], 2.2, 0, TAU); c.fill();
        const br = breath(4.4); c.strokeStyle = `rgba(${GREEN},${(.5 * (1 - br) * A).toFixed(3)})`; c.lineWidth = 1;
        c.beginPath(); c.arc(q[0], q[1], 3 + 5 * br, 0, TAU); c.stroke();
      } else if (n.k === 'gate') {
        c.strokeStyle = `rgba(${INK},${.75 * A})`; c.lineWidth = 1; c.beginPath();
        for (let i = 0; i <= 6; i++) { const an = i * TAU / 6 + Math.PI / 6; c[i ? 'lineTo' : 'moveTo'](q[0] + 4.5 * Math.cos(an), q[1] + 4.5 * Math.sin(an)); }
        c.stroke();
      }
    }
    for (const n of BRAIN.nodes) {
      if (n.k !== 'file' && n.k !== 'lane') continue;
      const q = proj.get(n.id), back = q[2] < -.15, A = back ? .35 : 1, col = n.k === 'lane' ? GOLD : INK, r = n.r;
      const h = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 3);
      h.addColorStop(0, `rgba(${col},${.35 * A})`); h.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = h; c.beginPath(); c.arc(q[0], q[1], r * 3, 0, TAU); c.fill();
      c.fillStyle = `rgba(${col},${A})`; c.beginPath(); c.arc(q[0], q[1], r, 0, TAU); c.fill();
      if (!back) {
        c.font = n.k === 'lane' ? font(500, 10) : font(400, 10);
        c.fillStyle = n.k === 'lane' ? `rgba(${GOLD},.9)` : 'rgba(190,190,194,.8)';
        c.fillText(n.l, q[0] + r + 5 * ls, q[1] + 3.5 * ls);
      }
    }
    // blooms
    for (const b of this.blooms) {
      const f = (this.t - b.t0) / K.bloom, e = 1 - (1 - f) * (1 - f), fade = Math.pow(1 - f, 1.5), q = proj.get(b.n.id);
      c.lineWidth = 1.4;
      c.strokeStyle = `rgba(${GOLD},${(.7 * fade).toFixed(3)})`; c.beginPath(); c.arc(q[0], q[1], 4 + 46 * e, 0, TAU); c.stroke();
      c.strokeStyle = `rgba(${GOLD},${(.35 * fade).toFixed(3)})`; c.beginPath(); c.arc(q[0], q[1], 4 + 24 * e, 0, TAU); c.stroke();
    }
    // the gate hoop and its caption
    const hoop = []; for (let i = 0; i <= 48; i++) { const a = i * TAU / 48; hoop.push(P([.36 * Math.cos(a), -.64, -.3 + .36 * Math.sin(a)])); }
    c.strokeStyle = `rgba(${INK},.2)`; c.lineWidth = 1; c.beginPath(); hoop.forEach((q, i) => c[i ? 'lineTo' : 'moveTo'](q[0], q[1])); c.stroke();
    const right = hoop.reduce((m, q) => q[0] > m[0] ? q : m, hoop[0]);
    if (!L.lite) { c.font = font(400, 9); c.fillStyle = 'rgba(190,190,194,.9)'; c.fillText('the 6 gates: every message passes here', right[0] - 22 * ls, right[1] + 3 * ls); }
    this.drawClock(c, cx, cy, RC, ls, font, breath, L.lite);
  }
  drawBeam(c, P, path, tail, wMul, glowR) {
    const N = path.length, head = Math.floor(this.beamHead) % N;
    let prev = null;
    for (let k = tail; k >= 0; k--) {
      const q = P(path[(head - k + N) % N]); const f = 1 - k / tail;
      if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) < 60) {
        c.strokeStyle = f > .8 ? `rgba(${PALE},${(.15 + .8 * f).toFixed(3)})` : `rgba(${GREEN},${(.15 + .8 * f).toFixed(3)})`;
        c.lineWidth = (1 + 2 * f) * wMul; c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(q[0], q[1]); c.stroke();
      }
      prev = q;
    }
    const g = c.createRadialGradient(prev[0], prev[1], 0, prev[0], prev[1], glowR);
    g.addColorStop(0, `rgba(${PALE},.55)`); g.addColorStop(1, `rgba(${PALE},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(prev[0], prev[1], glowR, 0, TAU); c.fill();
  }
  drawClock(c, cx, cy, RC, ls, font, breath, lite) {
    const ang = h => h / 24 * TAU - Math.PI / 2;              // 12 AM at the top, clockwise
    const at = (h, r) => [cx + r * Math.cos(ang(h)), cy + r * Math.sin(ang(h))];
    c.strokeStyle = `rgba(${GREEN},.16)`; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, RC, 0, TAU); c.stroke();
    for (let h = 0; h < 24; h++) {
      const big = h % 6 === 0, d = big ? 8 : 4, a = at(h, RC - d), b = at(h, RC + d);
      c.strokeStyle = big ? 'rgba(190,190,194,.5)' : 'rgba(190,190,194,.2)'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
    c.font = font(400, 9); c.fillStyle = 'rgba(190,190,194,.8)'; c.textAlign = 'center';
    if (!lite) [['12 AM', 0], ['6 AM', 6], ['12 PM', 12], ['6 PM', 18]].forEach(([t, h]) => { const p = at(h, RC + 50 * ls); c.fillText(t, p[0], p[1] + 3); });
    c.textAlign = 'left';
    const now = BRAIN.now + this.t / 3600;
    c.strokeStyle = `rgba(${GREEN},.35)`; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, RC, ang(now), ang(now + .5)); c.stroke();
    const h0 = at(now, RC - 26), h1 = at(now, RC + 14);
    c.strokeStyle = `rgba(${GOLD},.85)`; c.lineWidth = 1.5; c.beginPath(); c.moveTo(h0[0], h0[1]); c.lineTo(h1[0], h1[1]); c.stroke();
    const hh = Math.floor(now), mm = Math.floor((now - hh) * 60), h12 = (hh % 12) || 12;
    this.arcText(c, `NOW ${h12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'} · 2 fire in the next 30 min`, cx, cy, RC - 40 * ls, ang(now), font(600, 9), `rgba(${GOLD},.95)`, 'start');
    for (const s of BRAIN.sats) {
      const r = RC + (s.j || 0) * 3, p = at(s.h, r), soon = s.soon;
      c.fillStyle = `rgba(${GREEN},${soon ? 1 : .55})`; c.beginPath(); c.arc(p[0], p[1], soon ? 3.5 : 2.5, 0, TAU); c.fill();
      if (soon) { const br = breath(2.6); c.strokeStyle = `rgba(${GREEN},${(.6 * (1 - br)).toFixed(3)})`; c.lineWidth = 1; c.beginPath(); c.arc(p[0], p[1], 5.5 + 2.5 * br, 0, TAU); c.stroke(); }
      if (s.lab && !lite) this.arcText(c, s.l.replace(/(\d+:\d+ [AP]M)$/, '$1'), cx, cy, RC + 14 * ls, ang(s.h), font(400, 8), 'rgba(190,190,194,.8)', 'center');
    }
  }
  arcText(c, text, cx, cy, r, a0, font, fill, align) {
    // text set along the ring, kept upright: clockwise on the top half, counter-clockwise on the bottom half
    c.font = font; c.fillStyle = fill;
    const w = c.measureText(text).width, bottom = Math.sin(a0) > 0, dir = bottom ? -1 : 1;
    const rr = bottom ? r + 3 : r;
    let a = align === 'center' ? a0 - dir * (w / 2) / rr : a0;
    for (const ch of text) {
      const cw = c.measureText(ch).width, mid = a + dir * (cw / 2) / rr;
      c.save(); c.translate(cx + rr * Math.cos(mid), cy + rr * Math.sin(mid)); c.rotate(mid + (bottom ? -Math.PI / 2 : Math.PI / 2));
      c.fillText(ch, -cw / 2, 0); c.restore();
      a += dir * cw / rr;
    }
  }
  drawMini(c, W, H) {
    // side-on (pitch .06, yaw 1.0 +- .25): what the real panel shows at this size (minibrain.png), not the spec's .28
    const sc = Math.min(W, H) * .40, yaw = this.yawOverride ?? (1.0 + .25 * Math.sin(this.t * 1000 / 9000));
    const P = projector(W * .5, H * .46, sc, yaw, this.pitchOverride ?? .06);
    c.lineCap = 'round';
    strokeRings(c, this.shape.rings, P, [['back', 1, .07], ['front', 1, .30]], () => GREEN, () => 1);
    // the beam: 90 point tail, every third point drawn
    const path = this.shape.beam, N = path.length, head = Math.floor(this.beamHead) % N;
    let prev = null;
    for (let k = 90; k >= 0; k -= 3) {
      const q = P(path[(head - k + N) % N]), f = 1 - k / 90;
      if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) < 40) {
        c.strokeStyle = f > .7 ? `rgba(${PALE},${(.12 + .85 * f).toFixed(3)})` : `rgba(${GREEN},${(.12 + .85 * f).toFixed(3)})`;
        c.lineWidth = 1 + 2.2 * f; c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(q[0], q[1]); c.stroke();
      }
      prev = q;
    }
    const g = c.createRadialGradient(prev[0], prev[1], 0, prev[0], prev[1], 14);
    g.addColorStop(0, `rgba(${PALE},.5)`); g.addColorStop(1, `rgba(${PALE},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(prev[0], prev[1], 14, 0, TAU); c.fill();
  }
}

// The mini panel runs at 12 frames a second on purpose (2 under reduced motion), like the real one.
export function runMini(view) {
  let alive = true, last = performance.now();
  const per = view.reduce ? 500 : 83;
  const tick = () => {
    if (!alive) return;
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    if (!view.reduce) view.step(Math.min(.25, dt));
    view.draw();
    setTimeout(tick, per);
  };
  tick();
  return () => { alive = false; };
}

// ---------- the brain view page: canvas + the HUD text, at the real 1920x1080 layout ----------
const CSS = `
@font-face{font-family:Orbitron;src:url(${new URL('../fonts/orbitron-var.woff2', import.meta.url)}) format('woff2');font-weight:400 900;font-display:swap}
.kvb{position:absolute;inset:0;background:rgb(6,6,6);overflow:hidden;color:#BEBEC2;font:400 10px/1.5 "JetBrains Mono",Mono,monospace;text-align:left}
.kvb canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.kvb .bh{position:absolute;left:32px;top:26px;width:360px}
.kvb .bh-t{display:flex;align-items:baseline;gap:12px;white-space:nowrap}
.kvb .bh-title{font:800 22px/1 Orbitron,sans-serif;letter-spacing:.10em;color:transparent;-webkit-text-stroke:1px #EDEDEF;text-transform:uppercase}
.kvb .bh-stats{font-size:10px;letter-spacing:.16em;color:#52FF5E;text-transform:uppercase}
.kvb .bh-sub{max-width:340px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.12);font-size:10px;line-height:1.7;color:rgba(255,255,255,.55)}
.kvb .bh-sub b{color:rgba(255,255,255,.85);font-weight:700}
.kvb .bl{position:absolute;right:32px;width:300px}
.kvb .bl h5{font:600 8.5px/1.6 Orbitron,sans-serif;letter-spacing:.24em;color:#52FF5E;text-transform:uppercase;margin:0 0 8px}
.kvb .bl ol{list-style:none;margin:0;padding:0}
.kvb .bl li{display:grid;grid-template-columns:62px 1fr;gap:8px;padding:3px 6px;border-radius:3px;border-left:2px solid transparent;font-size:9.5px;line-height:15.2px;color:#BEBEC2;transition:background .3s,border-color .3s}
.kvb .bl li i{font-style:normal;color:#7E7E84}
.kvb .bl li .f{color:#EDEDEF}.kvb .bl li .ln{color:#FFE1A8}.kvb .bl li .rb{color:#4FD24F}
.kvb .bl.nx li .rb{color:#52FF5E}
.kvb .bl li.on{background:rgba(82,255,94,.08);border-left-color:#52FF5E}
.kvb .bl li.on .f,.kvb .bl li.on .ln,.kvb .bl li.on .rb{color:#52FF5E}
.kvb .sig{top:120px}.kvb .nx{bottom:26px}
.kvb .leg{position:absolute;left:32px;bottom:26px;max-width:360px;display:flex;flex-wrap:wrap;gap:6px}
.kvb .leg span{display:flex;align-items:center;gap:7px;font-size:9px;letter-spacing:.12em;color:#BEBEC2;border:1px solid rgba(190,190,194,.16);border-radius:4px;padding:5px 9px;background:rgba(2,6,12,.6)}
.kvb .leg i{width:8px;height:8px;border-radius:50%;flex:none}
.kvb .leg b{color:#EDEDEF;font-weight:700}
.kvb .esc{position:absolute;right:32px;top:26px;font-size:10px;letter-spacing:.14em;color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.24);background:rgba(0,0,0,.4);padding:6px 12px}
.kvb.pt .sig li:nth-child(n+7),.kvb.pt .nx,.kvb.pt .esc,.kvb.pt .bh-sub,.kvb.pt .leg span:nth-child(n+4){display:none}
`;
let cssDone = false;
const kindCls = { file: 'f', lane: 'ln', robot: 'rb' };
export function mountBrainView(host, opts = {}) {
  if (!cssDone) { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); cssDone = true; }
  const root = document.createElement('div'); root.className = 'kvb'; if (opts.portrait) root.classList.add('pt');
  const B = BRAIN, rows = B.ledger.map(([t, k, , n, rest]) => `<li><i>${t}</i><span><span class="${kindCls[k]}">${n}</span>${rest}</span></li>`).join('');
  const nx = B.next.map(([t, n, rest]) => `<li><i>${t}</i><span><span class="rb">${n}</span>${rest}</span></li>`).join('');
  const chip = (col, k, t) => `<span><i style="background:${col}"></i><b>${k}</b> ${t}</span>`;
  root.innerHTML = `<canvas></canvas>
  <div class="bh"><div class="bh-t"><span class="bh-title">The brain</span><span class="bh-stats">12 files · 7 lanes · 8 live reports · 42 threads · 6 of 6 robots green</span></div>
  <p class="bh-sub">The beam scans what the machine is. The <b>cortex</b> carries the 12 numbered files, the <b>frontal lobe</b> the 7 lanes, the <b>cerebellum</b> the 8 reports still live. The <b>stem</b> is the 6 robots and the six <b>gates</b> at its top are the hooks every message crosses. A gold thread is a real cross-reference. The outer <b>clock</b> is 24 hours round: each robot sits where it fires next and the hand is now. A point blooms when a session writes it. Click a point to open the file. ESC to close.</p></div>
  <span class="esc">ESC ×</span>
  <div class="bl sig"><h5>Signals · the last 14 real events, replayed at their true times</h5><ol>${rows}</ol></div>
  <div class="bl nx"><h5>Next to fire · the robots queued on the clock</h5><ol>${nx}</ol></div>
  <div class="leg">${chip('#52FF5E', 'SCAN', 'the brain, drawn by the beam · the numbered files on the cortex')}${chip('#FFCC66', 'LANES', 'the work in hand, on the frontal lobe')}${chip('rgba(255,204,102,.5)', 'THREADS', 'real cross-references')}${chip('#FFE1A8', 'DUST', 'live reports, on the cerebellum')}${chip('rgba(82,255,94,.6)', 'STEM', 'the robots, lamps down the cord')}${chip('#EDEDEF', 'GATES', 'the 6 hooks, a hoop at the medulla')}${chip('rgba(82,255,94,.35)', 'THE CLOCK', '24 h round, each robot where it fires next')}</div>`;
  host.appendChild(root);
  const lis = [...root.querySelectorAll('.sig li')];
  const view = new BrainView(root.querySelector('canvas'), { mode: 'full', labelScale: opts.labelScale || 1, layout: opts.layout,
    onRow: i => lis.forEach((li, k) => li.classList.toggle('on', k === i)) });
  return { root, view };
}

// ---------- the mini panel: "THE BRAIN click to expand", 291x197 at 1920x1080 ----------
const MCSS = `.kvm{position:absolute;inset:0;background:#0b0b0b;font-family:"JetBrains Mono",Mono,monospace;box-shadow:inset 1px 0 0 rgba(255,255,255,.1)}
.kvm .mh{height:24px;margin-top:11px;display:flex;align-items:center;gap:9px;padding:0 12px;background:linear-gradient(#2a2a2a,#1f1f1f);border-top:1px solid rgba(255,255,255,.14);border-bottom:1px solid rgba(255,255,255,.14)}
.kvm .mh b{font-weight:800;font-size:9px;letter-spacing:.26em;color:#FFCC66}
.kvm .mh span{font-size:8px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:.06em}
.kvm .mc{position:absolute;left:14px;right:14px;top:44px;height:150px;border:1px solid rgba(255,255,255,.13);background:rgba(0,0,0,.3)}
.kvm canvas{position:absolute;inset:0;width:100%;height:100%;display:block}`;
let mcssDone = false;
export function mountMiniBrain(host, opts = {}) {
  if (!mcssDone) { const s = document.createElement('style'); s.textContent = MCSS; document.head.appendChild(s); mcssDone = true; }
  const root = document.createElement('div'); root.className = 'kvm';
  root.innerHTML = '<div class="mh"><b>THE BRAIN</b><span>click to expand</span></div><div class="mc"><canvas></canvas></div>';
  host.appendChild(root);
  const box = root.querySelector('.mc'), view = new BrainView(box.querySelector('canvas'), { mode: 'mini' });
  const fit = () => { const r = box.getBoundingClientRect(), k = box.offsetWidth ? r.width / box.offsetWidth : 1; view.size(box.clientWidth, box.clientHeight, Math.min(4, devicePixelRatio * Math.max(1, k))); };
  fit(); addEventListener('resize', fit);
  let halt = null;
  const api = { root, view, fit, start() { if (!halt) halt = runMini(view); }, stop() { if (halt) { halt(); halt = null; } } };
  if (!opts.still) api.start();
  return api;
}
