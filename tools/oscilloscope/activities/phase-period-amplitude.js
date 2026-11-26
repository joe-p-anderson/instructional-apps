// Activity "Sinusoidal Signals": phase shift / period and amplitude, on the oscilloscope Tool.
// (The id still says phase-period-amplitude, so saved Runs and Reports keep matching.)
// Hints guide the measurement and never state the passing value.
// Ported from the Tasks in Finished/oscilloscope_lab.html. Pure data (no DOM): the
// runner core and Node tests import it directly. Prompts and Questions may use \( \) math.
// Conditions, and Hints that would give an answer away, are encoded answer keys
// (framework/v1/authoring/encode-keys.html); decode one in Node or the console with
// decodeKey() from framework/v1/runner/keys.js.

const ALL = ['Va', 'f', 'Dt', 'Va-marker', 'f-marker', 'Dt-marker'];
// The readouts that print φ: hidden while a Task asks the student to set φ.
const PHI_READOUTS = ['phi-readout', 'ratio-readout'];

export default {
  id: 'oscilloscope-phase-period-amplitude',
  version: 1,
  title: 'Sinusoidal Signals',
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
          hide: PHI_READOUTS,
          condition: 'enc1:HVVeAlBUBkNJVxEEREZJVhETAAILAAJRVFcOF0NSXBZydmQXCQQICFBBAVRFTw9DSUVPXBhIRwAEABUAGjhBCQAVGRpRquUPc2SwqbgQAR9TQBxWQ0EHQw4',
          points: 1,
          hint: { after: 3, text: 'A full period is a phase of \\(2\\pi\\), so \\(\\pi/2\\) is a quarter of a period. Read the period off the time axis, then shift the red trace until its peaks sit that far from the blue trace\'s peaks.' },
        },
        {
          id: 'phase-pi-4',
          title: 'Phase shift \\(\\pi/4\\)',
          prompt: 'Set \\(\\phi = 2\\pi f \\Delta t = \\pi/4\\) (45°). \\(\\Delta t\\) is now fixed.',
          lock: ['Dt', 'Dt-marker'],
          condition: 'enc1:HVVeAlBUBkNJVxEEREZJVhETAAILAAJRVVcMGEZWXBhwcmETCQcEBV5EAVRFTw9DSUVPXBhIRwAEABUAGjhBCQAVGRpRquUPdWSwqbgQAB9RTxhWQ0EHQw4',
          points: 1,
          hint: { after: 3, text: 'With \\(\\Delta t\\) fixed, only \\(f\\) changes \\(\\phi = 2\\pi f \\Delta t\\). Compare the phase you need with the one you set in Task 1.1, and scale \\(f\\) by the same factor.' },
        },
        {
          id: 'phase-question',
          title: 'Measuring phase',
          prompt: 'Answer in a few sentences.',
          show: PHI_READOUTS,
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
          condition: 'enc1:HVVeAlBUBkNJVzVOAUYRFRcVFxFMThNHRw1UTFFfVQ5xcX4CRFFCVgMDYRdTRQ9DSVdSQh1URQdHDw',
          points: 1,
          hint: { after: 3, text: 'The period is the time from one peak of a trace to the next. Count the 1 s grid squares between neighbouring peaks as you adjust \\(f\\); the f marker snaps to tenths, so finish in the number box.' },
        },
        {
          id: 'pkpk-4',
          title: 'Peak-to-peak \\(= 4\\) V',
          prompt: 'Adjust \\(V_a\\) so that \\(2 V_a = 4\\) V.',
          show: ['Va', 'Va-marker'],
          lock: ['f', 'f-marker'],
          condition: 'enc1:HVVeAlBUBkNJVxEHXQ9HWEcGExcJEVRJX00XAgcKCQJ7dHwQBRwSRQcFShNFbAIDFhlDVg9QS0RVUiRHEw',
          points: 1,
          hint: { after: 3, text: 'Peak-to-peak is the height from a trough of the trace up to a peak, which is twice the amplitude \\(V_a\\). Read both ends off the voltage axis.' },
        },
      ],
    },
  ],
};
