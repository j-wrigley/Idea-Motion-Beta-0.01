/**
 * Professional Canvas/Artboard Management System
 * Inspired by Figma's artboard system - clean, reliable, and performant
 */

class CanvasManager {
  constructor() {
    this.canvases = new Map();
    this.activeCanvasId = null;
    this.workspace = null;
    this.nextCanvasId = 1;
    this.initialized = false;
  }

  init(workspace, experimentsRegistry, imageEffectsRegistry) {
    this.workspace = workspace;
    this.experimentsRegistry = experimentsRegistry;
    this.imageEffectsRegistry = imageEffectsRegistry;
    this.initialized = true;
    
    // Set up workspace event handlers
    this.setupWorkspaceEvents();
    
    console.log('Canvas Manager initialized');
  }

  /**
   * Create a new canvas artboard
   */
  createCanvas(options = {}) {
    if (!this.initialized) {
      throw new Error('Canvas Manager not initialized');
    }

    const canvas = {
      id: `canvas-${this.nextCanvasId++}`,
      name: options.name || `Canvas ${this.nextCanvasId - 1}`,
      size: {
        width: options.width || 2560,
        height: options.height || 1440
      },
      position: {
        x: options.x || 0,
        y: options.y || 0
      },
      // Text properties
      text: options.text || 'TYPE',
      fontSize: options.fontSize || 120,
      fontWeight: options.fontWeight || 400,
      lineHeight: options.lineHeight || 1.2,
      typeColor: options.typeColor || '#000000',
      textPosition: options.textPosition || 'center-center',
      paddingTop: options.paddingTop || 40,
      paddingBottom: options.paddingBottom || 40,
      paddingLeft: options.paddingLeft || 40,
      paddingRight: options.paddingRight || 40,
      // Effect properties
      selectedExperimentId: options.experimentId || (this.experimentsRegistry[0]?.id || null),
      currentExperiment: null,
      // Background color
      backgroundColor: options.backgroundColor || '#ffffff',
      // Image properties
      images: options.images || [],
      imageLayering: options.imageLayering || 'behind',
      imageOpacity: options.imageOpacity || 1.0,
      imageScale: options.imageScale || 1.0,
      currentImageEffect: null,
      selectedImageEffectId: options.selectedImageEffectId || 'none',
      // State
      isPointerOverCanvas: false,
      p5Instance: null,
      artboardElement: null,
      canvasElement: null,
      needsRedraw: true
    };

    // Store canvas
    this.canvases.set(canvas.id, canvas);

    // Create the visual artboard
    this.createArtboard(canvas);

    // Set as active if it's the first canvas
    if (this.canvases.size === 1) {
      this.setActiveCanvas(canvas.id);
    }

    // Update layers panel via custom event
    document.dispatchEvent(new CustomEvent('canvas:layersUpdate', {
      detail: { canvasId: canvas.id, action: 'created' }
    }));

    console.log('Canvas created:', canvas.id);
    return canvas;
  }

