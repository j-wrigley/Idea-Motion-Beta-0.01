export function createHalftoneImagesExperiment() {
  return {
    name: 'Halftone Images',
    description: 'Convert images to halftone dot patterns',
    
    params: {
      dotSize: 10,           // base dot size
      dotSpacing: 16,        // spacing between samples
      contrast: 1.0,         // dot opacity multiplier
      angleDeg: 0,           // pattern rotation in degrees
      pattern: 'dots',       // 'dots' | 'lines' | 'squares'
      invert: false,         // invert foreground/background
      intensity: 1.0,        // global intensity
      scale: 1.0,            // image scale
      // New controls
      fgColor: '#000000',    // foreground (dot) color
      bgColor: '#ffffff',    // background color
      backgroundEnabled: true,
      blendMode: 'normal',   // 'normal' | 'multiply' | 'screen'
      jitterPx: 0,           // random jitter per sample
      offsetXPx: 0,
      offsetYPx: 0,
      lineThickness: 0.3,    // for 'lines' pattern, relative thickness
      sampleChannel: 'luma'  // 'luma' | 'r' | 'g' | 'b'
    },
    
    draw(p, ctx) {
      if (!ctx.images || ctx.images.length === 0) {
        // Show placeholder when no images
        p.fill(200);
        p.noStroke();
        p.rectMode(p.CENTER);
        p.rect(p.width/2, p.height/2, 200, 100);
        
        p.fill(100);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('Upload images to see halftone effect', p.width/2, p.height/2);
        return;
      }
      
      // Apply halftone effect to each image
      ctx.images.forEach((imageData) => {
        if (!imageData.p5Image) return;
        
        const img = imageData.p5Image;
        const scale = Math.max(0.05, this.params.scale);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const angleRad = (this.params.angleDeg || 0) * (Math.PI / 180);

        // Draw halftone pattern
        p.push();
        p.translate(p.width/2 - drawW/2, p.height/2 - drawH/2);
        p.translate(drawW/2, drawH/2);
        p.rotate(angleRad);
        p.translate(-drawW/2, -drawH/2);
        // Background handled by canvas; no fill here
        // Blend mode
        if (this.params.blendMode === 'multiply') p.blendMode(p.MULTIPLY);
        else if (this.params.blendMode === 'screen') p.blendMode(p.SCREEN);
        else p.blendMode(p.BLEND);
        this.drawHalftonePattern(p, img, { ...this.params, drawW, drawH });
        
        p.pop();
      });
    },
    
    drawHalftonePattern(p, img, params) {
      // Ensure pixel data is available for accurate sampling
      try { img.loadPixels(); } catch {}
      const spacing = Math.max(2, params.dotSpacing);
      const baseDot = Math.max(0.2, params.dotSize);
      const dotIntensity = Math.max(0, params.intensity);
      const invert = !!params.invert;
      
      // Sample image and create halftone pattern
      for (let x = 0; x < img.width; x += spacing) {
        for (let y = 0; y < img.height; y += spacing) {
          // Sample brightness at this position
          const brightness = this.sampleBrightness(img, x, y, params.sampleChannel);
          const norm = brightness / 255;
          // Map brightness to dot diameter (darker -> larger)
          const t = invert ? norm : (1 - norm);
          const size = Math.max(0, baseDot * dotIntensity * params.contrast * t);
          
          if (size > 0.05) { // Only draw if visible
            // Apply jitter and offsets
            const jx = params.jitterPx ? (Math.random() * 2 - 1) * params.jitterPx : 0;
            const jy = params.jitterPx ? (Math.random() * 2 - 1) * params.jitterPx : 0;
            
            // Set dot color; respect alpha via fill with opacity
            const col = p.color(params.fgColor);
            p.noStroke();
            p.fill(col);
            
            // Map source coords (image space) into draw space for proper centering/scaling
            const px = (x / img.width) * params.drawW + params.offsetXPx + jx;
            const py = (y / img.height) * params.drawH + params.offsetYPx + jy;

            if (params.pattern === 'dots') {
              p.ellipse(px, py, size, size);
            } else if (params.pattern === 'lines') {
              p.rectMode(p.CENTER);
              p.rect(px, py, Math.max(0.5, size), Math.max(0.5, size * params.lineThickness));
            } else if (params.pattern === 'squares') {
              p.rectMode(p.CENTER);
              p.rect(px, py, size, size);
            }
          }
        }
      }
    },
    
    sampleBrightness(img, x, y, channel = 'luma') {
      const ix = Math.max(0, Math.min(img.width - 1, Math.round(x)));
      const iy = Math.max(0, Math.min(img.height - 1, Math.round(y)));
      const idx = 4 * (iy * img.width + ix);
      const px = img.pixels || [];
      const r = px[idx] ?? 127;
      const g = px[idx + 1] ?? 127;
      const b = px[idx + 2] ?? 127;
      if (channel === 'r') return r;
      if (channel === 'g') return g;
      if (channel === 'b') return b;
      // ITU-R BT.709 luma
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    },
    
    getParams() {
      return this.params;
    },
    
    setParams(newParams) {
      Object.assign(this.params, newParams);
    }
  };
}
