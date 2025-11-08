export class CanvasRecorder {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.chunks = [];
    this.recorder = null;
    this.stream = null;
    this.fileExtension = 'webm';
    this.options = options;
  }

  _pickMimeType() {
    const preferred = (this.options.preferredContainer || '').toLowerCase();
    const mp4Candidates = [
      'video/mp4;codecs=avc1',
      'video/mp4',
    ];
    const webmCandidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];

    const ordered = preferred === 'mp4'
      ? [...mp4Candidates, ...webmCandidates]
      : [...webmCandidates, ...mp4Candidates];

    for (const type of ordered) {
      if (MediaRecorder.isTypeSupported?.(type)) {
        if (type.includes('mp4')) this.fileExtension = 'mp4';
        else this.fileExtension = 'webm';
        return type;
      }
    }
    return undefined;
  }

  start() {
    if (!this.canvas || !this.canvas.captureStream) return false;
    const fps = this.options.fps || 60;
    this.stream = this.canvas.captureStream(fps);

    const mimeType = this._pickMimeType();
    const quality = this.options.quality || 'high';
    const bitrate = quality === 'high' ? 8000000 : quality === 'medium' ? 4000000 : 2000000;
    
    try {
      const options = mimeType ? { 
        mimeType,
        videoBitsPerSecond: bitrate,
        audioBitsPerSecond: 128000   // 128 kbps audio if available
      } : {
        videoBitsPerSecond: bitrate,
        audioBitsPerSecond: 128000
      };
      this.recorder = new MediaRecorder(this.stream, options);
    } catch (e) {
      console.warn('MediaRecorder init failed', e);
      return false;
    }

    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    return true;
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve(null);
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.recorder.mimeType || 'video/webm' });
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.recorder = null;
        this.chunks = [];
        resolve(blob);
      };
      this.recorder.stop();
    });
  }
} 