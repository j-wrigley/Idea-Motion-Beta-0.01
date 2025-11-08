export function createWavyImagesExperiment() {
  return {
    name: 'Wavy Images',
    description: 'Apply wavy distortion effects to images',
    
    params: {
      amplitude: 20,          // pixel offset magnitude
      frequency: 1.0,         // oscillations per second
      speed: 1.0,
      direction: 'horizontal', // 'horizontal', 'vertical', 'both'
      intensity: 1.0,
      offset: 0,              // base phase (radians)
      scale: 1.0,             // image scale
      spacingPx: 40,          // spacing between multiple images
      layout: 'vertical'      // 'vertical' | 'horizontal'
    },
    
    draw(p, ctx) {
      console.log('Wavy Images draw called, ctx.images:', ctx.images);
      
      if (!ctx.images || ctx.images.length === 0) {
        // Show placeholder when no images
        p.fill(200);
        p.noStroke();
        p.rectMode(p.CENTER);
        p.rect(p.width/2, p.height/2, 200, 100);
        
        p.fill(100);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('Upload images to see wavy effect', p.width/2, p.height/2);
        return;
      }
      
      // Apply wavy effect to each image
      const total = ctx.images.length;
      ctx.images.forEach((imageData, index) => {
        if (!imageData.p5Image) {
          console.log('No p5Image for image:', imageData.name);
          return;
        }
        
        const img = imageData.p5Image;
        const time = ctx.timeSeconds * this.params.speed;
        
        // Calculate wave parameters
        const amplitude = this.params.amplitude * this.params.intensity;
        const frequency = this.params.frequency; // cycles per second
        const phase = this.params.offset + (index * 0.5);
        const scale = Math.max(0.05, this.params.scale);
        const spacing = Math.max(0, this.params.spacingPx);
        
        // Base center position with layout spacing
        const centerX = p.width / 2;
        const centerY = p.height / 2;
        let drawX = centerX;
        let drawY = centerY;
        const spreadIndex = index - (total - 1) / 2; // symmetric spread
        // For vertical wave direction, arrange images next to each other horizontally
        // (even if layout was left at default), per UX request
        const layoutUsed = (this.params.direction === 'vertical') ? 'horizontal' : this.params.layout;
        if (layoutUsed === 'horizontal') {
          drawX += spreadIndex * spacing;
        } else {
          // default vertical
          drawY += spreadIndex * spacing;
        }
        
        // Compute wave offsets
        let dx = 0, dy = 0;
        const angle = (time * frequency * p.TWO_PI) + phase;
        if (this.params.direction === 'horizontal' || this.params.direction === 'both') {
          dx += Math.sin(angle) * amplitude;
        }
        if (this.params.direction === 'vertical' || this.params.direction === 'both') {
          dy += Math.sin(angle) * amplitude;
        }
        
        // Draw wavy distorted image
        p.push();
        p.imageMode(p.CENTER);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        p.image(img, drawX + dx, drawY + dy, drawW, drawH);
        p.pop();
      });
    },
    
    getParams() {
      return this.params;
    },
    
    setParams(newParams) {
      Object.assign(this.params, newParams);
    }
  };
}
