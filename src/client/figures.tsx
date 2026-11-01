/**
 * The inline SVG figures for the pipeline stages, plus the overview pipeline.
 *
 * Every figure is drawn with `currentColor` / `var(--dsw-alias-*)` tokens only,
 * so it follows light and dark themes without a second asset. Each figure has
 * `role="img"` and an `aria-label` supplied by the caller (the step title), and
 * is marked `focusable="false"` so it never traps tab focus in the panel.
 *
 * @module dsh-project-autotest/client/figures
 */
import { createElement as h, Fragment, type ReactNode } from 'react'
import type { FigureId } from './content.ts'

/** Shared stroke defaults: thin, round, inherits the label colour. */
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Filled badge shape used for nodes. */
const NODE = {
  fill: 'var(--dsw-alias-bg-layer-2)',
  stroke: 'currentColor',
  strokeWidth: 1.3,
}

/** A rounded rectangle plus a centred two-line label, the figure's basic node. */
function node(x: number, y: number, w: number, label: string, sub?: string, tone?: string): ReactNode {
  return h(
    Fragment,
    { key: `${x}-${y}-${label}` },
    h('rect', { x, y, width: w, height: 30, rx: 6, ...(tone === undefined ? NODE : { ...NODE, stroke: tone }) }),
    h(
      'text',
      {
        x: x + w / 2,
        y: sub === undefined ? y + 19 : y + 14,
        textAnchor: 'middle',
        fontSize: 9.5,
        fill: 'currentColor',
      },
      label,
    ),
    sub === undefined
      ? null
      : h('text', { x: x + w / 2, y: y + 24, textAnchor: 'middle', fontSize: 7.5, opacity: 0.62, fill: 'currentColor' }, sub),
  )
}

/** A short arrow with an open head. */
function arrow(x1: number, y1: number, x2: number, y2: number, key: string): ReactNode {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 5
  const hx1 = x2 - head * Math.cos(angle - Math.PI / 7)
  const hy1 = y2 - head * Math.sin(angle - Math.PI / 7)
  const hx2 = x2 - head * Math.cos(angle + Math.PI / 7)
  const hy2 = y2 - head * Math.sin(angle + Math.PI / 7)
  return h(Fragment, { key }, h('path', { d: `M${x1} ${y1}L${x2} ${y2}`, ...STROKE, opacity: 0.55 }), h('path', {
    d: `M${hx1.toFixed(2)} ${hy1.toFixed(2)}L${x2} ${y2}L${hx2.toFixed(2)} ${hy2.toFixed(2)}`,
    ...STROKE,
    opacity: 0.55,
  }))
}

/** A check glyph, used for "covered / passes". */
function check(cx: number, cy: number, size = 4): ReactNode {
  return h('path', {
    d: `M${cx - size} ${cy}l${size * 0.75} ${size * 0.8}l${size * 1.3} -${size * 1.5}`,
    ...STROKE,
    strokeWidth: 1.7,
    stroke: 'var(--dsw-alias-state-success-primary)',
  })
}

/** A cross glyph, used for "excluded / fails". */
function cross(cx: number, cy: number, size = 3.4): ReactNode {
  return h('path', {
    d: `M${cx - size} ${cy - size}l${size * 2} ${size * 2}M${cx + size} ${cy - size}l-${size * 2} ${size * 2}`,
    ...STROKE,
    strokeWidth: 1.7,
    stroke: 'var(--dsw-alias-state-error-primary)',
  })
}

