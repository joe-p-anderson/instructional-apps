// Activity: phase shift / period and amplitude, on the oscilloscope Tool.
// Ported from the Tasks in Finished/oscilloscope_lab.html. Pure data (no DOM): the
// runner core and Node tests import it directly. Prompts and Questions may use \( \) math.

const ALL = ['Va', 'f', 'Dt', 'Va-marker', 'f-marker', 'Dt-marker'];

export default {
  id: 'oscilloscope-phase-period-amplitude',
  version: 1,
  title: 'Oscilloscope: Phase Shift, Period and Amplitude',
  course: 'PHY/EGR 3120',
  tool: 'oscilloscope',
  parts: [
    {
      id: 'phase',
      title: 'Part 1: Phase Shift',
      mode: 'dual-trace',
      setup: { Va: 2, f: 0.5, Dt: 0.25 },
      tasks: [
        {
          id: 'phase-pi-2',
          title: 'Phase shift \\(\\pi/2\\)',
          prompt: 'Set \\(\\phi = 2\\pi f \\Delta t = \\pi/2\\) (90°) by adjusting \\(f\\) and \\(\\Delta t\\).',
          show: ALL,
          condition: { state: 'phi', target: Math.PI / 2, tol: 0.05, targetLabel: 'π/2 ≈ 1.571 rad' },
          points: 1,
          hint: { after: 3, text: 'With \\(f = 0.5\\) Hz, a quarter period is \\(\\Delta t = 0.5\\) s.' },
        },
        {
          id: 'phase-pi-4',
          title: 'Phase shift \\(\\pi/4\\)',
          prompt: 'Set \\(\\phi = 2\\pi f \\Delta t = \\pi/4\\) (45°). \\(\\Delta t\\) is now fixed.',
          lock: ['Dt', 'Dt-marker'],
          condition: { state: 'phi', target: Math.PI / 4, tol: 0.05, targetLabel: 'π/4 ≈ 0.785 rad' },
          points: 1,
          hint: { after: 3, text: 'Halving \\(f\\) halves \\(\\phi\\) when \\(\\Delta t\\) stays the same.' },
        },
        {
          id: 'phase-question',
          title: 'Measuring phase',
          prompt: 'Answer in a few sentences.',
          questions: [{
            id: 'why-hard',
            kind: 'text',
            prompt: 'Why is phase shift somewhat difficult to measure from an oscilloscope?',
            points: 1,
          }],
          points: 0,
        },
      ],
    },
    {
      id: 'period-amplitude',
      title: 'Part 2: Period and Amplitude',
      mode: 'dual-trace',
      setup: { Va: 1.5, f: 0.5, Dt: 0.25 },
      tasks: [
        {
          id: 'period-3',
          title: 'Period \\(= 3\\) s',
          prompt: 'Adjust \\(f\\) so that \\(T = 1/f = 3\\) s.',
          show: ['f', 'f-marker'],
          lock: ['Va', 'Va-marker'],
          hide: ['Dt', 'Dt-marker'],
          condition: { state: 'T', target: 3, tol: 0.05, targetLabel: '3.00 s' },
          points: 1,
          hint: { after: 3, text: 'Type \\(f = 0.33\\) Hz into the number box: the f marker snaps to tenths.' },
        },
        {
          id: 'pkpk-4',
          title: 'Peak-to-peak \\(= 4\\) V',
          prompt: 'Adjust \\(V_a\\) so that \\(2 V_a = 4\\) V.',
          show: ['Va', 'Va-marker'],
          lock: ['f', 'f-marker'],
          condition: { state: 'pkpk', target: 4, tol: 0.05, targetLabel: '4.00 V' },
          points: 1,
          hint: { after: 3, text: 'Peak-to-peak is twice the amplitude: \\(V_a = 2\\) V.' },
        },
      ],
    },
  ],
};
