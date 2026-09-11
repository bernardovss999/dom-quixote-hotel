import * as THREE from './vendor/three.module.min.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hero = document.querySelector('.hero');
const canvas = document.querySelector('#suite-webgl');

// One coordinated reveal language across the page.
const motionTargets = document.querySelectorAll(
  '.split-section, .accommodations, .amenities-section, .booking-section, .location-section, .proof-section, .faq-section, .final-cta'
);
motionTargets.forEach((element) => element.classList.add('motion-section'));

if ('IntersectionObserver' in window && !reduceMotion) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  motionTargets.forEach((element) => observer.observe(element));
} else {
  motionTargets.forEach((element) => element.classList.add('is-visible'));
}

// Pointer depth on room cards; keyboard and touch remain unaffected.
if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
  document.querySelectorAll('.room-card').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--tilt-x', `${(-y * 3.5).toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${(x * 4.5).toFixed(2)}deg`);
      card.style.setProperty('--glow-x', `${((x + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--glow-y', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  });
}

if (!hero || !canvas || reduceMotion || !window.WebGLRenderingContext) {
  hero?.classList.add('three-fallback');
} else {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const uniforms = {
    uTexture: { value: null },
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uScroll: { value: 0 },
    uScale: { value: new THREE.Vector2(1, 1) },
    uOffset: { value: new THREE.Vector2(0, 0) },
    uReveal: { value: 0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: `
      uniform float uTime;
      uniform float uScroll;
      uniform vec2 uMouse;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float edge = sin(uv.y * 3.14159265);
        p.z += sin((uv.x * 4.2) + uTime * 0.42) * 0.018 * edge;
        p.x += uMouse.x * (uv.y - 0.5) * 0.045;
        p.y += uMouse.y * (uv.x - 0.5) * 0.032 + uScroll * 0.018;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uTime;
      uniform float uScroll;
      uniform float uReveal;
      uniform vec2 uMouse;
      uniform vec2 uScale;
      uniform vec2 uOffset;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        float wave = sin(uv.y * 10.0 + uTime * 0.35) * 0.0025;
        uv.x += wave + uMouse.x * 0.008 * (uv.y - 0.5);
        uv.y += uMouse.y * 0.006 * (uv.x - 0.5) + uScroll * 0.004;
        vec2 coverUv = uv * uScale + uOffset;
        vec4 color = texture2D(uTexture, coverUv);
        color.rgb = mix(color.rgb * vec3(0.78, 0.86, 0.84), color.rgb, 0.62);
        float vignette = smoothstep(0.88, 0.22, distance(vUv, vec2(0.5)));
        color.rgb *= mix(0.78, 1.04, vignette);
        color.a *= smoothstep(0.0, 0.16, uReveal);
        gl_FragColor = color;
      }
    `
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 52, 32), material);
  scene.add(mesh);

  const pointerTarget = new THREE.Vector2(0, 0);
  let textureSize = { width: 1, height: 1 };
  let currentScroll = 0;
  let targetScroll = 0;
  let frame = 0;
  const clock = new THREE.Clock();

  function updateCover() {
    const width = hero.clientWidth;
    const height = hero.clientHeight;
    renderer.setSize(width, height, false);
    const canvasAspect = width / height;
    const imageAspect = textureSize.width / textureSize.height;
    if (canvasAspect > imageAspect) {
      const scaleY = imageAspect / canvasAspect;
      uniforms.uScale.value.set(1, scaleY);
      uniforms.uOffset.value.set(0, (1 - scaleY) * 0.5);
    } else {
      const scaleX = canvasAspect / imageAspect;
      uniforms.uScale.value.set(scaleX, 1);
      uniforms.uOffset.value.set((1 - scaleX) * 0.5, 0);
    }
  }

  const loader = new THREE.TextureLoader();
  loader.load(
    '_next/static/media/suite-01.2mt26_4ew4ogs.jpg',
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      uniforms.uTexture.value = texture;
      textureSize = { width: texture.image.width, height: texture.image.height };
      updateCover();
      hero.classList.add('three-ready');
      animate();
    },
    undefined,
    () => hero.classList.add('three-fallback')
  );

  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    pointerTarget.set(
      ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      -((event.clientY - rect.top) / rect.height - 0.5) * 2
    );
  });
  hero.addEventListener('pointerleave', () => pointerTarget.set(0, 0));
  window.addEventListener('scroll', () => {
    const rect = hero.getBoundingClientRect();
    targetScroll = THREE.MathUtils.clamp(-rect.top / Math.max(hero.clientHeight, 1), 0, 1);
  }, { passive: true });
  window.addEventListener('resize', updateCover, { passive: true });

  function animate() {
    frame = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    uniforms.uTime.value = elapsed;
    uniforms.uMouse.value.lerp(pointerTarget, 0.055);
    currentScroll += (targetScroll - currentScroll) * 0.06;
    uniforms.uScroll.value = currentScroll;
    uniforms.uReveal.value = Math.min(1, uniforms.uReveal.value + 0.018);
    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) cancelAnimationFrame(frame);
    else if (!document.hidden && uniforms.uTexture.value) animate();
  });
}
