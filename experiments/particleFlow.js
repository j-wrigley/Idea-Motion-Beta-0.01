// Global variable to persist overlay timer across reinitializations
let globalShowPaddingOverlayUntilMs = 0;

export function createParticleFlowExperiment() {
  const params = {
    baseTextSizeRatio: 0.24,
    lineHeight: 1.15,
    particleCount: 1200,
    particleSize: 2.0,
    flowScale: 0.008,
    flowStrength: 1.4,
    speed: 2.0,
    attraction: 0.35,
    textAttraction: 0.0,
    shape: 'circle', // 'circle' | 'square'
    flowMode: 'noise', // 'noise' | 'tangent' | 'outline'
    spawnInsideText: true,
    confineToText: true,
    edgeThreshold: 0.15,
    collideWithText: false,
  };

  let pg = null; // offscreen text mask
  let particles = [];
  let allocated = 0;
  let insideCache = null; // array of {x,y} inside glyphs
  let clearNextFrame = false;

  function ensureBuffer(p) {
    if (!pg || pg.width !== p.width || pg.height !== p.height) {
      pg = p.createGraphics(p.width, p.height);
      pg.pixelDensity(1);
      // Clear existing; we'll seed after mask is drawn
      allocated = 0;
      particles = [];
      insideCache = null;
    }
  }

  function drawTextMask(p, ctx, effBaseTextSizeRatio, effLineHeight) {
    pg.clear();
    pg.background(0);
    pg.fill(255);
    pg.noStroke();
    // Use global text positioning if provided, otherwise default to center-center
    const position = ctx.textPosition || 'center-center';
    
    // Set text alignment based on position
    if (position.includes('left')) {
      pg.textAlign(pg.LEFT, pg.BASELINE);
    } else if (position.includes('right')) {
      pg.textAlign(pg.RIGHT, pg.BASELINE);
    } else {
      pg.textAlign(pg.CENTER, pg.BASELINE);
    }
    if (ctx.font) pg.textFont(ctx.font);

    const baseTextSize = ctx.fontSize || Math.max(16, Math.min(pg.width, pg.height) * effBaseTextSizeRatio);
    pg.textSize(baseTextSize);
    
    // Apply font weight if provided
    if (ctx.fontWeight) {
      pg.textStyle(pg.NORMAL);
      if (ctx.fontWeight >= 600) {
        pg.textStyle(pg.BOLD);
      }
    }

    const textRaw = ctx.text && ctx.text.length > 0 ? ctx.text : 'TYPE';
    const lines = textRaw.split(/\r?\n/);

    // Layout with comprehensive padding
    const paddingTop = ctx.paddingTop !== undefined ? ctx.paddingTop : 20;
    const paddingBottom = ctx.paddingBottom !== undefined ? ctx.paddingBottom : 20;
    const paddingLeft = ctx.paddingLeft !== undefined ? ctx.paddingLeft : 20;
    const paddingRight = ctx.paddingRight !== undefined ? ctx.paddingRight : 20;
    
    const usableW = Math.max(0, pg.width - paddingLeft - paddingRight);
    const usableH = Math.max(0, pg.height - paddingTop - paddingBottom);
    const lineAdvance = baseTextSize * effLineHeight;
    const totalHeight = lineAdvance * lines.length;
    
    // Calculate positioning based on text position
    let startY, centerX;
    
    // Calculate Y position based on vertical alignment
    if (position.includes('top')) {
      startY = paddingTop + lineAdvance;
    } else if (position.includes('bottom')) {
      startY = pg.height - paddingBottom - (totalHeight - lineAdvance);
    } else {
      startY = (pg.height - totalHeight) / 2 + lineAdvance;
    }
    
    // Calculate X position based on horizontal alignment
    if (position.includes('left')) {
      centerX = paddingLeft; // Left edge with padding
    } else if (position.includes('right')) {
      centerX = pg.width - paddingRight; // Right edge with padding
    } else {
      centerX = pg.width / 2; // Center
    }

    for (let li = 0; li < lines.length; li++) {
      const txt = lines[li];
      const y = startY + li * lineAdvance;
      const tw = Math.max(1, pg.textWidth(txt));
      const scaleX = Math.min(1, usableW / tw);
      pg.push();
      pg.translate(centerX, y);
      if (scaleX !== 1) pg.scale(scaleX, 1);
      pg.text(txt, 0, 0);
      pg.pop();
    }

    pg.loadPixels();

    // Rebuild inside cache at a coarse grid for efficient sampling
    insideCache = [];
    const step = Math.max(2, Math.floor(Math.min(pg.width, pg.height) / 180)); // adaptive step
    for (let y = 0; y < pg.height; y += step) {
      for (let x = 0; x < pg.width; x += step) {
        const b = sampleBrightness(x, y);
        if (b >= params.edgeThreshold) insideCache.push({ x, y });
      }
    }
  }

  function sampleBrightness(x, y) {
    const xi = x | 0; const yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= pg.width || yi >= pg.height) return 0;
    const idx = 4 * (yi * pg.width + xi);
    return pg.pixels[idx] / 255; // red channel
  }

  function sampleGradient(x, y) {
    const s1 = sampleBrightness(x + 1, y);
    const s2 = sampleBrightness(x - 1, y);
    const s3 = sampleBrightness(x, y + 1);
    const s4 = sampleBrightness(x, y - 1);
    return { gx: (s1 - s2) * 0.5, gy: (s3 - s4) * 0.5 };
  }

  function ensureParticles(p, target) {
    if (allocated >= target) return;
    const pickInside = () => {
      // Prefer cache
      if (params.spawnInsideText && insideCache && insideCache.length > 0) {
        const pt = insideCache[(Math.random() * insideCache.length) | 0];
        // jitter within grid cell
        return { x: Math.min(p.width - 1, Math.max(0, pt.x + (Math.random() - 0.5) * 2)), y: Math.min(p.height - 1, Math.max(0, pt.y + (Math.random() - 0.5) * 2)) };
      }
      // Fallback brute force search
      let tries = 0;
      while (tries < 800) {
        const x = p.random(p.width);
        const y = p.random(p.height);
        if (!params.spawnInsideText || sampleBrightness(x, y) >= params.edgeThreshold) return { x, y };
        tries++;
      }
      // As last resort, center
      return { x: p.width / 2, y: p.height / 2 };
    };
    while (allocated < target) {
      const pos = pickInside();
      particles.push({ x: pos.x, y: pos.y, vx: 0, vy: 0 });
      allocated++;
    }
  }

  function parseHexColor(hex) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '#000000');
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }

  return {
    name: 'Particle Flow',

    getControlDefinitions() {
      return [
        { id: 'clearTrails', type: 'button', label: 'Clear trails', onClick: ({ p }) => {
          clearNextFrame = true;
        } },
        // Flow settings
        { id: 'flowMode', type: 'select', label: 'Flow mode', options: [
          { label: 'Noise', value: 'noise' },
          { label: 'Outline', value: 'outline' },
          { label: 'Tangent', value: 'tangent' },
        ], default: 'noise' },
        { id: 'spawnInsideText', type: 'checkbox', label: 'Spawn inside text', default: true },
        { id: 'confineToText', type: 'checkbox', label: 'Confine to text', default: true },
        { id: 'collideWithText', type: 'checkbox', label: 'Collide with text', default: false },
        { id: 'edgeThreshold', type: 'range', label: 'Edge threshold', min: 0.05, max: 0.5, step: 0.01, default: 0.15 },

        { id: 'baseTextSizeRatio', type: 'range', label: 'Text size', min: 0.12, max: 0.5, step: 0.01, default: 0.24 },
        { id: 'lineHeight', type: 'range', label: 'Line height', min: 0.8, max: 2.0, step: 0.05, default: 1.15 },

        { id: 'particleCount', type: 'range', label: 'Particles', min: 200, max: 4000, step: 50, default: 1200 },
        { id: 'particleSize', type: 'range', label: 'Dot size', min: 0.5, max: 5.0, step: 0.1, default: 2.0 },
        { id: 'flowScale', type: 'range', label: 'Flow scale', min: 0.002, max: 0.02, step: 0.0005, default: 0.008 },
        { id: 'flowStrength', type: 'range', label: 'Flow strength', min: 0.0, max: 4.0, step: 0.05, default: 1.4 },
        { id: 'speed', type: 'range', label: 'Speed', min: 0.2, max: 6.0, step: 0.1, default: 2.0 },
        { id: 'attraction', type: 'range', label: 'Attraction', min: 0.0, max: 1.0, step: 0.02, default: 0.35 },
        { id: 'textAttraction', type: 'range', label: 'Text attraction', min: 0.0, max: 2.0, step: 0.05, default: 0.0 },
        { id: 'shape', type: 'select', label: 'Shape', options: [ { label: 'Circle', value: 'circle' }, { label: 'Square', value: 'square' } ], default: 'circle' },
      ];
    },

    getParams() { return { ...params }; },

    setParams(next) {
      const prevCount = params.particleCount;
      const prevSpawn = params.spawnInsideText;
      const prevEdge = params.edgeThreshold;
      Object.assign(params, next);
      if (params.particleCount !== prevCount) {
        if (pg) ensureParticles({ width: pg.width, height: pg.height, random: Math.random }, params.particleCount);
      }
      if (params.spawnInsideText !== prevSpawn) {
        if (pg) { allocated = 0; particles = []; }
      }
      if (params.edgeThreshold !== prevEdge) {
        // Rebuild cache/seed on next draw
        if (pg) { insideCache = null; allocated = 0; particles = []; }
      }
    },

    showPaddingOverlay() {
      // Show overlay for ~600ms when global side padding changes
      console.log('Particle Flow: Setting padding overlay timer');
      globalShowPaddingOverlayUntilMs = performance.now() + 600;
    },

    init(p, ctx) {
      ensureBuffer(p);
      // Seed will happen after first mask render in draw()
    },

    draw(p, ctx) {
      ensureBuffer(p);

      // Effective values from cursor bindings (no mutation)
      const isBound = (id) => Array.isArray(ctx.boundIds) && ctx.boundIds.includes(id);
      const normFromAxis = (id, fallbackAxis) => {
        const mx = p.constrain(p.mouseX / p.width, 0, 1);
        const my = p.constrain(p.mouseY / p.height, 0, 1);
        const axis = ctx.getAxis ? ctx.getAxis(id) : (fallbackAxis || 'x');
        const inv = ctx.getInvert ? ctx.getInvert(id) : false;
        let t = axis === 'y' ? (1 - my) : mx;
        if (inv) t = 1 - t;
        return Math.max(0, Math.min(1, t));
      };

      const effBaseTextSizeRatio = isBound('baseTextSizeRatio') ? p.lerp(0.12, 0.5, normFromAxis('baseTextSizeRatio', 'y')) : params.baseTextSizeRatio;
      const effLineHeight = isBound('lineHeight') ? p.lerp(0.8, 2.0, normFromAxis('lineHeight', 'y')) : (ctx.lineHeight || params.lineHeight);
      const effFlowScale = isBound('flowScale') ? p.lerp(0.002, 0.02, normFromAxis('flowScale', 'x')) : params.flowScale;
      const effFlowStrength = isBound('flowStrength') ? p.lerp(0.0, 4.0, normFromAxis('flowStrength', 'x')) : params.flowStrength;
      const effSpeed = isBound('speed') ? p.lerp(0.2, 6.0, normFromAxis('speed', 'x')) : params.speed;
      const effAttraction = isBound('attraction') ? p.lerp(0.0, 1.0, normFromAxis('attraction', 'y')) : params.attraction;
      const effTextAttraction = isBound('textAttraction') ? p.lerp(0.0, 2.0, normFromAxis('textAttraction', 'y')) : params.textAttraction;
      
      // Debug parameter values
      if (Math.random() < 0.01) { // Log occasionally to avoid spam
        console.log(`Particle Flow params: attraction=${effAttraction}, textAttraction=${effTextAttraction}`);
      }
      const effParticleSize = isBound('particleSize') ? p.lerp(0.5, 5.0, normFromAxis('particleSize', 'y')) : params.particleSize;

      const allowObstacle = (!params.confineToText && params.collideWithText);

      drawTextMask(p, ctx, effBaseTextSizeRatio, effLineHeight);
      // Seed particles after mask exists so spawnInsideText works
      ensureParticles(p, params.particleCount);

      // Clear background each frame
      const bg = parseHexColor(ctx.backgroundColor);
      p.background(bg.r, bg.g, bg.b);

      // Use text color for particles, with visibility enhancement
      let particleColor = ctx.typeColor || '#000000';
      
      // If particles are too dark on light background, make them more visible
      const bgColor = parseHexColor(ctx.backgroundColor);
      const isLightBackground = (bgColor.r + bgColor.g + bgColor.b) / 3 > 128;
      const isDarkParticle = particleColor === '#111111' || particleColor === '#000000';
      
      if (isLightBackground && isDarkParticle) {
        // Make dark particles much more visible on light background
        particleColor = '#000000'; // Pure black for maximum contrast
      }
      
      p.fill(particleColor);
      p.noStroke();
      
      // Debug particle color
      if (Math.random() < 0.01) {
        console.log(`Particle color: ctx.typeColor=${ctx.typeColor} -> ${particleColor}`);
        console.log(`Background: ${ctx.backgroundColor}, isLight: ${isLightBackground}, isDark: ${isDarkParticle}`);
      }

      // Transient padding overlay (comprehensive)
      const currentTime = performance.now();
      if (currentTime < globalShowPaddingOverlayUntilMs) {
        p.push();
        p.noFill();
        
        // Red padding boundary lines
        p.stroke(255, 59, 48, 200); // red with slight transparency
        p.strokeWeight(1.25);
        const ctx2d = p.drawingContext;
        
        // Get padding values from context
        const paddingTop = ctx.paddingTop !== undefined ? ctx.paddingTop : 20;
        const paddingBottom = ctx.paddingBottom !== undefined ? ctx.paddingBottom : 20;
        const paddingLeft = ctx.paddingLeft !== undefined ? ctx.paddingLeft : 20;
        const paddingRight = ctx.paddingRight !== undefined ? ctx.paddingRight : 20;
        
        // Calculate padding boundaries with bounds checking
        const x1 = Math.max(0, paddingLeft);
        const x2 = Math.min(p.width, p.width - paddingRight);
        const y1 = Math.max(0, paddingTop);
        const y2 = Math.min(p.height, p.height - paddingBottom);
        
        // Set up dotted line style
        const prevDash = ctx2d.getLineDash();
        const prevCap = ctx2d.lineCap;
        ctx2d.setLineDash([3, 6]);
        ctx2d.lineCap = 'butt';
        
        // Draw all four padding boundaries
        p.line(x1, y1, x2, y1); // Top line
        p.line(x1, y2, x2, y2); // Bottom line
        p.line(x1, y1, x1, y2); // Left line
        p.line(x2, y1, x2, y2); // Right line
        
        // Reset dash style
        ctx2d.setLineDash(prevDash);
        ctx2d.lineCap = prevCap;

        p.pop();
      }

      const time = p.millis() * 0.0005;
      const activeCount = Math.min(allocated, Math.round(params.particleCount));

      // Helper to nudge a point back inside text by sampling nearby directions
      const nudgeInside = (pt) => {
        let bestX = pt.x, bestY = pt.y, bestB = sampleBrightness(pt.x, pt.y);
        const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
        for (let r = 1; r <= 8; r++) {
          for (const [dx, dy] of dirs) {
            const nx = pt.x + dx * r * 2;
            const ny = pt.y + dy * r * 2;
            const b = sampleBrightness(nx, ny);
            if (b > bestB) { bestB = b; bestX = nx; bestY = ny; }
            if (b >= params.edgeThreshold) { pt.x = nx; pt.y = ny; return true; }
          }
        }
        if (bestB > 0) { pt.x = bestX; pt.y = bestY; return true; }
        return false;
      };

      for (let i = 0; i < activeCount; i++) {
        const pt = particles[i];
        // Flow field
        let ax = 0, ay = 0;
        if (params.flowMode === 'noise') {
          const ang = p.noise(pt.x * effFlowScale, pt.y * effFlowScale, time) * p.TWO_PI * effFlowStrength;
          ax += Math.cos(ang) * 0.2 * effSpeed;
          ay += Math.sin(ang) * 0.2 * effSpeed;
        } else {
          const g = sampleGradient(pt.x, pt.y);
          const mag = Math.hypot(g.gx, g.gy) + 1e-6;
          const nx = g.gx / mag, ny = g.gy / mag; // normal
          const tx = -ny, ty = nx; // tangent
          if (params.flowMode === 'outline') {
            const normalScale = allowObstacle ? 0.6 : 0.0; // disable normal push when not colliding
            ax += nx * effFlowStrength * normalScale;
            ay += ny * effFlowStrength * normalScale;
          } else if (params.flowMode === 'tangent') { ax += tx * effFlowStrength * 0.6; ay += ty * effFlowStrength * 0.6; }
          // If gradient is weak (flat interior), add a small noise drift to avoid stagnation
          if (mag < 0.002) {
            const jitterAng = p.noise(pt.x * (effFlowScale * 0.8), pt.y * (effFlowScale * 0.8), time + 100.0) * p.TWO_PI;
            ax += Math.cos(jitterAng) * 0.08 * effSpeed;
            ay += Math.sin(jitterAng) * 0.08 * effSpeed;
          }
        }

        // Attraction to text via gradient (stronger)
        const g2 = sampleGradient(pt.x, pt.y);
        ax += g2.gx * effAttraction * 10.0;
        ay += g2.gy * effAttraction * 10.0;
        
        // Additional text attraction for better readability
        if (effTextAttraction > 0) {
          // Use gradient to pull particles toward text boundaries
          ax += g2.gx * effTextAttraction * 15.0;
          ay += g2.gy * effTextAttraction * 15.0;
        }

        // Base drift so particles never fully stall
        const drift = p.noise(13 + pt.x * effFlowScale * 0.5, 29 + pt.y * effFlowScale * 0.5, time + 7.0) - 0.5;
        ax += drift * 0.04 * effSpeed;
        ay += (1 - drift) * 0.04 * effSpeed;

        // Integrate with damping
        const oldX = pt.x, oldY = pt.y;
        pt.vx = (pt.vx + ax) * 0.96;
        pt.vy = (pt.vy + ay) * 0.96;
        pt.x += pt.vx;
        pt.y += pt.vy;

        // Enforce confinement robustly
        if (params.confineToText) {
          let bHere = sampleBrightness(pt.x, pt.y);
          if (bHere < params.edgeThreshold) {
            const g = sampleGradient(pt.x, pt.y);
            const mag = Math.hypot(g.gx, g.gy);
            if (mag > 1e-6) {
              const nx = g.gx / mag, ny = g.gy / mag;
              const miss = (params.edgeThreshold - bHere);
              const push = 6 + miss * 24; // stronger push the further outside
              pt.x += nx * push;
              pt.y += ny * push;
              const dot = pt.vx * nx + pt.vy * ny;
              pt.vx -= (1.8 + miss * 1.2) * dot * nx;
              pt.vy -= (1.8 + miss * 1.2) * dot * ny;
            }
            if (sampleBrightness(pt.x, pt.y) < params.edgeThreshold) {
              if (!nudgeInside(pt)) { pt.x = oldX; pt.y = oldY; pt.vx *= 0.5; pt.vy *= 0.5; }
            }
          }
        } else if (allowObstacle) {
          // Treat text as a solid obstacle: bounce off its edges
          const bNow = sampleBrightness(pt.x, pt.y);
          if (bNow >= params.edgeThreshold) {
            const g = sampleGradient(pt.x, pt.y);
            const mag = Math.hypot(g.gx, g.gy);
            let nx, ny; // outward normal (pointing to darker area)
            if (mag > 1e-6) { nx = -g.gx / mag; ny = -g.gy / mag; }
            else {
              const dx = oldX - pt.x, dy = oldY - pt.y; const dmag = Math.hypot(dx, dy) || 1; nx = dx / dmag; ny = dy / dmag;
            }
            const miss = (bNow - params.edgeThreshold);
            const push = 4 + miss * 20;
            pt.x += nx * push;
            pt.y += ny * push;
            const vn = pt.vx * nx + pt.vy * ny;
            if (vn < 0) {
              const restitution = 0.5;
              pt.vx -= (1 + restitution) * vn * nx;
              pt.vy -= (1 + restitution) * vn * ny;
            }
          }
        }

        // Wrap only if not confining
        if (!params.confineToText) {
          if (pt.x < 0) pt.x += p.width; else if (pt.x >= p.width) pt.x -= p.width;
          if (pt.y < 0) pt.y += p.height; else if (pt.y >= p.height) pt.y -= p.height;
        }

        // Draw
        if (params.shape === 'square') p.square(pt.x, pt.y, effParticleSize);
        else p.circle(pt.x, pt.y, effParticleSize);
        
        // Debug particle drawing
        if (i === 0 && Math.random() < 0.01) {
          console.log(`Drawing particle at ${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}, size: ${effParticleSize}, color: ${particleColor}, activeCount: ${activeCount}`);
        }
      }
    },

    onResize(p) {
      ensureBuffer(p);
    },
  };
} 