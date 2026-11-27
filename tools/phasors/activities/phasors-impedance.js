// Activity "Phasors and Impedance" (PHY/EGR 3120), on the phasors Tool.
// Part 1 adds two same-frequency sinusoids as phasors (Sum Mode): the resultant of two phasors
// 90° apart by Pythagoras, a check against the drawn resultant, the resultant of two 120° apart
// by the law of cosines, a choice on the in-phase and out-of-phase extremes, and a free-text why.
//
// Pure data (no DOM): the runner core and Node tests import it directly. Prompts may use \( \)
// math; Question prompts use Unicode subscripts so they read the same either way.
//
// Conditions, numeric and choice keys are encoded answer keys (framework/v1/authoring/
// encode-keys.html, or encodeKey() from framework/v1/runner/keys.js); decode one with decodeKey().
// The keys agree with the engine (tests/unit/phasors/activity.test.js checks them against sum()).
// Tolerances: amplitudes 2% relative (AMP); phases ±2° judged mod 360° (PHASE), so −270° and 90°
// both pass. Hints guide and never state the passing value.
// Points: 1 per Task with a Condition, none for a Task without one, 1 per graded Question.
//
// Part 1's Setup fixes ω and v₁ = 3∠0°, v₂ = 4∠90° V; its first Task locks every way of changing
// them (SUM_INPUTS, and ω). The 120° Task opens φ₂ alone and its Condition checks φ₂ = 120°, so
// every student works the same second sum. Each compute Task hides the resultant layer ('sum',
// ../layers.js), and the Task after it shows it; the extremes Task opens the sinusoids for dragging.

const AMP = { kind: 'numeric', relTol: 0.02, points: 1 };
const PHASE = { kind: 'numeric', tol: 2, modulus: 360, points: 1 };

// Sum Mode: the Controls that set A₁, φ₁, A₂ and φ₂ (number inputs and drag handles).
const SUM_INPUTS = ['A1', 'phi1', 'A2', 'phi2', 'tip1', 'tip2', 'crest1', 'crest2'];

const sumPart = {
  id: 'sum',
  title: 'Part 1: Sum',
  mode: 'sum',
  setup: { A1: 3, phi1: 0, A2: 4, phi2: 90, omega: 1000 },
  tasks: [
    {
      id: 'right-angle',
      title: 'Two phasors 90° apart',
      prompt: 'The Tool shows v₁ = 3 cos(ωt) V and v₂ = 4 cos(ωt + 90°) V at ω = 1000 rad/s. Their phasors are '
        + 'v₁ = 3∠0° V and v₂ = 4∠90° V, drawn head-to-tail on the complex plane. The sum v₁ + v₂ is another '
        + 'sinusoid A cos(ωt + φ), and its phasor A∠φ is the vector sum of the two. The resultant is hidden: '
        + 'compute A and φ by hand, then submit to see it.',
      lock: [...SUM_INPUTS, 'omega'],
      hide: ['sum'],
      questions: [
        { ...AMP, id: 'A', prompt: 'A (V)', answer: 'enc1:Uw' },
        { ...PHASE, id: 'phi', prompt: 'φ (°)', answer: 'enc1:U0QDRwIQUlFBRlRYHFFQTV0' },
      ],
      points: 0,
      hint: { after: 3, text: 'The two phasors are the legs of a right triangle, and the resultant is its hypotenuse. v₁ lies along the real axis, so φ is the angle at the origin: tan φ = (the leg opposite it) / (the leg next to it).' },
    },
    {
      id: 'check-sum',
      title: 'Check against the resultant',
      prompt: 'The resultant v₁ + v₂ is now drawn on both Displays: check your A and φ against its readout. '
        + 'Then press Play, or drag the time cursor, and watch each phasor\'s projection on the real axis.',
      show: ['sum'],
      questions: [{
        id: 'curve',
        kind: 'choice',
        prompt: 'How does the sum curve relate to v₁(t) and v₂(t)?',
        choices: [
          { id: 'pointwise', text: 'At every instant it is v₁(t) + v₂(t): the resultant\'s projection is the sum of the two projections.' },
          { id: 'larger', text: 'At every instant it follows the larger of v₁(t) and v₂(t).' },
          { id: 'amplitudes', text: 'Its peaks reach A₁ + A₂, since the two crests add.' },
          { id: 'frequency', text: 'It oscillates at twice ω, since two sinusoids are added.' },
        ],
        correct: 'enc1:RAdCH19UFAgAEEM',
        points: 1,
      }],
      points: 0,
    },
    {
      id: 'law-of-cosines',
      title: 'Two phasors 120° apart',
      prompt: 'The φ₂ box is now unlocked: set φ₂ to 120°, so v₂ = 4∠120° V. The resultant is hidden again. '
        + 'Compute A by the law of cosines, \\(A^2 = A_1^2 + A_2^2 + 2A_1A_2\\cos(\\varphi_2 - \\varphi_1)\\), '
        + 'and φ from the components: add the real parts and the imaginary parts of v₁ and v₂. '
        + 'Submit with φ₂ at 120°.',
      show: ['phi2'],
      hide: ['sum'],
      condition: 'enc1:HVVeAlBUBkNJVxEERFZHWEcGExcJEVRJX0gJEF9HEU8tZmgQHgVN',
      questions: [
        { ...AMP, id: 'A', prompt: 'A (V)', answer: 'enc1:VVkbRgQVVlBBQlRYG1dcTFw' },
        { ...PHASE, id: 'phi', prompt: 'φ (°)', answer: 'enc1:UUQDTggXW1lFR1VUHVVWTVw' },
      ],
      points: 1,
      hint: { after: 3, text: 'cos 120° is negative, so the second phasor shortens the sum. For φ: v₂ = 4 cos 120° + j·4 sin 120°; add v₁\'s real part to its real part, then take the angle of the sum. Its real part is positive, so φ is between 0° and 90°.' },
    },
    {
      id: 'extremes',
      title: 'In phase and out of phase',
      prompt: 'The resultant is shown again, and the sinusoids are unlocked: drag the phasor tips or the crests, '
        + 'or type in the boxes. Try φ₂ = φ₁ (in phase) and φ₂ = φ₁ + 180° (out of phase).',
      show: ['sum', ...SUM_INPUTS],
      questions: [{
        id: 'extremes',
        kind: 'choice',
        prompt: 'What is the amplitude A of v₁ + v₂ at the two extremes?',
        choices: [
          { id: 'sum-difference', text: 'In phase, A = A₁ + A₂; out of phase, A = |A₁ − A₂|.' },
          { id: 'difference-sum', text: 'In phase, A = |A₁ − A₂|; out of phase, A = A₁ + A₂.' },
          { id: 'sum-zero', text: 'In phase, A = A₁ + A₂; out of phase, A = 0.' },
          { id: 'pythagoras', text: 'A = √(A₁² + A₂²) at both, whatever the phases.' },
        ],
        correct: 'enc1:RARYGxxECgcVEBMJQwcAVg',
        points: 1,
      }],
      points: 0,
    },
    {
      id: 'why',
      title: 'Why another sinusoid?',
      prompt: 'Answer in a few sentences.',
      questions: [{
        id: 'why',
        kind: 'text',
        prompt: 'Why is the sum of two sinusoids of the same frequency another sinusoid at that same frequency? Use the phasor picture.',
        points: 1,
      }],
      points: 0,
    },
  ],
};

export default {
  id: 'phasors-impedance',
  version: 1,
  title: 'Phasors and Impedance',
  course: 'PHY/EGR 3120',
  tool: 'phasors',
  parts: [sumPart],
};
