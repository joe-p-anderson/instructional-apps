// Activity: Conductor Properties (PHY 4300), on the electrostatics Tool.
// Ported from the six Tasks in Finished/conductor_properties.html (deleted). Pure data (no DOM):
// the runner core and Node tests import it directly. Prompts may use \( \) math and HTML.
//
// Each Task prompt is the old prompt word for word, then the old Part's "Instructions" text.
// Each Task's free-text Question is the old question word for word. As in the old app, no
// Control is locked or hidden. Unlike the old app, the answer box is open before Submit.
//
// Conditions and Hints are encoded answer keys (framework/v1/authoring/encode-keys.html);
// decode one in Node or the console with decodeKey() from framework/v1/runner/keys.js.
// They use the built-in range and anyOf types; lengths are in cm (the Modes' State units).

const INSTRUCTIONS = {
  field: 'Express each answer as a <em>modus tollens</em> proof: if&nbsp;\\(A\\) implies disequilibrium, but the conductor is in equilibrium, then \\(A\\) is false.',
  potential: 'How is the conductor different from the surrounding space from the perspective of the potential field?',
  gauss: 'Express each answer as a <em>modus tollens</em> proof about electrostatic equilibrium.',
};

const prompt = (text, instructions) => `${text}\n<br>${instructions}`;

const question = (text) => [{ id: 'explain', kind: 'text', prompt: text, points: 1 }];

export default {
  id: 'conductor-properties',
  version: 1,
  title: 'Conductor Properties',
  course: 'PHY 4300',
  tool: 'electrostatics',
  parts: [
    {
      id: 'electric-field',
      title: 'Part 1: Electric Field',
      mode: 'electric-field',
      setup: { Q: 0, E0x: 0, E0y: 0, theta: 0, induce: false, showCharges: true },
      tasks: [
        {
          id: 'ef-t1',
          title: 'Apply a bulk field',
          prompt: prompt('Apply a bulk field.', INSTRUCTIONS.field),
          // |E₀| above 0
          condition: 'enc1:HVVZD0FFQVtRBwACSgFHWEcBBgQaEQJRRzwLTRICRwxjJTBPRlUSC1YK',
          questions: question('What must be true of the electric field in the bulk of a conductor in electrostatic equilibrium and why?'),
          points: 1,
          hint: { after: 3, text: 'enc1:RDNfF1YAFwkWVSSOr-RFHgoLAREHF0tLBA5aWVMDF08sZDtUQxBTVAgDXxMdAAwTUwEYHEhEBFQLHRwfCwZPSyCbuaALRQpSYQGworBJHhM' },
        },
        {
          id: 'ef-t2',
          title: 'Change the surface field',
          prompt: prompt('Change the surface field.', INSTRUCTIONS.field),
          // Q above 0 and θ above 0
          condition: 'enc1:PQwPAkhQBkNJVxMNQwMAVklQAREPAEVJX1tqAl9HBEIuMjcCCgBNHR1VWQ9BRUFbUQcAAkoBR1hHAQYEGhECUUcNU0UHBEcMYyUwT0ZVEgtWCnA',
          questions: question('What must be true of the electric field at the surface of a conductor in electrostatic equilibrium and why?'),
          points: 1,
          hint: { after: 3, text: 'enc1:RDBEAFQAFwkWVQIDQwAQFxEdAEUPVFAEFhBPSQUARUMpJSBHVRBhHUYDRRNfAA4OBRBBGEUBRbrdUgIMDR9FGUUWXUZTHwBSLmpw' },
        },
      ],
    },
    {
      id: 'potential',
      title: 'Part 2: Potential',
      mode: 'potential',
      setup: { Q: 1, x1: -6, y1: -6, x2: 7, y2: 7, lockToSurface: false, measureAtInfinity: false },
      tasks: [
        {
          id: 'pf-t1',
          title: 'Measure the potential inside',
          prompt: prompt('Try measuring the potential inside the conductor.', INSTRUCTIONS.potential),
          // r1 below 5 cm, and anyOf(measure at infinity, r2 below 5 cm)
          condition: 'enc1:PQwPAkhQBkNJVxMNQwMAVklQAREPAEVJX1tJEVFJR0IkKD1XEgoFTEoMDwJIUAZDSVcAAlQrA1ZJUBEKABBJHwwWVVNRXz5bYzcmQURVEgtEGkgXQlURBDIBKAJLDQsdEQtQSUwRUR4EFUgCSREXVSQ5flsSRElBA1UXVENBDQYWV01OXhAEAABQSEccRgJHRxteTBwSRxp0OQ9dbQ',
          questions: question('What must be true about the potential field inside a conductor? Why?'),
          points: 1,
          hint: { after: 3, text: 'enc1:RDNfF1YAM1BTHA8fRAAAVBEaF0UNG04PEBpPTwFLRXQpITwAQEVEETZFDR9fUwoFFlUVA0JIRRsXUgYQHBoABAtZVkUSFhBSJGQzVBBZXlcPGUQCSA5B' },
        },
        {
          id: 'pf-t2',
          title: 'Potential difference along surface paths',
          prompt: prompt('Try measuring the potential difference of surface paths.', INSTRUCTIONS.potential),
          // lock to surface is on
          condition: 'enc1:HVVeAlBUBkNJVw0DTg8xGzYHAAMPF0VJSVteUQYECVNjfiZSRVVN',
          questions: question('How is the potential field at the surface of a conductor related to the value inside? Why?'),
          points: 1,
          hint: { after: 3, text: 'enc1:RCNYBF8ADA9TGQ4PRkQRG0UBBxcIFUMOS1s' },
        },
      ],
    },
    {
      id: 'gauss',
      title: 'Part 3: Gauss’s Law',
      mode: 'gauss',
      setup: { lambda: 1, E0x: 0, E0y: 0, xc: 0, yc: 0, r: 2 },
      tasks: [
        {
          id: 'gl-t1',
          title: 'The charge in the bulk',
          prompt: prompt('Explore the charge in the bulk.', INSTRUCTIONS.gauss),
          // outer extent below 5 cm
          condition: 'enc1:HVVZD0FFQVtRBwACSgFHWEcBBgQaEQJRRxZOVBYXRwxjJjdMX0cSC1MK',
          questions: question('What must be true of the charge density in the bulk and why?'),
          points: 1,
          hint: { after: 3, text: 'enc1:RCRFBFhOCEEcB0EBQhIAVBEaF0UpFVUYFhBaTlMWEFInJTFFEEVeRQ8bDRddTEMOFVUIGA0IDBEWUhsLHR1EDkUNU0VTBgpOJTExVF9CHhM' },
        },
        {
          id: 'gl-t2',
          title: 'The charge at the surface',
          prompt: prompt('Explore the charge at the surface.', INSTRUCTIONS.gauss),
          // outer extent above 5 cm and inner extent below 5 cm
          condition: 'enc1:PQwPAkhQBkNJVxMNQwMAVklQAREPAEVJX1tUVQcAFwJtZjNCX0ZVE1xCUFpKAhcYAxBDVg8WBBoCF1BJTAdUChEcGRpRDAtOJDZwDBJSVV0JAA9MBF0-',
          questions: question('What must be true of the charge at the surface of a conductor and why?'),
          points: 1,
          hint: { after: 3, text: 'enc1:RDpMHVQAFwkWVSYNWBcWHQQcUhYbBkYKBhwbUwcXBEQlKDcARFhVEQUYQxJEQxcOAZfh9V5EABACF15FHhVSHwkAG0kdFgxEJGQzTlQQQFAUA0EPEU8WFQAcBQkDRg' },
        },
      ],
    },
  ],
};
