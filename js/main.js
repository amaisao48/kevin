/* KEVIN fresh build: the page's motion. One pinned camera for the story, KEVIN, HOME, the click, the chat and the
   stack, then a few smaller scenes. Every scrubbed tween sets both ends (fromTo or an explicit set first). */
(function () {
  'use strict';
  var html = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- works in every mode ---------- */
  buildTicks();
  setupTabs();
  var brain = null, mini = null, liftMini = null;
  if (window.KVBrainView) {
    // layer 01 is the real brain recording: plays when the layer comes forward, holds its last frame after
    var bvid = $('#brainVid');
    if (bvid) {
      bvid.poster = bvid.getAttribute(window.innerWidth < 760 ? 'data-pm' : 'data-pd');
      brain = { running: false, reveal: 0,
        start: function () { this.running = true; loadVids(); if (bvid.ended) bvid.currentTime = 0; var p = bvid.play(); if (p && p.catch) p.catch(function () {}); },
        stop: function () { this.running = false; bvid.pause(); }, resize: function () {}, draw: function () {} };
    }
    if ($('#miniVid')) {
      var mv = $('#miniVid');
      document.documentElement.style.setProperty('--mbw', Math.round(582 / Math.min(3, window.devicePixelRatio || 1)) + 'px');
      mini = { running: false, start: function () { this.running = true; loadVids(); var p = mv.play(); if (p && p.catch) p.catch(function () {}); },
        stop: function () { this.running = false; mv.pause(); }, resize: function () {}, draw: function () {} };
    }
    if ($('#liftMini')) liftMini = new KVBrainView($('#liftMini'), { mini: true });
    renderSignals();
  }

  var CINEMA = html.classList.contains('js') && window.gsap && window.ScrollTrigger;
  if (!CINEMA) {
    html.className = 'still';
    setupThemesStill();
    if (document.fonts) document.fonts.ready.then(stillFrames); else stillFrames();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  if (window.ScrambleTextPlugin) gsap.registerPlugin(ScrambleTextPlugin);
  ScrollTrigger.config({ ignoreMobileResize: true });
  var lenis = null;
  if (window.Lenis && matchMedia('(pointer:fine)').matches) {
    lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  var nav = $('#nav');
  var stageST = null, stageTL = null, UNIT = 1, lastW = 0, lastH = 0;
  var others = [];

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    buildAll();
    var m = /[?&]at=([\d.]+)/.exec(location.search);
    if (m) jumpUnit(parseFloat(m[1]));
    var s = /[?&]sec=([a-z]+):([\d.]+)/.exec(location.search);
    if (s) jumpSection(s[1], parseFloat(s[2]));
  });
  var rT;
  window.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      var w = window.innerWidth, h = window.innerHeight;
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 160) return;
      var keep = stageST ? (window.scrollY - stageST.start) / Math.max(1, stageST.end - stageST.start) : 0;
      buildAll();
      if (stageST && keep > 0 && keep < 1) window.scrollTo(0, stageST.start + keep * (stageST.end - stageST.start));
    }, 220);
  });

  function buildAll() {
    lastW = window.innerWidth; lastH = window.innerHeight;
    html.classList.add('kv-ready');   // the stage's placeholder length (css) hands over to the real pin
    // phone or desktop cut of the brain recording, matched to the layout every time it is built
    var bv0 = $('#brainVid');
    if (bv0) { bv0.poster = bv0.getAttribute(lastW < 760 ? 'data-pm' : 'data-pd'); if (bv0.getAttribute('src')) loadVids(); }
    if (stageTL) { stageTL.scrollTrigger && stageTL.scrollTrigger.kill(true); stageTL.kill(); }
    others.forEach(function (o) { o.kill && o.kill(true); });
    others = [];
    buildStage();
    buildScreens();
    buildThemes();
    buildPhonePricing();
    buildUses();
    buildDepts();
    buildSmall();
    ScrollTrigger.refresh();
  }

  function loadVids() {
    var bv = document.getElementById('brainVid'), mv2 = document.getElementById('miniVid');
    var want = bv && bv.getAttribute(window.innerWidth < 760 ? 'data-m' : 'data-d');
    if (bv && bv.getAttribute('src') !== want) { bv.src = want; bv.preload = 'auto'; }
    if (mv2 && !mv2.getAttribute('src')) { mv2.src = mv2.getAttribute('data-src'); mv2.preload = 'auto'; }
  }
  // "Go to chat" on the HOME screen: a tap plays on to the chat, like the cursor does (no jump inside the pinned stage)
  var goEl = document.getElementById('homeGo');
  if (goEl) goEl.addEventListener('click', function (e) {
    if (!window.KV || !KV.st) return; e.preventDefault();
    var y = KV.st.start + ((KV.click + 0.5) / KV.tl.duration()) * (KV.st.end - KV.st.start);
    if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: 'smooth' });
  });
  /* "See pricing" in the nav: shown from the KEVIN line on; a straight jump (no long scroll through the animations) */
  var navPriceEl = document.getElementById('navPrice');
  function navPriceOn(on) { if (navPriceEl) navPriceEl.classList.toggle('on', !!on); }
  if (navPriceEl) navPriceEl.addEventListener('click', function (e) {
    var tgt = document.getElementById('pricing'); if (!tgt) return;
    e.preventDefault();
    var y = tgt.getBoundingClientRect().top + window.scrollY;
    if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
    ScrollTrigger.update(); navPriceOn(true);
  });

  // second rendition of the KEVIN moment: ?kv=burst (the word blows out into the stars instead of the fly-through)
  var BURST = /[?&]kv=burst/.test(location.search);

  /* =================== THE STAGE =================== */
  function buildStage() {
    var sin = $('.stage-in'), W = sin.clientWidth, H = sin.clientHeight, phone = W < 900;
    var sky = window.KVSky;
    // the real picker card is 1290 px wide: never show it bigger than its own pixels (crisp on any screen)
    document.documentElement.style.setProperty('--pk', Math.round(1290 / Math.min(3, window.devicePixelRatio || 1)) + 'px');
    gsap.set($$('.beat'), { clearProps: 'all' });

    /* ---- KEVIN word: one geometry shared by the on-screen SVG letters, the clip window and the point targets ---- */
    var wordEl = $('#kvWord');
    var fsProbe = parseFloat(getComputedStyle(wordEl).fontSize) || 100;
    var sp = wordEl.querySelectorAll('span'), ratio = (sp[sp.length - 1].getBoundingClientRect().right - sp[0].getBoundingClientRect().left) / fsProbe || 3.6;
    var len = phone ? W - 36 : Math.min(W * 0.84, 1560);
    var fs = len / ratio;
    var cvm = document.createElement('canvas').getContext('2d');
    cvm.font = '900 ' + fs + 'px Archivo';
    try { cvm.fontStretch = 'expanded'; } catch (e) {}
    var mK = cvm.measureText('KEVIN'), k = len / mK.width;
    var capH = (mK.actualBoundingBoxAscent || fs * 0.7);
    var x0 = (W - len) / 2, base = (phone ? H * 0.47 : H * 0.5) + capH / 2;
    var wKEV = cvm.measureText('KEV').width * k, wI = cvm.measureText('I'), iInk = ((wI.actualBoundingBoxRight || 0) + (wI.actualBoundingBoxLeft || 0)) * k || fs * 0.2;
    var iCx = x0 + wKEV + (cvm.measureText('I').width * k) / 2, iCy = base - capH / 2;
    var zoomS = Math.max(W / Math.max(4, iInk * 0.9), H / Math.max(4, capH * 0.9)) * 1.25;

    var svg = $('#kvSvg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'kvSvg'; svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'kv-svg');
      svg.innerHTML = '<text id="kvSvgText">KEVIN</text>';
      $('#kv').appendChild(svg);
    }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('style', 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;overflow:visible;opacity:0;pointer-events:none');
    [$('#kvSvgText'), $('#kvClipText')].forEach(function (t) {
      t.setAttribute('x', x0); t.setAttribute('y', base);
      t.setAttribute('font-size', fs); t.setAttribute('textLength', len); t.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      t.setAttribute('style', "font-family:Archivo;font-weight:900;font-variation-settings:'wdth' 125;font-stretch:125%");
      t.removeAttribute('transform');
    });
    $('#kvSvgText').setAttribute('fill', '#EDEEF2');
    var built = $('#kvBuilt'), line = $('#kvLine');
    gsap.set(built, { left: '50%', xPercent: -50, whiteSpace: 'nowrap', top: base - capH - (phone ? 46 : 64), fontSize: phone ? 22 : Math.max(22, fs * 0.13) });
    // the line under KEVIN, centred under the word (Anthony 2026-10-15: centred text)
    gsap.set(line, { left: phone ? 18 : '50%', right: phone ? 18 : 'auto', xPercent: phone ? 0 : -50, top: base + (phone ? 26 : 36), width: phone ? 'auto' : Math.min(760, W * 0.6), textAlign: 'center' });

    /* ---- the gray chat and its points ---- */
    var gchat = $('#gchat'), glog = $('#glog'), ctxEl = $('#ctx'), greset = $('#greset'), win1 = $('.gwin.one'), gflag = $('.gflag');
    gsap.set([gchat, glog, win1, greset, gflag], { clearProps: 'clipPath,transform,opacity,visibility' });
    // the original page's chat: a real window size, centred (a touch low, so its caption sits above it)
    var gH = Math.round(Math.min(560, H * (phone ? 0.56 : 0.6))), gTop = Math.round((H - gH) / 2 + (phone ? 34 : 40));
    gsap.set(gchat, { left: '50%', x: 0, xPercent: -50, yPercent: 0, top: gTop, height: gH });
    // how far the log scrolls so its last line ends just above the message box
    var travel = Math.max(0, glog.offsetHeight + 54 + 70 - gH);
    var sr = sin.getBoundingClientRect(), gr = gchat.getBoundingClientRect();
    if (sky) {
      sky.setChat({ x: gr.left - sr.left, y: gr.top - sr.top, w: gr.width, h: gr.height });
      sky.setLetters({ x: x0, y: base, fs: fs, len: len });
      gsap.set(sky.st, { shatter: 0, gather: 0, solid: 0, release: 0, stars: 0, word: 0, hush: 0 });
    }

    /* ---- HOME ---- */
    var home = $('#home'), homeIn = $('#homeIn'), go = $('#homeGo'), cursor = $('#cursor');
    gsap.set([homeIn, go, cursor], { clearProps: 'transform' });
    var hr = homeIn.getBoundingClientRect(), br = go.getBoundingClientRect();
    var bx = br.left - hr.left + br.width / 2, by = br.top - hr.top + br.height / 2;
    var bvx = br.left - sr.left + br.width / 2, bvy = br.top - sr.top + br.height / 2;
    var figs = $$('.fig'), brief = $('#homeBrief'), briefTxt = brief.getAttribute('data-full') || brief.textContent;
    brief.setAttribute('data-full', briefTxt);

    /* ---- the stack geometry ---- */
    var lyBrain = $('#lyBrain'), lyChat = $('#lyChat'), lyModels = $('#lyModels'), lySkills = $('#lySkills'), lyHooks = $('#lyHooks');
    var order = [lyBrain, lyChat, lyModels, lySkills, lyHooks];
    var cards = [lyBrain, lyModels, lySkills, lyHooks];
    var cw, ch, top0 = phone ? 62 : 0;
    if (phone) { cw = W - 32; ch = Math.min(H * 0.56, cw * 1.18); }
    else { cw = Math.min(W - 64 - W * 0.4, 1000); ch = Math.min(cw * 0.62, H * 0.7); }
    // phones: the models card is only as tall as the real picker card (no empty box around it)
    var mh = phone ? Math.round((cw - 16) * 854 / 1290 + 16) : ch;
    cards.forEach(function (c) { var h = c === lyModels ? mh : ch; gsap.set(c, { width: cw, height: h, left: (W - cw) / 2, top: (H - h) / 2, right: 'auto', bottom: 'auto' }); });
    if (phone) {
      // phones: the layer and its caption sit together in the middle of the screen (2026-10-16: they sat high, with
      // dead space under them). Captions stay top-aligned at one height (ruling 20), so use the tallest one.
      var capMax = 0;
      $$('.cap').forEach(function (c) { capMax = Math.max(capMax, c.offsetHeight); });
      top0 = Math.max(58, Math.round((H - (ch + 14 + capMax)) / 2));
    }
    gsap.set(lyChat, { clearProps: 'width,height,left,top' });
    var chatFull = { width: W, height: H, left: 0, top: 0 }, chatCard = { width: cw, height: ch, left: (W - cw) / 2, top: (H - ch) / 2 };
    var capTop = phone ? top0 + ch + 14 : 0;
    $('#caps').style.setProperty('--capTop', capTop + 'px');
    function boxOf(el) { return { w: cw, h: el === lyModels ? mh : ch }; }
    var fit = { dx: 0, dy: 0, k: 1 };
    function slot(el, i) {
      var b = boxOf(el);
      if (phone) {
        var vw = W * 0.72;
        return { x: fit.dx, y: (-0.27 + 0.135 * i) * H + fit.dy, z: 0, rotationX: 52, rotationY: 0, rotationZ: -14, scale: fit.k * vw / b.w };
      }
      var vw2 = W * 0.255;
      return { x: W * (0.15 + 0.175 * i) - W / 2 + fit.dx, y: -0.05 * H + fit.dy, z: -i * 70, rotationX: 0, rotationY: -32, rotationZ: 0, scale: fit.k * vw2 / b.w };
    }
    function focus(el) {
      var b = boxOf(el);
      if (phone) {
        var s = Math.min((W - 32) / b.w, ch / b.h);
        return { x: 0, y: top0 + ch / 2 - H / 2, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: s };
      }
      var areaL = W * 0.4, areaR = W - 64, s2 = Math.min((areaR - areaL) / b.w, (H * 0.72) / b.h);
      return { x: (areaL + areaR) / 2 - W / 2, y: H * 0.02, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: s2 };
    }
    var stack = $('#stack');
    // the tilted pile sits dead centre and fits the screen: lay it out, measure it, correct, twice
    gsap.set(stack, { autoAlpha: 1 });
    for (var it = 0; it < 3; it++) {
      order.forEach(function (el, i) { gsap.set(el, Object.assign({ autoAlpha: 1 }, el === lyChat ? chatCard : {}, slot(el, i))); });
      var u = null;
      order.forEach(function (el) { var r = el.getBoundingClientRect(); u = u ? { l: Math.min(u.l, r.left), t: Math.min(u.t, r.top), r: Math.max(u.r, r.right), b: Math.max(u.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
      var uw = u.r - u.l, uh = u.b - u.t;
      fit.k *= Math.min(1, (W - (phone ? 28 : 120)) / uw, (H - (phone ? 150 : 200)) / uh);
      fit.dx += W / 2 - (u.l - sr.left + uw / 2); fit.dy += (phone ? H / 2 + 22 : H / 2 + 10) - (u.t - sr.top + uh / 2);
    }
    gsap.set(order, { clearProps: 'transform,opacity,visibility,zIndex' });
    gsap.set([lyBrain, lyModels, lySkills, lyHooks], { x: 0, y: 0, z: -40, scale: 0.9 * W / cw, autoAlpha: 0 });
    gsap.set(lyChat, Object.assign({ x: 0, y: 0, z: 0, scale: 1, autoAlpha: 1 }, chatFull));

    /* ---- initial states ---- */
    var B = function (c) { return $('.' + c); };
    gsap.set($$('.beat'), { autoAlpha: 0, filter: 'blur(0px)', y: 0 });
    gsap.set('.b-boomer,.b-demo,.b-pc', { yPercent: -50 });   // these three sit in the middle of the screen
    gsap.set(B('b-q'), { autoAlpha: 1 });
    gsap.set(gchat, { autoAlpha: 0, clipPath: 'inset(0% 0% 0% 0%)' });
    gsap.set(glog, { y: 0 });
    gsap.set(greset, { autoAlpha: 0, xPercent: 130 });
    gsap.set(gflag, { autoAlpha: 0 });
    ctxEl.textContent = '12%'; ctxEl.parentNode.classList.remove('hot');
    gsap.set([built, line], { autoAlpha: 0, y: 0 });
    gsap.set(svg, { opacity: 0 });
    // HOME shows through the KEVIN letters: a mask made from the very same letter picture as the points and the
    // solid word, so all three line up on every browser (the old SVG letters drew differently on iPhones)
    // (2026-10-16: the see-through letters and the zoom are retired; HOME no longer shows through a letter mask)
    var maskUrl = null;
    function homeMask(s) {
      var hs = home.style;
      if (!maskUrl || s === null) { hs.maskImage = hs.webkitMaskImage = 'none'; return; }
      hs.maskImage = hs.webkitMaskImage = 'url(' + maskUrl + ')';
      hs.maskRepeat = hs.webkitMaskRepeat = 'no-repeat';
      hs.maskSize = hs.webkitMaskSize = (W * s) + 'px ' + (H * s) + 'px';
      hs.maskPosition = hs.webkitMaskPosition = (iCx - iCx * s) + 'px ' + (iCy - iCy * s) + 'px';
    }
    gsap.set(home, { autoAlpha: 0, clipPath: 'none', webkitClipPath: 'none' });
    homeMask(BURST ? null : 1);
    gsap.set('.home-tabs li', { autoAlpha: 0 });
    /* ---- the solid KEVIN that glides into HOME (Anthony 2026-10-16: "something a little bit more solid" than the black
       letters zooming). A copy of the very same letter picture the points and the solid word come from sits above HOME,
       so the hand-over from the star canvas cannot jump; it shrinks into HOME's own KEVIN label and turns gold. ---- */
    // the briefing types itself out later: reserve its full height now so HOME never shifts while it types
    brief.style.minHeight = ''; brief.textContent = briefTxt; brief.style.minHeight = brief.offsetHeight + 'px';
    var fly = $('#kvFly'), kvLab = $('.home-kv'), flyGold = null, wd = sky && sky.wordPic ? sky.wordPic() : null;
    if (!fly) { fly = document.createElement('div'); fly.id = 'kvFly'; fly.className = 'kv-fly'; fly.setAttribute('aria-hidden', 'true'); sin.appendChild(fly); }
    fly.innerHTML = '';
    gsap.set(fly, { clearProps: 'transform' });
    var flyTo = null;
    if (wd && !BURST) {
      var mk = function (gold) {
        var c = document.createElement('canvas'); c.width = wd.img.width; c.height = wd.img.height;
        var g = c.getContext('2d'); g.drawImage(wd.img, 0, 0);
        if (gold) { g.globalCompositeOperation = 'source-in'; g.fillStyle = '#FFD23F'; g.fillRect(0, 0, c.width, c.height); }
        c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%' + (gold ? ';opacity:0' : '');
        fly.appendChild(c); return c;
      };
      mk(false); flyGold = mk(true);
      // the label's letters, not its full-width line
      var rg = document.createRange(); rg.selectNodeContents(kvLab);
      var kr = rg.getBoundingClientRect(), icx = x0 + len / 2, icy = base - capH / 2;
      gsap.set(fly, { left: wd.x, top: wd.y, width: wd.w, height: wd.h, autoAlpha: 0, transformOrigin: (icx - wd.x) + 'px ' + (icy - wd.y) + 'px' });
      flyTo = { x: (kr.left - sr.left + kr.width / 2) - icx, y: (kr.top - sr.top + kr.height / 2) - icy, scale: kr.width / len };
    }
    gsap.set(kvLab, { autoAlpha: flyTo ? 0 : 1 });
    gsap.set(stack, { autoAlpha: 0 });
    gsap.set($$('.cap'), { autoAlpha: 0, y: 14 });
    gsap.set('#stackTitle', { autoAlpha: 0 });
    gsap.set(cursor, { autoAlpha: 0, x: W * 0.86, y: H * 0.96 });
    gsap.set($$('.c2,.c3,.c4,.c5,.c6'), { autoAlpha: 0, y: 8 });
    gsap.set($$('.lib-diff .dl'), { autoAlpha: 0 });
    gsap.set('#homePay', { autoAlpha: 0 });
    figs.forEach(function (f) { f.textContent = fmt(f, 0); });
    brief.textContent = '';

    // every story line is split into words once; a line comes in dim and its words light up in order (the original
    // page's opening), then the words go out in order
    $$('.beat').forEach(function splitWords(el) {
      if (el.getAttribute('data-split')) return; el.setAttribute('data-split', '1');
      [].slice.call(el.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.appendChild(s);
          });
          el.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') splitWords(n);
      });
    });
    gsap.set($$('.beat .w'), { opacity: 1 });
    // the three captions sit just above the chat box
    $$('.b-bloat,.b-halluc,.b-forget').forEach(function (c) { c.style.top = Math.max(phone ? 60 : 70, gTop - c.offsetHeight - (phone ? 14 : 22)) + 'px'; });
    gsap.set('.b-q,.b-behind,.b-boomer', { yPercent: -50 });
    var tl = gsap.timeline({ defaults: { ease: 'none' } });
    function WS(c) { return $$('.w', B(c)); }
    function beatIn(c, at, d) {
      d = d || 0.6; var ws = WS(c);
      tl.fromTo(B(c), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12 }, at);
      tl.fromTo(ws, { opacity: 0.14 }, { opacity: 1, duration: Math.max(0.1, d * 0.3), stagger: d * 0.7 / Math.max(1, ws.length), immediateRender: false }, at + 0.04);
    }
    function beatOut(c, at, d) {
      d = d || 0.35; var ws = WS(c);
      tl.fromTo(ws, { opacity: 1 }, { opacity: 0, duration: 0.1, stagger: d * 0.8 / Math.max(1, ws.length), immediateRender: false }, at);
      tl.fromTo(B(c), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.05, immediateRender: false }, at + d);
    }
    var ctxP = { v: 12 };
    function ctxTo(v, at, d) { tl.fromTo(ctxP, { v: ctxP.v }, { v: v, duration: d, onUpdate: function () { ctxEl.textContent = Math.round(ctxP.v) + '%'; ctxEl.parentNode.classList.toggle('hot', ctxP.v > 85); } }, at); ctxP.v = v; }

    // 1. the story
    tl.fromTo('.scroll-cue', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3 }, 0.05);
    beatOut('b-q', 0.12, 0.38);
    beatIn('b-behind', 0.55, 0.3);
    beatOut('b-behind', 1.0, 0.25);
    beatIn('b-boomer', 1.3, 0.6);
    beatOut('b-boomer', 2.05, 0.3);
    // the chat: the log scrolls up as the context fills, it makes things up, then a fresh empty chat slides in
    tl.fromTo(gchat, { autoAlpha: 0, x: 0, y: 60, scale: 0.96, xPercent: -50 }, { autoAlpha: 1, x: 0, y: 0, scale: 1, xPercent: -50, duration: 0.5, ease: 'power3.out' }, 2.4);
    beatIn('b-bloat', 2.6);
    tl.fromTo(glog, { y: 0 }, { y: -travel, duration: 1.95 }, 2.75);
    ctxTo(100, 2.75, 1.95);
    beatOut('b-bloat', 4.25); beatIn('b-halluc', 4.4);
    tl.fromTo(gflag, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 4.75);
    if (window.ScrambleTextPlugin) tl.to('.gm.hal', { scrambleText: { text: '{original}', chars: '01#%&?!', revealDelay: 0, speed: 0.6 }, duration: 0.8 }, 4.75);
    tl.fromTo(win1, { x: 0, skewX: 0 }, { keyframes: { x: [0, -6, 5, -3, 0], skewX: [0, 2, -2, 1, 0] }, duration: 0.4 }, 5.2);
    beatOut('b-halluc', 5.9); beatIn('b-forget', 6.05);
    tl.fromTo(win1, { opacity: 1, scale: 1 }, { opacity: 0.25, scale: 0.94, duration: 0.5 }, 6.05);
    tl.fromTo(gflag, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2, immediateRender: false }, 6.05);
    tl.fromTo(greset, { xPercent: 130, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.7, ease: 'expo.out' }, 6.15);
    beatOut('b-forget', 6.9); beatIn('b-demo', 8.05, 0.75);
    // the points from the shattered chat hang back behind the words so they never sit on top of them
    if (sky) { tl.fromTo(sky.st, { hush: 0 }, { hush: 1, duration: 0.5 }, 7.6); tl.fromTo(sky.st, { hush: 1 }, { hush: 0, duration: 0.4, immediateRender: false }, 9.85); }
    // the chat window shatters into points, bottom rows first
    if (sky) tl.fromTo(sky.st, { shatter: 0 }, { shatter: 1, duration: 1.6 }, 7.2);
    tl.fromTo(gchat, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.88 }, 7.2);
    tl.set(gchat, { autoAlpha: 0 }, 8.1);
    beatOut('b-demo', 8.95, 0.25); beatIn('b-pc', 9.2, 0.55);
    beatOut('b-pc', 9.85, 0.25);
    // 2. KEVIN: the points fly together into the letters
    tl.fromTo(built, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 10.05);
    if (sky) {
      tl.fromTo(sky.st, { gather: 0 }, { gather: 1, duration: 2.0 }, 10.15);
      tl.fromTo(sky.st, { stars: 0 }, { stars: 1, duration: 1.3 }, 10.3);
    }
    if (sky) {
      tl.fromTo(sky.st, { word: 0 }, { word: 1, duration: 0.6, ease: 'power1.inOut' }, 11.45);
      tl.fromTo(sky.st, { solid: 0 }, { solid: 1, duration: 0.6, ease: 'power1.inOut' }, 11.45);
    }
    tl.fromTo(line, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 11.9);
    if (sky && !BURST) tl.fromTo(sky.st, { release: 0 }, { release: 1, duration: 1.2 }, 12.3);
    tl.fromTo([built, line], { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -18, duration: 0.4 }, 13.35);
    if (BURST) {
      // 3b. ?kv=burst (Anthony 2026-10-15): the solid word turns back into its points, then blows outward into the
      // star field. Every star behind the rest of the page comes out of the letters. HOME settles in as they land.
      if (sky) {
        tl.fromTo(sky.st, { word: 1 }, { word: 0, duration: 0.5, ease: 'power1.inOut' }, 12.9);
        tl.fromTo(sky.st, { solid: 1 }, { solid: 0, duration: 0.5, ease: 'power1.inOut' }, 12.9);
        tl.fromTo(sky.st, { release: 0 }, { release: 1, duration: 1.7 }, 13.3);
      }
      tl.fromTo(home, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: 'power1.inOut' }, 14.2);
      tl.fromTo(homeIn, { scale: 1.06 }, { scale: 1, duration: 1.0, ease: 'power2.out' }, 14.2);
    } else {
    // 3. the solid word glides up into HOME's KEVIN label and turns gold while HOME settles in around it
    if (flyTo) {
      if (sky) tl.fromTo(sky.st, { word: 1 }, { word: 0, duration: 0.01, immediateRender: false }, 13.5);
      tl.fromTo(fly, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 13.5);
      // it shrinks a little ahead of the glide, so the big letters are small before HOME's words appear
      tl.fromTo(fly, { scale: 1 }, { scale: flyTo.scale, duration: 1.0, ease: 'power2.inOut' }, 13.55);
      tl.fromTo(fly, { x: 0, y: 0 }, { x: flyTo.x, y: flyTo.y, duration: 1.25, ease: 'power3.inOut' }, 13.55);
      tl.fromTo(flyGold, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 14.15);
      tl.fromTo(kvLab, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 14.75);
      tl.fromTo(fly, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2, immediateRender: false }, 14.82);
    } else if (sky) tl.fromTo(sky.st, { word: 1 }, { word: 0, duration: 0.5 }, 13.7);
    // HOME comes in as the word lands, so the big letters never sit on top of HOME's words
    // HOME holds still so the word docks on the exact spot
    tl.fromTo(home, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: 'power1.inOut' }, 14.68);
    }
    // the arrival: the tabs come up, the Quotes tab underlines, the figures roll up, Kevin's briefing types
    tl.fromTo('.home-tabs li', { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.08, ease: 'power2.out' }, 14.4);
    tl.fromTo('.home-tabs li.on', { '--tab': 0 }, { '--tab': 1, duration: 0.6, ease: 'power2.inOut' }, 14.85);
    figs.forEach(function (f, i) {
      var p = { v: 0 }, to = +f.getAttribute('data-to');
      tl.fromTo(p, { v: 0 }, { v: to, duration: 0.9, ease: 'power2.out', onUpdate: function () { f.textContent = fmt(f, p.v); } }, 14.9 + i * 0.12);
    });
    var bP = { n: 0 };
    tl.fromTo(bP, { n: 0 }, { n: briefTxt.length, duration: 1.1, onUpdate: function () { brief.textContent = briefTxt.slice(0, Math.round(bP.n)); } }, 15.0);
    // a payment lands
    var col = $('#figCollected'), cP = { v: 46215 };
    tl.fromTo('#homePay', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: -14, duration: 0.3 }, 16.6);
    tl.fromTo(cP, { v: 46215 }, { v: 46555, duration: 0.6, ease: 'power2.out', immediateRender: false, onUpdate: function () { if (this.progress() > 0) col.textContent = '$' + Math.round(cP.v).toLocaleString('en-US'); } }, 16.7);
    tl.fromTo('#homePay', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3 }, 17.5);
    // the camera pushes in on Go to chat, the cursor arrives and clicks
    tl.fromTo(homeIn, { scale: 1, transformOrigin: bx + 'px ' + by + 'px' }, { scale: phone ? 1.55 : 1.7, transformOrigin: bx + 'px ' + by + 'px', duration: 1.0, ease: 'power2.inOut' }, 17.5);
    tl.fromTo(cursor, { autoAlpha: 0, x: W * 0.86, y: H * 0.96 }, { autoAlpha: 1, x: bvx + 6, y: bvy + 4, duration: 0.8, ease: 'power2.out' }, 17.8);
    tl.fromTo(go, { scale: 1 }, { scale: 0.94, duration: 0.08 }, 18.62);
    tl.fromTo(cursor, { scale: 1 }, { scale: 0.86, duration: 0.08 }, 18.62);
    // HOME is gone at once, like the real app; the chat is underneath
    tl.set([home, cursor], { autoAlpha: 0 }, 18.75);
    tl.set(stack, { autoAlpha: 1 }, 18.75);
    tl.fromTo('#stageSample', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 18.75);
    tl.fromTo('.c2', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.15 }, 18.95);
    tl.fromTo('.c3', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 19.4);
    tl.fromTo('.c4', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 19.75);
    tl.fromTo('.c5', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 20.1);
    tl.fromTo('.lib-diff .dl', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, stagger: 0.08 }, 20.2);
    tl.fromTo('.c6', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 20.85);
    var stEl = $('#libStatus');
    tl.call(function () { stEl.textContent = 'step 3 · writing the quote'; }, null, 19.0);
    tl.fromTo({}, {}, { duration: 0.01, onComplete: function () { stEl.textContent = '✓ draft ready · waiting for Mike'; }, onReverseComplete: function () { stEl.textContent = 'step 3 · writing the quote'; } }, 20.9);
    // 4. the stack: the chat tilts back and the layers come out from behind it
    var T = 21.4;
    order.forEach(function (el, i) {
      // the chat re-lays itself out at card size while it tilts back, so its text is never shrunk in the stack
      var from = el === lyChat ? Object.assign({ x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, autoAlpha: 1 }, chatFull)
        : { x: 0, y: 0, z: -40, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 0.9 * W / cw, autoAlpha: 0 };
      tl.fromTo(el, from, Object.assign({ duration: 1.0, ease: 'power3.inOut', autoAlpha: 1 }, el === lyChat ? chatCard : {}, slot(el, i)), T + (el === lyChat ? 0 : 0.1 + i * 0.06));
    });
    tl.fromTo('#stackTitle', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, T + 0.6);
    // desktop: layer 02 is the real Liberty screen once the chat has tilted back (phones keep the readable coded chat)
    if (!phone && $('#libReal')) tl.fromTo('#libReal', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: 'power1.inOut' }, T + 0.3);
    var DIM = phone ? 0 : 0.16;
    var F = T + 1.3, step = 1.2;
    order.forEach(function (el, i) {
      var at = F + i * step;
      tl.set(el, { zIndex: 10 }, at);
      tl.fromTo(el, slot(el, i), Object.assign({ duration: 0.6, ease: 'power3.inOut' }, focus(el)), at);
      tl.fromTo($$('.cap')[i], { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.35 }, at + 0.3);
      if (i === 0) tl.fromTo(order.slice(1), { autoAlpha: 1 }, { autoAlpha: DIM, duration: 0.3 }, at);
      else tl.fromTo(el, { autoAlpha: DIM }, { autoAlpha: 1, duration: 0.3 }, at);
      if (i === order.length - 1) return;   // ruling 17: the last layer stays in front and the page moves on
      tl.fromTo(el, { autoAlpha: 1 }, { autoAlpha: DIM, duration: 0.3 }, at + step - 0.05);
      tl.fromTo($$('.cap')[i], { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -10, duration: 0.25 }, at + step - 0.05);
      tl.fromTo(el, focus(el), Object.assign({ duration: 0.55, ease: 'power3.inOut' }, slot(el, i)), at + step - 0.05);
      tl.set(el, { zIndex: 5 - i }, at + step + 0.5);
    });
    var E = F + 5 * step;
    var total = E + 0.2;
    tl.to({}, { duration: 0.01 }, total);
    // the slow assembly (2026-10-15): everything from the solid letters on moves later by D
    var D = 0.5;
    tl.shiftChildren(D, false, 11.4);
    T += D; F += D; E += D; total += D;
    // a slower opening (Anthony 2026-10-16: "a tiny bit slower, like how it highlights all the words"): every story step
    // before unit 10 stretches by S, everything after moves later by SH
    var S = 1.2, CUT = 10.0, SH = CUT * (S - 1);
    tl.getChildren(false, true, true).forEach(function (c) {
      var s0 = c.startTime();
      if (s0 < CUT) { c.startTime(s0 * S); c.timeScale(c.timeScale() / S); } else c.startTime(s0 + SH);
    });
    T += SH; F += SH; E += SH; total += SH;

    UNIT = Math.round(H * (phone ? 0.42 : 0.45));
    var clickAt = 18.75 + D + SH;
    stageTL = tl;
    tl.scrollTrigger = ScrollTrigger.create({
      trigger: '#stage', start: 'top top', end: '+=' + Math.round(total * UNIT), pin: '.stage-in', scrub: lenis ? true : 0.4,
      animation: tl, anticipatePin: 1,
      onLeave: function () { navPriceOn(true); nav.classList.remove('hide'); nav.inert = false; if (brain) brain.stop(); if (mini) mini.stop(); },
      onEnterBack: function () { if (brain) brain.start(); }
    });
    stageST = tl.scrollTrigger;
    tl.eventCallback('onUpdate', function () {
      var t = tl.time();
      // the menu steps aside only while HOME's click and the full-screen chat play, then comes back for the stack (See pricing)
      var hideNav = t > 17.4 + D + SH && t < T + 0.9 && stageST.isActive;
      // the two real recordings download only once HOME is near, so the first screen stays light
      if (t > 13 + SH) loadVids();
      navPriceOn(t > 11.9 + D + SH || stageST.progress >= 1);
      nav.classList.toggle('hide', hideNav); nav.inert = hideNav;
      var live = stageST.isActive && t > T - 0.1 && t < F + step + 0.3;
      if (brain) { if (live && !brain.running) brain.start(); else if (!live && brain.running) brain.stop(); }
      if (mini) { var m = t > clickAt - 0.2 && t < T + 0.4 && stageST.isActive; if (m && !mini.running) mini.start(); else if (!m && mini.running) mini.stop(); }
      var focusing = t > F - 0.1;
      $('#stackTitle').style.visibility = focusing ? 'hidden' : '';
    });
    window.KV = { tl: tl, st: stageST, unit: UNIT, total: total, jump: jumpUnit, T: T, F: F, E: E, click: clickAt };
  }

  function fmt(f, v) { var p = f.getAttribute('data-pre') || ''; return p + Math.round(v).toLocaleString('en-US'); }

  function jumpUnit(u) {
    if (!stageST) return;
    var y = stageST.start + (u / stageTL.duration()) * (stageST.end - stageST.start);
    if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
    ScrollTrigger.update();
  }
  function jumpSection(id, p) {
    var o = others.filter(function (x) { return x.vars && x.vars.id === id; })[0];
    var y = o ? o.start + p * (o.end - o.start) : ($('#' + id).getBoundingClientRect().top + window.scrollY);
    if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
    ScrollTrigger.update();
  }

  /* =================== REAL INTERFACES =================== */
  function buildScreens() {
    var sec = $('#screens'), sets = $$('.scr-set', sec), phone = window.innerWidth < 900;
    var sub = $('#scrSub'), cnt = $('#scrCount');
    gsap.set(sets, { autoAlpha: 0, xPercent: -50, yPercent: -50, x: 0, y: 0 });
    gsap.set($$('.lift', sec), { autoAlpha: 0, y: 0, scale: 1 });
    var tl = gsap.timeline({ defaults: { ease: 'none' } }), t = 0, marks = [];
    var sh = sets[0].offsetWidth / 1.7778, G = Math.max(0, (window.innerHeight - sh) / 2 - 178);
    sets.forEach(function (s, i) {
      marks.push([t, s]);
      var opens = i === 0 && $('.lift-pick', s);
      if (opens) { tl.fromTo(s, { autoAlpha: 1, y: 0 }, { autoAlpha: 1, y: 0, duration: 0.01 }, 0); t += 0.05; }
      else { tl.fromTo(s, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, t); t += 0.6; }
      var note = $('.scr-note', s);
      if (note && phone) { tl.fromTo(s, { y: 0 }, { y: -G, duration: 0.4 }, t); t += 0.9; tl.fromTo(s, { y: -G }, { y: 0, duration: 0.3 }, t); }
      else if (note) t += 0.8;
      $$('.lift', s).forEach(function (l) {
        if (l.classList.contains('lift-pick')) {
          // like the original page: the section OPENS zoomed in on the real picker card, then scrolling settles it back
          // into its place on the screen. The card is laid out at its zoomed size (sharp, never above its own pixels)
          // and shrinks into place, so it is never blown up.
          var sw = s.offsetWidth, sh = s.offsetHeight, px = parseFloat(l.style.getPropertyValue('--x')) / 100,
            py = parseFloat(l.style.getPropertyValue('--y')) / 100, pw = parseFloat(l.style.getPropertyValue('--w')) / 100;
          var rw = sw * pw, rh = rw * 854 / 1290, dpr = Math.min(3, window.devicePixelRatio || 1);
          var S = Math.max(1, Math.min(window.innerWidth * (phone ? 0.94 : 0.84) / rw, window.innerHeight * (phone ? 0.5 : 0.62) / rh, 1290 / (rw * dpr)));
          gsap.set(l, { position: 'absolute', left: sw / 2 - rw * S / 2, top: sh / 2 - rh * S / 2, width: rw * S, right: 'auto', margin: 0, transformOrigin: '50% 50%' });
          var tx = sw * px + rw / 2 - sw / 2, ty = sh * py + rh / 2 - sh / 2;
          tl.fromTo(l, { autoAlpha: 1, x: 0, y: 0, scale: 1 }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.01 }, 0);
          tl.fromTo($('.scr', s), { opacity: 0.3 }, { opacity: 0.3, duration: 0.01 }, 0);
          tl.fromTo(l, { x: 0, y: 0, scale: 1 }, { x: tx, y: ty, scale: 1 / S, duration: 1.0, ease: 'power3.inOut' }, t + 0.35);
          tl.fromTo($('.scr', s), { opacity: 0.3 }, { opacity: 1, duration: 0.6, ease: 'power2.inOut' }, t + 0.75);
          tl.fromTo(l, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.25 }, t + 1.4);
          t += 1.8;
        } else if (phone) {
          // phones, like the laptop (2026-10-15): the readable close-up card grows out of its own spot on the screen,
          // sits whole over the dimmed screen, then fades back into it
          var sw2 = s.offsetWidth, sh2 = s.offsetHeight, cs = l.style;
          var px2 = parseFloat(cs.getPropertyValue('--x')) / 100, py2 = parseFloat(cs.getPropertyValue('--y')) / 100, pw2 = parseFloat(cs.getPropertyValue('--w')) / 100;
          var li = $('.lift-img', l), ar = li ? (+li.getAttribute('height') / +li.getAttribute('width')) : 0.2;
          var rw2 = sw2 * pw2, rh2 = rw2 * ar, lw = Math.min(window.innerWidth * 0.94, 520);
          l.classList.add('zl');
          gsap.set(l, { position: 'absolute', left: sw2 / 2 - lw / 2, width: lw, right: 'auto', margin: 0, top: 0, transformOrigin: '50% 50%' });
          gsap.set(l, { top: sh2 / 2 - l.offsetHeight / 2 });
          var fx = sw2 * px2 + rw2 / 2 - sw2 / 2, fy = sh2 * py2 + rh2 / 2 - sh2 / 2, fsc = Math.max(0.12, rw2 / lw);
          tl.fromTo(l, { autoAlpha: 0, x: fx, y: fy, scale: fsc }, { autoAlpha: 1, x: fx, y: fy, scale: fsc, duration: 0.1 }, t);
          tl.fromTo(l, { x: fx, y: fy, scale: fsc }, { x: 0, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', immediateRender: false }, t + 0.05);
          tl.fromTo($('.scr', s), { opacity: 1 }, { opacity: 0.28, duration: 0.35 }, t);
          // the camera pushes into that spot on the real screen while the card grows, and eases back out after
          var org = ((px2 + pw2 / 2) * 100).toFixed(1) + '% ' + ((py2 * 100) + (rh2 / sh2) * 50).toFixed(1) + '%';
          tl.fromTo($('.scr', s), { scale: 1, transformOrigin: org }, { scale: 1.45, transformOrigin: org, duration: 1.2, ease: 'power2.out' }, t);
          tl.fromTo($('.scr', s), { scale: 1.45 }, { scale: 1, duration: 0.45, ease: 'power2.inOut', immediateRender: false }, t + 1.35);
          tl.fromTo(l, { x: 0, y: 0, scale: 1 }, { x: fx, y: fy, scale: fsc, duration: 0.4, ease: 'power2.in', immediateRender: false }, t + 1.3);
          tl.fromTo(l, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.15, immediateRender: false }, t + 1.6);
          tl.fromTo($('.scr', s), { opacity: 0.28 }, { opacity: 1, duration: 0.3, immediateRender: false }, t + 1.45);
          t += 1.9;
        } else {
          tl.fromTo(l, { autoAlpha: 0, scale: 0.92, y: 18 }, { autoAlpha: 1, scale: 1.12, y: 0, duration: 0.45, ease: 'power2.out' }, t);
          tl.fromTo($('.scr', s), { opacity: 1 }, { opacity: 0.35, duration: 0.35 }, t);
          tl.fromTo(l, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.25 }, t + 1.15);
          tl.fromTo($('.scr', s), { opacity: 0.35 }, { opacity: 1, duration: 0.25 }, t + 1.15);
          t += 1.4;
        }
      });
      if (!$$('.lift', s).length && !note) t += 0.9;
      if (i < sets.length - 1) { tl.fromTo(s, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.35 }, t); t += 0.35; }
      else t += 0.5;
    });
    tl.to({}, { duration: 0.01 }, t);
    var st = ScrollTrigger.create({
      id: 'screens', trigger: '.scr-pin', start: 'top top', end: '+=' + Math.round(t * window.innerHeight * 0.3), pin: '.scr-pin', scrub: lenis ? true : 0.4, animation: tl,
      onToggle: function (self) { if (!liftMini) return; if (self.isActive) liftMini.start(); else liftMini.stop(); }
    });
    tl.eventCallback('onUpdate', function () {
        var now = tl.time(), cur = marks[0][1];
        marks.forEach(function (m) { if (now >= m[0] - 0.05) cur = m[1]; });
        if (sub.textContent !== cur.dataset.sub) { sub.textContent = cur.dataset.sub; cnt.textContent = cur.dataset.n; }
    });
    others.push(st);
  }

  /* =================== PRICING ON PHONES =================== */
  // one screen: the three prices as tabs, the chosen plan's details below (rows that differ; the rest in one line)
  function buildPhonePricing() {
    var box = $('#pmob'), table = $('.pricing .ptable'); if (!box || !table || box.childNodes.length) return;
    var heads = $$('thead th', table).slice(1), rows = $$('tbody tr', table), same = [], diff = [];
    rows.forEach(function (r) {
      var cells = $$('td', r).map(function (c) { return { t: c.textContent.trim(), no: c.classList.contains('no') }; });
      var label = $('th', r).textContent.trim();
      if (cells.every(function (c) { return c.t === 'Included'; })) same.push(label); else diff.push({ label: label, cells: cells });
    });
    var si = diff.findIndex(function (d) { return d.label === 'Skills I build'; }), ri = diff.findIndex(function (d) { return d.label === 'Robots I build'; });
    if (si > -1 && ri > -1) {
      diff[si] = { label: 'Skills and robots I build', cells: diff[si].cells.map(function (c, k) {
        var r = diff[ri].cells[k].t.replace(/:.*$/, ''); return { t: c.t === r ? c.t : c.t + ' and ' + r.replace(/^Up to /, ''), no: false }; }) };
      diff.splice(ri, 1);
    }
    var tabs = document.createElement('div'); tabs.className = 'pm-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Plans');
    var card = document.createElement('div'); card.className = 'pm-card'; card.setAttribute('role', 'tabpanel');
    var short = ['One time', 'One time', 'A month'];
    heads.forEach(function (h, i) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab');
      b.innerHTML = '<b>' + $('.pn', h).textContent + '</b><span class="amt">' + $('.amt', h).textContent + '</span><small>' + short[i] + '</small>';
      b.onclick = function () { show(i); };
      b.onkeydown = function (e) {
        var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!k) return;
        var n = (i + k + heads.length) % heads.length; show(n); tabs.children[n].focus(); e.preventDefault();
      };
      tabs.appendChild(b);
    });
    function show(i) {
      $$('button', tabs).forEach(function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
      var h = heads[i], btn = $('.btn', h);
      card.innerHTML = '<p class="pm-when">' + $('.when', h).textContent + '</p><ul class="pm-rows">' +
        diff.map(function (d) { var c = d.cells[i]; return '<li><span>' + d.label + '</span><b' + (c.no ? ' class="no"' : '') + '>' + c.t + '</b></li>'; }).join('') +
        '</ul><p class="pm-all">Every plan also gets the interview, the brain and the app, hooks and locks, the walkthrough video, and a KEVIN that explains and fixes itself.</p>' +
        '<a class="btn ' + (i === 1 ? 'btn-gold' : 'btn-line') + '" href="' + btn.getAttribute('href') + '">' + btn.textContent + '</a>';
    }
    box.appendChild(tabs); box.appendChild(card); box.hidden = false; show(1);
  }

  /* =================== THEMES (the original page's section) =================== */
  // scroll re-skins one cockpit through five looks; the section takes on each theme's colour
  function buildThemes() {
    var sec = $('#themes'); if (!sec) return;
    var imgs = $$('.th-shot', sec), sws = $$('.sw', sec), nm = $('.th-name', sec), cur = -1;
    function mark(i) {
      if (i === cur) return; cur = i;
      sws.forEach(function (w, j) { w.classList.toggle('on', j === i); });
      nm.textContent = sws[i].querySelector('b').textContent;
      sec.style.backgroundColor = getComputedStyle(sws[i]).getPropertyValue('--bg');
      sec.classList.toggle('light', sws[i].textContent.indexOf('Concrete') === 0);
    }
    gsap.set(imgs.slice(1), { clipPath: 'circle(0% at 0% 50%)' });
    var tt = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onUpdate: function () { mark(Math.min(imgs.length - 1, Math.max(0, Math.round(tt.time() - 0.15)))); } });
    imgs.forEach(function (im, i) { if (i) tt.fromTo(im, { clipPath: 'circle(0% at 0% 50%)' }, { clipPath: 'circle(150% at 0% 50%)', duration: 0.7 }, i - 0.35); });
    tt.to({}, { duration: 0.4 });
    // pinned with ScrollTrigger (CSS sticky cannot hold here: the body clips sideways overflow)
    var st = ScrollTrigger.create({ id: 'themes', trigger: sec, start: 'top top', end: '+=' + Math.round(window.innerHeight * 1.6), pin: '.th-stage', scrub: 0.6, animation: tt });
    others.push(st);
    sws.forEach(function (w, i) {
      w.querySelector('button').onclick = function () {
        var y = st.start + (st.end - st.start) * Math.min(1, (i + 0.2) / tt.duration());
        if (lenis) lenis.scrollTo(y, { duration: 1.1 }); else window.scrollTo({ top: y, behavior: 'smooth' });
      };
    });
    mark(0);
  }
  function setupThemesStill() {
    var sec = $('#themes'); if (!sec) return;
    var imgs = $$('.th-shot', sec), sws = $$('.sw', sec), nm = $('.th-name', sec);
    sws.forEach(function (w, i) {
      w.querySelector('button').onclick = function () {
        imgs.forEach(function (im, j) { im.style.clipPath = j === i ? 'none' : 'circle(0% at 0% 50%)'; });
        sws.forEach(function (x, j) { x.classList.toggle('on', j === i); }); nm.textContent = w.querySelector('b').textContent;
        sec.style.backgroundColor = getComputedStyle(w).getPropertyValue('--bg'); sec.classList.toggle('light', i === 4);
      };
    });
    if (sws[0]) sws[0].classList.add('on');
  }

  /* =================== USE CASES =================== */
  function buildUses() {
    // calm decode (2026-10-15, Anthony: the scramble was too noisy): letters land left to right, only the two at the
    // leading edge flicker, the rest of the line waits invisible so nothing jumps
    $$('.use h3.dec').forEach(function (h) {
      var txt = h.getAttribute('data-full') || h.textContent; h.setAttribute('data-full', txt);
      var pool = 'abcdefghijklmnopqrstuvwxyz', esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
      function paint(n) {
        var i = Math.floor(n), edge = '';
        for (var k = i; k < Math.min(txt.length, i + 2); k++) edge += txt[k] === ' ' ? ' ' : pool[(Math.random() * 26) | 0];
        h.innerHTML = esc(txt.slice(0, i)) + '<span class="dec-e">' + esc(edge) + '</span><span class="dec-r">' + esc(txt.slice(i + edge.length)) + '</span>';
      }
      paint(0);
      others.push(ScrollTrigger.create({
        trigger: h, start: 'top 85%', once: true,
        onEnter: function () { var o = { n: 0 }; gsap.to(o, { n: txt.length, duration: 0.55, ease: 'power1.out', onUpdate: function () { paint(o.n); }, onComplete: function () { h.textContent = txt; } }); }
      }));
    });
    var tiles = $$('#wallGrid li');
    gsap.set(tiles, { autoAlpha: 0 });
    others.push(ScrollTrigger.create({
      trigger: '#wallGrid', start: 'top 85%', once: true,
      onEnter: function () { gsap.fromTo(tiles, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.03 }); }
    }));
  }

  /* =================== DEPARTMENTS =================== */
  function buildDepts() {
    var sec = $('#departments'), dps = $$('.dp', sec), idx = $$('#dpIndex li');
    gsap.set(dps, { autoAlpha: 0 });
    var tl = gsap.timeline({ defaults: { ease: 'none' } }), t = 0;
    dps.forEach(function (d, i) {
      var word = $('.dp-word', d), card = $('.dp-card', d);
      if (i === 0) {
        // the first department is already in place when the section arrives (the menu link lands on it, not on an empty scene)
        gsap.set(d, { autoAlpha: 1 }); gsap.set(word, { xPercent: 0, clipPath: 'inset(0% 0% 0% 0%)' }); gsap.set(card, { y: 0, autoAlpha: 1 });
        t += 0.8; tl.fromTo(d, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2 }, t); t += 0.1;
        return;
      }
      tl.fromTo(d, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, t);
      tl.fromTo(word, { xPercent: 18, clipPath: 'inset(0% 100% 0% 0%)' }, { xPercent: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.55, ease: 'power3.out' }, t);
      tl.fromTo(card, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, t + 0.2);
      t += 1.0;
      if (i < dps.length - 1) { tl.fromTo(d, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2 }, t); t += 0.1; }
    });
    tl.to({}, { duration: 0.3 }, t);
    var st = ScrollTrigger.create({
      id: 'departments', trigger: '.dp-pin', start: 'top top', end: '+=' + Math.round((t + 0.3) * window.innerHeight * 0.3), pin: '.dp-pin', scrub: lenis ? true : 0.4, animation: tl
    });
    function mark() { var i = Math.min(dps.length - 1, Math.floor((tl.time() + 0.2) / 1.1)); idx.forEach(function (li, j) { li.classList.toggle('on', j === i); }); }
    tl.eventCallback('onUpdate', mark); mark();
    others.push(st);
  }

  /* =================== SMALL SCENES =================== */
  function buildSmall() {
    var spans = $$('#film span');
    others.push(ScrollTrigger.create({
      trigger: '#film', start: 'top 85%', end: 'bottom 40%', scrub: true,
      onUpdate: function (self) { spans.forEach(function (s, i) { var v = Math.max(0, Math.min(1, self.progress * spans.length * 1.2 - i)); s.style.setProperty('--h', (v * 100) + '%'); }); }
    }));
    var builtTw = gsap.fromTo('#built', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power2.inOut', scrollTrigger: { trigger: '#built', start: 'top 92%', end: 'top 40%', scrub: true } });
    others.push(builtTw.scrollTrigger);
    var fw = gsap.fromTo('.foot-word', { yPercent: 40 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    others.push(fw.scrollTrigger);
  }

  /* =================== helpers used in every mode =================== */
  function buildTicks() {
    var g = $('#ringTicks'); if (!g || g.childNodes.length) return;
    var ns = 'http://www.w3.org/2000/svg', robots = [3.75, 7.25, 8, 9.5];
    for (var i = 0; i < 96; i++) {
      var h = i / 4, a = h / 24 * Math.PI * 2 - Math.PI / 2, maj = i % 24 === 0, r1 = 166, r2 = maj ? 178 : (i % 4 === 0 ? 174 : 170);
      var l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', 200 + Math.cos(a) * r1); l.setAttribute('y1', 200 + Math.sin(a) * r1);
      l.setAttribute('x2', 200 + Math.cos(a) * r2); l.setAttribute('y2', 200 + Math.sin(a) * r2);
      if (maj) l.setAttribute('class', 'maj');
      g.appendChild(l);
    }
    robots.forEach(function (h) {
      var a = h / 24 * Math.PI * 2 - Math.PI / 2, l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', 200 + Math.cos(a) * 158); l.setAttribute('y1', 200 + Math.sin(a) * 158);
      l.setAttribute('x2', 200 + Math.cos(a) * 168); l.setAttribute('y2', 200 + Math.sin(a) * 168);
      l.setAttribute('class', 'rb'); g.appendChild(l);
    });
  }
  function setupTabs() {
    var tabs = $$('.ide-tabs [role=tab]');
    function sel(i) {
      tabs.forEach(function (t, j) {
        var on = i === j; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
        var p = document.getElementById(t.getAttribute('aria-controls')); if (on) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { sel(i); });
      t.addEventListener('keydown', function (e) {
        var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (k) { var n = (i + k + tabs.length) % tabs.length; sel(n); tabs[n].focus(); e.preventDefault(); }
      });
    });
    if (tabs.length) sel(0);
  }
  function renderSignals() {
    var ol = $('#bvSignals'); if (!ol || !window.KV_BRAIN) return;
    ol.innerHTML = KV_BRAIN.signals.map(function (s) { return '<li><i>' + s[0] + '</i><span>' + s[1] + '</span></li>'; }).join('');
  }
  function showNode(n, i) {
    var f = $('#bvFile'), t = $('#bvText');
    if (!f) return;
    f.textContent = (n.k === 'robot' ? 'robot · ' : n.k === 'gate' ? 'hook · ' : '') + (n.k === 'lane' ? n.id : n.k === 'file' ? n.id : n.l);
    t.textContent = n.c;
    var li = $$('#bvSignals li'); li.forEach(function (x, j) { x.classList.toggle('on', j === i % li.length); });
  }
  function stillFrames() {
    if (brain) { brain.resize(); brain.draw(performance.now()); showNode(KV_BRAIN.nodes[0], 0); }
    if (mini) { mini.resize(); mini.draw(performance.now()); }
    if (liftMini) { liftMini.resize(); liftMini.draw(performance.now()); }
  }
})();
