// Phasors Tool: the stylesheet link each Mode's root carries (every rule in phasors.css is
// scoped to .ph-tool).

import { h } from '../../framework/v1/ui-kit.js';

export const toolStyles = () => h('link', { rel: 'stylesheet', href: new URL('./phasors.css', import.meta.url).href });
