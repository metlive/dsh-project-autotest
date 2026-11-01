/**
 * The seven steps of the automated-testing process, as locale-keyed data.
 *
 * One record per language, each carrying the same seven steps in the same
 * order: the page renders `content[activeLocale] ?? content.zh` structurally, so
 * a missing or half-translated language can never shift a step or drop a panel.
 * The figure component draws from `figure: 'analyse' | ...`, an id that is
 * language-independent, so the drawing and the prose cannot drift apart.
 *
 * @module dsh-project-autotest/client/content
 */

/** Which diagram {@link import('./figures.tsx').StepFigure} draws for one step. */
export type FigureId = 'requirement' | 'cases' | 'execution' | 'bugs'

/**
 * Who does the work at a stage.
 *
 * `model` stages run unattended: the agent writes and runs the scripts and
 * reports the result. `human` stages are judgement calls no agent can make for
 * you. `review` is the model's output landing on a human desk — automation
 * runs it, a person decides what the result means.
 */
export type StageOwner = 'human' | 'model' | 'review'

/** One concrete thing a person must do at a stage (empty on model-run stages). */
export interface StageAction {
  /** What to do, in one line. */
  do: string
  /** Why it cannot be left to the model, or what to check. */
  detail: string
}

/** One step, as the detail view renders it. */
export interface Step {
  /** The stable id AND the pipeline stage id (`analyses` maps to `analyse`). */
  id: string
  /** The number shown in the badge and the overview pipeline. */
  number: number
  /** Short Chinese/English title, e.g. 「分析测试需求」. */
  title: string
  /** One-sentence statement of what the step is for. */
  summary: string
  /** What the step consumes from the previous step. */
  input: string
  /** What the step hands to the next step. */
  output: string
  /** Bullet points from the source material, kept in the original emphasis. */
  practices: string[]
  /** The trap this step is most often run into, stated as a warning. */
  pitfall: string
  /** Who does the work here. */
  owner: StageOwner
  /** What a person must do — empty when the model runs the stage alone. */
  actions: StageAction[]
  /** The figure to draw. */
  figure: FigureId
}

/** The flow's content for one locale. */
export interface FlowContent {
  steps: Step[]
  /** The one-line thesis of the whole flow, printed above the pipeline. */
  thesis: string
}

