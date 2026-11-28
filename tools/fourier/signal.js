// What both Fourier Modes assemble the same way from the shared input (./inputs.js) and filter
// (./filter.js) Controls: their State entries and their serialize() entries, plus the clamp
// their integer sliders (Synthesis N, Analysis n) apply to set and restored values.
//
// signalState(inputs, filters) returns { state(), settings() }:
//   state()     { waveform, amp, f0, offset, shift, filter, fc, applyGain, applyPhase, fcRatio, tau }
//   settings()  the same without the readouts fcRatio and tau, as serialize() keeps them
// toCount(v, max) rounds v to an integer in 0 … max.

export function signalState(inputs, filters) {
  return {
    state() {
      const input = inputs.value();
      return { ...input, ...filters.state(input.f0) };
    },
    settings: () => ({ ...inputs.value(), ...filters.settings() }),
  };
}

export const toCount = (v, max) => Math.min(max, Math.max(0, Math.round(Number(v))));
