// KEVIN, layer by layer: a scroll-driven exploded view of the product (Three.js + GSAP ScrollTrigger).
import * as THREE from '../vendor/three.module.js';

const section = document.getElementById('anatomy');
const canvas = document.getElementById('anat');
const labels = [...section.querySelectorAll('.alabel')];
const intro = section.querySelector('.anat-intro');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduce && window.gsap && window.ScrollTrigger) {
  try { init(); } catch (e) { document.documentElement.classList.add('anat-static'); }
} else document.documentElement.classList.add('anat-static');

function init() {
  gsap.registerPlugin(ScrollTrigger);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 900 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x07080b, 1);
  document.documentElement.classList.remove('anat-static');
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); document.documentElement.classList.add('anat-static'); ScrollTrigger.refresh(); });

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07080b, 26, 62);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const names = ['interface', 'models', 'brain', 'skills', 'hooks'];
  const W = 16, H = 9;

  const outer = new THREE.Group();   // yaw
  const inner = new THREE.Group();   // pitch
  outer.add(inner); scene.add(outer);

  const layers = names.map((n, i) => {
    const tex = loader.load(`media/layers/${n}.jpg`, () => ScrollTrigger.refresh());
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: i === 0 ? 0xffd23f : 0x4a505c, transparent: true, opacity: 0.0 }));
    const g = new THREE.Group(); g.add(mesh); g.add(edge);
    g.position.z = -i * 0.002;  // stacked flat at the start, interface on top
    inner.add(g);
    return { g, mesh, edge, mat };
  });

  // Dust: slow, sparse, for depth
  const N = 420, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i*3] = (Math.random()-.5)*60; pos[i*3+1] = (Math.random()-.5)*36; pos[i*3+2] = (Math.random()-.5)*40 - 6; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(dust);

  // State the timeline animates
  const S = { pitch: 0, yaw: 0, gap: 0, dist: 0, focus: -1, lift: 0, dim: 0, edges: 0, dust: 0, camY: 0, tour: 0, u: 0 };

  function fitDistance() {
    // distance at which the 16x9 plane fills the viewport (contain)
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hByH = H / 2 / Math.tan(vFov / 2);
    const hByW = (W / 2) / (Math.tan(vFov / 2) * camera.aspect);
    return Math.max(hByH, hByW);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // Pointer parallax
  const P = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { P.tx = (e.clientX / innerWidth - .5); P.ty = (e.clientY / innerHeight - .5); }, { passive: true });

  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' },
    scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 1,
      onUpdate: st => showLabel(st.progress) } });

  tl.to(S, { pitch: -1.02, yaw: -0.62, dist: 1, edges: 1, dust: 1, duration: 1 }, 0)          // tilt into 3D
    .to(S, { gap: 2.4, duration: .9 }, 0.6)                                                    // explode
    .to(intro, { opacity: 0, y: -30, duration: .4 }, 0.15);
  // bring each layer forward in turn
  // the camera glides down the exploded stack, settling square-on to each layer in turn
  const T0 = 1.6, STEP = 1.5;
  tl.to(S, { tour: 1, dim: 1, duration: .6 }, T0 - .3);
  for (let i = 1; i < names.length; i++) tl.to(S, { u: i, duration: .8, ease: 'power2.inOut' }, T0 + (i - 1) * STEP + .7);
  const TE = T0 + (names.length - 1) * STEP + 1.4;
  tl.to(S, { tour: 0, dim: 0, duration: .7 }, TE)
    .to(S, { gap: 0, pitch: 0, yaw: 0, dist: 0, edges: 0, duration: 1 }, TE + .4)   // ends on the full Liberty screen
    .to(section.querySelector('.anat-stage'), { opacity: 0, duration: .4 }, TE + 1.5);

  function showLabel(p) {
    const total = tl.duration();
    const t = p * total;
    labels.forEach((el, i) => {
      const a = 1.6 + i * 1.5;
      el.classList.toggle('on', t > a - .1 && t < a + 1.35);
    });
  }

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { rootMargin: '100px' }).observe(section);

  const t0 = performance.now();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = (performance.now() - t0) / 1000;
    P.x += (P.tx - P.x) * 0.05; P.y += (P.ty - P.y) * 0.05;

    outer.rotation.y = S.yaw + P.x * 0.18 * S.dist;
    inner.rotation.x = S.pitch - P.y * 0.10 * S.dist;

    layers.forEach((L, i) => {
      const near = Math.max(0, 1 - Math.abs(i - S.u));
      const front = Math.min(1, Math.max(0, (S.u - i) * 1.6));      // layers between the camera and the one on show
      L.g.position.set(0, 0, -i * (0.002 + S.gap));
      L.mat.opacity = (1 - 0.78 * S.dim * (1 - near)) * (1 - S.tour * front);
      L.edge.material.opacity = (0.45 + 0.55 * near * S.tour) * S.edges * (1 - S.tour * front);
      L.g.visible = L.mat.opacity > 0.01;
    });

    const base = fitDistance();
    const narrow = innerWidth < 900;
    const exploded = narrow ? base * 0.62 + 8 : base * 1.5 + 5;
    const d = THREE.MathUtils.lerp(base, exploded, S.dist) * (1 - 0.92 * S.camY);
    // aim at the real middle of the stack, and slide it right so the labels own the left side
    scene.updateMatrixWorld();
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    layers.forEach(L => c.add(L.g.getWorldPosition(v)));
    c.multiplyScalar(1 / layers.length);
    const side = narrow ? 0 : -W * 0.16 * S.dist;
    const drop = (narrow ? -3.2 : 0) * S.dist;
    camera.position.set(c.x + side + Math.sin(t * .15) * .25 * S.dist, c.y + drop + 3 * S.dist, c.z + d);
    camera.lookAt(c.x + side, c.y + drop, c.z);
    // camera tour: square-on views of each layer, blended with the overview
    if (S.tour > 0.001) {
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const wFrac = narrow ? 0.96 : 0.62;
      const dist = (W / wFrac) / (2 * Math.tan(vFov / 2) * camera.aspect);
      const view = k => {
        const L = layers[k], cW = L.g.getWorldPosition(new THREE.Vector3());
        const q = L.g.getWorldQuaternion(new THREE.Quaternion());
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        const shift = narrow ? up.clone().multiplyScalar(-H * 0.18) : right.clone().multiplyScalar(-W * 0.2);
        return { pos: cW.clone().add(n.multiplyScalar(dist)).add(shift), look: cW.clone().add(shift), up };
      };
      const i0 = Math.floor(S.u), i1 = Math.min(names.length - 1, i0 + 1), f = S.u - i0;
      const A = view(i0), B = view(i1), e = f * f * (3 - 2 * f);
      const pos = A.pos.clone().lerp(B.pos, e), look = A.look.clone().lerp(B.look, e), up = A.up.clone().lerp(B.up, e).normalize();
      const k = S.tour * S.tour * (3 - 2 * S.tour);
      const lookNow = new THREE.Vector3(c.x + side, c.y + drop, c.z).lerp(look, k);
      camera.position.lerp(pos, k);
      camera.up.set(0, 1, 0).lerp(up, k).normalize();
      camera.lookAt(lookNow);
      const cd = camera.position.distanceTo(lookNow);
      scene.fog.near = Math.max(scene.fog.near, cd * 0.9); scene.fog.far = Math.max(scene.fog.far, cd * 2.2);
    } else camera.up.set(0, 1, 0);

    dust.material.opacity = (innerWidth < 900 ? 0 : 0.35) * S.dust;
    dust.rotation.y = t * 0.01;
    renderer.render(scene, camera);
  }
  frame();
  ScrollTrigger.refresh();
}
