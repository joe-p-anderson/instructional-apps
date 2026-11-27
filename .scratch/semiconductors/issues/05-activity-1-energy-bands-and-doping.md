# 05: Activity 1: "Energy Bands and Doping"

**What to build:** A student opens the Activity page, passes the Name gate, and works through four Parts. They end by downloading a Report.

- **Takeaway:** *a material conducts only where carriers have empty states just above them, and the Fermi level (set by the gap, temperature and doping) decides where that happens.*
- **Part 1, Atoms to bands** (Atoms Mode, about 5 minutes). Step N up to "many" and vary the spacing. Questions: what a band is, and why spacing sets the band width and the gap.
- **Part 2, Filling and headroom** (Bulk Mode, T = 0, no doping).
  - **Prediction gate:** the tilt stays hidden until the student Submits "which tank will carry current?"
  - Then they tilt the metal and the full band, and see that only the partly filled band ripples and drifts.
- **Part 3, Gap and temperature** (Bulk Mode, filled band).
  - Students compare insulator and semiconductor by E_g against kT, and see thermal droplets and bubbles.
  - E_F sits in the gap, defined as the 50% level with f(E). An inline caveat says the water table is not a surface.
  - Students tilt the semiconductor. A Task asks why droplets and bubbles moving opposite ways give current in the same direction.
- **Part 4, Doping** (Bulk Mode, room temperature).
  - **Prediction gate:** the doping Controls stay hidden until the student Submits "where will the water table move?" and/or "will the slab be charged?"
  - Then they add donors and acceptors.
  - A Task asks why the minority carriers shrink.
  - The net charge stays 0, and the ions show in the real-space row.

This is pure Activity data, course "PHY/EGR 3120", with encoded answer keys. The Activity page is listed after the Standalone entry in the index and the README.

See [spec](../spec.md): Activity 1, Prediction gates, Activities, Testing Decisions (2, 3).

**Blocked by:** 03 (Bulk tilt and hole current), 04 (Bulk doping and the real-space row).

**Status:** ready-for-agent

- [ ] The Activity names the `semiconductors` Tool. Its four Parts use the intended Modes and Setups, in the order Atoms to bands, Filling and headroom, Gap and temperature, Doping.
- [ ] Each prediction gate hides its Control (tilt, doping) until Submit, and the following Task shows it. Gate Questions pass for any answer, and the answer is recorded in the Report.
- [ ] Conceptual checks are `choice` Questions, with correct answers passing and wrong ones failing. Explanations are `text` Questions, recorded only. There are no numeric hand calculations.
- [ ] Inline caveat text appears in Part 3 (E_F isn't a surface).
- [ ] The Water/Textbook toggle and pause are never hidden by any Task.
- [ ] Runner-core unit tests with `stubTool` cover the Tool name, the Parts and Modes, the gate hide/show behaviour, gates passing any answer, and the answer keys being encoded.
- [ ] A Playwright Activity spec covers the Name gate, a gate blocking its Control until Submit, Submitting a Task, and downloading the Report.
- [ ] The Activity is listed under PHY/EGR 3120 in the index and the README.
