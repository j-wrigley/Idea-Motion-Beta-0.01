export function createSpaceGalleryImagesExperiment() {
  let params = {
    shape: 'sphere',        // 'sphere' | 'cube'
    radius: 300,            // gallery radius in px
    imageScale: 0.4,        // per-image scale multiplier
    instances: 36,          // number of placements (will wrap images)
    yawDeg: 0,              // camera yaw
    pitchDeg: 0,            // camera pitch
    spinDegPerSec: 0,       // auto-spin around Y
    cameraDist: 700,        // camera distance for projection
    depthFade: 0.0          // 0..1 amount of alpha fade with depth
  };

  // Drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startYaw = 0;
  let startPitch = 0;

  // Cached positions
  let cachedKey = '';
  let cachedPositions = [];

  function getParams() { return params; }
  function setParams(next) {
    params = { ...params, ...next };
    cachedKey = ''; // force rebuild
  }

  function radians(deg) { return (deg * Math.PI) / 180; }

  function rotateX(pt, a) {
    const s = Math.sin(a), c = Math.cos(a);
    const y = pt.y * c - pt.z * s;
    const z = pt.y * s + pt.z * c;
    return { x: pt.x, y, z };
  }
  function rotateY(pt, a) {
    const s = Math.sin(a), c = Math.cos(a);
    const x = pt.x * c + pt.z * s;
    const z = -pt.x * s + pt.z * c;
    return { x, y: pt.y, z };
  }
  function project(p, pt, f) {
    const scale = f / (f + pt.z);
    return { sx: pt.x * scale, sy: pt.y * scale, scale };
  }

  function buildPositions(num, shape, radius) {
    const pts = [];
    if (shape === 'sphere') {
      // Fibonacci sphere distribution
      const phi = (1 + Math.sqrt(5)) / 2;
      for (let i = 0; i < num; i++) {
        const t = (i + 0.5) / num;
        const y = 1 - 2 * t;
        const r = Math.sqrt(1 - y * y);
        const theta = 2 * Math.PI * i / phi;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        pts.push({ x: x * radius, y: y * radius, z: z * radius });
      }
    } else {
      // Cube distribution: grid over faces
      const faces = 6;
      const perFace = Math.max(1, Math.floor(num / faces));
      const grid = Math.max(1, Math.floor(Math.sqrt(perFace)));
      const step = (radius * 2) / (grid - 1 || 1);
      const offs = -radius;
      const add = (x, y, z) => pts.push({ x, y, z });
      for (let f = 0; f < faces; f++) {
        for (let gy = 0; gy < grid; gy++) {
          for (let gx = 0; gx < grid; gx++) {
            const a = offs + gx * step;
            const b = offs + gy * step;
            if (f === 0) add(-radius, a, b);      // -X face
            else if (f === 1) add(radius, a, b);  // +X
            else if (f === 2) add(a, -radius, b); // -Y
            else if (f === 3) add(a, radius, b);  // +Y
            else if (f === 4) add(a, b, -radius); // -Z
            else add(a, b, radius);               // +Z
            if (pts.length >= num) break;
          }
          if (pts.length >= num) break;
        }
        if (pts.length >= num) break;
      }
    }
    return pts;
  }

  function ensurePositions(images) {
    const key = `${params.shape}|${params.radius}|${params.instances}|${images?.length || 0}`;
    if (key !== cachedKey) {
      cachedPositions = buildPositions(Math.max(1, params.instances), params.shape, Math.max(10, params.radius));
      cachedKey = key;
    }
  }

  function draw(p, ctx) {
    const images = ctx.images || [];
    if (!images.length) {
      p.push(); p.fill(0); p.textAlign(p.CENTER, p.CENTER); p.textSize(16);
      p.text('Upload images to view Space Gallery', p.width / 2, p.height / 2);
      p.pop();
      return;
    }

    ensurePositions(images);

    const centerX = p.width / 2;
    const centerY = p.height / 2;
    const yaw = radians(params.yawDeg + (params.spinDegPerSec * (ctx.timeSeconds || 0)));
    const pitch = radians(params.pitchDeg);
    const f = Math.max(100, params.cameraDist);

    const imgCount = images.length;
    // Draw back to front
    const transformed = cachedPositions.map((pt, i) => {
      let q = rotateY(pt, yaw);
      q = rotateX(q, pitch);
      return { i, q };
    }).sort((a, b) => a.q.z - b.q.z);

    for (const item of transformed) {
      const q = item.q;
      const imageData = images[item.i % imgCount];
      const img = imageData?.p5Image;
      if (!img) continue;
      const pr = project(p, q, f);
      const sc = Math.max(0.05, params.imageScale * pr.scale);
      const w = img.width * sc;
      const h = img.height * sc;
      // Depth fade based on z mapped to [0,1]
      let alpha = 255;
      if (params.depthFade > 0) {
        const r = Math.max(1, params.radius);
        // Map z from [-r, r] to [0,1]
        const zn = Math.max(0, Math.min(1, (q.z + r) / (2 * r)));
        const fade = 1 - params.depthFade * zn;
        alpha = Math.max(0, Math.min(255, Math.round(255 * fade)));
      }
      p.push();
      p.imageMode(p.CENTER);
      if (p.tint) p.tint(255, alpha);
      p.image(img, centerX + pr.sx, centerY + pr.sy, w, h);
      if (p.noTint) p.noTint();
      p.pop();
    }
  }

  function mousePressed(p) {
    isDragging = true;
    dragStartX = p.mouseX; dragStartY = p.mouseY;
    startYaw = params.yawDeg; startPitch = params.pitchDeg;
  }
  function mouseDragged(p) {
    if (!isDragging) return;
    const dx = p.mouseX - dragStartX;
    const dy = p.mouseY - dragStartY;
    const sens = 0.2; // deg per px
    params.yawDeg = startYaw + dx * sens;
    params.pitchDeg = Math.max(-80, Math.min(80, startPitch - dy * sens));
    if (window.CanvasManager && window.CanvasManager.getActiveCanvas()) {
      window.CanvasManager.getActiveCanvas().needsRedraw = true;
    }
  }
  function mouseReleased() { isDragging = false; }

  return {
    id: 'spaceGalleryImages',
    name: 'Space Gallery Images',
    draw,
    getParams,
    setParams,
    mousePressed,
    mouseDragged,
    mouseReleased
  };
}


