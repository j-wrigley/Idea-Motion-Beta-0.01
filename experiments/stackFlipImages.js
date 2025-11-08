export function createStackFlipImagesExperiment() {
  let params = {
    speed: 1.0,        // flips per second
    scale: 1.0,        // image scale multiplier
    stackDepth: 5,     // max images drawn in stack
    spacingPx: 8,      // vertical spacing between items
    stackAlign: 'center', // 'center' | 'up' | 'down' | 'none'
    fadeCurve: 1.0,    // exponent for fade (1=linear)
    crossfade: true,   // also fade in next image
    fadeEnabled: true  // master toggle for fading
  };

  function getParams() { return params; }
  function setParams(next) {
    params = { ...params, ...next };
    if (window.CanvasManager && window.CanvasManager.getActiveCanvas()) {
      window.CanvasManager.getActiveCanvas().needsRedraw = true;
    }
  }

  function draw(p, ctx) {
    const images = ctx.images || [];
    if (!images.length) {
      p.push();
      p.fill(0);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(16);
      p.text('Upload images to see Stack Flip', p.width / 2, p.height / 2);
      p.pop();
      return;
    }

    const centerX = p.width / 2;
    const centerY = p.height / 2;
    const t = Math.max(0, ctx.timeSeconds) * Math.max(0, params.speed);
    const baseIndex = Math.floor(t) % images.length;
    const progress = t - Math.floor(t); // 0..1 within current flip

    // Top image fade out (alpha 1 → 0), with curve
    const fadeAlpha = params.fadeEnabled
      ? Math.pow(1 - progress, Math.max(0.1, params.fadeCurve))
      : 1.0;

    const stackDepth = Math.max(1, Math.min(images.length, Math.round(params.stackDepth)));
    for (let k = stackDepth - 1; k >= 0; k--) {
      const idx = (baseIndex + k) % images.length;
      const imageData = images[idx];
      const img = imageData?.p5Image;
      if (!img) continue;

      const scale = Math.max(0.05, params.scale);
      const w = img.width * scale;
      const h = img.height * scale;

      // Vertical offset per depth based on alignment
      let offsetY = 0;
      const s = params.spacingPx;
      if (params.stackAlign === 'center') {
        offsetY = (k - (stackDepth - 1) / 2) * s;
      } else if (params.stackAlign === 'up') {
        offsetY = -k * s;
      } else if (params.stackAlign === 'down') {
        offsetY = k * s;
      } else {
        offsetY = 0; // 'none'
      }

      p.push();
      p.imageMode(p.CENTER);
      if (k === 0) {
        // Fading the topmost image
        p.tint(255, Math.max(0, Math.min(255, fadeAlpha * 255)));
      } else if (k === 1 && params.crossfade && params.fadeEnabled) {
        // Fade in the next one
        const inAlpha = Math.max(0, Math.min(255, (1 - fadeAlpha) * 255));
        p.tint(255, inAlpha);
      } else {
        p.tint(255, 255);
      }
      p.image(img, centerX, centerY + offsetY, w, h);
      p.pop();
    }
    // Clear tint state (defensive)
    p.noTint?.();
  }

  return {
    id: 'stackFlipImages',
    name: 'Stack Flip Images',
    draw,
    getParams,
    setParams
  };
}


