export function createPathImagesPhysicsExperiment() {
  let params = {
    spacingPx: 40,
    scale: 0.6,
    speedPxPerSec: 120,
    alignToPath: true,
    jitterPx: 0,
    maxStrokes: 8,
    maxPointsPerStroke: 600
  };

  let strokes = [];
  let currentStroke = null;

  function getParams() { return params; }
  function setParams(next) { params = { ...params, ...next }; }

  function addPoint(p, x, y) {
    if (!currentStroke) return;
    const last = currentStroke[currentStroke.length - 1];
    if (!last || p.dist(last.x, last.y, x, y) > 2) {
      if (currentStroke.length < params.maxPointsPerStroke) {
        currentStroke.push({ x, y });
      }
    }
  }

  function mousePressed(p) {
    if (!currentStroke) currentStroke = [];
    addPoint(p, p.mouseX, p.mouseY);
  }

  function mouseDragged(p) {
    addPoint(p, p.mouseX, p.mouseY);
  }

  function mouseReleased(p) {
    if (currentStroke && currentStroke.length > 1) {
      strokes.push(currentStroke);
      if (strokes.length > params.maxStrokes) strokes.shift();
    }
    currentStroke = null;
  }

  function lengthOfStroke(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
    return L;
  }

  function pointAt(pts, s) {
    if (pts.length < 2) return { x: pts[0].x, y: pts[0].y, dx: 1, dy: 0 };
    let rem = s;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i-1], b = pts[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (rem <= seg) {
        const t = seg > 0 ? rem / seg : 0;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const dx = (b.x - a.x) / (seg || 1);
        const dy = (b.y - a.y) / (seg || 1);
        return { x, y, dx, dy };
      }
      rem -= seg;
    }
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / (seg || 1);
    const dy = (b.y - a.y) / (seg || 1);
    return { x: b.x, y: b.y, dx, dy };
  }

  function draw(p, ctx) {
    const images = ctx.images || [];
    if (!images.length) {
      p.push();
      p.fill(0);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(16);
      p.text('Upload images, then draw paths to place images', p.width / 2, p.height / 2);
      p.pop();
      return;
    }

    // Draw hint when no strokes
    if (strokes.length === 0 && !currentStroke) {
      p.push();
      p.fill(0, 90);
      p.textAlign(p.CENTER, p.BOTTOM);
      p.textSize(12);
      p.text('Click and drag to draw image paths', p.width / 2, p.height - 10);
      p.pop();
    }

    const spacing = Math.max(8, params.spacingPx);
    const phase = (ctx.timeSeconds * params.speedPxPerSec) % spacing;

    // Draw existing strokes
    const allStrokes = currentStroke && currentStroke.length > 1 ? [...strokes, currentStroke] : strokes;

    let imgIndex = 0;
    for (const stroke of allStrokes) {
      if (stroke.length < 2) continue;
      const L = lengthOfStroke(stroke);
      for (let s = phase; s <= L; s += spacing) {
        const { x, y, dx, dy } = pointAt(stroke, s);
        const imageData = images[imgIndex % images.length];
        const img = imageData.p5Image;
        if (img) {
          const jx = (params.jitterPx ? (Math.random() * 2 - 1) * params.jitterPx : 0);
          const jy = (params.jitterPx ? (Math.random() * 2 - 1) * params.jitterPx : 0);
          p.push();
          p.translate(x + jx, y + jy);
          if (params.alignToPath) {
            const angle = Math.atan2(dy, dx);
            p.rotate(angle);
          }
          p.imageMode(p.CENTER);
          const w = img.width * params.scale;
          const h = img.height * params.scale;
          p.image(img, 0, 0, w, h);
          p.pop();
          imgIndex++;
        }
      }
    }
  }

  return {
    id: 'pathImagesPhysics',
    name: 'Path Images Physics',
    draw,
    getParams,
    setParams,
    mousePressed,
    mouseDragged,
    mouseReleased
  };
}


