export type GraphicsMode = 'auto' | 'smooth' | 'detail';

// Use sustained frame times, not single loading spikes, to adjust quality.
export function createRenderQuality(lowPower: boolean) {
 let mode: GraphicsMode = 'auto';
 let scale = 1;
 let elapsed = 0;
 let samples = 0;
 let healthyWindows = 0;
 return {
  setMode(next: GraphicsMode) { mode = next; scale = 1; this.reset(); },
  reset() { elapsed = 0; samples = 0; healthyWindows = 0; },
  sample(ms: number) {
   if (mode !== 'auto' || ms <= 0 || ms > 250) return false;
   elapsed += ms; samples++;
   if (elapsed < 2000 || samples < 30) return false;
   const average = elapsed / samples;
   elapsed = 0; samples = 0;
   const previous = scale;
   if (average > 23) { scale = Math.max(.55, scale - .15); healthyWindows = 0; }
   else if (average < 18) {
    if (++healthyWindows >= 4) { scale = Math.min(1, scale + .1); healthyWindows = 0; }
   } else healthyWindows = 0;
   return scale !== previous;
  },
  pixelRatio(width: number, height: number, deviceRatio: number) {
   const ceiling = mode === 'smooth' ? 1 : mode === 'detail' ? 1.6 : lowPower ? 1.25 : 1.6;
   const budget = mode === 'smooth' || lowPower ? 1_500_000 : 3_000_000;
   return Math.min(deviceRatio || 1, ceiling, Math.sqrt(budget / Math.max(1, width * height))) * (mode === 'auto' ? scale : 1);
  },
  shadowInterval() { return mode === 'smooth' || (mode === 'auto' && (lowPower || scale < .8)) ? 100 : 50; },
 };
}
