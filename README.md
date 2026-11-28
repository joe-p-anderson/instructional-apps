# Instructional apps

Static instructional apps, served as-is (no build). Tools are built on [framework v1](framework/v1/README.md).

## Tools

- [Vernier caliper](tools/vernier/): practise reading a 0.05 mm vernier caliper (outside, inside and depth measurements).
- [Least squares fitting](tools/least-squares/): linearize a physical model, fit a straight line by dragging its (m, b) handle, and judge it by SSE, R², residuals and error bars.
- [Electrostatics](tools/electrostatics/): a charged circular conductor in an applied field, with electric field, potential (probes P1/P2) and Gauss's law Modes.
- [Spacetime diagrams](tools/spacetime/): draw events, worldlines and rods in an Earth frame K and a rocket frame K′, with Lorentz-transformed coordinates, intervals and proper times.
- [Fourier Series](tools/fourier/) (PHY/EGR 3120): a Synthesis Mode that builds a periodic signal from its harmonics and watches the partial sum approach it as N grows, and an Analysis Mode that finds each coefficient as the net area of the signal times a test function, with its spectrum; an RC low-pass or high-pass filter can act on each harmonic's gain and phase in either Mode.
- [Phasors and Impedance](tools/phasors/) (PHY/EGR 3120): a Sum Mode that adds two same-frequency sinusoids A cos(ωt + φ) as phasors, drawn head-to-tail on the complex plane beside their curves in time, and a Circuit Mode for a series R, L and/or C loop: its impedance plane, rotating phasor plane with the KVL closure, time plot and schematic, with ω swept to the RC corner or the LC resonance. Every phasor and impedance reads out in a + jb and A∠φ° form.

## Activities

- [Conductor Properties](tools/electrostatics/activities/conductor-properties.html) (PHY 4300, electrostatics): the field, potential and charge of a conductor in electrostatic equilibrium, explained as modus tollens proofs.
- [Spacetime Diagrams](tools/spacetime/activities/lab10.html) (PHY 1200, spacetime): Lab 10's building the diagram and relativity of simultaneity, read by counting the rocket's tilted grid lines.
- [Frequency Domain: Fourier Series](tools/fourier/activities/fourier-series.html) (PHY/EGR 3120, fourier): build the square and triangle waves from their harmonics, compute a sine's and the square wave's coefficients by hand, then pass the square wave through the RC low-pass and high-pass filters, gain and phase in turn.
- [Phasors and Impedance](tools/phasors/activities/phasors-impedance.html) (PHY/EGR 3120, phasors): add two same-frequency sinusoids as phasors, hand-computing the resultant of two 90° apart and two 120° apart before it is revealed, then work series RC and RLC loops in stages (Z, then I, then each device voltage and the KVL closure), recognize V_C/V_in as the Fourier low-pass H, and sweep ω to resonance.
