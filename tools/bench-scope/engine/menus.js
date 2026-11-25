// The softkey menu state machine (Spec 0002, "Menus"). Pure, no DOM, the same on every skin;
// each skin only draws frame.menu (render.js) and decides which buttons exist (the control map).
//
// A feature module adds a menu by giving itself a `menus` hook, a map of menu definitions:
//
//   menus: {
//     trigger: {
//       button: 'trig-menu',            control whose press opens the menu (absent on a skin = unreachable)
//       title: 'Trigger',               or (ctx) => string
//       items: (ctx) => [item, ...],    one per softkey, top first (an item, or a (ctx) => item
//                                       such as choiceItem gives); null leaves a softkey blank
//       onButton(ctx, showing) -> bool  optional: called when the button is pressed; `showing` is
//                                       whether this menu is on screen now. Return false to close
//                                       the menu instead of opening it (the CH menus turn the
//                                       channel off on a second press). Default: open.
//     },
//   }
//
// An item is { label, value?, options?, select?(ctx), disabled? }: label on the first line, value
// (the current setting) on the second, options (all choices, for skins that list them), and select
// runs when its softkey is pressed. disabled: drawn greyed (an item the simulation doesn't offer;
// give it no select). Build them with choiceItem / toggleItem / infoItem below.
// Items are rebuilt from the settings every time, so a menu never caches a setting.
//
// Behaviour:
//   press <button>     opens that menu (or onButton decides); opening shows it
//   softkey n          selects item n of the menu on screen; nothing if no menu is on screen
//   press menu-onoff   (TBS) hides / shows the open menu
// Menu state is live, not settings: it is not serialized, and restore() and a skin switch reset
// it (no menu open).
//
// Frame: frame.menu = null, or { id, title, items: [{ label, value, options, disabled } | null] } while
// a menu is on screen.
// Wiring: engine.js builds the menu feature from every feature's `menus` (menuSystem below).

const lives = new WeakMap(); // settings -> { open: menu id | null, visible }
const fresh = () => ({ open: null, visible: false });
function liveOf(settings) {
  if (!lives.has(settings)) lives.set(settings, fresh());
  return lives.get(settings);
}

/** The id of the menu on screen for an engine's settings, or null (for features that act only while their menu shows). */
export function menuShown(settings) {
  const live = lives.get(settings);
  return live?.open && live.visible ? live.open : null;
}

/** A softkey that cycles through `options` ([{ value, text }]). */
export function choiceItem(label, options, get, set) {
  return (ctx) => {
    const cur = get(ctx);
    const i = Math.max(0, options.findIndex((o) => o.value === cur));
    return {
      label,
      value: options[i].text,
      options: options.map((o) => o.text),
      select: (c) => set(c, options[(i + 1) % options.length].value),
    };
  };
}

/** A softkey that toggles a boolean, shown as On / Off. */
export function toggleItem(label, get, set) {
  return choiceItem(label, [{ value: false, text: 'Off' }, { value: true, text: 'On' }], get, set);
}

/** A softkey that only shows something (the one setting the simulation offers). */
export function infoItem(label, value) {
  return () => ({ label, value });
}

/** The menu feature for the menus the given features define. */
export function menuSystem(features) {
  const defs = {};
  for (const f of features) Object.assign(defs, f.menus);

  const press = {};
  for (const [id, def] of Object.entries(defs)) {
    press[def.button] = (ctx) => {
      const live = liveOf(ctx.settings);
      const showing = live.open === id && live.visible;
      const open = def.onButton ? def.onButton(ctx, showing) !== false : true;
      if (open) Object.assign(live, { open: id, visible: true });
      else if (live.open === id) Object.assign(live, fresh());
    };
  }
  press['menu-onoff'] = ({ settings }) => {
    const live = liveOf(settings);
    if (live.open) live.visible = !live.visible;
  };

  const shown = (ctx) => {
    const live = liveOf(ctx.settings);
    return live.open && live.visible ? live.open : null;
  };
  const items = (ctx, id) => defs[id].items(ctx).map((it) => (typeof it === 'function' ? it(ctx) : it ?? null));

  return {
    init(settings) { lives.set(settings, fresh()); },
    restore(settings) { lives.set(settings, fresh()); },
    press,
    softkey(ctx, n) {
      const id = shown(ctx);
      if (!id) return;
      items(ctx, id)[Math.trunc(n) - 1]?.select?.(ctx);
    },
    frame(ctx, frame) {
      const id = shown(ctx);
      if (!id) return;
      const title = typeof defs[id].title === 'function' ? defs[id].title(ctx) : defs[id].title;
      frame.menu = {
        id,
        title,
        items: items(ctx, id).map((it) => (it
          ? { label: it.label, value: it.value ?? '', options: it.options ?? null, disabled: it.disabled === true }
          : null)),
      };
    },
  };
}
