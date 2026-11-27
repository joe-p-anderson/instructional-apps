// The Phasors Tool's revealable layers: per Mode, the ids of the trace-visibility Controls an
// Activity's Task hide/show lists act on (each Mode's header says what each one hides).
// Node-safe, so Activity tests can check their hide/show lists against it.
export const LAYERS = Object.freeze({
  sum: Object.freeze(['sum']),
  circuit: Object.freeze(['Ztotal', 'I', 'VR', 'VL', 'VC', 'kvl']),
});
