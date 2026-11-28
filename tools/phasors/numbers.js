// Phasors Tool: the small number helpers every module shares. Pure, no DOM.
//
//   finite(v)          v is a number or a numeric string with a finite value (not null, '',
//                      a boolean or anything else Number() would quietly turn into 0 or 1)
//   clamp(v, lo, hi)   v limited to [lo, hi]
//   DEG                degrees per radian

export const finite = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== ''))
  && Number.isFinite(Number(v));

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const DEG = 180 / Math.PI;