/** Draw the first step's figure: a requirement split into positive / negative cases. */
function analyseFigure(): ReactNode {
  return h(
    Fragment,
    null,
    node(12, 12, 64, '测试需求', '功能点', 'var(--dsw-alias-brand-primary)'),
    arrow(76, 27, 104, 27, 'a1'),
    node(104, 6, 52, '正向用例', '优先实现'),
    check(169, 21),
    arrow(104, 48, 116, 48, 'a2'),
    node(116, 36, 52, '反向用例', '分析筛选'),
    check(181, 51),
    // Coverage meter: a partially filled bar, the point that coverage is never 100%.
    h('rect', { x: 104, y: 60, width: 74, height: 7, rx: 3.5, fill: 'none', stroke: 'currentColor', strokeWidth: 1, opacity: 0.5 }),
    h('rect', { x: 104, y: 60, width: 46, height: 7, rx: 3.5, fill: 'var(--dsw-alias-brand-primary)', opacity: 0.75 }),
    h('text', { x: 12, y: 66, fontSize: 7.5, fill: 'currentColor', opacity: 0.62 }, '覆盖率'),
  )
}

/** Draw step ①: the two documents going in, the baseline coming out. */
function requirementFigure(): ReactNode {
  return h(
    Fragment,
    null,
    // Two stacked documents: product requirements and the technical design.
    h('rect', { x: 18, y: 4, width: 46, height: 56, rx: 5, ...NODE, opacity: 0.55 }),
    h('rect', { x: 12, y: 10, width: 46, height: 56, rx: 5, ...NODE }),
    h('path', { d: 'M19 22h32M19 30h32M19 38h24M19 46h28', ...STROKE, strokeWidth: 1.1, opacity: 0.45 }),
    h('text', { x: 35, y: 18, textAnchor: 'middle', fontSize: 7.5, fill: 'currentColor' }, '产品需求'),
    h('text', { x: 64, y: 62, textAnchor: 'middle', fontSize: 7, fill: 'currentColor', opacity: 0.62 }, '技术方案'),
    arrow(62, 40, 84, 40, 'r1'),
    // The baseline it produces.
    h('rect', { x: 86, y: 14, width: 74, height: 50, rx: 6, ...NODE }),
    h('text', { x: 123, y: 27, textAnchor: 'middle', fontSize: 8, fill: 'currentColor' }, '需求基线'),
    h('path', { d: 'M96 36h54M96 44h44M96 52h48', ...STROKE, strokeWidth: 1.1, opacity: 0.45 }),
    h('circle', { cx: 154, cy: 56, r: 3.2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.1 }),
    h('text', { x: 123, y: 74, textAnchor: 'middle', fontSize: 7.5, fill: 'currentColor', opacity: 0.62 }, '功能点 · 优先级 · 覆盖率'),
  )
}

/** Draw the third step's figure: a case card and a realistic-environment switch. */
function casesFigure(): ReactNode {
  const lines = [30, 38, 46, 54]
  return h(
    Fragment,
    null,
    h('rect', { x: 12, y: 6, width: 78, height: 58, rx: 7, ...NODE }),
    h('text', { x: 18, y: 17, fontSize: 8, fill: 'currentColor', opacity: 0.8 }, '测试用例'),
    lines.map((y, index) =>
      h('rect', {
        key: y,
        x: 18,
        y: y - 6,
        width: index === 2 ? 40 : 62 - index * 8,
        height: 4.5,
        rx: 2,
        fill: 'currentColor',
        opacity: 0.28,
      }),
    ),
    check(78, 48, 3.4),
    arrow(90, 35, 108, 35, 'c1'),
    // Real environment: a monitor with the app inside, labelled.
    h('rect', { x: 110, y: 10, width: 52, height: 36, rx: 4, ...NODE }),
    h('rect', { x: 114, y: 14, width: 44, height: 22, rx: 2, fill: 'currentColor', opacity: 0.1 }),
    h('path', { d: 'M114 17h44', ...STROKE, opacity: 0.35 }),
    h('circle', { cx: 130, cy: 25, r: 3.4, fill: 'none', stroke: 'currentColor', strokeWidth: 1.1 }),
    h('path', { d: 'M114 36l7-6 5 4 6-7 6 6 5-3 5 6', ...STROKE, strokeWidth: 1.1, opacity: 0.6 }),
    h('path', { d: 'M128 46v5M138 46v5M124 51h18', ...STROKE, opacity: 0.6 }),
    h('text', { x: 136, y: 62, textAnchor: 'middle', fontSize: 7.5, fill: 'currentColor', opacity: 0.62 }, '真实环境'),
  )
}