  /**
   * Create the visual artboard for a canvas
   */
  createArtboard(canvas) {
    // Calculate position for new artboard
    this.calculateArtboardPosition(canvas);

    // Create artboard DOM structure
    const artboard = document.createElement('div');
    artboard.className = 'canvas-artboard';
    artboard.id = `artboard-${canvas.id}`;
    artboard.style.cssText = `
      position: absolute;
      transform: translate(${canvas.position.x}px, ${canvas.position.y}px);
      width: ${canvas.size.width}px;
      height: ${canvas.size.height}px;
      will-change: transform;
    `;

    // Create title bar with aspect ratio controls
    const titleBar = document.createElement('div');
    titleBar.className = 'canvas-title-bar';
    
    // Title text (editable)
    const titleText = document.createElement('input');
    titleText.className = 'canvas-title-text';
    titleText.type = 'text';
    titleText.value = canvas.name;
    
    // Aspect ratio controls
    const ratioControls = document.createElement('div');
    ratioControls.className = 'canvas-ratio-controls';
    
    const ratioSelect = document.createElement('select');
    ratioSelect.className = 'canvas-ratio-select';
    ratioSelect.innerHTML = `
      <option value="1:1">1:1 · Square (Instagram Feed)</option>
      <option value="4:5">4:5 · Portrait (Instagram Feed)</option>
      <option value="9:16">9:16 · Story/Reel/TikTok</option>
      <option value="16:9">16:9 · YouTube/Presentation</option>
      <option value="4:3">4:3 · Presentation (Classic)</option>
      <option value="3:2">3:2 · Photo</option>
      <option value="2:3">2:3 · Portrait Photo</option>
      <option value="5:4">5:4 · Classic</option>
      <option value="21:9">21:9 · Ultrawide</option>
      <option value="custom">Custom</option>
    `;
    
    // Set current ratio based on canvas size
    const currentRatio = this.getAspectRatio(canvas.size.width, canvas.size.height);
    ratioSelect.value = currentRatio;
    
    ratioControls.appendChild(ratioSelect);
    
    // Background color picker (small circle)
    const colorWrap = document.createElement('div');
    colorWrap.className = 'canvas-color-picker';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'canvas-color-input';
    colorInput.value = canvas.backgroundColor || '#ffffff';
    colorWrap.appendChild(colorInput);
    ratioControls.appendChild(colorWrap);
    
    // Assemble title bar
    titleBar.appendChild(titleText);
    titleBar.appendChild(ratioControls);

    // Create canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-content';

    // Assemble artboard
    artboard.appendChild(titleBar);
    artboard.appendChild(canvasContainer);
    this.workspace.appendChild(artboard);

    // Store references
    canvas.artboardElement = artboard;
    
    // Add ratio change event listener
    ratioSelect.addEventListener('change', (e) => {
      this.changeCanvasRatio(canvas.id, e.target.value);
    });
    
    // Ensure clicks on the select work properly
    ratioSelect.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // Color input events
    colorInput.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    colorInput.addEventListener('input', (e) => {
      canvas.backgroundColor = e.target.value || '#ffffff';
      canvas.needsRedraw = true;
      try { canvas.p5Instance?.loop(); } catch {}
    });

    // Add title editing event handlers
    titleText.addEventListener('blur', (e) => {
      const newName = e.target.value.trim();
      if (newName && newName !== canvas.name) {
        canvas.name = newName;
        // Update layers panel
        document.dispatchEvent(new CustomEvent('canvas:layersUpdate', {
          detail: { canvasId: canvas.id, action: 'renamed' }
        }));
      }
    });

    titleText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.target.blur(); // Save on Enter
      } else if (e.key === 'Escape') {
        e.target.value = canvas.name; // Cancel on Escape
        e.target.blur();
      }
      e.stopPropagation(); // Prevent artboard drag
    });

    titleText.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent artboard selection
    });
    
    ratioSelect.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    
    console.log('Artboard created and added to workspace:', artboard.id);
    console.log('Artboard position:', { x: canvas.position.x, y: canvas.position.y });
    console.log('Workspace element:', this.workspace);

    // Create p5.js instance
    this.createP5Instance(canvas, canvasContainer);

    // Set up artboard event handlers
    this.setupArtboardEvents(canvas, artboard, titleBar);
  }

  /**
   * Create p5.js instance for canvas
   */
  createP5Instance(canvas, container) {
    const sketch = (p) => {
      p.setup = () => {
        // Create canvas element
        const canvasElement = p.createCanvas(canvas.size.width, canvas.size.height);
        canvasElement.parent(container);
        
        // Configure canvas for ultra high quality
        p.pixelDensity(4); // Ultra high quality for professional output
        p.frameRate(60);   // Smooth animations for recording

        // Store canvas element reference
        canvas.canvasElement = canvasElement.canvas;

        // Initialize text experiment and image effect independently
        this.initializeExperiment(canvas, p);
        this.initializeImageEffect(canvas, p);

        // Stop draw loop for new canvases unless they're active
        if (this.activeCanvasId !== canvas.id) {
          try { p.noLoop(); } catch {}
        }

        console.log('p5.js setup complete for:', canvas.id);
      };

      p.draw = () => {
        // Only draw if this canvas is active
        if (this.activeCanvasId !== canvas.id) {
          return;
        }

        // Apply cursor bindings before creating the context (so params affect draw)
        const binding = (window.applyMouseBindingsForCanvas ? window.applyMouseBindingsForCanvas(p, canvas) : { active: false, boundIds: new Set() });

        const ctx = this.createRenderingContext(canvas, p);
        // Augment context with binding info for overlays/HUD
        ctx.mouseBindingsActive = binding.active;
        ctx.boundIds = binding.boundIds;

        // Clear background
        p.background(ctx.backgroundColor);

        // Draw background images
        if (canvas.imageLayering === 'behind' && canvas.currentImageEffect?.draw) {
          canvas.currentImageEffect.draw(p, ctx);
        }

        // Draw main experiment
        if (canvas.currentExperiment?.draw) {
          canvas.currentExperiment.draw(p, ctx);
        }

        // Draw foreground images
        if (canvas.imageLayering === 'infront' && canvas.currentImageEffect?.draw) {
          canvas.currentImageEffect.draw(p, ctx);
        }

        // Toggle flag for compatibility; loop remains active
        canvas.needsRedraw = false;
      };

      // Handle mouse events with performance optimization
      let renderContext = null;
      
      p.mousePressed = () => {
        let did = false;
        if (!renderContext) renderContext = this.createRenderingContext(canvas, p);
        if (canvas.currentExperiment?.mousePressed) { canvas.currentExperiment.mousePressed(p, renderContext); did = true; }
        if (canvas.currentImageEffect?.mousePressed) { canvas.currentImageEffect.mousePressed(p, renderContext); did = true; }
        if (did) { canvas.needsRedraw = true; try { p.loop(); } catch {} }
        renderContext = null; // Clear cache
      };

      p.mouseMoved = () => {
        let did = false;
        if (!renderContext) renderContext = this.createRenderingContext(canvas, p);
        if (canvas.currentExperiment?.mouseMoved) { canvas.currentExperiment.mouseMoved(p, renderContext); did = true; }
        if (canvas.currentImageEffect?.mouseMoved) { canvas.currentImageEffect.mouseMoved(p, renderContext); did = true; }
        if (did) { canvas.needsRedraw = true; try { p.loop(); } catch {} }
        renderContext = null; // Clear cache
      };

      p.mouseDragged = () => {
        let did = false;
        if (!renderContext) renderContext = this.createRenderingContext(canvas, p);
        if (canvas.currentExperiment?.mouseDragged) { canvas.currentExperiment.mouseDragged(p, renderContext); did = true; }
        if (canvas.currentImageEffect?.mouseDragged) { canvas.currentImageEffect.mouseDragged(p, renderContext); did = true; }
        if (did) { canvas.needsRedraw = true; try { p.loop(); } catch {} }
        renderContext = null; // Clear cache
      };

      p.mouseReleased = () => {
        let did = false;
        if (!renderContext) renderContext = this.createRenderingContext(canvas, p);
        if (canvas.currentExperiment?.mouseReleased) { canvas.currentExperiment.mouseReleased(p, renderContext); did = true; }
        if (canvas.currentImageEffect?.mouseReleased) { canvas.currentImageEffect.mouseReleased(p, renderContext); did = true; }
        if (did) { canvas.needsRedraw = true; try { p.loop(); } catch {} }
        renderContext = null; // Clear cache
      };

      p.keyPressed = () => {
        if (canvas.currentExperiment?.keyPressed) {
          canvas.currentExperiment.keyPressed(p, this.createRenderingContext(canvas, p));
          canvas.needsRedraw = true;
        }
      };
    };

    // Create p5 instance
    canvas.p5Instance = new p5(sketch);
  }

  // (class continues with more methods below)
  
  /**
   * Create rendering context for experiments
   */
  createRenderingContext(canvas, p) {
    return {
      backgroundColor: canvas.backgroundColor,
      typeColor: canvas.typeColor,
      imageColor: canvas.imageColor || '#000000',
      text: canvas.text,
      fontSize: canvas.fontSize,
      fontWeight: canvas.fontWeight,
      lineHeight: canvas.lineHeight,
      sidePadding: canvas.sidePadding || 40,
      paddingTop: canvas.paddingTop,
      paddingBottom: canvas.paddingBottom,
      paddingLeft: canvas.paddingLeft,
      paddingRight: canvas.paddingRight,
      textPosition: canvas.textPosition,
      width: p.width,
      height: p.height,
      timeSeconds: p.millis() / 1000,
      isPointerOverCanvas: canvas.isPointerOverCanvas,
      mouseBindingsActive: false,
      boundIds: new Set(),
      hideOverlays: window.state?.isRecording || false,
      font: window.state?.uploadedFont || window.state?.fontFamily,
      images: canvas.images,
      imageLayering: canvas.imageLayering,
      imageOpacity: canvas.imageOpacity,
      imageScale: canvas.imageScale
    };
  }

  /**
   * Initialize experiment for canvas
   */
  initializeExperiment(canvas, p) {
    if (!canvas.selectedExperimentId) return;

    // Only text experiments here (keep image effects separate)
    const experimentDef = this.experimentsRegistry?.find(e => e.id === canvas.selectedExperimentId);
    if (!experimentDef) return;

    try {
      canvas.currentExperiment = experimentDef.factory();
      if (canvas.currentExperiment.init) {
        canvas.currentExperiment.init(p, this.createRenderingContext(canvas, p));
      }
      canvas.needsRedraw = true;
      console.log('Experiment initialized:', experimentDef.name, 'for canvas:', canvas.id);
    } catch (error) {
      console.error('Failed to initialize experiment:', error);
    }
  }

  initializeImageEffect(canvas, p) {
    const effectId = canvas.selectedImageEffectId;
    if (!effectId || effectId === 'none') {
      canvas.currentImageEffect = null;
      return;
    }
    const effectDef = this.imageEffectsRegistry?.find(e => e.id === effectId);
    if (!effectDef) {
      canvas.currentImageEffect = null;
      return;
    }
    try {
      canvas.currentImageEffect = effectDef.factory();
      if (canvas.currentImageEffect.init) {
        canvas.currentImageEffect.init(p, this.createRenderingContext(canvas, p));
      }
      canvas.needsRedraw = true;
      console.log('Image effect initialized:', effectDef.name, 'for canvas:', canvas.id);
    } catch (error) {
      console.error('Failed to initialize image effect:', error);
    }
  }

  /**
   * Set active canvas
   */
  setActiveCanvas(canvasId) {
    const canvas = this.canvases.get(canvasId);
    if (!canvas) return;

    // Update active state
    const previousActiveId = this.activeCanvasId;
    this.activeCanvasId = canvasId;

    // Update visual states
    this.canvases.forEach((c, id) => {
      if (c.artboardElement) {
        c.artboardElement.classList.toggle('active', id === canvasId);
        c.artboardElement.style.borderColor = id === canvasId ? '#007AFF' : '#ddd';
        c.artboardElement.style.boxShadow = id === canvasId ? 
          '0 4px 20px rgba(0,122,255,0.3)' : 
          '0 4px 12px rgba(0,0,0,0.1)';
      }
    });

    // Start/stop draw loops based on active state
    this.canvases.forEach((c, id) => {
      if (c.p5Instance) {
        if (id === canvasId) {
          // Start draw loop for active canvas
          try { c.p5Instance.loop(); } catch {}
          c.needsRedraw = true;
        } else {
          // Stop draw loop for inactive canvases
          try { c.p5Instance.noLoop(); } catch {}
        }
      }
    });

    // Update layers panel via custom event
    document.dispatchEvent(new CustomEvent('canvas:layersUpdate', {
      detail: { canvasId, action: 'activated' }
    }));

    // Dispatch event for UI updates
    this.dispatchCanvasEvent('activeCanvasChanged', { 
      canvasId, 
      canvas, 
      previousActiveId 
    });

    console.log('Active canvas set:', canvasId);
  }

  /**
   * Switch experiment for a canvas
   */
  switchExperiment(canvasId, experimentId) {
    const canvas = this.canvases.get(canvasId);
    if (!canvas) return;

    // Decide whether this is a text experiment or an image effect
    const isText = this.experimentsRegistry?.some(e => e.id === experimentId);
    const isImage = this.imageEffectsRegistry?.some(e => e.id === experimentId);

    if (isText) {
      canvas.selectedExperimentId = experimentId;
      // Re-init text experiment
      if (canvas.p5Instance) {
        this.initializeExperiment(canvas, canvas.p5Instance);
      }
    } else if (isImage) {
      canvas.selectedImageEffectId = experimentId;
      // Re-init image effect
      if (canvas.p5Instance) {
        this.initializeImageEffect(canvas, canvas.p5Instance);
      }
    } else {
      console.warn('Unknown experiment/effect id:', experimentId);
      return;
    }
    
    // Only start loop if this canvas is active
    if (this.activeCanvasId === canvasId) {
      try { canvas.p5Instance?.loop(); } catch {}
    } else {
      try { canvas.p5Instance?.noLoop(); } catch {}
    }

    console.log('Experiment switched:', experimentId, 'for canvas:', canvasId);
  }

  /**
   * Update canvas properties
   */
  updateCanvas(canvasId, properties) {
    const canvas = this.canvases.get(canvasId);
    if (!canvas) return;

    // Update properties
    Object.assign(canvas, properties);

    // Trigger redraw
    canvas.needsRedraw = true;
    try { canvas.p5Instance?.loop(); } catch {}

    console.log('Canvas updated:', canvasId, properties);
  }

  /**
   * Delete canvas
   */
  deleteCanvas(canvasId) {
    const canvas = this.canvases.get(canvasId);
    if (!canvas) return;

    // Clean up p5 instance
    if (canvas.p5Instance) {
      canvas.p5Instance.remove();
    }

    // Remove artboard
    if (canvas.artboardElement) {
      canvas.artboardElement.remove();
    }

    // Remove from collection
    this.canvases.delete(canvasId);

    // Set new active canvas if we deleted the active one
    if (this.activeCanvasId === canvasId && this.canvases.size > 0) {
      const nextCanvas = this.canvases.values().next().value;
      this.setActiveCanvas(nextCanvas.id);
    }

    console.log('Canvas deleted:', canvasId);
  }

  /**
   * Get active canvas
   */
  getActiveCanvas() {
    if (!this.activeCanvasId) return null;
    return this.canvases.get(this.activeCanvasId);
  }

  /**
   * Get all canvases
   */
  getAllCanvases() {
    return Array.from(this.canvases.values());
  }

  /**
   * Get aspect ratio string from width and height
   */
  getAspectRatio(width, height) {
    const ratio = width / height;
    
    // Common ratios with tolerance
    const ratios = {
      '1:1': 1.0,
      '16:9': 16/9,
      '4:3': 4/3,
      '9:16': 9/16,
      '4:5': 4/5,
      '5:4': 5/4,
      '3:2': 3/2,
      '2:3': 2/3,
      '21:9': 21/9
    };
    
    for (const [ratioStr, ratioValue] of Object.entries(ratios)) {
      if (Math.abs(ratio - ratioValue) < 0.01) {
        return ratioStr;
      }
    }
    
    return 'custom';
  }

  /**
   * Change canvas aspect ratio
   */
  changeCanvasRatio(canvasId, ratioStr) {
    const canvas = this.canvases.get(canvasId);
    if (!canvas) return;
    
    const baseSize = 800; // Base size for calculations
    let newWidth, newHeight;
    
    if (ratioStr === 'custom') {
      // Keep current size for custom
      newWidth = canvas.size.width;
      newHeight = canvas.size.height;
    } else {
      const [widthRatio, heightRatio] = ratioStr.split(':').map(Number);
      const aspectRatio = widthRatio / heightRatio;
      
      if (aspectRatio > 1) {
        // Landscape
        newWidth = baseSize;
        newHeight = Math.round(baseSize / aspectRatio);
      } else {
        // Portrait
        newHeight = baseSize;
        newWidth = Math.round(baseSize * aspectRatio);
      }
    }
    
    // Animate the resize
    this.animateCanvasResize(canvas, newWidth, newHeight);
  }

  /**
   * Animate canvas resize
   */
  animateCanvasResize(canvas, newWidth, newHeight) {
    const artboard = canvas.artboardElement;
    if (!artboard) return;
    
    const startWidth = canvas.size.width;
    const startHeight = canvas.size.height;
    const duration = 300; // 300ms animation
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentWidth = startWidth + (newWidth - startWidth) * easeProgress;
      const currentHeight = startHeight + (newHeight - startHeight) * easeProgress;
      
      // Update canvas size
      canvas.size.width = Math.round(currentWidth);
      canvas.size.height = Math.round(currentHeight);
      
      // Update artboard size
      artboard.style.width = `${canvas.size.width}px`;
      artboard.style.height = `${canvas.size.height}px`;
      
      // Update p5.js canvas if it exists
      if (canvas.p5Instance && canvas.p5Instance.canvas) {
        canvas.p5Instance.resizeCanvas(canvas.size.width, canvas.size.height);
        canvas.needsRedraw = true;
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete
        canvas.size.width = newWidth;
        canvas.size.height = newHeight;
        
        // Trigger layers panel update
        document.dispatchEvent(new CustomEvent('canvas:layersUpdate', {
          detail: { canvasId: canvas.id, action: 'resized' }
        }));
      }
    };
    
    requestAnimationFrame(animate);
  }

  /**
   * Calculate position for new artboard
   */
  calculateArtboardPosition(canvas) {
    // Position canvases in the current visible area by accounting for workspace transform
    const panX = parseFloat(this.workspace.dataset.panX || 0);
    const panY = parseFloat(this.workspace.dataset.panY || 0);
    const zoomLevel = window.state?.zoomLevel || 1.0;
    
    // Get the container to determine visible area
    const container = document.getElementById('canvas-container');
    if (!container) {
      // Fallback positioning
      canvas.position.x = 100;
      canvas.position.y = 100;
      return;
    }
    
    const containerRect = container.getBoundingClientRect();
    
    // Calculate the center of the currently visible area
    // Account for pan offset and zoom level
    const visibleCenterX = (-panX / zoomLevel) + (containerRect.width / 2 / zoomLevel);
    const visibleCenterY = (-panY / zoomLevel) + (containerRect.height / 2 / zoomLevel);
    
    if (this.canvases.size === 1) {
      // First canvas - place at center of visible area
      canvas.position.x = visibleCenterX - 200; // Offset slightly from center
      canvas.position.y = visibleCenterY - 150;
      console.log('First canvas positioned at center of visible area:', canvas.position, '(pan:', {panX, panY}, 'zoom:', zoomLevel, ')');
    } else {
      // Subsequent canvases - offset from center in a grid pattern
      const offset = 100;
      const index = this.canvases.size - 1;
      const cols = Math.ceil(Math.sqrt(index));
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      canvas.position.x = visibleCenterX - 200 + (col * offset);
      canvas.position.y = visibleCenterY - 150 + (row * offset);
      console.log('Canvas', this.canvases.size, 'positioned in grid at:', canvas.position, '(row:', row, 'col:', col, ')');
    }
  }

  /**
   * Set up workspace-level events
   */
  setupWorkspaceEvents() {
    // Click on empty space deselects all canvases
    this.workspace.addEventListener('click', (e) => {
      if (e.target === this.workspace) {
        // Clicked on empty workspace
        this.canvases.forEach(canvas => {
          if (canvas.artboardElement) {
            canvas.artboardElement.classList.remove('active');
            canvas.artboardElement.style.borderColor = '#ddd';
            canvas.artboardElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          }
        });
        this.activeCanvasId = null;
        this.dispatchCanvasEvent('activeCanvasChanged', { canvasId: null });
      }
    });
  }

  /**
   * Set up artboard-specific events
   */
  setupArtboardEvents(canvas, artboard, titleBar) {
    // Click to activate (but allow ratio controls and title text to work)
    artboard.addEventListener('click', (e) => {
      // Don't stop propagation for ratio controls or title text
      if (e.target.closest('.canvas-ratio-controls') || e.target.classList.contains('canvas-title-text')) {
        return; // Let these elements handle their own events
      }
      e.stopPropagation();
      this.setActiveCanvas(canvas.id);
    });

    // Mouse enter/leave for hover effects
    artboard.addEventListener('mouseenter', () => {
      canvas.isPointerOverCanvas = true;
      canvas.needsRedraw = true;
    });

    artboard.addEventListener('mouseleave', () => {
      canvas.isPointerOverCanvas = false;
      canvas.needsRedraw = true;
    });

    // Drag to move (pan-aware, stable)
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let artboardStart = { x: 0, y: 0 };

    titleBar.addEventListener('mousedown', (e) => {
      // Don't start drag if clicking on ratio controls or title text
      if (e.target.closest('.canvas-ratio-controls') || e.target.classList.contains('canvas-title-text')) {
        return; // Let these elements handle their own events
      }
      
      isDragging = true;
      titleBar.style.cursor = 'grabbing';
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
      artboardStart.x = canvas.position.x;
      artboardStart.y = canvas.position.y;
      e.preventDefault();
    });

    let dragScheduled = false;
    let pendingX = 0, pendingY = 0;
    const flushDrag = () => {
      artboard.style.transform = `translate(${pendingX}px, ${pendingY}px)`;
      canvas.position.x = pendingX;
      canvas.position.y = pendingY;
      dragScheduled = false;
    };

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      // Delta in screen space; convert to logical space by current zoom
      const zoom = (window.state && window.state.zoomLevel) ? window.state.zoomLevel : 1;
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;

      pendingX = artboardStart.x + dx;
      pendingY = artboardStart.y + dy;

      if (!dragScheduled) {
        dragScheduled = true;
        requestAnimationFrame(flushDrag);
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        titleBar.style.cursor = 'grab';
      }
    });
  }

  /**
   * Dispatch custom events
   */
  dispatchCanvasEvent(type, detail) {
    const event = new CustomEvent(`canvas:${type}`, { detail });
    document.dispatchEvent(event);
  }

  /**
   * Force redraw of all canvases
   */
  redrawAll() {
    this.canvases.forEach(canvas => {
      canvas.needsRedraw = true;
    });
  }

  /**
   * Force redraw of specific canvas
   */
  redraw(canvasId) {
    const canvas = this.canvases.get(canvasId);
    if (canvas && canvas.p5Instance) {
      canvas.needsRedraw = true;
      canvas.p5Instance.loop(); // Restart drawing loop
    }
  }
}

// Export singleton instance
window.CanvasManager = new CanvasManager();