/** Chinese content: the source material, restructured around who does what. */
export const zhContent: FlowContent = {
  thesis: '人工只做两件事的入口：把产品文档和技术方案放进来、把测试用例定下来。脚本编写与执行交给模型，人工只评审结果。',
  steps: [
    {
      id: 'step-requirement',
      number: 1,
      title: '产品文档 / 技术方案',
      summary: '流程的起点：把产品需求文档和技术方案放进工作区，让被测系统「测什么」有唯一出处。',
      input: '产品需求文档、技术方案 / 设计文档、版本规划',
      output: '需求基线：功能点清单、优先级、覆盖率目标、自动化粒度',
      practices: [
        '这是人和模型共用的输入：文档放进来之后，模型读它就能生成用例草稿，人只需要补充文档里没写清楚的地方。',
        '一份技术方案要覆盖接口定义、数据模型、异常码、权限与边界值，这些正是反向用例的来源。',
        '需求变了就替换文档并重新生成，不要靠记忆维护「最新版本是哪份」。',
      ],
      pitfall: '把需求散落在聊天记录和截图里：模型读不到，人也对不上版本，用例设计就只能靠猜。',
      owner: 'human',
      actions: [
        { do: '把产品需求文档和技术方案拖到本页', detail: '支持 .md / .txt 等文本文件；文档会保存到工作区 docs/autotest/inputs/ 下，随项目一起进版本库。' },
        { do: '标出优先级与不做自动化的范围', detail: '明确哪些功能本轮必须先覆盖、哪些暂不覆盖，模型据此收敛用例范围。' },
        { do: '设定覆盖率目标与自动化粒度', detail: '接口级优先；UI 级只覆盖主流程，避免脚本脆弱。' },
      ],
      figure: 'requirement',
    },
    {
      id: 'step-cases',
      number: 2,
      title: '设计测试用例',
      summary: '人工最核心的一步：把功能点翻译成可执行、可自动化的用例，正向优先，反向靠分析筛出来。',
      input: '需求基线、产品文档与技术方案',
      output: '可执行的用例集：前置条件、操作步骤、预期结果、设计方法',
      practices: [
        '自动化测试做不到 100% 覆盖，只能尽可能提高覆盖率：先写正向用例，再通过分析筛出反向用例。',
        '每个用例都要能在无人值守的情况下被脚本执行，并给出明确的通过 / 失败判定。',
        '可以从 XMind / Markdown / CSV 导入现成用例，再在这里补齐预期结果。',
      ],
      pitfall: '用例只写 happy path、断言含糊（只看「不报错」不看数据结果），模型执行后仍无法判断是产品问题还是用例问题。',
      owner: 'human',
      actions: [
        { do: '把需求拆成一条条用例', detail: '一条需求通常对应多条用例；正向优先，反向覆盖边界值、异常输入、权限与并发。' },
        { do: '写清预期结果', detail: '预期必须是可断言的精确结果（状态码、返回字段、页面文案），模型据此判断通过或失败。' },
        { do: '导入已有用例（可选）', detail: '支持 XMind 思维导图、Markdown 评审页、CSV 表格；解析后先预览再落盘。' },
      ],
      figure: 'cases',
    },
    {
      id: 'step-execution',
      number: 3,
      title: '编写并执行测试脚本（模型自动）',
      summary: '模型根据用例自动写脚本、跑脚本并把结果汇报回来；人工不需要写代码，只评审结果。',
      input: '测试用例集、被测系统与可用的测试环境',
      output: '自动化测试脚本、执行结果（每条用例通过 / 失败）、失败记录',
      practices: [
        '脚本的编写与执行全由模型完成：读用例 → 选框架 → 写脚本 → 执行 → 回填结果，人不用碰代码。',
        '模型写完后会先自检：在正确版本上通过、在缺陷版本上失败，两条都成立才算脚本可信。',
        '执行结果直接回到本页：用例的执行结论、失败原因由模型回填，人工只需要看结论。',
        '环境按需准备（本地 / 测试服 / 容器），不再单列为流程阶段。',
      ],
      pitfall: '脚本写完就当「已验证」：没有确认脚本能在正确版本通过、在缺陷版本失败，脚本自身的问题会被当成产品缺陷。',
      owner: 'model',
      actions: [],
      figure: 'execution',
    },
    {
      id: 'step-bugs',
      number: 4,
      title: '跟踪测试 Bug',
      summary: '模型给出失败结论并归因，人工确认是产品缺陷后提单，修复后回归闭环。',
      input: '执行结果、失败日志与模型给出的归因',
      output: '闭环的缺陷（已修复并回归通过）、与需求保持一致的用例与脚本',
      practices: [
        '失败先归因：只有「产品缺陷」才转成 Bug；脚本或环境问题由模型修正后重跑。',
        '缺陷进缺陷管理工具跟踪，修复后必须回归验证，人工确认结果后关闭。',
        '如果修复方案与原始需求有偏离，回归前先同步用例与脚本，否则回归结论不成立。',
      ],
      pitfall: '把每个红色结果都当成产品缺陷：脚本或环境问题被当成 Bug 提交，既浪费开发时间，也让结果没人再认真看。',
      owner: 'review',
      actions: [
        { do: '确认缺陷是否成立', detail: '看模型给出的复现路径与断言差异，确认是产品问题再提单。' },
        { do: '修复后做回归并关闭', detail: '模型跑回归，人确认结果后关闭缺陷；需求有偏离时先要求同步用例与脚本。' },
      ],
      figure: 'bugs',
    },
  ],
}

