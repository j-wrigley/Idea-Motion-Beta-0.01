// Wavy Text experiment: animates characters along a wave with mouse interaction
// - Horizontal position per character
// - Vertical offset via sine wave animated by time
// - Interaction: mouseX controls frequency, mouseY controls amplitude (toggleable)

// Global variable to persist overlay timer across reinitializations
let globalShowPaddingOverlayUntilMs = 0;

export function createWavyTextExperiment() {
  const params = {
    // Base text and layout
    baseTextSizeRatio: 0.22, // proportion of min(width,height)
    lineHeight: 1.2, // line spacing multiplier
    paddingRatio: 0.08,

    // Wave when not using mouse (or as base values)
    amplitudeRatio: 0.22, // proportion of height
    frequency: 2.0, // waves across text
    speed: 1.0, // time multiplier
    
    // Text spread control
    textSpread: 1.0, // 0.0 = tightly packed, 1.0 = full width spread
    
    // Wave customization
    waveOffset: 0.0, // Phase offset for the wave (0-2π)
    waveIntensity: 1.0, // Intensity multiplier for wave effect
    
    // Animation control
    animationPaused: false, // Pause/play the wave animation
  };


  return {
    name: "Wavy Text",

    getControlDefinitions() {
      return [
        { id: "baseTextSizeRatio", type: "range", label: "Text size", min: 0.12, max: 0.5, step: 0.01, default: 0.22 },
        { id: "lineHeight", type: "range", label: "Line height", min: 0.8, max: 2.0, step: 0.05, default: 1.2 },
        { id: "paddingRatio", type: "range", label: "Side padding", min: 0.0, max: 0.2, step: 0.005, default: 0.08 },

        { id: "amplitudeRatio", type: "range", label: "Amplitude", min: 0.0, max: 0.5, step: 0.005, default: 0.22 },
        { id: "frequency", type: "range", label: "Frequency", min: 0.1, max: 12.0, step: 0.1, default: 2.0 },
        { id: "speed", type: "range", label: "Speed", min: 0.0, max: 4.0, step: 0.05, default: 1.0 },
        { id: "textSpread", type: "range", label: "Text spread", min: 0.0, max: 1.0, step: 0.05, default: 1.0 },
        
        { id: "waveOffset", type: "range", label: "Wave offset", min: 0.0, max: 6.28, step: 0.1, default: 0.0 },
        { id: "waveIntensity", type: "range", label: "Wave intensity", min: 0.0, max: 2.0, step: 0.05, default: 1.0 },
        { id: "animationPaused", type: "checkbox", label: "Animation", default: false },
      ];
    },

    getParams() {
      return { ...params };
    },

    setParams(next) {
      const wasPaddingChanged = next.paddingRatio !== undefined && next.paddingRatio !== params.paddingRatio;
      Object.assign(params, next);
      if (wasPaddingChanged) {
        // show overlay for ~600ms after last change
        globalShowPaddingOverlayUntilMs = performance.now() + 600;
      }
    },

    showPaddingOverlay() {
      // Show overlay for ~600ms when global side padding changes
      console.log('Wavy Text: Setting padding overlay timer');
      globalShowPaddingOverlayUntilMs = performance.now() + 600;
    },

    init(p, ctx) {
      try {
        p.noStroke();
      } catch (error) {
        console.warn('WavyText init failed:', error);
      }
    },

    draw(p, ctx) {
      // Use canvas font size if provided, otherwise derive from canvas
      const baseTextSize = ctx.fontSize || Math.max(16, Math.min(p.width, p.height) * params.baseTextSizeRatio);
      p.textSize(baseTextSize);
      
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

      const textRaw = ctx.text && ctx.text.length > 0 ? ctx.text : "TYPE";
      const lines = textRaw.split(/\r?\n/);

      // Base wave
      const ampMax = p.height * params.amplitudeRatio;
      const freqMin = 0.1;
      const freqMax = 12.0;

      let frequency = params.frequency;
      let amplitude = ampMax * params.waveIntensity;
      // No default mouse effect; only apply if explicitly bound via generic system

      const time = params.animationPaused ? 0 : (p.millis() / 1000) * params.speed;

      // Layout with comprehensive padding
      const paddingTop = ctx.paddingTop !== undefined ? ctx.paddingTop : 20;
      const paddingBottom = ctx.paddingBottom !== undefined ? ctx.paddingBottom : 20;
      const paddingLeft = ctx.paddingLeft !== undefined ? ctx.paddingLeft : 20;
      const paddingRight = ctx.paddingRight !== undefined ? ctx.paddingRight : 20;
      
      const usableW = Math.max(0, p.width - paddingLeft - paddingRight);
      const usableH = Math.max(0, p.height - paddingTop - paddingBottom);
      const lineAdvance = baseTextSize * (ctx.lineHeight || params.lineHeight);
      const totalHeight = lineAdvance * lines.length;
      
      // Calculate actual canvas positioning with proper padding
      let startY, textX;
      
      // Calculate Y position based on vertical alignment
      if (position.includes('top')) {
        startY = paddingTop + lineAdvance / 2;
      } else if (position.includes('bottom')) {
        startY = p.height - paddingBottom - (totalHeight - lineAdvance / 2);
      } else {
        // Center within the usable height (accounting for padding)
        const usableCenterY = paddingTop + usableH / 2;
        startY = usableCenterY + lineAdvance / 2;
      }
      
      // Calculate X position based on horizontal alignment
      if (position.includes('left')) {
        textX = paddingLeft;
      } else if (position.includes('right')) {
        textX = p.width - paddingRight;
      } else {
        // Center within the usable width (accounting for padding)
        textX = paddingLeft + usableW / 2;
      }

      // Transient padding overlay (comprehensive)
      const currentTime = performance.now();
      if (currentTime < globalShowPaddingOverlayUntilMs) {
        console.log('Wavy Text: Drawing padding overlay, time remaining:', globalShowPaddingOverlayUntilMs - currentTime);
        
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

      for (let li = 0; li < lines.length; li++) {
        const txt = lines[li];
        const letters = [...txt];
        const n = letters.length;
        const baseY = startY + li * lineAdvance;

        for (let i = 0; i < n; i++) {
          const ch = letters[i];
          const t = n <= 1 ? 0.5 : i / (n - 1);

          // Calculate character positioning based on text position
          const chWidth = p.textWidth(ch);
          const half = chWidth * 0.5;
          
          // Calculate X position based on text alignment and positioning
          let x;
          if (position.includes('left')) {
            // Left alignment: start from left edge
            const leftEdge = textX;
            const rightEdge = textX + usableW * params.textSpread;
            x = p.lerp(leftEdge, rightEdge, t);
          } else if (position.includes('right')) {
            // Right alignment: start from right edge
            const rightEdge = textX;
            const leftEdge = textX - usableW * params.textSpread;
            x = p.lerp(leftEdge, rightEdge, t);
          } else {
            // Center alignment: spread from center
            const centerX = textX;
            const spreadWidth = usableW * params.textSpread;
            const leftEdge = centerX - spreadWidth / 2;
            const rightEdge = centerX + spreadWidth / 2;
            x = p.lerp(leftEdge, rightEdge, t);
          }

          const phase = i * (Math.PI * frequency / Math.max(1, n - 1)) + params.waveOffset;
          const y = baseY + Math.sin(time * frequency + phase) * amplitude;
          
          p.text(ch, x, y);
        }
      }
    },

    mousePressed(p) {
      // Optional tap to briefly increase speed
      const original = params.speed;
      params.speed = Math.min(4.0, original * 1.5);
      setTimeout(() => (params.speed = original), 300);
    },

    onResize(p) {
      // Sizes are derived per frame
    },
  };
} 