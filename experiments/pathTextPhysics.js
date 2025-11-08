export function createPathTextPhysicsExperiment() {
  const params = {
    baseTextSizeRatio: 0.22,
    lineHeight: 1.0,
    charSpacing: 1.0, // multiplier on character advance
    minAdvanceEm: 0.25, // minimum advance in em to prevent overlap on thin glyphs
    minThinEm: 0.35, // enforce at least this em-width for very thin glyphs like I/l/1
    gravity: 0.6,
    stiffness: 0.8,
    damping: 0.12,
    maxStrokes: 8,
    maxCharsPerStroke: 220,
    alignToMotion: true,
    bounce: 0.3,
    collisions: true,
    collisionStrength: 0.25,
  };

  let strokes = []; // array of { particles: [{x,y,vx,vy,char,lastAngle,dirX,dirY}], isDrawing, lastX,lastY }
  let currentStroke = null;

  function repeatChars(text) {
    const base = (text && text.length > 0 ? text : 'TYPE');
    return [...base];
  }

  function measureAdvance(p, font, size, ch) {
    if (font) p.textFont(font);
    p.textSize(size);
    const w = p.textWidth(ch || ' ');
    // Treat ultra-thin glyphs as at least minThinEm of an em to avoid visual crowding
    const thinEm = Math.max(0, params.minThinEm || 0.35);
    const wThinCorrected = Math.max(w, thinEm * size);
    // Ensure a hard minimum advance based on em (font size)
    const minAdvancePx = Math.max(2, (params.minAdvanceEm || 0.25) * size);
    return Math.max(minAdvancePx, wThinCorrected * params.charSpacing);
  }

  function addCharToStroke(p, ctx, s, x, y, dirX, dirY) {
    const chars = s._chars || repeatChars(ctx?.text || 'TYPE');
    if (!s._chars) s._chars = chars;
    const idx = s._nextIdx ?? 0;
    const ch = chars[idx % chars.length];
    s._nextIdx = idx + 1;
    const initialAngle = Math.atan2(dirY || 0, dirX || 1);
    s.particles.push({ x, y, vx: 0, vy: 0, char: ch, lastX: x, lastY: y, dirX, dirY, lastAngle: initialAngle });
  }

  function startStroke(p, ctx, x, y) {
    if (strokes.length >= params.maxStrokes) strokes.shift();
    const chars = repeatChars(ctx?.text || 'TYPE');
    currentStroke = { particles: [], isDrawing: true, lastX: x, lastY: y, _nextIdx: 0, _chars: chars };
    strokes.push(currentStroke);
  }

  function continueStroke(p, ctx, x, y, baseSize) {
    if (!currentStroke) return;
    const dx = x - currentStroke.lastX;
    const dy = y - currentStroke.lastY;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.5) return;
    const dirX = dx / dist, dirY = dy / dist;
    const nextCh = currentStroke._chars[(currentStroke._nextIdx ?? 0) % currentStroke._chars.length];
    const adv = Math.max(3, measureAdvance(p, ctx?.font, baseSize, nextCh));
    // place multiple chars if needed
    let remain = dist + (currentStroke._carry || 0);
    let px = currentStroke.lastX, py = currentStroke.lastY;
    while (remain >= adv && currentStroke.particles.length < params.maxCharsPerStroke) {
      px += dirX * adv;
      py += dirY * adv;
      addCharToStroke(p, ctx, currentStroke, px, py, dirX, dirY);
      remain -= adv;
    }
    currentStroke._carry = remain;
    currentStroke.lastX = x; currentStroke.lastY = y;
  }

  function endStroke() {
    if (currentStroke) currentStroke.isDrawing = false;
    currentStroke = null;
  }

  function clear() {
    strokes = [];
    currentStroke = null;
  }

  function integrate(p, ctx, baseSize, eff) {
    const g = eff.gravity;
    const k = eff.stiffness;
    const d = eff.damping;
    const bounce = params.bounce;

    // Ensure text metrics reflect current size/font
    if (ctx?.font) p.textFont(ctx.font);
    p.textSize(baseSize);
    const ascent = p.textAscent();
    const descent = p.textDescent();
    const charHeight = ascent + descent;

    // Phase 0: flatten particles list for global operations and tag indices
    const all = [];
    for (let sIndex = 0; sIndex < strokes.length; sIndex++) {
      const s = strokes[sIndex];
      for (let i = 0; i < s.particles.length; i++) {
        const part = s.particles[i];
        part._stroke = sIndex;
        part._si = i;
        all.push(part);
      }
    }
    for (let i = 0; i < all.length; i++) all[i]._idx = i;

    // Phase 1: forces (gravity + springs) update velocities
    for (const s of strokes) {
      const parts = s.particles;
      const n = parts.length;
      for (let i = 0; i < n; i++) {
        const a = parts[i];
        // gravity
        a.vy += g;
        // spring to previous neighbor
        if (i > 0) {
          const b = parts[i - 1];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy) || 1;
          // Use average of adjacent glyph advances to stabilize spacing for thin glyphs
          const restA = measureAdvance(p, ctx?.font, baseSize, a.char);
          const restB = measureAdvance(p, ctx?.font, baseSize, b.char);
          const rest = (restA + restB) * 0.5;
          const diff = dist - rest;
          const nx = dx / dist, ny = dy / dist;
          const force = -k * diff;
          a.vx += force * nx; a.vy += force * ny;
          b.vx -= force * nx; b.vy -= force * ny;
        }
        // damping
        a.vx *= (1 - d);
        a.vy *= (1 - d);
      }
    }

    // Phase 2: integrate positions
    for (const s of strokes) {
      for (const a of s.particles) {
        a.x += a.vx;
        a.y += a.vy;
      }
    }

    // Phase 3: compute per-char metrics (width & radius)
    for (const a of all) {
      const w = Math.max(2, p.textWidth(a.char));
      a._w = w;
      const baseRad = Math.max(charHeight * 0.5, w * 0.45);
      a._r = baseRad * 0.85; // slightly conservative radius
    }

    // Phase 4: collisions (spatial hash, circle approx)
    if (params.collisions) {
      const cell = Math.max(8, baseSize * 0.8);
      const grid = new Map();
      const key = (cx, cy) => cx + ',' + cy;
      for (const a of all) {
        const cx = Math.floor(a.x / cell), cy = Math.floor(a.y / cell);
        const kkey = key(cx, cy);
        let arr = grid.get(kkey);
        if (!arr) { arr = []; grid.set(kkey, arr); }
        arr.push(a._idx);
      }
      const getCell = (cx, cy) => grid.get(key(cx, cy)) || [];
      const strength = Math.max(0, Math.min(1, params.collisionStrength || 0));
      for (const a of all) {
        const cx = Math.floor(a.x / cell), cy = Math.floor(a.y / cell);
        let tested = 0;
        let stop = false;
        for (let oy = -1; oy <= 1 && !stop; oy++) {
          for (let ox = -1; ox <= 1 && !stop; ox++) {
            const list = getCell(cx + ox, cy + oy);
            for (const j of list) {
              if (tested > 12) { stop = true; break; }
              if (j <= a._idx) continue;
              const b = all[j];
              // Skip adjacent neighbors in same stroke to avoid fighting the spring
              if (a._stroke === b._stroke && Math.abs(a._si - b._si) <= 1) continue;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist = Math.hypot(dx, dy);
              const minDist = (a._r + b._r) * 0.98;
              if (dist > 0 && dist < minDist) {
                const nx = dx / dist, ny = dy / dist;
                const overlap = (minDist - dist);
                const push = overlap * 0.5 * strength;
                a.x -= nx * push; a.y -= ny * push;
                b.x += nx * push; b.y += ny * push;
                // damp approach velocity only (prevents energy increase)
                const rvx = b.vx - a.vx;
                const rvy = b.vy - a.vy;
                const vn = rvx * nx + rvy * ny; // positive if separating
                if (vn < 0) {
                  const corr = (-vn) * 0.25 * strength;
                  a.vx -= nx * corr; a.vy -= ny * corr;
                  b.vx += nx * corr; b.vy += ny * corr;
                }
                tested++;
              }
            }
          }
        }
      }
    }

    // Phase 5: clamp to canvas bounds so glyphs never leave
    for (const a of all) {
      if (eff.alignToMotion) {
        // use circle radius for rotated glyphs (centered drawing)
        if (a.x < a._r) { a.x = a._r; a.vx = Math.abs(a.vx) * bounce; }
        if (a.x > p.width - a._r) { a.x = p.width - a._r; a.vx = -Math.abs(a.vx) * bounce; }
        if (a.y < a._r) { a.y = a._r; a.vy = Math.abs(a.vy) * bounce; }
        if (a.y > p.height - a._r) { a.y = p.height - a._r; a.vy = -Math.abs(a.vy) * bounce; }
      } else {
        // baseline-left drawing, axis-aligned box using ascent/descent
        const w = a._w;
        if (a.x < 0) { a.x = 0; a.vx = Math.abs(a.vx) * bounce; }
        if (a.x + w > p.width) { a.x = p.width - w; a.vx = -Math.abs(a.vx) * bounce; }
        if (a.y - ascent < 0) { a.y = ascent; a.vy = Math.abs(a.vy) * bounce; }
        if (a.y + descent > p.height) { a.y = p.height - descent; a.vy = -Math.abs(a.vy) * bounce; }
      }
    }
  }

  function angleLerp(a0, a1, t) {
    const diff = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
    return a0 + diff * t;
  }

  function render(p, ctx, baseSize, align) {
    p.fill(ctx.typeColor);
    p.noStroke();
    p.textSize(baseSize);
    if (ctx.font) p.textFont(ctx.font);
    // Use global text positioning if provided, otherwise default to center-center
    const position = ctx.textPosition || 'center-center';
    
    // Set text alignment based on position
    if (position.includes('left')) {
      p.textAlign(p.LEFT, p.BASELINE);
    } else if (position.includes('right')) {
      p.textAlign(p.RIGHT, p.BASELINE);
    } else {
      p.textAlign(p.CENTER, p.CENTER);
    }

    for (const s of strokes) {
      const parts = s.particles;
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        if (align) {
          let dx = 1, dy = 0;
          const hasPrev = i > 0;
          const hasNext = i + 1 < parts.length;
          if (hasPrev && hasNext) {
            // central difference tangent
            dx = parts[i + 1].x - parts[i - 1].x;
            dy = parts[i + 1].y - parts[i - 1].y;
          } else if (hasNext) {
            dx = parts[i + 1].x - a.x;
            dy = parts[i + 1].y - a.y;
          } else if (hasPrev) {
            dx = a.x - parts[i - 1].x;
            dy = a.y - parts[i - 1].y;
          } else if (Math.hypot(a.vx, a.vy) > 1e-3) {
            dx = a.vx; dy = a.vy;
          } else if (a.dirX || a.dirY) {
            dx = a.dirX; dy = a.dirY;
          }
          if (dx === 0 && dy === 0) { dx = 1; dy = 0; }
          const desired = Math.atan2(dy, dx);
          const prev = (typeof a.lastAngle === 'number') ? a.lastAngle : desired;
          const ang = angleLerp(prev, desired, 0.35);
          a.lastAngle = ang;
          p.push(); p.translate(a.x, a.y); p.rotate(ang); p.text(a.char, 0, 0); p.pop();
        } else {
          p.text(a.char, a.x, a.y);
        }
      }
    }
  }

  return {
    name: 'Path Text Physics',

    getControlDefinitions() {
      return [
        { id: 'baseTextSizeRatio', type: 'range', label: 'Text size', min: 0.005, max: 0.5, step: 0.005, default: 0.22 },
        { id: 'charSpacing', type: 'range', label: 'Char spacing', min: 0.6, max: 2.0, step: 0.02, default: 1.0 },
        { id: 'gravity', type: 'range', label: 'Gravity', min: 0.0, max: 2.0, step: 0.02, default: 0.6 },
        { id: 'stiffness', type: 'range', label: 'Stiffness', min: 0.0, max: 2.0, step: 0.02, default: 0.8 },
        { id: 'damping', type: 'range', label: 'Damping', min: 0.0, max: 0.5, step: 0.01, default: 0.12 },
        { id: 'maxStrokes', type: 'range', label: 'Max strokes', min: 1, max: 20, step: 1, default: 8 },
        { id: 'maxCharsPerStroke', type: 'range', label: 'Max chars per stroke', min: 20, max: 600, step: 10, default: 220 },
        { id: 'alignToMotion', type: 'checkbox', label: 'Align to motion', default: true },
        { id: 'collisions', type: 'checkbox', label: 'Collisions', default: true },
        { id: 'collisionStrength', type: 'range', label: 'Collision strength', min: 0.0, max: 1.0, step: 0.02, default: 0.25 },
        { id: 'bounce', type: 'range', label: 'Bounce', min: 0.0, max: 1.0, step: 0.02, default: 0.3 },
        { id: 'clear', type: 'button', label: 'Clear', onClick: () => { strokes = []; currentStroke = null; } },
      ];
    },

    getParams() { return { ...params }; },

    setParams(next) { Object.assign(params, next); },

    init(p, ctx) {
      strokes = []; currentStroke = null;
    },

    draw(p, ctx) {
      // Effective mapping from cursor bindings
      const isBound = (id) => Array.isArray(ctx.boundIds) && ctx.boundIds.includes(id);
      const normFromAxis = (id, fallbackAxis) => {
        const mx = p.constrain(p.mouseX / p.width, 0, 1);
        const my = p.constrain(p.mouseY / p.height, 0, 1);
        const axis = ctx.getAxis ? ctx.getAxis(id) : (fallbackAxis || 'x');
        const inv = ctx.getInvert ? ctx.getInvert(id) : false;
        let t = axis === 'y' ? (1 - my) : mx;
        if (inv) t = 1 - t; return Math.max(0, Math.min(1, t));
      };
      const eff = {
        baseTextSizeRatio: isBound('baseTextSizeRatio') ? p.lerp(0.12, 0.5, normFromAxis('baseTextSizeRatio', 'y')) : params.baseTextSizeRatio,
        charSpacing: isBound('charSpacing') ? p.lerp(0.6, 2.0, normFromAxis('charSpacing', 'x')) : params.charSpacing,
        gravity: isBound('gravity') ? p.lerp(0.0, 2.0, normFromAxis('gravity', 'y')) : params.gravity,
        stiffness: isBound('stiffness') ? p.lerp(0.0, 2.0, normFromAxis('stiffness', 'x')) : params.stiffness,
        damping: isBound('damping') ? p.lerp(0.0, 0.5, normFromAxis('damping', 'x')) : params.damping,
        alignToMotion: params.alignToMotion,
      };
      // Use effective char spacing for advance during drawing
      params.charSpacing = eff.charSpacing;

      // Use context font size if provided, otherwise use ratio-based calculation
      const baseSize = ctx.fontSize || Math.max(6, Math.min(p.width, p.height) * eff.baseTextSizeRatio);

      // Physics step
      integrate(p, ctx, baseSize, eff);
      render(p, ctx, baseSize, eff.alignToMotion);
    },

    mousePressed(p, ctx) { startStroke(p, ctx, p.mouseX, p.mouseY); },
    mouseDragged(p, ctx) {
      // Use context font size if provided, otherwise use ratio-based calculation
      const baseSize = ctx.fontSize || Math.max(6, Math.min(p.width, p.height) * params.baseTextSizeRatio);
      continueStroke(p, ctx, p.mouseX, p.mouseY, baseSize);
    },
    mouseReleased(p) { endStroke(); },

    onResize(p) { /* keep strokes; physics adapts */ },
    clear,
  };
} 