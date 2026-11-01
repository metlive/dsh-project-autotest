/**
 * The sidebar glyph for the 「自动化测试」 row.
 *
 * The `sidebar.panellist` icon share is `{ size, active }`; only `size` is used,
 * and the colour is inherited from the row so the glyph follows the sidebar's
 * own selected and hover states. Drawn inline (rather than importing a
 * primitives icon) so the row carries no dependency on a glyph that may be
 * renamed upstream, and so the pipeline metaphor is this plugin's own.
 *
 * @module dsh-project-autotest/client/FlowIcon
 */
import { createElement as h, type ReactNode } from 'react'

/** Props the sidebar composes for a panel icon. */
export interface FlowIconProps {
  /** The edge length the global panel row asks for, in pixels. */
  size?: number
  /** Whether this panel is selected in the main column. */
  active?: boolean
}

/**
 * Render the pipeline glyph: three steps flowing into a passing check.
 * @param props - the sidebar's icon share.
 * @returns the icon element.
 */
export function FlowIcon({ size = 16 }: FlowIconProps): ReactNode {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    // The three pipeline nodes.
    h('circle', { cx: 2.6, cy: 5, r: 1.35 }),
    h('circle', { cx: 8, cy: 5, r: 1.35 }),
    h('circle', { cx: 13.4, cy: 5, r: 1.35 }),
    h('path', { d: 'M3.95 5h2.7M9.35 5h2.7' }),
    // The verdict: down into a check.
    h('path', { d: 'M8 6.35v2.2' }),
    h('circle', { cx: 8, cy: 11.7, r: 2.55 }),
    h('path', { d: 'M6.9 11.7l.85.9 1.45-1.6' }),
  )
}
