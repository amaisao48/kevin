// KEVIN, layer by layer: a scroll-driven exploded view built from real page code (CSS 3D), so every word stays sharp.
// Layers live in #anatomy .an-stack (built by _tools/ft_anatomy.py). Landscape layers are 1920x1080; on portrait
// screens the stack switches to tall 540x800 layouts so a face-on layer fills a phone and reads clearly.

const section = document.getElementById('anatomy');
const stack = section.querySelector('.an-stack');
const layers = [...stack.querySelectorAll('.an-layer')];
const labels = [...section.querySelectorAll('.alabel')];
const alabels = section.querySelector('.alabels');
const intro = section.querySelector('.anat-intro');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (reduce || !window.gsap || !window.ScrollTrigger || !stack) document.documentElement.classList.add('anat-static');
else { try { init(); } catch (e) { document.documentElement.classList.add('anat-static'); } }

function init() {
  gsap.registerPlugin(ScrollTrigger);
  const slot = stack.querySelector('.lc-slot');
  if (slot && window.KV_CHAT) window.KV_CHAT(slot);

  // layer 02: the Liberty brain view, rebuilt in code. It runs only while it can be seen, and opens (the newest event
  // blooms, the drift eases in) as the camera arrives on it, the way the real view opens.
  const bslot = stack.querySelector('.kvb-slot');
  let B = null, Bmod = null, bOpened = false, bRun = false, bFrame = 0;
  function mountBrain() {
    if (!Bmod || !bslot) return;
    if (B) B.view.stop();
    bslot.textContent = '';
    B = Bmod.mountBrainView(bslot, { portrait: pt, labelScale: pt ? 1.25 : 1,
      layout: pt ? (W, H) => ({ cx: W * .5, cy: H * .5, sc: Math.min(W, H) * .27, lite: true }) : null });
    B.pt = pt; B.k = 0; sizeBrain(); B.view.draw();
  }
  function sizeBrain() {
    const r = bslot.getBoundingClientRect(), dw = pt ? 450 : 1920, dh = pt ? 541.67 : 1080;
    const k = Math.max(.25, Math.min(3, Math.round(r.width / (pt ? 1080 : 1920) * (pt ? 2.4 : 1) * (devicePixelRatio || 1) * 4) / 4));
    if (k !== B.k) { B.k = k; B.view.size(dw, dh, k); }
  }
  function brainTick() {
    if (!B) return;
    const want = visible && S.u < 1.75 && (S.tilt > .02 || S.u > .02);
    if (want !== bRun) { bRun = want; want ? B.view.start() : B.view.stop(); }
    if (!want) return;
    if (++bFrame % 12 === 0) sizeBrain();
    if (!bOpened && S.u > .55 && S.tour > .5) { bOpened = true; B.view.open(); }
    if (bOpened && S.u < .3) bOpened = false;
  }
  if (bslot) import('./kvbrain.js?v=kv1').then(m => { Bmod = m; mountBrain(); }).catch(() => {});

  // state the scroll timeline animates
  const S = { tilt: 0, gap: 0, edges: 0, tour: 0, u: 0 };
  const N = layers.length;
  layers.forEach((el, i) => { el.style.zIndex = N - i; });          // front-to-back order even where a browser flattens 3D
  let pt = false, LW = 1920, LH = 1080, fit = 1, faceF = 1, overF = 1, faceX = 0, faceY = 0;

  // Layout is measured from the pinned stage itself (not the window): on a real iPhone the window grows when Safari's
  // toolbar hides, and centering on the window pushed everything to the top.
  const stageEl = section.querySelector('.anat-stage');
  let SH = 0, labTop = 0;
  function measure() {
    SH = stageEl.clientHeight || innerHeight;
    const SW = stageEl.clientWidth || innerWidth;
    pt = SW / SH < .9;
    stack.classList.toggle('pt', pt);
    LW = pt ? 540 : 1920; LH = pt ? 650 : 1080;
    fit = Math.min(SW / LW, (SH - 68) / LH);                            // cover: the screen below the nav, same as the KEVIN reveal
    const labH = Math.max(0, ...labels.map(l => l.offsetHeight));
    if (pt) {
      const gap = 20, top0 = 76, avail = SH - 18 - top0;
      faceF = Math.min(SW * .9 / LW, (avail - gap - labH) * .9 / LH);   // breathing room: the group never touches the edges
      const layerH = LH * faceF, top = top0 + Math.max(0, (avail - layerH - gap - labH) / 2);
      faceX = 0; faceY = top + layerH / 2 - SH / 2;                      // layer + caption centered as one group
      labTop = top + layerH + gap;                                       // every caption starts on the same line
      overF = fit * .62;
    } else {
      faceF = Math.min(SW * .58 / LW, (SH - 150) / LH);
      const gut = Math.min(56, Math.max(20, SW * .04));
      faceX = (SW - gut - LW * faceF / 2) - SW / 2;                      // right side; the captions own the left
      faceY = 20;
      labTop = SH / 2 + faceY - labH / 2;                                // caption block centered on the layer, tops aligned
      overF = fit * .5;
    }
    if (alabels) { alabels.style.top = labTop + 'px'; alabels.style.bottom = 'auto'; }
    if (B && B.pt !== pt) mountBrain();
  }

  // pointer parallax (desktop), smoothed in the frame loop
  const P = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { P.tx = e.clientX / innerWidth - .5; P.ty = e.clientY / innerHeight - .5; } }, { passive: true });

  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = v => Math.max(0, Math.min(1, v));
  let last = '';
  function render() {
    if (stageEl.clientHeight !== SH) { measure(); last = ''; }       // toolbar shown or hidden: re-center
    P.x += (P.tx - P.x) * .08; P.y += (P.ty - P.y) * .08;
    const k = S.tour * S.tour * (3 - 2 * S.tour);                       // eased blend: overview -> square-on tour
    const f = lerp(lerp(fit, overF, S.tilt), faceF, k);
    const free = S.tilt * (1 - k);
    const rx = 55 * free - P.y * 6 * free, rz = -38 * free + P.x * 6 * free;
    const G = S.gap * LH * .3;                                         // spacing between layers (layer px)
    const zc = k * S.u * (G + 1);
    const ty0 = 34 * (1 - S.tilt) * (1 - k);                           // cover centered in the space under the nav
    const tx = faceX * k, ty = ty0 + faceY * k + (pt ? -SH * .04 : SH * .02) * free;
    const key = [f, rx, rz, G, zc, tx, ty, S.u, S.edges].map(v => v.toFixed(3)).join();
    if (key === last) return; last = key;
    stack.style.transform = `translate3d(${tx}px,${ty}px,0) scale3d(${f},${f},${f}) rotateX(${rx}deg) rotateZ(${rz}deg) translate3d(0,0,${zc}px)`;
    for (let i = 0; i < N; i++) {
      const el = layers[i];
      const near = Math.max(0, 1 - Math.abs(i - S.u));
      const front = clamp((S.u - i) * 1.6) * k;                         // layers between the camera and the one on show
      const op = 1 - front;
      el.style.transform = `translate3d(0,0,${-i * (G + 1)}px)`;
      el.style.opacity = op.toFixed(3);
      el.style.visibility = op < .01 ? 'hidden' : 'visible';
      el.style.setProperty('--dim', (.74 * k * (1 - near)).toFixed(3));
      el.style.setProperty('--edge', (S.edges * (.5 + .5 * near * k)).toFixed(3));
    }
  }

  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' },
    scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true,
      onUpdate: st => showLabel(st.progress) } });
  tl.fromTo(S, { tilt: 0, edges: 0 }, { tilt: 1, edges: 1, duration: 1 }, 0)            // tilt into 3D
    .fromTo(S, { gap: 0 }, { gap: 1, duration: .9 }, .6)                               // explode
    .fromTo(intro, { opacity: 1, y: 0 }, { opacity: 0, y: -30, duration: .4 }, .15);
  const T0 = 1.6, STEP = 1.5;
  tl.fromTo(S, { tour: 0 }, { tour: 1, duration: .6 }, T0 - .3);
  for (let i = 1; i < N; i++) tl.fromTo(S, { u: i - 1 }, { u: i, duration: .8, immediateRender: false }, T0 + (i - 1) * STEP + .7);
  const TE = T0 + (N - 2) * STEP + 1.5;                                                  // the last layer has arrived
  tl.to({}, { duration: 1 }, TE);                                                        // hold on it, then the page moves on (no second stack, no second chat)

  function showLabel(p) {
    const t = p * tl.duration();
    labels.forEach((el, i) => {
      const a = 1.6 + i * 1.5, lastOne = i === labels.length - 1;
      el.classList.toggle('on', t > a - .35 && (lastOne || t < a + 1.05));             // switch at the middle of each camera move
    });
  }

  let visible = false;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { rootMargin: '200px' }).observe(section);
  (function frame() { requestAnimationFrame(frame); if (visible) render(); brainTick(); })();

  // one chat, not two: the stage shows only once it pins over the intro's last frame, and the intro scene steps aside
  const stage = stageEl, scene = document.querySelector('#intro .scene');
  const swap = on => { stage.style.opacity = on ? '' : '0'; if (scene) scene.style.opacity = on ? '0' : ''; };   // opacity: children can't override it
  const hand = ScrollTrigger.create({ trigger: section, start: 'top top', onEnter: () => swap(true), onLeaveBack: () => swap(false),
    onRefresh: self => swap(self.scroll() >= self.start - 1) });

  measure(); render();
  ScrollTrigger.addEventListener('refreshInit', () => { measure(); last = ''; });
  ScrollTrigger.refresh();
}