/** Draw the fifth step's figure: script → run → script bug loop, with the developer channel. */
function scriptsFigure(): ReactNode {
  return h(
    Fragment,
    null,
    h('rect', { x: 12, y: 6, width: 78, height: 30, rx: 6, ...NODE }),
    h('text', { x: 51, y: 18, textAnchor: 'middle', fontSize: 8.5, fill: 'currentColor' }, '公共测试框架'),
    h('text', { x: 51, y: 28, textAnchor: 'middle', fontSize: 7.5, fill: 'currentColor', opacity: 0.62 }, '先确立'),
    arrow(51, 36, 51, 46, 's1'),
    h('rect', { x: 12, y: 46, width: 78, height: 26, rx: 6, ...NODE }),
    h('text', { x: 51, y: 57, textAnchor: 'middle', fontSize: 8.5, fill: 'currentColor' }, '编写测试脚本'),
    h('text', { x: 51, y: 66, textAnchor: 'middle', fontSize: 7.5, fill: 'currentColor', opacity: 0.62 }, '按计划与用例'),
    arrow(90, 59, 108, 59, 's2'),
    h('rect', { x: 108, y: 46, width: 78, height: 26, rx: 6, ...NODE }),
    h('text', { x: 147, y: 57, textAnchor: 'middle', fontSize: 8.5, fill: 'currentColor' }, '反复执行'),
    h('text', { x: 147, y: 66, textAnchor: 'middle', fontSize: 7.5, fill: 'currentColor', opacity: 0.62 }, '确保脚本正确'),
    // The loop back: a failing run returns to the script, not to the product.
    h('path', { d: 'M147 46q0-12-12-12h-72q-12 0-12 12', ...STROKE, opacity: 0.55, strokeDasharray: '3 2.5' }),
    h('text', { x: 99, y: 31, textAnchor: 'middle', fontSize: 7.5, fill: 'currentColor', opacity: 0.7 }, '脚本自身错误 → 修脚本与调试'),
    // The side channel to developers.
    h('path', { d: 'M108 21h-6', ...STROKE, opacity: 0.4 }),
    h('text', { x: 108, y: 24, fontSize: 7, fill: 'currentColor', opacity: 0.62 }, '与开发沟通内部结构'),
  )
}

/** Draw the sixth step's figure: a daily triage that splits real defects from script/env faults. */
function resultsFigure(): ReactNode {
  return h(
    Fragment,
    null,
    node(12, 22, 62, '执行结果', '每日分析', 'var(--dsw-alias-brand-primary)'),
    arrow(74, 37, 94, 37, 'r1'),
    // The diamond decision.
    h('path', { d: 'M110 18l18 19-18 19-18-19Z', ...NODE }),
    h('text', { x: 110, y: 34, textAnchor: 'middle', fontSize: 7.5, fill: 'currentColor' }, '是真'),
    h('text', { x: 110, y: 43, textAnchor: 'middle', fontSize: 7.5, fill: 'currentColor' }, '缺陷?'),
    arrow(128, 37, 144, 20, 'r2'),
    arrow(128, 37, 144, 54, 'r3'),
    h('rect', { x: 146, y: 8, width: 52, height: 24, rx: 5, ...NODE, stroke: 'var(--dsw-alias-state-error-primary)' }),
    h('text', { x: 172, y: 19, textAnchor: 'middle', fontSize: 8, fill: 'currentColor' }, '记录并提交'),
    h('text', { x: 172, y: 28, textAnchor: 'middle', fontSize: 7.5, fill: 'currentColor', opacity: 0.62 }, '给开发修复'),
    h('rect', { x: 146, y: 42, width: 52, height: 24, rx: 5, ...NODE, stroke: 'var(--dsw-alias-state-warn-primary)' }),
    h('text', { x: 172, y: 53, textAnchor: 'middle', fontSize: 8, fill: 'currentColor' }, '检查脚本'),
    h('text', { x: 172, y: 62, textAnchor: 'middle', fontSize: 7.5, fill: 'currentColor', opacity: 0.62 }, '或测试环境'),
    h('text', { x: 12, y: 12, fontSize: 7.5, fill: 'currentColor', opacity: 0.62 }, '每天固定时间分析'),
  )
}