/** English content: a faithful translation of {@link zhContent}. */
export const enContent: FlowContent = {
  thesis: 'A person owns two entry points: drop in the product docs and technical design, and settle the test cases. Scripts are written and run by the model; a person reviews the result.',
  steps: [
    {
      id: 'step-requirement',
      number: 1,
      title: 'Product docs / technical design',
      summary: 'Where the flow starts: put the product requirements and the technical design into the workspace so "what to test" has one source of truth.',
      input: 'Product requirements, technical design, release plan',
      output: 'A requirements baseline: feature list, priorities, coverage target, automation granularity',
      practices: [
        'This is the input both you and the model work from: once the docs are here the model drafts cases, and you only fill the gaps the docs leave.',
        'A technical design should cover the interface contract, data model, error codes, permissions and boundary values — the raw material for negative cases.',
        'When the requirement changes, replace the document and regenerate; never track "which version is current" from memory.',
      ],
      pitfall: 'Leaving requirements scattered across chat logs and screenshots: the model cannot read them, and nobody can match versions, so case design becomes guesswork.',
      owner: 'human',
      actions: [
        { do: 'Drop the requirements and the technical design onto this page', detail: 'Text documents (.md / .txt) are stored in the workspace under docs/autotest/inputs/ and travel with the project.' },
        { do: 'Mark priorities and what stays out of automation', detail: 'Say which features must be covered this round and which are deferred, so the model narrows the case set.' },
        { do: 'Set the coverage target and the automation granularity', detail: 'API level first; UI level only for the main flow, to keep scripts stable.' },
      ],
      figure: 'requirement',
    },
    {
      id: 'step-cases',
      number: 2,
      title: 'Design test cases',
      summary: 'The human core of the work: turn features into executable cases — positive first, then filter out the negative ones.',
      input: 'The requirements baseline, product docs and the technical design',
      output: 'An executable case set: preconditions, steps, expected results, technique',
      practices: [
        'Automation never reaches 100% coverage: write positive cases first, then filter out the negative ones by analysis.',
        'Every case must run unattended and give an unambiguous pass/fail verdict.',
        'Cases already written elsewhere can be imported from XMind, Markdown or CSV, then completed here.',
      ],
      pitfall: 'Cases covering only the happy path with vague assertions ("no error") leave the model unable to tell a product bug from a bad case.',
      owner: 'human',
      actions: [
        { do: 'Split the requirement into cases', detail: 'One requirement usually maps to several cases: positive first, then boundary values, invalid input, permissions and concurrency.' },
        { do: 'Write exact expected results', detail: 'The expectation must be assertable (status code, returned fields, page copy) so the model can judge pass or fail.' },
        { do: 'Import existing cases (optional)', detail: 'XMind mind maps, Markdown review pages and CSV sheets are supported — you preview before anything is written.' },
      ],
      figure: 'cases',
    },
    {
      id: 'step-execution',
      number: 3,
      title: 'Write and run scripts (model)',
      summary: 'The model writes the scripts, runs them and reports back; you do not write code, you review the result.',
      input: 'The case set, the system under test and a usable environment',
      output: 'Automated scripts, per-case verdicts, failure records',
      practices: [
        'Writing and running scripts belongs to the model: read the case, pick the framework, write the script, run it, fill in the verdict. You never touch the code.',
        'The model self-checks before reporting: the script passes on a correct build and fails on the defective one — both, or it is not trustworthy.',
        'The verdicts land back on this page: last result and failure cause are filled in for you.',
        'The environment is prepared on demand (local / test server / container); it is no longer a stage of its own.',
      ],
      pitfall: 'Treating "script written" as "verified": without the pass-on-good / fail-on-bad check, the script\u2019s own bugs get reported as product defects.',
      owner: 'model',
      actions: [],
      figure: 'execution',
    },
    {
      id: 'step-bugs',
      number: 4,
      title: 'Track test bugs',
      summary: 'The model reports failures and attributes them; you confirm a product defect, file it, and close after regression.',
      input: 'Run results, failure logs and the model\u2019s attribution',
      output: 'Closed defects (fixed and regressed), cases and scripts back in line with the requirement',
      practices: [
        'Attribute first: only a product defect becomes a bug; script and environment failures are fixed and re-run by the model.',
        'Defects are tracked in the defect tool and must be regressed after the fix; a person confirms the result before closing.',
        'If the fix departs from the original requirement, update the cases and scripts before regression, or the verdict is meaningless.',
      ],
      pitfall: 'Treating every red result as a product bug: script and environment problems filed as bugs waste developers\u2019 time and teach everyone to ignore the runs.',
      owner: 'review',
      actions: [
        { do: 'Confirm the defect is real', detail: 'Read the reproduction path and the assertion diff the model reports; file it only when it is a product problem.' },
        { do: 'Regression after the fix, then close', detail: 'The model runs the regression; you confirm and close. When the requirement drifted, ask for the cases and scripts to be updated first.' },
      ],
      figure: 'bugs',
    },
  ],
}

/** Content by language prefix, the table {@link contentFor} reads. */
const CONTENT_BY_LOCALE: Record<string, FlowContent> = {
  zh: zhContent,
  en: enContent,
}

/**
 * The content for a locale id ("zh-CN", "en-US", "zh", …).
 *
 * An unknown language falls back to Chinese rather than throwing: a new UI
 * language should degrade to readable copy, never to a broken page.
 * @param localeId - the shell's active locale id.
 * @returns the flow content for that language.
 */
export function contentFor(localeId: string): FlowContent {
  const language = localeId.toLowerCase().split('-')[0] ?? ''
  return CONTENT_BY_LOCALE[language] ?? zhContent
}

export const CONTENT_STEP_TO_STAGE: Record<string, string> = {
  'step-requirement': 'requirement',
  'step-cases': 'cases',
  'step-execution': 'execution',
  'step-bugs': 'bugs',
}
