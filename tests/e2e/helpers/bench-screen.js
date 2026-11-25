// The bench-scope screen at native resolution, for tests that read its pixels. The live
// canvas is drawn at its displayed size times devicePixelRatio, so pixel positions in screen
// coordinates come from the 'screen' Display snapshot (native resolution) instead.
//
// Call installScreenReader(page) before page.goto(); then, inside page.evaluate(async ...),
// `await window.nativeScreen()` returns a canvas holding the snapshot.

export const installScreenReader = (page) => page.addInitScript(() => {
  window.nativeScreen = async () => {
    const display = window.toolHost.instances[0].displays.find((d) => d.id === 'screen');
    const img = new Image();
    img.src = await display.snapshot();
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
    return c;
  };
});