/** Draw the seventh step's figure: defect → fix → regression → close, with a requirement deviation. */
function bugsFigure(): ReactNode {
  const stages = ['缺陷记录', '开发修复', '回归测试', '闭环']
  return h(
    Fragment,
    null,
    stages.map((label, index) => {
      const x = 12 + index * 45
      return h(Fragment, { key: label },
        h('rect', {
          x,
          y: 18,
          width: 38,
          height: 24,
          rx: 6,
          ...NODE,
          ...(index === 3 ? { stroke: 'var(--dsw-alias-state-success-primary)' } : {}),
        }),
        h('text', { x: x + 19, y: 33, textAnchor: 'middle', fontSize: 7.8, fill: 'currentColor' }, label),
        index < stages.length - 1 ? arrow(x + 38, 30, x + 45, 30, `b${index}`) : null,
      )
    }),
    // The deviation branch: a changed requirement sends the script back for
    // editing before regression. It hangs below the 「回归测试」 stage.
    h('path', { d: 'M95 42v6q0 6 6 6h48q6 0 6-6v-6', ...STROKE, opacity: 0.5, strokeDasharray: '3 2.5' }),
    h('text', { x: 99, y: 60, textAnchor: 'middle', fontSize: 7, fill: 'currentColor', opacity: 0.7 }, '偏离原始需求 → 回归前先改脚本'),
    h('text', { x: 12, y: 12, fontSize: 7.5, fill: 'currentColor', opacity: 0.62 }, '缺陷管理工具中定期跟踪'),
  )
}

/** The figure registry. */
const FIGURES: Record<FigureId, () => ReactNode> = {
  requirement: requirementFigure,
  cases: casesFigure,
  execution: scriptsFigure,
  bugs: bugsFigure,
}

/**
 * Render one step's figure.
 *
 * Called by the panel, never mounted as a component: the panel builds its tree
 * with `createElement` and there is no JSX runtime to instantiate a component
 * from a function reference.
 * @param figure - which figure to draw.
 * @param label - the accessible label (the step title).
 * @returns the figure element.
 */
export function stepFigure(figure: FigureId, label: string): ReactNode {
  return h(
    'svg',
    {
      className: 'dpat-figure',
      viewBox: '0 0 200 72',
      role: 'img',
      'aria-label': label,
      focusable: 'false',
    },
    (FIGURES[figure] ?? analyseFigure)(),
  )
}

/**
 * Render the seven-step overview pipeline.
 *
 * Called, not mounted — see {@link stepFigure}.
 *
 * Each stage is a numbered chip; the connector between chips is drawn by the
 * list's own `::before` rule, so no connector element is emitted here.
 * @param props.labels - the seven step titles, in order.
 * @param props.label - the accessible label for the whole diagram.
 * @returns the pipeline element.
 */
export function flowPipeline(labels: string[], label: string): ReactNode {
  return h(
    'ol',
    { className: 'dpat-pipeline', 'aria-label': label },
    labels.map((title, index) =>
      h(
        'li',
        { key: `${index}-${title}`, className: 'dpat-pipelineItem' },
        h('span', { className: 'dpat-pipelineIndex', 'aria-hidden': 'true' }, String(index + 1)),
        h('span', { className: 'dpat-pipelineTitle' }, title),
      ),
    ),
  )
}
