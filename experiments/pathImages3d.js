export function createPathImages3DExperiment() {
  let params = {
    shape: 'helix',           // 'helix' | 'circle' | 'knot'
    count: 60,                // number of instances
    speed: 0.15,              // animation speed
    radiusA: 220,             // primary radius (px)
    radiusB: 120,             // secondary radius / thickness (px)
    height: 280,              // helix height (px)
    turns: 2.0,               // helix turns
    knotP: 2,                 // knot parameter P (for 'knot')
    knotQ: 3,                 // knot parameter Q (for 'knot')
    tiltXDeg: 10,             // camera tilt X
    tiltYDeg: -10,            // camera tilt Y
    fovDeg: 60,               // field of view
    spinDegPerSec: 20,        // spin around Y per second
    billboard: true,          // always face camera
    reverseZOrder: false,     // draw order reversal
    scaleMin: 0.2,            // scale at farthest depth
    scaleMax: 1.0             // scale at closest depth
  };

  function getParams() {
    return params;
  }

  function setParams(newParams) {
    params = { ...params, ...newParams };
    if (window.CanvasManager && window.CanvasManager.getActiveCanvas()) {
      window.CanvasManager.getActiveCanvas().needsRedraw = true;
    }
  }

  function radians(deg) {
    return (deg * Math.PI) / 180;
  }

  function rotateX(point, angle) {
    const s = Math.sin(angle), c = Math.cos(angle);
    const y = point.y * c - point.z * s;
    const z = point.y * s + point.z * c;
    return { x: point.x, y, z };
  }

  function rotateY(point, angle) {
    const s = Math.sin(angle), c = Math.cos(angle);
    const x = point.x * c + point.z * s;
    const z = -point.x * s + point.z * c;
    return { x, y: point.y, z };
  }

  function project(p, point, f) {
    const z = point.z;
    const scale = f / (f + z);
    return { sx: point.x * scale, sy: point.y * scale, scale };
  }

  function shapePoint(t) {
    // t in [0,1]
    const twoPi = Math.PI * 2;
    if (params.shape === 'circle') {
      const a = t * twoPi;
      return { x: params.radiusA * Math.cos(a), y: 0, z: params.radiusA * Math.sin(a) };
    }
    if (params.shape === 'knot') {
      // Simple torus knot parametric form
      const a = t * twoPi;
      const pK = params.knotP;
      const qK = params.knotQ;
      const r = params.radiusA + params.radiusB * Math.cos(qK * a);
      const x = r * Math.cos(pK * a);
      const y = params.radiusB * Math.sin(qK * a);
      const z = r * Math.sin(pK * a);
      return { x, y, z };
    }
    // default: helix
    const a = t * twoPi * params.turns;
    return {
      x: params.radiusA * Math.cos(a),
      y: -params.height / 2 + params.height * t,
      z: params.radiusA * Math.sin(a)
    };
  }

  function draw(p, ctx) {
    const images = ctx.images || [];
    if (!images.length) {
      p.push();
      p.fill(0);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(16);
      p.text('Upload images to see Path Images 3D', p.width / 2, p.height / 2);
      p.pop();
      return;
    }

    const centerX = p.width / 2;
    const centerY = p.height / 2;
    const time = ctx.timeSeconds * params.speed;
    const spinY = radians(params.spinDegPerSec) * time;
    const tiltX = radians(params.tiltXDeg);
    const tiltY = radians(params.tiltYDeg);
    const f = (p.height / 2) / Math.tan(radians(params.fovDeg) / 2);

    // Build instances with depth for sorting
    const instances = [];
    for (let i = 0; i < params.count; i++) {
      const t = i / Math.max(1, params.count - 1);
      let pos = shapePoint(t);

      // Spin around Y
      pos = rotateY(pos, spinY);
      // Apply camera tilt
      pos = rotateX(pos, tiltX);
      pos = rotateY(pos, tiltY);

      const proj = project(p, pos, f);
      instances.push({
        t,
        x: centerX + proj.sx,
        y: centerY + proj.sy,
        z: pos.z,
        depthScale: proj.scale
      });
    }

    // Sort by z (back to front)
    instances.sort((a, b) => (params.reverseZOrder ? a.z - b.z : b.z - a.z));

    const imgCount = images.length;
    for (let k = 0; k < instances.length; k++) {
      const inst = instances[k];
      const imageData = images[k % imgCount];
      const img = imageData.p5Image || null;
      if (!img) continue;

      // Scale image by perspective and depth mapping
      const depthNorm = Math.max(0, Math.min(1, (inst.depthScale))); // 0..1
      const scaleLerp = params.scaleMin + (params.scaleMax - params.scaleMin) * depthNorm;
      const w = img.width * scaleLerp;
      const h = img.height * scaleLerp;

      p.push();
      p.imageMode(p.CENTER);
      // Billboard is implicit as we draw without rotating the image in 3D
      p.image(img, inst.x, inst.y, w, h);
      p.pop();
    }
  }

  return {
    id: 'pathImages3d',
    name: 'Path Images 3D',
    draw,
    getParams,
    setParams
  };
}


