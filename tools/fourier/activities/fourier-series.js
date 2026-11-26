// Activity "Frequency Domain: Fourier Series" (PHY/EGR 3120), on the fourier Tool.
// Part 1 builds the square and triangle waves from their series (Synthesis Mode); Parts 2 and 3
// take a shifted sine and the square wave apart by hand (Analysis Mode). Parts 4 and 5 pass the
// square wave through the RC low-pass and high-pass (Synthesis Mode, where the time plot shows
// the filtered sum and its N = ∞ curve): gain only, phase only, both, then one harmonic by hand.
//
// Pure data (no DOM): the runner core and Node tests import it directly. Prompts and Questions
// may use \( \) math; the ones students answer use Unicode subscripts so they read the same
// either way.
//
// Conditions, numeric and choice keys, and Hints that would give an answer away are encoded
// answer keys (framework/v1/authoring/encode-keys.html, or encodeKey() from
// framework/v1/runner/keys.js); decode one with decodeKey(). The keys agree with the engine
// (tests/unit/fourier/activity.test.js checks them against series() and productAverage()).
// Tolerances: amplitudes (and aₙ, bₙ) 2% relative, or 0.01 V absolute for a zero amplitude;
// phases ±2° judged mod 360°, so −90° and 270° both pass. The N Conditions accept a band about
// the smallest N within 5% (from a little below it, where the error is just over 5%), since
// students judge it by eye. Hints guide and never state the passing value.
// Points: 1 per Task with a Condition, none for a Task without one, 1 per graded Question.
//
// Every Setup fixes f₀ = 1 kHz, ±1 V and no offset; Parts 1–3 fix the filter off, and the first
// Task of each locks those Controls (FIXED); the coefficient Tasks hide the spectrum (and the Task
// after them shows it), and the filter curves stay hidden. Parts 4 and 5 fix the square wave,
// f_c = 3 kHz and the filter type with both toggles off, lock all but the toggles (FILTER_LOCK)
// and unlock the toggles (TOGGLES), whose states the toggle Tasks' Conditions check.

const FIXED = ['amp', 'f0', 'offset', 'shift', 'filter', 'fc', 'applyGain', 'applyPhase'];
const SETUP = { amp: 1, f0: 1000, offset: 0, filter: 'off' };
const TOGGLES = ['applyGain', 'applyPhase'];
const FILTER_LOCK = ['waveform', ...FIXED.filter((id) => !TOGGLES.includes(id))];
const FILTERED = { ...SETUP, waveform: 'square', shift: 0, fc: 3000, applyGain: false, applyPhase: false, N: 30 };

const AMP = { kind: 'numeric', relTol: 0.02, points: 1 };
const ZERO = { kind: 'numeric', tol: 0.01, points: 1 }; // a zero amplitude: relTol would leave no tolerance
const PHASE = { kind: 'numeric', tol: 2, modulus: 360, points: 1 };

