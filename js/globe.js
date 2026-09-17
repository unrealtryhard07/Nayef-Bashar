/* Interactive dotted globe with live trade routes (canvas, orthographic projection). Drag to rotate. */
(function () {
  'use strict';

  const DEG = Math.PI / 180;
  const DOT_COUNT = 2800;
  const SPIN_DEG_PER_SEC = 5;
  const TILT_DEG = -18;
  const ARC_SEGMENTS = 64;
  const ARC_LIFT = 0.22;
  const DRAG_DEG_PER_PX = 0.35;
  const RESUME_AFTER_MS = 2200;

  const HUBS = {
    kuwait: [29.37, 47.98], dubai: [25.2, 55.27], jeddah: [21.49, 39.19], mumbai: [19.08, 72.88],
    shanghai: [31.23, 121.47], singapore: [1.29, 103.85], sydney: [-33.87, 151.21], rotterdam: [51.92, 4.48],
    hamburg: [53.55, 9.99], newyork: [40.71, -74.0], losangeles: [34.05, -118.24], santos: [-23.96, -46.33], mombasa: [-4.04, 39.67],
  };

  const MODE_COLORS = { sea: '#4ea1ff', air: '#f5c56b', land: '#6fe3c1' };
  // [from, to, mode, seconds per trip, phase offset, show vehicle]
  const ROUTES = [
    ['kuwait', 'shanghai', 'sea', 11, 0.1, true], ['rotterdam', 'kuwait', 'sea', 12, 0.55, false],
    ['dubai', 'newyork', 'air', 7, 0.3, true], ['kuwait', 'dubai', 'land', 5, 0.2, true],
    ['singapore', 'losangeles', 'sea', 14, 0.7, false], ['mumbai', 'hamburg', 'air', 8, 0.05, false],
    ['jeddah', 'mombasa', 'sea', 9, 0.4, false], ['shanghai', 'sydney', 'air', 7.5, 0.8, false],
    ['rotterdam', 'santos', 'sea', 13, 0.15, false], ['kuwait', 'jeddah', 'land', 6, 0.6, false],
    ['losangeles', 'newyork', 'land', 8, 0.35, false], ['hamburg', 'kuwait', 'air', 7, 0.9, false],
  ];

  // Small glyphs drawn in a 20×20 box centred on the vehicle.
  const GLYPHS = {
    sea: 'M-7 2h14l-3 4h-8zM-4 -5h6v6h-6zM3 -1h3v3h-3z',
    air: 'M-8 1l6-2 3-6h2l-1 5 5-1 2-3h1.6l-.8 3.6.8 3.4h-1.6l-2-3-5-1 1 5h-2l-3-6-6-2z',
    land: 'M-8 -4h9v8h-9zM1 -1h4l3 3v2h-7zM-5 5.5a1.5 1.5 0 1 0 .1 0M4 5.5a1.5 1.5 0 1 0 .1 0',
  };

  const toVec = ([lat, lon]) => [Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.cos(lon * DEG)];

  function slerp(a, b, t) {
    const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const omega = Math.acos(dot);
    if (omega < 1e-6) return a;
    const s = Math.sin(omega);
    const wa = Math.sin((1 - t) * omega) / s;
    const wb = Math.sin(t * omega) / s;
    return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb];
  }

  function fibonacciSphere(n) {
    const points = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i += 1) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      points.push([Math.cos(golden * i) * r, y, Math.sin(golden * i) * r]);
    }
    return points;
  }

  function mount(canvas, { reducedMotion = false } = {}) {
    const ctx = canvas.getContext('2d');
    const dots = fibonacciSphere(DOT_COUNT);
    const hubVecs = Object.fromEntries(Object.entries(HUBS).map(([k, v]) => [k, toVec(v)]));
    const arcs = ROUTES.map(([from, to, mode, dur, phase, vehicle]) => {
      const a = hubVecs[from];
      const b = hubVecs[to];
      const span = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      const points = Array.from({ length: ARC_SEGMENTS + 1 }, (_, i) => {
        const t = i / ARC_SEGMENTS;
        const p = slerp(a, b, t);
        const lift = 1 + ARC_LIFT * (span / Math.PI) * Math.sin(Math.PI * t);
        return [p[0] * lift, p[1] * lift, p[2] * lift];
      });
      return { mode, dur, phase, vehicle, points, glyph: new Path2D(GLYPHS[mode]) };
    });

    let size = 0;
    let dpr = 1;
    let yaw = -35 * DEG;
    let pitch = TILT_DEG * DEG;
    let last = performance.now();
    let clock = 0;
    let raf = 0;
    let visible = true;
    let dragging = null;
    let resumeAt = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = Math.max(1, Math.round(rect.width));
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }

    // Rotate a unit-sphere vector by yaw (around Y) then pitch (around X). Returns camera-space [x, y, z].
    function rotate([x, y, z]) {
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
    }

    function draw() {
      const R = size * 0.42;
      const cx = size / 2;
      const cy = size / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25);
      halo.addColorStop(0, 'rgba(40, 90, 200, 0.18)');
      halo.addColorStop(1, 'rgba(40, 90, 200, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      body.addColorStop(0, '#16264d');
      body.addColorStop(1, '#050a18');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      const dotR = Math.max(1, size / 480);
      for (const d of dots) {
        const [x, y, z] = rotate(d);
        if (z <= 0) continue;
        ctx.globalAlpha = 0.18 + z * 0.7;
        ctx.fillStyle = '#b9ccf5';
        ctx.fillRect(cx + x * R - dotR / 2, cy - y * R - dotR / 2, dotR, dotR);
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = 'rgba(160, 190, 255, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      const isShown = ([x, y, z]) => z > 0 || x * x + y * y > 1;
      const toScreen = ([x, y]) => [cx + x * R, cy - y * R];

      for (const arc of arcs) {
        const color = MODE_COLORS[arc.mode];
        const cam = arc.points.map(rotate);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, size / 520);
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        let penDown = false;
        cam.forEach((p) => {
          if (!isShown(p)) {
            penDown = false;
            return;
          }
          const [sx, sy] = toScreen(p);
          if (penDown) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
          penDown = true;
        });
        ctx.stroke();
        ctx.globalAlpha = 1;

        const t = ((clock / arc.dur) + arc.phase) % 1;
        const idx = Math.min(ARC_SEGMENTS, Math.floor(t * ARC_SEGMENTS));
        const p = cam[idx];
        if (!isShown(p)) continue;
        const [sx, sy] = toScreen(p);
        if (arc.vehicle) {
          const scale = size / 560;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(scale, scale);
          ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#0b1a3d';
          ctx.fill(arc.glyph);
          ctx.restore();
        } else {
          const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9);
          glow.addColorStop(0, color);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(sx, sy, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      Object.values(hubVecs).forEach((v) => {
        const p = rotate(v);
        if (p[2] <= 0) return;
        const [sx, sy] = toScreen(p);
        const pulse = (clock * 0.6) % 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - pulse) * p[2]})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, 3 + pulse * 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.45 + p[2] * 0.55})`;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, size / 280), 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      if (!dragging && now > resumeAt) yaw += SPIN_DEG_PER_SEC * DEG * dt;
      draw();
      raf = visible ? requestAnimationFrame(frame) : 0;
    }

    function start() {
      if (reducedMotion || raf || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    canvas.addEventListener('pointerdown', (e) => {
      dragging = { x: e.clientX, y: e.clientY, yaw, pitch };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      yaw = dragging.yaw + (e.clientX - dragging.x) * DRAG_DEG_PER_PX * DEG;
      pitch = Math.max(-60 * DEG, Math.min(60 * DEG, dragging.pitch + (e.clientY - dragging.y) * DRAG_DEG_PER_PX * DEG));
      if (reducedMotion) draw();
    });
    const release = () => {
      dragging = null;
      resumeAt = performance.now() + RESUME_AFTER_MS;
      canvas.classList.remove('is-dragging');
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    new ResizeObserver(() => { resize(); draw(); }).observe(canvas);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible) start();
      else stop();
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => {
      visible = !document.hidden;
      if (visible) start();
      else stop();
    });

    resize();
    draw();
    start();
  }

  window.NB_GLOBE = { mount };
})();
