let globalShowPaddingOverlayUntilMs = 0;

export function createTechnicalTypeExperiment() {
  const params = {
    baseTextSizeRatio: 0.22,
    lineHeight: 1.1,
    sidePaddingRatio: 0.08,
    fitToWidth: true,

    techColor: '#D60000',
    strokeWeight: 1.2,
    dashed: true,
    labelSizePx: 12,
    precision: 0,
    showGrid: false,
    gridSizePx: 24,

    showBaseline: true,
    showAscDesc: true,
    showXHeight: true,
    xHeightRatio: 0.68,
    showBounds: true,
    showDimensions: true,
    showHUD: true,
  };

  let showPaddingOverlayUntilMs = 0;

  function formatNum(n, prec) { return n.toFixed(Math.max(0, Math.min(4, prec))); }

  function rasterMeasure(p, ctx, size) {
    // Limit buffer size to prevent memory issues
    const maxSize = 200;
    const limitedSize = Math.min(size, maxSize);
    const w = Math.ceil(limitedSize * 2.2);
    const h = Math.ceil(limitedSize * 2.2);
    const baseY = Math.floor(limitedSize);
    const xPad = Math.floor(limitedSize * 0.2);
    
    const measureChar = (ch) => {
      try {
        const g = p.createGraphics(w, h); 
        g.pixelDensity(1);
        g.clear(); 
        g.textAlign(g.LEFT, g.BASELINE); 
        if (ctx.font) g.textFont(ctx.font);
        g.textSize(limitedSize); 
        g.noStroke(); 
        g.fill(255);
        g.text(ch, xPad, baseY);
        g.loadPixels();
        
        let top = h, bottom = -1;
        const arr = g.pixels;
        for (let y = 0; y < h; y++) {
          const row = y * w * 4;
          for (let x = 0; x < w; x++) {
            const a = arr[row + x * 4 + 3];
            if (a > 0) { if (y < top) top = y; if (y > bottom) bottom = y; }
          }
        }
        if (bottom < 0 || top >= h) return null;
        return { top, bottom };
      } catch (error) {
        console.warn('Raster measure failed:', error);
        return null;
      }
    };
    const up = measureChar('H') || measureChar('l') || measureChar('d');
    const dn = measureChar('p') || measureChar('g') || measureChar('y');
    const xch = measureChar('x');
    const asc = up ? (baseY - up.top) : p.textAscent();
    const des = dn ? (dn.bottom - baseY) : p.textDescent();
    const xh = xch ? (baseY - xch.top) : asc * (params.xHeightRatio || 0.68);
    return { asc, des, xh };
  }

  function measureMetrics(p, ctx, size) {
    const fallback = () => ({ asc: p.textAscent(), des: p.textDescent(), xh: p.textAscent() * (params.xHeightRatio || 0.68) });
    const f = ctx.font;
    if (f && typeof f.textBounds === 'function') {
      try {
        const boundsH = f.textBounds('H', 0, 0, size);
        const boundsl = f.textBounds('l', 0, 0, size);
        const boundsd = f.textBounds('d', 0, 0, size);
        const boundsp = f.textBounds('p', 0, 0, size);
        const boundsg = f.textBounds('g', 0, 0, size);
        const boundsy = f.textBounds('y', 0, 0, size);
        const boundsx = f.textBounds('x', 0, 0, size);
        const topY = Math.min(boundsH.y, boundsl.y, boundsd.y);
        const bottomY = Math.max(boundsp.y + boundsp.h, boundsg.y + boundsg.h, boundsy.y + boundsy.h);
        const asc = -topY;
        const des = bottomY;
        const xh = -boundsx.y;
        if (isFinite(asc) && isFinite(des) && isFinite(xh) && asc > 0 && des >= 0 && xh > 0) {
          return { asc, des, xh };
        }
        return fallback();
      } catch (_) { return fallback(); }
    }
    // Raster fallback for default string fonts
    return rasterMeasure(p, ctx, size);
  }

  return {
    name: 'Technical Type',

    getControlDefinitions() {
      return [
        { id: 'textHeading', type: 'heading', label: 'Text' },
        { id: 'baseTextSizeRatio', type: 'range', label: 'Text size', min: 0.08, max: 0.5, step: 0.005, default: 0.22 },
        { id: 'lineHeight', type: 'range', label: 'Line height', min: 0.7, max: 2.0, step: 0.02, default: 1.1 },
        { id: 'sidePaddingRatio', type: 'range', label: 'Side padding', min: 0.0, max: 0.2, step: 0.005, default: 0.08 },
        { id: 'fitToWidth', type: 'checkbox', label: 'Fit to width', default: true },

        { id: 'styleHeading', type: 'heading', label: 'Style' },
        { id: 'techColor', type: 'color', label: 'Tech color', default: '#D60000' },
        { id: 'strokeWeight', type: 'range', label: 'Line weight', min: 0.5, max: 3.0, step: 0.1, default: 1.2 },
        { id: 'dashed', type: 'checkbox', label: 'Dashed', default: true },
        { id: 'labelSizePx', type: 'range', label: 'Label size', min: 8, max: 24, step: 1, default: 12 },
        { id: 'precision', type: 'range', label: 'Decimals', min: 0, max: 3, step: 1, default: 0 },

        { id: 'gridHeading', type: 'heading', label: 'Grid' },
        { id: 'showGrid', type: 'checkbox', label: 'Show grid', default: false },
        { id: 'gridSizePx', type: 'range', label: 'Grid size', min: 8, max: 80, step: 1, default: 24 },

        { id: 'guideHeading', type: 'heading', label: 'Guides' },
        { id: 'showBaseline', type: 'checkbox', label: 'Baseline', default: true },
        { id: 'showAscDesc', type: 'checkbox', label: 'Asc/Desc', default: true },
        { id: 'showXHeight', type: 'checkbox', label: 'x-Height', default: true },
        { id: 'xHeightRatio', type: 'range', label: 'x-Height ratio', min: 0.4, max: 0.9, step: 0.01, default: 0.68 },
        { id: 'showBounds', type: 'checkbox', label: 'Bounds', default: true },
        { id: 'showDimensions', type: 'checkbox', label: 'Dimensions', default: true },
        { id: 'showHUD', type: 'checkbox', label: 'Show HUD', default: true },
      ];
    },

    getParams() { return { ...params }; },

    setParams(next) {
      const changed = next && Object.prototype.hasOwnProperty.call(next, 'sidePaddingRatio') && next.sidePaddingRatio !== params.sidePaddingRatio;
      Object.assign(params, next);
      if (changed) showPaddingOverlayUntilMs = performance.now() + 600;
    },

    init(p, ctx) {},

    draw(p, ctx) {
      const techC = p.color(params.techColor || '#D60000');
      const sw = Math.max(0.5, params.strokeWeight || 1.2);
      const dashed = !!params.dashed;
      const labelSize = Math.max(6, Math.floor(params.labelSizePx || 12));
      const prec = Math.max(0, Math.min(3, params.precision || 0));

      // Grid
      if (params.showGrid) {
        p.push();
        p.stroke(0, 0, 0, 25); p.strokeWeight(1); p.noFill();
        const g = Math.max(4, params.gridSizePx|0);
        for (let x = 0; x <= p.width; x += g) p.line(x, 0, x, p.height);
        for (let y = 0; y <= p.height; y += g) p.line(0, y, p.width, y);
        p.pop();
      }

      // Text layout
      if (ctx.font) p.textFont(ctx.font);
      const baseSize = ctx.fontSize || Math.max(10, Math.min(p.width, p.height) * params.baseTextSizeRatio);
      p.textSize(baseSize);
      
      // Apply font weight if provided
      if (ctx.fontWeight) {
        p.textStyle(p.NORMAL);
        if (ctx.fontWeight >= 600) {
          p.textStyle(p.BOLD);
        }
      }
      const lines = (ctx.text && ctx.text.length > 0 ? ctx.text : 'TYPE').split(/\r?\n/);
      
      // Add error handling for measureMetrics to prevent memory crashes
      let met;
      try {
        met = measureMetrics(p, ctx, baseSize);
      } catch (error) {
        console.warn('Technical Type: measureMetrics failed, using fallback:', error);
        met = { asc: p.textAscent(), des: p.textDescent(), xh: p.textAscent() * (params.xHeightRatio || 0.68) };
      }
      
      const asc = met.asc; const des = met.des; const xhMeasured = met.xh;
      const lineAdv = baseSize * (ctx.lineHeight || params.lineHeight);
      const totalH = lineAdv * lines.length;
      
      // Get padding values
      const paddingTop = ctx.paddingTop || 20;
      const paddingBottom = ctx.paddingBottom || 20;
      const paddingLeft = ctx.paddingLeft || 20;
      const paddingRight = ctx.paddingRight || 20;
      
      // Calculate usable area
      const usableW = p.width - paddingLeft - paddingRight;
      const usableH = p.height - paddingTop - paddingBottom;
      
      // Use global text positioning if provided, otherwise default to center-center
      const position = ctx.textPosition || 'center-center';
      
      // Set text alignment based on position
      if (position.includes('left')) {
        p.textAlign(p.LEFT, p.BASELINE);
      } else if (position.includes('right')) {
        p.textAlign(p.RIGHT, p.BASELINE);
      } else {
        p.textAlign(p.CENTER, p.BASELINE);
      }
      
      // Calculate text position based on alignment and padding
      let startY, centerX;
      
      if (position.includes('top')) {
        startY = paddingTop + lineAdv;
      } else if (position.includes('bottom')) {
        startY = p.height - paddingBottom - (totalH - lineAdv);
      } else {
        // Center vertically
        startY = paddingTop + (usableH - totalH) / 2 + lineAdv;
      }
      
      if (position.includes('left')) {
        centerX = paddingLeft;
      } else if (position.includes('right')) {
        centerX = p.width - paddingRight;
      } else {
        // Center horizontally
        centerX = paddingLeft + usableW / 2;
      }

      // Draw comprehensive padding overlay
      if (!ctx.hideOverlays && (performance.now() < showPaddingOverlayUntilMs || performance.now() < globalShowPaddingOverlayUntilMs)) {
        showPaddingOverlay(p, ctx);
      }

      // Draw text
      p.fill(ctx.typeColor); p.noStroke();
      const lineBoxes = [];
      for (let li = 0; li < lines.length; li++) {
        const s = lines[li];
        const y = startY + li * lineAdv;
        const tw = Math.max(1, p.textWidth(s));
        let sx = 1, drawW = tw;
        if (params.fitToWidth && tw > usableW) { sx = usableW / tw; drawW = usableW; }
        p.push(); p.translate(centerX, y); if (sx !== 1) p.scale(sx, 1); p.text(s, 0, 0); p.pop();
        lineBoxes.push({ y, sx, s, width: drawW, tw, asc, des, xh: xhMeasured });
      }

      // Guides and dimensions
      p.push();
      p.stroke(techC); p.strokeWeight(sw); p.noFill();
      const applyDash = () => { if (dashed) p.drawingContext.setLineDash([6, 6]); else p.drawingContext.setLineDash([]); };
      const clearDash = () => { p.drawingContext.setLineDash([]); };
      p.textAlign(p.LEFT, p.BOTTOM); p.fill(techC); p.noStroke(); p.textSize(labelSize);
      const label = (x, y, t, align = 'left') => { 
        p.push(); 
        p.noStroke(); 
        p.fill(techC); 
        if (align === 'right') {
          p.textAlign(p.RIGHT, p.BOTTOM); 
          p.translate(x, y); 
          p.text(t, -4, -2); 
        } else {
          p.textAlign(p.LEFT, p.BOTTOM); 
          p.translate(x, y); 
          p.text(t, 4, -2); 
        }
        p.pop(); 
      };

      for (const lb of lineBoxes) {
        const y = lb.y;
        const half = lb.width / 2;
        
        // Calculate actual text bounds based on alignment
        let left, right;
        if (position.includes('left')) {
          left = centerX;
          right = centerX + lb.width;
        } else if (position.includes('right')) {
          left = centerX - lb.width;
          right = centerX;
        } else {
          // Center alignment
          left = centerX - half;
          right = centerX + half;
        }
        // Calculate smart label position based on alignment to prevent cut-off
        let labelX;
        const labelPadding = 20; // Space between text and labels
        
        if (position.includes('left')) {
          // For left alignment, put labels to the right of the text
          labelX = right + labelPadding;
        } else if (position.includes('right')) {
          // For right alignment, put labels to the left of the text
          labelX = left - labelPadding;
        } else {
          // For center alignment, put labels to the right
          labelX = right + labelPadding;
        }
        
        // Ensure labels don't go off-screen
        labelX = Math.max(10, Math.min(p.width - 10, labelX));
        
        // Determine label alignment based on position
        const labelAlign = position.includes('right') ? 'right' : 'left';
        
        if (params.showBaseline) { 
          p.stroke(techC); p.noFill(); p.strokeWeight(sw); applyDash(); p.line(left, y, right, y); clearDash(); 
          
          // Special positioning for baseline label to prevent wrapping and ensure visibility
          let baselineLabelX, baselineLabelAlign;
          if (position.includes('left')) {
            // For left alignment, put baseline label to the right with more padding
            baselineLabelX = right + 30;
            baselineLabelAlign = 'left';
          } else if (position.includes('right')) {
            // For right alignment, put baseline label to the left with more padding
            baselineLabelX = left - 30;
            baselineLabelAlign = 'right';
          } else {
            // For center alignment, use standard positioning
            baselineLabelX = labelX;
            baselineLabelAlign = labelAlign;
          }
          
          // Ensure baseline label doesn't go off-screen
          baselineLabelX = Math.max(10, Math.min(p.width - 10, baselineLabelX));
          
          label(baselineLabelX, y, `baseline`, baselineLabelAlign); 
        }
        if (params.showAscDesc) {
          p.stroke(techC); p.strokeWeight(sw); applyDash();
          p.line(left, y - lb.asc, right, y - lb.asc);
          p.line(left, y + lb.des, right, y + lb.des); clearDash();
          label(labelX, y - lb.asc, `asc ${formatNum(lb.asc, prec)}px`, labelAlign);
          label(labelX, y + lb.des, `desc ${formatNum(lb.des, prec)}px`, labelAlign);
        }
        if (params.showXHeight) { const xh = lb.xh; p.stroke(techC); p.strokeWeight(sw); applyDash(); p.line(left, y - xh, right, y - xh); clearDash(); label(labelX, y - xh, `x ${formatNum(xh, prec)}px`, labelAlign); }
        if (params.showBounds) { p.stroke(techC); p.strokeWeight(sw); applyDash(); p.rect(left, y - lb.asc, lb.width, lb.asc + lb.des); clearDash(); }
        if (params.showDimensions) {
          // Calculate safe spacing to avoid overlap with other labels
          const descenderY = y + lb.des;
          const minSpacing = 20; // Minimum spacing between labels
          const yA = Math.min(y - lb.asc - 14, descenderY - minSpacing);
          
          p.stroke(techC); p.strokeWeight(sw); clearDash(); p.line(left, yA, right, yA); p.line(left, yA - 4, left, yA + 4); p.line(right, yA - 4, right, yA + 4);
          p.noStroke(); p.fill(techC); p.textSize(labelSize); const wStr = `${formatNum(lb.width, prec)} px`; p.textAlign(p.CENTER, p.BOTTOM); p.text(wStr, (left + right) / 2, yA - 8);
          // Adjust height label positioning based on alignment to avoid overlap
          let xA, heightLabelX;
          if (position.includes('right')) {
            // For right alignment, put height label further left to avoid descender overlap
            xA = left - 30;
            heightLabelX = xA - 6;
          } else {
            // For left and center alignment, use standard positioning
            xA = left - 14;
            heightLabelX = xA - 6;
          }
          
          p.stroke(techC); p.line(xA, y - lb.asc, xA, y + lb.des); p.line(xA - 4, y - lb.asc, xA + 4, y - lb.asc); p.line(xA - 4, y + lb.des, xA + 4, y + lb.des);
          p.noStroke(); p.textAlign(p.RIGHT, p.CENTER); p.text(`${formatNum(lb.asc + lb.des, prec)} px`, heightLabelX, y);
        }
      }
      p.pop();

      if (params.showHUD) {
        const mouseIn = p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
        if (mouseIn) {
          p.push(); p.stroke(techC); p.strokeWeight(sw * 0.75); p.noFill(); p.drawingContext.setLineDash([2, 4]);
          p.line(0, p.mouseY, p.width, p.mouseY); p.line(p.mouseX, 0, p.mouseX, p.height); p.drawingContext.setLineDash([]);
          p.noStroke(); p.fill(techC); p.textSize(labelSize);
          p.textAlign(p.LEFT, p.TOP); p.text(`x ${formatNum(p.mouseX, prec)}  y ${formatNum(p.mouseY, prec)}`, p.mouseX + 8, p.mouseY + 8);
          p.pop();
        }
      }
    },

    onResize(p) {},
  };
}

function showPaddingOverlay(p, ctx) {
  const paddingTop = ctx.paddingTop || 20;
  const paddingBottom = ctx.paddingBottom || 20;
  const paddingLeft = ctx.paddingLeft || 20;
  const paddingRight = ctx.paddingRight || 20;
  
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
  
  // Draw all four boundary lines
  p.line(x1, y1, x2, y1); // top
  p.line(x1, y2, x2, y2); // bottom
  p.line(x1, y1, x1, y2); // left
  p.line(x2, y1, x2, y2); // right
  
  // Restore previous line style
  ctx2d.setLineDash(prevDash);
  ctx2d.lineCap = prevCap;
  p.pop();
} 