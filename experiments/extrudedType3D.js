export function createExtrudedType3DExperiment() {
  const params = {
    baseTextSizeRatio: 0.28,
    lineHeight: 1.1,

    depthLayers: 48,
    layerSpacingPx: 3,
    fade: 0.6, // 0..1 how much farther layers fade (from center)
    wobble: 0.0, // 0..1 offsets layers with subtle noise

    tiltXDeg: 18,
    tiltYDeg: -14,
    spinEnabled: true,
    spinDegPerSec: 12,
    fovDeg: 60,
  };

  let pgText = null;     // 2D text texture (with alpha)
  let g3d = null;        // offscreen WEBGL scene
  let lastW = 0, lastH = 0;
  let cachedKey = '';

  function ensureBuffers(p) {
    if (p.width !== lastW || p.height !== lastH || !pgText || !g3d) {
      lastW = p.width; lastH = p.height;
      pgText = p.createGraphics(p.width, p.height); pgText.pixelDensity(1);
      g3d = p.createGraphics(p.width, p.height, p.WEBGL); g3d.pixelDensity(1);
      cachedKey = '';
    }
  }

  function drawTextMask(p, ctx, sizeRatio, lineHeight) {
    pgText.clear();
    // Use global text positioning if provided, otherwise default to center-center
    const position = ctx.textPosition || 'center-center';
    
    // Set text alignment based on position
    if (position.includes('left')) {
      pgText.textAlign(pgText.LEFT, pgText.CENTER);
    } else if (position.includes('right')) {
      pgText.textAlign(pgText.RIGHT, pgText.CENTER);
    } else {
      pgText.textAlign(pgText.CENTER, pgText.CENTER);
    }
    if (ctx.font) pgText.textFont(ctx.font);
    const baseTextSize = ctx.fontSize || Math.max(12, Math.min(pgText.width, pgText.height) * sizeRatio);
    pgText.textSize(baseTextSize);
    
    // Apply font weight if provided
    if (ctx.fontWeight) {
      pgText.textStyle(pgText.NORMAL);
      if (ctx.fontWeight >= 600) {
        pgText.textStyle(pgText.BOLD);
      }
    }
    pgText.noStroke(); pgText.fill(255);
    const textRaw = ctx.text && ctx.text.length > 0 ? ctx.text : 'TYPE';
    const lines = textRaw.split(/\r?\n/);
    const lineAdvance = baseTextSize * lineHeight;
    const totalHeight = lineAdvance * lines.length;
    const startY = (pgText.height - totalHeight) / 2 + lineAdvance / 2;
    const usableW = pgText.width; const centerX = usableW / 2;
    for (let li = 0; li < lines.length; li++) {
      const txt = lines[li]; const y = startY + li * lineAdvance;
      const tw = Math.max(1, pgText.textWidth(txt));
      const scaleX = Math.min(1, usableW / tw);
      pgText.push(); pgText.translate(centerX, y); if (scaleX !== 1) pgText.scale(sx = scaleX, sy = 1); pgText.text(txt, 0, 0); pgText.pop();
    }
  }

  return {
    name: '3D Extruded Type',

    getControlDefinitions() {
      return [
        { id: 'textHeading', type: 'heading', label: 'Text' },
        { id: 'baseTextSizeRatio', type: 'range', label: 'Text size', min: 0.12, max: 0.6, step: 0.01, default: 0.28 },
        { id: 'lineHeight', type: 'range', label: 'Line height', min: 0.8, max: 2.0, step: 0.05, default: 1.1 },

        { id: 'threeDHeading', type: 'heading', label: '3D' },
        { id: 'depthLayers', type: 'range', label: 'Depth layers', min: 8, max: 160, step: 1, default: 48 },
        { id: 'layerSpacingPx', type: 'range', label: 'Layer spacing', min: 1, max: 12, step: 1, default: 3 },
        { id: 'fade', type: 'range', label: 'Fade', min: 0.0, max: 1.0, step: 0.02, default: 0.6 },
        { id: 'wobble', type: 'range', label: 'Wobble', min: 0.0, max: 1.0, step: 0.02, default: 0.0 },
        { id: 'tiltXDeg', type: 'range', label: 'Tilt X', min: -80, max: 80, step: 1, default: 18 },
        { id: 'tiltYDeg', type: 'range', label: 'Tilt Y', min: -80, max: 80, step: 1, default: -14 },
        { id: 'spinEnabled', type: 'checkbox', label: 'Spin', default: true },
        { id: 'spinDegPerSec', type: 'range', label: 'Spin speed', min: -180, max: 180, step: 1, default: 12 },
        { id: 'fovDeg', type: 'range', label: 'FOV', min: 30, max: 100, step: 1, default: 60 },
      ];
    },

    getParams() { return { ...params }; },

    setParams(next) { Object.assign(params, next); },

    init(p, ctx) { ensureBuffers(p); },

    draw(p, ctx) {
      ensureBuffers(p);

      // Bind helpers
      const isBound = (id) => Array.isArray(ctx.boundIds) && ctx.boundIds.includes(id);
      const normFromAxis = (id, fallbackAxis) => {
        const mx = p.constrain(p.mouseX / p.width, 0, 1);
        const my = p.constrain(p.mouseY / p.height, 0, 1);
        const axis = ctx.getAxis ? ctx.getAxis(id) : (fallbackAxis || 'x');
        const inv = ctx.getInvert ? ctx.getInvert(id) : false;
        let t = axis === 'y' ? (1 - my) : mx; if (inv) t = 1 - t; return Math.max(0, Math.min(1, t));
      };

      const effSizeRatio = isBound('baseTextSizeRatio') ? p.lerp(0.12, 0.6, normFromAxis('baseTextSizeRatio', 'y')) : params.baseTextSizeRatio;
      const effLineHeight = isBound('lineHeight') ? p.lerp(0.8, 2.0, normFromAxis('lineHeight', 'y')) : (ctx.lineHeight || params.lineHeight);
      const effLayers = Math.round(isBound('depthLayers') ? p.lerp(8, 160, normFromAxis('depthLayers', 'x')) : params.depthLayers);
      const effSpacing = Math.round(isBound('layerSpacingPx') ? p.lerp(1, 12, normFromAxis('layerSpacingPx', 'y')) : params.layerSpacingPx);
      const effFade = isBound('fade') ? p.lerp(0, 1, normFromAxis('fade', 'x')) : params.fade;
      const effWobble = isBound('wobble') ? p.lerp(0, 1, normFromAxis('wobble', 'x')) : params.wobble;
      const effTiltX = (isBound('tiltXDeg') ? p.lerp(-80, 80, normFromAxis('tiltXDeg', 'y')) : params.tiltXDeg) * (p.PI / 180);
      const effTiltY = (isBound('tiltYDeg') ? p.lerp(-80, 80, normFromAxis('tiltYDeg', 'x')) : params.tiltYDeg) * (p.PI / 180);
      const effSpinEnabled = !!params.spinEnabled;
      const effSpin = (isBound('spinDegPerSec') ? p.lerp(-180, 180, normFromAxis('spinDegPerSec', 'x')) : params.spinDegPerSec) * (p.PI / 180);
      const effFov = ((isBound('fovDeg') ? p.lerp(30, 100, normFromAxis('fovDeg', 'y')) : params.fovDeg) * p.PI) / 180;

      // Rebuild texture only if needed
      const key = `${lastW}x${lastH}|${effSizeRatio.toFixed(4)}|${effLineHeight.toFixed(4)}|${ctx.text}|${ctx.font ? 'f' : 'n'}|${ctx.fontSize || 'default'}|${ctx.fontWeight || 'default'}|${ctx.textPosition || 'center-center'}|${ctx.paddingTop || 20}|${ctx.paddingBottom || 20}|${ctx.paddingLeft || 20}|${ctx.paddingRight || 20}`;
      if (cachedKey !== key) {
        drawTextMask(p, ctx, effSizeRatio, effLineHeight);
        cachedKey = key;
      }

      // Setup 3D scene
      g3d.clear(); // keep transparent
      const w = g3d.width, h = g3d.height; const aspect = w / h;
      g3d.perspective(effFov, aspect, 1, 10000);

      // Center group
      g3d.push();
      const time = p.millis() * 0.001;
      g3d.rotateX(effTiltX);
      const spinAngle = effSpinEnabled ? effSpin * time : 0;
      g3d.rotateY(effTiltY + spinAngle);

      // Scale plane to texture size in world units
      const planeW = w; const planeH = h;
      const totalDepth = (effLayers - 1) * effSpacing;
      const startZ = -totalDepth / 2;

      g3d.noStroke();
      g3d.texture(pgText);
      g3d.textureMode(g3d.NORMAL);
      
      // Disable depth testing to ensure all layers are visible from all angles
      g3d.drawingContext.disable(g3d.drawingContext.DEPTH_TEST);

      // Convert typeColor to tint
      const tc = p.color(ctx.typeColor);
      const r = p.red(tc), g = p.green(tc), b = p.blue(tc);

      const mid = (effLayers - 1) / 2;
      
      // Always draw from back to front for proper alpha blending
      // Determine drawing order based on current rotation
      const effectiveRotY = (effTiltY + spinAngle) % (2 * p.PI);
      const normalizedRot = ((effectiveRotY % (2 * p.PI)) + (2 * p.PI)) % (2 * p.PI);
      const isFlipped = normalizedRot > p.PI/2 && normalizedRot < 3*p.PI/2;
      
      for (let idx = 0; idx < effLayers; idx++) {
        // Choose layer index based on viewing angle
        const i = isFlipped ? (effLayers - 1 - idx) : idx;
        
        const d = mid > 0 ? Math.abs(i - mid) / mid : 0; // 0 at center, 1 at ends
        const alpha = Math.max(0, Math.min(255, 255 * (1 - d * effFade)));
        // small wobble offsets
        const wob = effWobble > 0 ? (p.noise(0.2 * i, time * 0.5) - 0.5) * 2 * effWobble * 20 : 0;
        g3d.push();
        g3d.translate(wob, wob, startZ + i * effSpacing);
        g3d.tint(r, g, b, alpha);
        g3d.plane(planeW, planeH);
        g3d.pop();
      }

      g3d.pop();

      // Draw to screen (2D)
      p.image(g3d, 0, 0);
    },

    onResize(p) { ensureBuffers(p); },
  };
} 