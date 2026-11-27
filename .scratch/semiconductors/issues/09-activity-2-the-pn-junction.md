# 09: Activity 2: "The p–n Junction"

**What to build:** A student opens the Activity page, passes the Name gate, and works through three Junction Parts. They end by downloading a Report.

- **Takeaway:** *carriers spill across until the ions they leave exposed build a hill (the bent bands) that stops them; bias lowers or raises that hill, so current flows easily one way only.*
- **Part 1, Join** (slabs apart, zero bias).
  - **Prediction gate:** Join stays hidden until the student Submits "which way will the liquid flow, and what happens to the n-side bands?"
  - They join and scrub the timeline. Tasks point at early moments (big flow, small hill) and late ones (no net flow, full hill).
- **Part 2, Equilibrium anatomy** (joined, V = 0).
  - Fullness varies with position, and depletion = exposed ions.
  - Ions → ρ → E → bend.
  - The climber and roller arrows balance.
- **Part 3, Bias.**
  - **Prediction gate:** forward bias stays locked until the student Submits a prediction of what it does to the hill.
  - Then they explore forward and reverse.
  - Tasks cover:
    - the depletion region narrowing but keeping its exposed ions;
    - the saturation current coming from rolling minority droplets;
    - what sets the photon energy (one Task).
  - An inline caveat says the films are exaggerated.

Doping is fixed and symmetric throughout. This is pure Activity data, course "PHY/EGR 3120", with encoded answer keys. The Activity page is listed after Activity 1 in the index and the README.

See [spec](../spec.md): Activity 2, Prediction gates, Activities, Testing Decisions (2, 3).

**Blocked by:** 07 (Join timeline), 08 (Bias, battery and recombination).

**Status:** ready-for-agent

- [ ] The Activity names the `semiconductors` Tool. Its three Parts use Junction Mode with the intended Setups, in the order Join, Equilibrium anatomy, Bias.
- [ ] The Join gate hides the Join Control until Submit.
- [ ] The bias gate keeps forward bias unavailable until Submit. Use the framework's Task `hide` list, for example by hiding the bias Control or exposing a reverse-and-zero-only Setup first. If the framework can't express this, raise it rather than work around it.
- [ ] Gate Questions pass for any answer, and the answer is recorded in the Report.
- [ ] Conceptual checks are `choice` Questions, explanations are `text` Questions, and there are no numeric hand calculations. Conditions use the published State where needed (for example "joined and τ = 1", "bias > 0.5 V_bi").
- [ ] Inline caveat text appears in Part 3 (the films are exaggerated).
- [ ] The Water/Textbook toggle and pause are never hidden by any Task.
- [ ] Runner-core unit tests with `stubTool` cover the Tool name, the Parts and Setups, the gate hide/show behaviour, gates passing any answer, and the answer keys being encoded.
- [ ] A Playwright Activity spec covers the Name gate, the Join gate blocking Join until Submit, Submitting a Task, and downloading the Report.
- [ ] The Activity is listed under PHY/EGR 3120 in the index and the README.
