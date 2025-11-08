// Global variable to persist overlay timer across reinitializations
let globalShowPaddingOverlayUntilMs = 0;

export function createRadialRingsExperiment() {
  const params = {
    baseTextSizeRatio: 0.06,
    alignTangent: true,
    textOnCurve: true,

    ringCount: 12,
    innerRadiusRatio: 0.16,
    outerRadiusRatio: 0.5,

    sweepDeg: 300,
    startAngleDeg: 0,
    ringOffsetDeg: 8,

    advanceScale: 1.0,
    spiralPx: 2.0,
    letterSpacingEm: 0.02,
    minAdvanceEm: 0.05,
    completeText: false,

    jitterRadialPx: 0.0,
    jitterAngleDeg: 0.0,

    animate: true,
    animationPaused: false,
    rotateSpeedDeg: 12,
  };

  let lastW = 0, lastH = 0;
  let seed = 1337;

  function reseed(p) { seed = Math.floor(p.random(1e9)); }

  function ensure(p) {
    if (p.width !== lastW || p.height !== lastH) { lastW = p.width; lastH = p.height; }
  }

  function sanitizeText(raw) {
    if (!raw || !raw.length) return 'TYPE';
    return raw.replace(/\s+/g, ' ').trim();
  }

  return {
    name: 'Radial Rings',

    getControlDefinitions() {
      return [
        { id: 'textHeading', type: 'heading', label: 'Text' },
        { id: 'baseTextSizeRatio', type: 'range', label: 'Text size', min: 0.02, max: 0.35, step: 0.005, default: 0.06 },
        { id: 'alignTangent', type: 'checkbox', label: 'Align to tangent', default: true },
        { id: 'textOnCurve', type: 'toggle', label: 'Follow curve', default: true },
        { id: 'completeText', type: 'checkbox', label: 'Finish full text', default: false },

        { id: 'ringsHeading', type: 'heading', label: 'Rings' },
        { id: 'ringCount', type: 'range', label: 'Count', min: 1, max: 48, step: 1, default: 12 },
        { id: 'innerRadiusRatio', type: 'range', label: 'Inner radius', min: 0.04, max: 0.6, step: 0.005, default: 0.16 },
        { id: 'outerRadiusRatio', type: 'range', label: 'Outer radius', min: 0.1, max: 0.95, step: 0.005, default: 0.5 },
        { id: 'sweepDeg', type: 'range', label: 'Sweep', min: 20, max: 360, step: 1, default: 300 },
        { id: 'startAngleDeg', type: 'range', label: 'Start angle', min: -180, max: 180, step: 1, default: 0 },
        { id: 'ringOffsetDeg', type: 'range', label: 'Ring offset', min: -60, max: 60, step: 1, default: 8 },

        { id: 'layoutHeading', type: 'heading', label: 'Layout' },
        { id: 'advanceScale', type: 'range', label: 'Advance scale', min: 0.5, max: 2.0, step: 0.02, default: 1.0 },
        { id: 'spiralPx', type: 'range', label: 'Spiral step (px)', min: 0.0, max: 20.0, step: 0.5, default: 2.0 },
        { id: 'letterSpacingEm', type: 'range', label: 'Letter spacing (em)', min: 0.0, max: 0.6, step: 0.01, default: 0.02 },
        { id: 'minAdvanceEm', type: 'range', label: 'Min advance (em)', min: 0.0, max: 0.6, step: 0.01, default: 0.05 },

        { id: 'jitterHeading', type: 'heading', label: 'Jitter' },
        { id: 'jitterRadialPx', type: 'range', label: 'Radial jitter (px)', min: 0.0, max: 24.0, step: 0.5, default: 0.0 },
        { id: 'jitterAngleDeg', type: 'range', label: 'Angular jitter (deg)', min: 0.0, max: 18.0, step: 0.5, default: 0.0 },
        { id: 'reseed', type: 'button', label: 'Reseed', onClick: ({ p }) => reseed(p) },

        { id: 'motionHeading', type: 'heading', label: 'Motion' },
        { id: 'animate', type: 'checkbox', label: 'Animate rotation', default: true },
        { id: 'animationPaused', type: 'checkbox', label: 'Animation', default: false },
        { id: 'rotateSpeedDeg', type: 'range', label: 'Rotate speed', min: -180, max: 180, step: 1, default: 12 },
      ];
    },

    getParams() { return { ...params }; },

    setParams(next) { Object.assign(params, next); },

    showPaddingOverlay() {
      // Show overlay for ~600ms when global side padding changes
      console.log('Radial Rings: Setting padding overlay timer');
      globalShowPaddingOverlayUntilMs = performance.now() + 600;
    },

    init(p) { ensure(p); },

    draw(p, ctx) {
      ensure(p);

      const isBound = (id) => Array.isArray(ctx.boundIds) && ctx.boundIds.includes(id);
      const normFromAxis = (id, fallbackAxis) => {
        const mx = p.constrain(p.mouseX / p.width, 0, 1);
        const my = p.constrain(p.mouseY / p.height, 0, 1);
        const axis = ctx.getAxis ? ctx.getAxis(id) : (fallbackAxis || 'x');
        const inv = ctx.getInvert ? ctx.getInvert(id) : false;
        let t = axis === 'y' ? (1 - my) : mx; if (inv) t = 1 - t; return Math.max(0, Math.min(1, t));
      };

      const effSizeRatio = isBound('baseTextSizeRatio') ? p.lerp(0.02, 0.35, normFromAxis('baseTextSizeRatio', 'y')) : params.baseTextSizeRatio;
      const effAlignTangent = !!params.alignTangent;
      const effTextOnCurve = !!params.textOnCurve;
      const effCompleteText = !!params.completeText;

      const effRingCount = Math.round(isBound('ringCount') ? p.lerp(1, 48, normFromAxis('ringCount', 'x')) : params.ringCount);
      const effInnerR = (isBound('innerRadiusRatio') ? p.lerp(0.04, 0.6, normFromAxis('innerRadiusRatio', 'y')) : params.innerRadiusRatio) * Math.min(p.width, p.height);
      const effOuterR = (isBound('outerRadiusRatio') ? p.lerp(0.1, 0.95, normFromAxis('outerRadiusRatio', 'y')) : params.outerRadiusRatio) * Math.min(p.width, p.height);
      const r0 = Math.min(effInnerR, effOuterR);
      const r1 = Math.max(effInnerR, effOuterR);

      const effSweepDeg = isBound('sweepDeg') ? p.lerp(20, 360, normFromAxis('sweepDeg', 'x')) : params.sweepDeg;
      const effStartDeg = isBound('startAngleDeg') ? p.lerp(-180, 180, normFromAxis('startAngleDeg', 'x')) : params.startAngleDeg;
      const effRingOffsetDeg = isBound('ringOffsetDeg') ? p.lerp(-60, 60, normFromAxis('ringOffsetDeg', 'x')) : params.ringOffsetDeg;

      const effAdvanceScale = isBound('advanceScale') ? p.lerp(0.5, 2.0, normFromAxis('advanceScale', 'x')) : params.advanceScale;
      const effSpiralPx = isBound('spiralPx') ? p.lerp(0, 20, normFromAxis('spiralPx', 'y')) : params.spiralPx;
      const effLetterEm = isBound('letterSpacingEm') ? p.lerp(0, 0.6, normFromAxis('letterSpacingEm', 'x')) : params.letterSpacingEm;
      const effMinAdvEm = isBound('minAdvanceEm') ? p.lerp(0, 0.6, normFromAxis('minAdvanceEm', 'x')) : params.minAdvanceEm;

      const effJitR = isBound('jitterRadialPx') ? p.lerp(0, 24, normFromAxis('jitterRadialPx', 'y')) : params.jitterRadialPx;
      const effJitAdeg = isBound('jitterAngleDeg') ? p.lerp(0, 18, normFromAxis('jitterAngleDeg', 'x')) : params.jitterAngleDeg;

      const effAnimate = !!params.animate;
      const effRotSpd = isBound('rotateSpeedDeg') ? p.lerp(-180, 180, normFromAxis('rotateSpeedDeg', 'x')) : params.rotateSpeedDeg;

      // Text setup
      if (ctx.font) p.textFont(ctx.font);
      const baseTextSize = ctx.fontSize || Math.max(6, Math.min(p.width, p.height) * effSizeRatio);
      p.textSize(baseTextSize);
      
      // Apply font weight if provided
      if (ctx.fontWeight) {
        p.textStyle(p.NORMAL);
        if (ctx.fontWeight >= 600) {
          p.textStyle(p.BOLD);
        }
      }
      
      // Use global text positioning if provided, otherwise default to center-center
      const position = ctx.textPosition || 'center-center';
      
      // Set text alignment based on position
      if (position.includes('left')) {
        p.textAlign(p.LEFT, p.CENTER);
      } else if (position.includes('right')) {
        p.textAlign(p.RIGHT, p.CENTER);
      } else {
        p.textAlign(p.CENTER, p.CENTER);
      }
      
      p.fill(ctx.typeColor);
      p.noStroke();

      const token = sanitizeText(ctx.text);
      const tokenChars = token.split('');
      
      // Layout with comprehensive padding
      const paddingTop = ctx.paddingTop !== undefined ? ctx.paddingTop : 20;
      const paddingBottom = ctx.paddingBottom !== undefined ? ctx.paddingBottom : 20;
      const paddingLeft = ctx.paddingLeft !== undefined ? ctx.paddingLeft : 20;
      const paddingRight = ctx.paddingRight !== undefined ? ctx.paddingRight : 20;
      
      const usableW = Math.max(0, p.width - paddingLeft - paddingRight);
      const usableH = Math.max(0, p.height - paddingTop - paddingBottom);
      
      // Calculate positioning based on text position
      let cx, cy;
      
      // Calculate X position based on horizontal alignment
      if (position.includes('left')) {
        cx = paddingLeft + usableW * 0.25; // Left side with padding
      } else if (position.includes('right')) {
        cx = paddingLeft + usableW * 0.75; // Right side with padding
      } else {
        cx = p.width / 2; // Center
      }
      
      // Calculate Y position based on vertical alignment
      if (position.includes('top')) {
        cy = paddingTop + usableH * 0.25; // Top area with padding
      } else if (position.includes('bottom')) {
        cy = paddingTop + usableH * 0.75; // Bottom area with padding
      } else {
        cy = p.height / 2; // Center
      }

      // Transient padding overlay (comprehensive)
      const currentTime = performance.now();
      if (currentTime < globalShowPaddingOverlayUntilMs) {
        console.log('Radial Rings: Drawing padding overlay, time remaining:', globalShowPaddingOverlayUntilMs - currentTime);
        
        p.push();
        p.noFill();
        
        // Red padding boundary lines
        p.stroke(255, 59, 48, 200); // red with slight transparency
        p.strokeWeight(1.25);
        const ctx2d = p.drawingContext;
        
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

      const time = params.animationPaused ? 0 : (p.millis() * 0.001);
      const globalRot = effAnimate ? effRotSpd * time : 0;

      // Precompute widths for glyphs used in curved mode (performance)
      const glyphs = (token.length ? token : 'TYPE');
      const unique = new Set((glyphs + ' ').split(''));
      const widthMap = new Map();
      unique.forEach(ch => widthMap.set(ch, Math.max(1, p.textWidth(ch))));
      const spaceW = widthMap.get(' ') || Math.max(1, p.textWidth(' '));
      const tokenWidth = Math.max(1, p.textWidth(token));

      // Helper to compute per-char base advance in px (center-to-center approximation)
      const minAdvPxBase = effMinAdvEm * baseTextSize;
      const letterSpacePxBase = effLetterEm * baseTextSize;
      const charAdvancePx = (i) => {
        const ch = tokenChars[i];
        const next = (i < tokenChars.length - 1) ? tokenChars[i + 1] : ' ';
        const wCur = widthMap.get(ch) || Math.max(1, p.textWidth(ch));
        const wNext = widthMap.get(next) || spaceW;
        const pair = (wCur + wNext) * 0.5;
        return Math.max(pair, minAdvPxBase) + letterSpacePxBase;
      };
      const tokenUnitPx = tokenChars.reduce((s, _, i) => s + charAdvancePx(i), 0) * effAdvanceScale;

      const rings = Math.max(1, effRingCount);
      for (let ri = 0; ri < rings; ri++) {
        const tRing = rings === 1 ? 0.5 : ri / (rings - 1);
        const baseRadius = p.lerp(r0, r1, tRing);
        const startDeg = effStartDeg + ri * effRingOffsetDeg + globalRot;
        const sweepRad = p.radians(Math.max(0.1, effSweepDeg));
        const startRad = p.radians(startDeg);

        if (effTextOnCurve) {
          if (effCompleteText) {
            // Fit whole tokens along the arc
            const arcLenPx = baseRadius * sweepRad;
            const count = Math.max(0, Math.floor(arcLenPx / Math.max(1, tokenUnitPx)));
            const slackPx = Math.max(0, arcLenPx - count * tokenUnitPx);
            let a = startRad + (slackPx / 2) / Math.max(1, baseRadius);
            for (let k = 0; k < count; k++) {
              for (let i = 0; i < tokenChars.length; i++) {
                const ch = tokenChars[i];
                const advBase = charAdvancePx(i) * effAdvanceScale;
                const tArc = (a - startRad) / sweepRad;
                const baseR = baseRadius + tArc * effSpiralPx;
                const jr = effJitR > 0 ? (p.noise(0.021 * (k * tokenChars.length + i), 13.7 * ri, seed * 1e-6 + time * 0.3) - 0.5) * 2 * effJitR : 0;
                const jdeg = effJitAdeg > 0 ? (p.noise(0.019 * (k * tokenChars.length + i), 9.1 * ri, seed * 1e-6 + time * 0.2) - 0.5) * 2 * effJitAdeg : 0;
                const aa = a + p.radians(jdeg);
                const rr = baseR + jr;
                const x = cx + Math.cos(aa) * rr;
                const y = cy + Math.sin(aa) * rr;
                p.push();
                p.translate(x, y);
                if (effAlignTangent) p.rotate(aa + p.HALF_PI);
                p.text(ch, 0, 0);
                p.pop();
                a += advBase / Math.max(1, rr);
              }
            }
          } else {
            // Free-flow curved text (may cut off mid-sentence)
            let a = startRad;
            const aEnd = startRad + sweepRad;
            let ci = 0;
            const flowGlyphs = (glyphs + ' ');
            while (a < aEnd) {
              const ch = flowGlyphs[ci % flowGlyphs.length];
              const nextCh = flowGlyphs[(ci + 1) % flowGlyphs.length];
              const wCur = widthMap.get(ch) || Math.max(1, p.textWidth(ch));
              const wNext = widthMap.get(nextCh) || spaceW;
              const tArc = (a - startRad) / sweepRad;
              const baseR = baseRadius + tArc * effSpiralPx;
              const jr = effJitR > 0 ? (p.noise(0.021 * ci, 13.7 * ri, seed * 1e-6 + time * 0.3) - 0.5) * 2 * effJitR : 0;
              const jdeg = effJitAdeg > 0 ? (p.noise(0.019 * ci, 9.1 * ri, seed * 1e-6 + time * 0.2) - 0.5) * 2 * effJitAdeg : 0;
              const aa = a + p.radians(jdeg);
              const rr = baseR + jr;
              const x = cx + Math.cos(aa) * rr;
              const y = cy + Math.sin(aa) * rr;
              p.push();
              p.translate(x, y);
              if (effAlignTangent) p.rotate(aa + p.HALF_PI);
              p.text(ch, 0, 0);
              p.pop();
              const pair = (wCur + wNext) * 0.5;
              const advPx = Math.max(pair, minAdvPxBase) + letterSpacePxBase;
              a += (advPx * effAdvanceScale) / Math.max(1, rr);
              ci++;
            }
          }
        } else {
          // Straight-token mode (previous behavior): stamp the whole token along the arc
          const stepPx = (tokenWidth) * effAdvanceScale;
          const stepRad = Math.max(0.01, stepPx / Math.max(1, baseRadius));
          const steps = Math.min(2000, Math.ceil(sweepRad / stepRad));
          for (let si = 0; si < steps; si++) {
            const baseA = startRad + si * stepRad;
            const jr = effJitR > 0 ? (p.noise(0.017 * si, 11.3 * ri, seed * 1e-6 + time * 0.3) - 0.5) * 2 * effJitR : 0;
            const jdeg = effJitAdeg > 0 ? (p.noise(0.013 * si, 7.7 * ri, seed * 1e-6 + time * 0.2) - 0.5) * 2 * effJitAdeg : 0;
            const a = baseA + p.radians(jdeg);
            const tArc = (a - startRad) / sweepRad;
            const r = baseRadius + tArc * effSpiralPx + jr;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            p.push();
            p.translate(x, y);
            if (effAlignTangent) p.rotate(a + p.HALF_PI);
            p.text(token, 0, 0);
            p.pop();
          }
        }
      }
    },

    onResize(p) { ensure(p); },
  };
} 