export default {
  id: 'fourier-series',
  version: 1,
  title: 'Frequency Domain: Fourier Series',
  course: 'PHY/EGR 3120',
  tool: 'fourier',
  parts: [
    {
      id: 'synthesis',
      title: 'Part 1: Square vs Triangle',
      mode: 'synthesis',
      setup: { ...SETUP, waveform: 'square', shift: 0, N: 1, coefficientTable: true },
      tasks: [
        {
          id: 'falloff',
          title: 'How fast the terms fall',
          prompt: 'The sidebar\'s coefficient table lists each harmonic\'s amplitude Aₙ and phase φₙ for the '
            + 'selected waveform, written as Aₙ cos(nω₀t + φₙ). Switch the waveform between Square and Triangle '
            + 'and compare how fast Aₙ falls as n grows.',
          lock: FIXED,
          questions: [{
            id: 'falloff',
            kind: 'choice',
            prompt: 'How do the nonzero Aₙ fall with n?',
            choices: [
              { id: 'square-n-triangle-n2', text: 'Square Aₙ ∝ 1/n; triangle Aₙ ∝ 1/n²' },
              { id: 'square-n2-triangle-n', text: 'Square Aₙ ∝ 1/n²; triangle Aₙ ∝ 1/n' },
              { id: 'both-n', text: 'Both fall as 1/n' },
              { id: 'both-n2', text: 'Both fall as 1/n²' },
            ],
            correct: 'enc1:RARcA1BSBkwdWBUeRAULEwkXXwtcVg',
            points: 1,
          }],
          points: 0,
        },
        {
          id: 'square-n',
          title: 'Building the square wave',
          prompt: 'Select the Square wave. Raise N until the partial sum stays within 5% of the square wave '
            + '(±0.05 V) everywhere more than 0.1 ms from a jump, and stop at the smallest N that does. '
            + 'Press Play to watch the sum build up, then fine-tune N with the slider.',
          condition: 'enc1:PQwPBUVBFwRRT0MbTBIAEgoAH0dCVkUaEBhXU1FfR1MwMTNSVRIcExIWXxFUVC8AERANThdGERwAUgEUGxVSDkUOWlYWRxgMOmYmWUBVEgtEBUwYVkVBTVEGFQ1ZAUdORzxQSUwVQgQTHBkaQl1JAiMhPk9HEgoCVFsPAlBSBAQHOQAOSAhHTkcGGgBOB00KCRVeUwdFKwA1LDNUEFtVVBYEDQJZRUMSBhhBG0QQDR0LUkdATAl9',
          points: 1,
          hint: { after: 3, text: 'Judge the wiggles on the flat tops, not the overshoot right at each jump: that overshoot never shrinks, however large N gets. Each new odd harmonic squeezes the wiggles closer to the jumps.' },
        },
        {
          id: 'triangle-n',
          title: 'Building the triangle wave',
          prompt: 'Now select the Triangle wave and find the smallest N that keeps the sum within 5% '
            + '(±0.05 V) of the triangle everywhere more than 0.1 ms from a corner.',
          condition: 'enc1:PQwPBUVBFwRRT0MbTBIAEgoAH0dCVkUaEBhXU1FfR1QzLTNOV1xVE0pVWRdDRwYVPxQDCUFGX1YRGhdFGgZJCgseV0VTEgRWJGYvDEsSREgWEg9ME1ICDxQQQ0APFxEVERdQX0w6AkdHGFlPBQBHGnNocEJVXF9GRE0VWhNUAhMUEBUgTAYAGEdIUBEGEQAYCBhXTBYWEQAPZCZIUUQQWgMSXQURVAsEUwYUAQ0TDAANGxxFW1ECFjg',
          points: 1,
          hint: { after: 3, text: 'The triangle\'s sum is furthest off at the corners, which you can ignore here; look between them. Compare the table: the triangle\'s terms shrink much faster than the square\'s.' },
        },
        {
          id: 'explain',
          title: 'Jumps, corners and two descriptions',
          prompt: 'Answer each in a few sentences.',
          questions: [
            {
              id: 'jumps',
              kind: 'text',
              prompt: 'Why does a waveform with jumps (the square) need many more terms than one with only corners (the triangle)? Relate your answer to how fast Aₙ falls.',
              points: 1,
            },
            {
              id: 'descriptions',
              kind: 'text',
              prompt: 'The waveform and its table of Aₙ and φₙ describe the same signal two ways. What does each description make easy to see?',
              points: 1,
            },
          ],
          points: 0,
        },
      ],
    },
    {
      id: 'sine',
      title: 'Part 2: A Shifted Sine',
      mode: 'analysis',
      setup: { ...SETUP, waveform: 'sine', shift: 30, testFunction: 'cos', n: 1 },
      tasks: [
        {
          id: 'ab-1',
          title: 'a₁ and b₁ by hand',
          prompt: 'The input is a 1 V, 1 kHz sine delayed by 30° of its period. The product plot shows the input '
            + 'times the test function over one period T, with positive and negative area shaded. The net area '
            + 'gives \\(a_n = \\frac{2}{T}\\int_0^T v(t)\\cos(n\\omega_0 t)\\,dt\\) with the cos test function, and '
            + '\\(b_n = \\frac{2}{T}\\int_0^T v(t)\\sin(n\\omega_0 t)\\,dt\\) with sin. Compute a₁ and b₁ by hand.',
          lock: [...FIXED, 'waveform'],
          hide: ['spectrum', 'filter-curves'],
          questions: [
            { ...AMP, id: 'a1', prompt: 'a₁ (V)', answer: 'enc1:S0cDQw' },
            { ...AMP, id: 'b1', prompt: 'b₁ (V)', answer: 'enc1:VlkVQAcQUVRHRVJbFVBRR11E' },
          ],
          points: 0,
          hint: { after: 3, text: 'Write the shifted sine as sin(ω₀t − 30°) and expand it with the angle-difference identity: it is a mix of sin(ω₀t) and cos(ω₀t). Over one period, cos² and sin² each average to one half and cos·sin averages to zero.' },
        },
        {
          id: 'A-phi-1',
          title: 'A₁ and φ₁',
          prompt: 'Write the harmonic in cos form, A₁ cos(ω₀t + φ₁), where \\(a_1 = A_1\\cos\\varphi_1\\) and '
            + '\\(b_1 = -A_1\\sin\\varphi_1\\). Give φ₁ in degrees.',
          hide: ['spectrum'],
          questions: [
            { ...AMP, id: 'A1', prompt: 'A₁ (V)', answer: 'enc1:Vw' },
            { ...PHASE, id: 'phi1', prompt: 'φ₁ (°)', answer: 'enc1:S0YfRg' },
          ],
          points: 0,
          hint: { after: 3, text: 'A₁ = √(a₁² + b₁²). For φ₁, cos φ₁ has the sign of a₁ and sin φ₁ the sign of −b₁: use both signs to find the quadrant before you take an arctangent.' },
        },
        {
          id: 'off-harmonic',
          title: 'Other harmonics',
          prompt: 'The spectrum is now shown: check your A₁ and φ₁ against it. Then set n to 2 and to 3, with each test function, and look at the shaded areas.',
          show: ['spectrum'],
          questions: [{
            id: 'off-harmonic',
            kind: 'choice',
            prompt: 'What do the n = 2 and n = 3 products show?',
            choices: [
              { id: 'zero', text: 'Their positive and negative areas cancel, so a₂, b₂, a₃ and b₃ are all zero: the sine has no 2nd or 3rd harmonic.' },
              { id: 'small', text: 'Their net areas are small but not zero, so the sine has weak 2nd and 3rd harmonics.' },
              { id: 'cos-only', text: 'Only the cos products cancel; the sin products leave a net area.' },
              { id: 'shift', text: 'They cancel only because of the 30° shift.' },
            ],
            correct: 'enc1:RA1IBF4C',
            points: 1,
          }],
          points: 0,
        },
      ],
    },
    {
      id: 'square',
      title: 'Part 3: The Square Wave',
      mode: 'analysis',
      setup: { ...SETUP, waveform: 'square', shift: 0, testFunction: 'sin', n: 1 },
      tasks: [
        {
          id: 'A-phi-square',
          title: 'Aₙ and φₙ for n = 1 to 5',
          prompt: 'The input is the 1 V, 1 kHz square wave: +1 V for the first half period and −1 V for the second. '
            + 'Use the product plot to compute aₙ and bₙ by hand for n = 1 to 5, then give each Aₙ, and φₙ for the '
            + 'odd n. Enter 0 for an amplitude that is zero. '
            + '<b>Why φₙ is −90°:</b> this square wave is an odd function of t, like sin, so every cos product '
            + 'cancels and aₙ = 0. Each nonzero harmonic is then a positive multiple of sin(nω₀t), and '
            + 'sin x = cos(x − 90°), so written in the cos form Aₙ cos(nω₀t + φₙ) its phase is φₙ = −90°. '
            + 'We use the cos form because the phasor Activity next builds on it.',
          lock: [...FIXED, 'waveform'],
          hide: ['spectrum', 'filter-curves'],
          questions: [
            { ...AMP, id: 'A1', prompt: 'A₁ (V)', answer: 'enc1:V1kfQQISUFhGQVVbHlFUQldK' },
            { ...PHASE, id: 'phi1', prompt: 'φ₁ (°)', answer: 'enc1:S04d' },
            { ...ZERO, id: 'A2', prompt: 'A₂ (V)', answer: 'enc1:Vg' },
            { ...AMP, id: 'A3', prompt: 'A₃ (V)', answer: 'enc1:VlkZRAUUUlJCTVBZGlxWTFJE' },
            { ...PHASE, id: 'phi3', prompt: 'φ₃ (°)', answer: 'enc1:S04d' },
            { ...ZERO, id: 'A4', prompt: 'A₄ (V)', answer: 'enc1:Vg' },
            { ...AMP, id: 'A5', prompt: 'A₅ (V)', answer: 'enc1:VlkfQwUWV1ZKRVlVGVNVR1dHRg' },
            { ...PHASE, id: 'phi5', prompt: 'φ₅ (°)', answer: 'enc1:S04d' },
          ],
          points: 0,
          hint: { after: 3, text: 'Split the integral for bₙ at the half period: the wave is a constant on each half, so each piece is the integral of sin(nω₀t) over half a period. For even n the two halves cancel; for odd n they add.' },
        },
        {
          id: 'pattern',
          title: 'The pattern',
          prompt: 'The spectrum is now shown: check your Aₙ and φₙ against it.',
          show: ['spectrum'],
          questions: [{
            id: 'pattern',
            kind: 'choice',
            prompt: 'What pattern do the square wave\'s coefficients follow?',
            choices: [
              { id: 'even-zero-1-over-n', text: 'The even terms are zero, and Aₙ ∝ 1/n for odd n.' },
              { id: 'odd-1-over-n2', text: 'The even terms are zero, and Aₙ ∝ 1/n² for odd n.' },
              { id: 'all-1-over-n', text: 'Every term is nonzero, and Aₙ ∝ 1/n.' },
              { id: 'odd-zero', text: 'The odd terms are zero, and Aₙ ∝ 1/n for even n.' },
            ],
            correct: 'enc1:RBJbE18NGQQBGkxdAAsTERdfHEc',
            points: 1,
          }],
          points: 0,
        },
      ],
    },
    {
      id: 'lowpass',
      title: 'Part 4: Low-Pass on the Square',
      mode: 'synthesis',
      setup: { ...FILTERED, filter: 'lowpass' },
      tasks: [
        {
          id: 'gain-only',
          title: 'Gain only',
          prompt: 'The 1 V, 1 kHz square wave now feeds the first-order RC low-pass filter from the RC Activity, '
            + 'with f_c = 3 kHz. The filter acts on each harmonic in two ways: <b>Apply gain</b> scales its amplitude '
            + 'by the gain |H| at its frequency, and <b>Apply phase shift</b> adds the phase shift ∠H to its phase. Turn on '
            + 'Apply gain only, and compare the partial sum and the N = ∞ curve with the square wave.',
          lock: FILTER_LOCK,
          show: TOGGLES,
          condition: 'enc1:PQwPBUVBFwRRT0MNXRQJDSITGwtMWAIOFAxaTABHX1QzMTcMEkRRQwESWTpQQgYNUU9DLV0UCQ1FFRMMAFRPBUcEF1tRFhFBNSFwGhJRQEEKDn0eUFMGQ19XBB1YBQkHR0gUBAIHRUdHDVpSFAARbCAmN0wSChJwFgdBDxFQCwAAEEEfRQ0DAEUdFANMCX0',
          points: 1,
        },
        {
          id: 'phase-only',
          title: 'Phase only',
          prompt: 'Now turn on Apply phase shift only: every harmonic keeps its amplitude but is delayed by the filter. '
            + 'Compare the shape with the square wave and with the gain-only shape.',
          condition: 'enc1:PQwPBUVBFwRRT0MNXRQJDSITGwtMWAIOFAxaTABHX0YgKCFFHBJEUBQQSAJ9QQEEH1dbTmwUFRgcUhUEBxoABAMfGV1fHkdTNSUmRRIKElAWB0EPYUgCEhZXTU5IFRAVCQFQXxoGVQ5JW09BAQIAVA0lMEVcEgoTJwddGkgAEwkSBgRMXgwMEhFSHQtMCX0',
          points: 1,
        },
        {
          id: 'both',
          title: 'Gain and phase',
          prompt: 'Turn on both Apply gain and Apply phase shift. Try each of the three settings again if you like, and raise N to watch the partial sum approach the N = ∞ curve.',
          condition: 'enc1:PQwPBUVBFwRRT0MNXRQJDSITGwtMWAIOFAxaTABHX1QzMTcMEkRRQwESWTpQQgYNUU9DLV0UCQ1FFRMMAFRPBUcEF1tRFhFBNSFwGhJRQEEKDn0eUFMGQ19XBB1YBQkHR0gGFxsRDEkRGElHFhEpQSMhPgIKEnFBFhtUVkFIAhIWVRIERAIRVAocUBgz',
          questions: [{
            id: 'rc-curve',
            kind: 'choice',
            prompt: 'Which setting turns the square wave into the RC charging curve, V_C rising and falling exponentially toward ±1 V?',
            choices: [
              { id: 'gain', text: 'Gain only' },
              { id: 'phase', text: 'Phase only' },
              { id: 'both', text: 'Gain and phase together' },
              { id: 'either', text: 'Either one alone' },
            ],
            correct: 'enc1:RBVCAlkC',
            points: 1,
          }],
          points: 1,
        },
        {
          id: 'why-both',
          title: 'Why both?',
          prompt: 'Answer in a few sentences.',
          questions: [{
            id: 'why-both',
            kind: 'text',
            prompt: 'Why does the filter need both its gain and its phase shift to produce the RC charging curve? What goes wrong with each one alone?',
            points: 1,
          }],
          points: 0,
        },
        {
          id: 'harmonic-3',
          title: 'The output 3rd harmonic',
          prompt: 'Hand-compute the filtered output\'s 3rd harmonic, from the input\'s A₃ and φ₃ (Part 3). '
            + 'The first-order RC low-pass filter has gain |H| = 1/√(1 + (f/f_c)²) and phase shift ∠H = −arctan(f/f_c), '
            + 'at the harmonic\'s frequency f. The output harmonic has amplitude A₃·|H| and phase φ₃ + ∠H.',
          questions: [
            { ...AMP, id: 'A3out', prompt: 'Output A₃ (V)', answer: 'enc1:VlkeRgERU1RHRllbHF1VR1BG' },
            { ...PHASE, id: 'phi3out', prompt: 'Output φ₃ (°)', answer: 'enc1:S0YeQw' },
          ],
          points: 0,
          hint: { after: 3, text: 'The 3rd harmonic is at f = 3f₀: start from f/f_c there. Multiply the input\'s A₃ by |H|, and add ∠H, in degrees, to the input\'s φ₃.' },
        },
      ],
    },
    {
      id: 'highpass',
      title: 'Part 5: High-Pass on the Square',
      mode: 'synthesis',
      setup: { ...FILTERED, filter: 'highpass' },
      tasks: [
        {
          id: 'gain-only',
          title: 'Gain only',
          prompt: 'The same square wave now feeds the first-order RC high-pass filter, f_c = 3 kHz: the output is '
            + 'the voltage V_R across the resistor. Turn on Apply gain only, and compare the partial sum and the '
            + 'N = ∞ curve with the square wave.',
          lock: FILTER_LOCK,
          show: TOGGLES,
          condition: 'enc1:PQwPBUVBFwRRT0MNXRQJDSITGwtMWAIOFAxaTABHX1QzMTcMEkRRQwESWTpQQgYNUU9DLV0UCQ1FFRMMAFRPBUcEF1tRFhFBNSFwGhJRQEEKDn0eUFMGQ19XBB1YBQkHR0gUBAIHRUdHDVpSFAARbCAmN0wSChJwFgdBDxFQCwAAEEEfRQ0DAEUdFANMCX0',
          points: 1,
        },
        {
          id: 'phase-only',
          title: 'Phase only',
          prompt: 'Now turn on Apply phase shift only. The high-pass filter shifts each harmonic\'s phase forward rather than back.',
          condition: 'enc1:PQwPBUVBFwRRT0MNXRQJDSITGwtMWAIOFAxaTABHX0YgKCFFHBJEUBQQSAJ9QQEEH1dbTmwUFRgcUhUEBxoABAMfGV1fHkdTNSUmRRIKElAWB0EPYUgCEhZXTU5IFRAVCQFQXxoGVQ5JW09BAQIAVA0lMEVcEgoTJwddGkgAEwkSBgRMXgwMEhFSHQtMCX0',
          points: 1,
        },
        {
          id: 'both',
          title: 'Gain and phase',
          prompt: 'Turn on both Apply gain and Apply phase shift, and raise N to watch the partial sum approach the N = ∞ curve.',
          condition: 'enc1:PQwPBUVBFwRRT0MNXRQJDSITGwtMWAIOFAxaTABHX1QzMTcMEkRRQwESWTpQQgYNUU9DLV0UCQ1FFRMMAFRPBUcEF1tRFhFBNSFwGhJRQEEKDn0eUFMGQ19XBB1YBQkHR0gGFxsRDEkRGElHFhEpQSMhPgIKEnFBFhtUVkFIAhIWVRIERAIRVAocUBgz',
          questions: [{
            id: 'spikes',
            kind: 'choice',
            prompt: 'Which setting turns the square wave into the decaying spikes you measured, V_R jumping by 2 V at each edge and then decaying exponentially toward 0?',
            choices: [
              { id: 'gain', text: 'Gain only' },
              { id: 'phase', text: 'Phase only' },
              { id: 'both', text: 'Gain and phase together' },
              { id: 'either', text: 'Either one alone' },
            ],
            correct: 'enc1:RBVCAlkC',
            points: 1,
          }],
          points: 1,
        },
        {
          id: 'why-both',
          title: 'Why both?',
          prompt: 'Answer in a few sentences.',
          questions: [{
            id: 'why-both',
            kind: 'text',
            prompt: 'Why does the high-pass filter need both its gain and its phase shift to produce the decaying spikes? Compare with what you found for the low-pass.',
            points: 1,
          }],
          points: 0,
        },
        {
          id: 'harmonic-3',
          title: 'The output 3rd harmonic',
          prompt: 'Hand-compute the high-pass output\'s 3rd harmonic, from the input\'s A₃ and φ₃ (Part 3). '
            + 'The first-order RC high-pass filter has gain |H| = 1/√(1 + (f_c/f)²) and phase shift ∠H = arctan(f_c/f), '
            + 'at the harmonic\'s frequency f. The output harmonic has amplitude A₃·|H| and phase φ₃ + ∠H.',
          questions: [
            { ...AMP, id: 'A3out', prompt: 'Output A₃ (V)', answer: 'enc1:VlkeRgERU1RHRllbHF1VR1BG' },
            { ...PHASE, id: 'phi3out', prompt: 'Output φ₃ (°)', answer: 'enc1:S0MY' },
          ],
          points: 0,
          hint: { after: 3, text: 'The 3rd harmonic is at f = 3f₀: start from f_c/f there. Multiply the input\'s A₃ by |H|, and add ∠H, in degrees, to the input\'s φ₃. The high-pass ∠H is positive.' },
        },
        {
          id: 'gains-add',
          title: 'Do the gains add to 1?',
          prompt: 'Low-pass gives V_C and high-pass gives V_R, and V_C + V_R = v_in. The low-pass gain is '
            + 'H_LP = 1/(1 + j f/f_c) and the high-pass gain is H_HP = (j f/f_c)/(1 + j f/f_c). Compare the two at f = 3 kHz.',
          questions: [
            { ...AMP, id: 'magSum', prompt: '|H_LP| + |H_HP| at 3 kHz', answer: 'enc1:V1kZRwUSUlJGQ1NfGldVTVBD' },
            {
              id: 'complex-sum',
              kind: 'choice',
              prompt: 'Which statement explains why V_C + V_R = v_in?',
              choices: [
                { id: 'one', text: 'The complex gains add to 1 at every f, H_LP + H_HP = 1, though their magnitudes do not: the phase shifts matter.' },
                { id: 'magnitudes', text: 'The magnitudes add to 1 at every f, |H_LP| + |H_HP| = 1, so the amplitudes split between V_C and V_R.' },
                { id: 'dc', text: 'The gains add to 1 only at f = 0, so V_C + V_R = v_in only for the DC term.' },
                { id: 'neither', text: 'Neither adds to 1: V_C + V_R = v_in only at N = ∞.' },
              ],
              correct: 'enc1:RBhDExM',
              points: 1,
            },
          ],
          points: 0,
        },
      ],
    },
  ],
};
