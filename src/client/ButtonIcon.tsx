/**
 * Inline glyphs for the workbench's buttons.
 *
 * Every button pairs its label with a 14px stroke glyph, the way the host's
 * own toolbars read: the icon carries the recognition, the word carries the
 * meaning. They are drawn inline — no icon package, no external file — and
 * painted with `currentColor`, so a button's normal, hover and disabled
 * colours apply to the glyph without any extra rule.
 *
 * `play` alone is filled rather than stroked: at 14px an outlined triangle
 * reads as a smudge.
 *
 * @module dsh-project-autotest/client/ButtonIcon
 */
import { createElement as h, type ReactNode } from 'react'

/** Every glyph this plugin ships; a `data-icon` attribute carries the name. */
export type ButtonIconName =
  | 'import'
  | 'export'
  | 'add'
  | 'play'
  | 'prev'
  | 'next'
  | 'bug'
  | 'close'
  | 'apply'
  | 'reset'

/** The path data per glyph, on a 16×16 grid. */
const PATHS: Record<Exclude<ButtonIconName, 'play'>, string> = {
  // An arrow dropping into an open tray.
  import: 'M8 2.2v6.6M5.3 6.2 8 8.9l2.7-2.7M2.9 10.9v1.6a1.2 1.2 0 0 0 1.2 1.2h7.8a1.2 1.2 0 0 0 1.2-1.2v-1.6',
  // An arrow lifting out of a closed tray.
  export: 'M8 9.2V2.6M5.3 5.3 8 2.6l2.7 2.7M2.9 9.6v2.9a1.2 1.2 0 0 0 1.2 1.2h7.8a1.2 1.2 0 0 0 1.2-1.2V9.6',
  add: 'M8 3.4v9.2M3.4 8h9.2',
  // The "more" chevrons of the pager.
  prev: 'M10 4.2 6.2 8l3.8 3.8',
  next: 'M6 4.2 9.8 8 6 11.8',
  // A bug: shell, legs, antennae.
  bug: 'M8 4.6a3 3 0 0 1 3 3v2.2a3 3 0 0 1-6 0V7.6a3 3 0 0 1 3-3ZM8 2.6v2M6.2 3.6 5 2.5M9.8 3.6 11 2.5M5 7.6H2.4M13.6 7.6H11M5.2 10.6 2.9 12M10.8 10.6 13.1 12',
  close: 'M4.6 4.6l6.8 6.8M11.4 4.6l-6.8 6.8',
  // A tick accepting the change.
  apply: 'M3 8.4 6.3 11.6 13 4.8',
  // A counter-clockwise arrow going back to the default.
  reset: 'M3.1 8a4.9 4.9 0 1 0 1.5-3.5M3 2.9v2.6h2.6',
}

/** Props for a button glyph. */
export interface ButtonIconProps {
  /** Which glyph to draw. */
  name: ButtonIconName
}

/**
 * Render a button glyph, hidden from assistive technology (the label speaks).
 * @param props - the glyph name.
 * @returns the icon element.
 */
export function ButtonIcon({ name }: ButtonIconProps): ReactNode {
  return h(
    'svg',
    {
      className: 'dpat-btnIcon',
      viewBox: '0 0 16 16',
      width: 14,
      height: 14,
      'aria-hidden': 'true',
      focusable: 'false',
      'data-icon': name,
    },
    name === 'play'
      ? h('path', { d: 'M5.6 3.4 12.2 8l-6.6 4.6z', fill: 'currentColor', stroke: 'none' })
      : h('path', {
        d: PATHS[name],
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
  )
}
