/**
 * Experiment interface (reference)
 * @typedef {Object} Experiment
 * @property {string} name
 * @property {(p: p5, ctx: {backgroundColor:string, typeColor:string, text:string}) => void} init
 * @property {(p: p5, ctx: {backgroundColor:string, typeColor:string, text:string, width:number, height:number, timeSeconds:number}) => void} draw
 * @property {(p: p5) => void} [mouseMoved]
 * @property {(p: p5) => void} [mouseDragged]
 * @property {(p: p5) => void} [mousePressed]
 * @property {(p: p5) => void} [keyPressed]
 * @property {(p: p5, size: {width:number, height:number}) => void} [onResize]
 */

export {}; // documentation-only module 