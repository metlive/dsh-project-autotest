/**
 * Styles for the workbench, following the official client-plugin convention:
 * one `<style>` tag keyed by `data-plugin-css`, inserted once per document and
 * reused afterwards.
 *
 * The layout is the light, single-rail design: the header, a 232px left stage
 * nav (stages 1/2 grouped as preparation, 3/4 as run & review), then a right
 * column with one KPI line, a centred 1080px stage and the storage footer.
 * The stage bar never appears across the top. Every colour reads a DSH theme
 * alias with a literal fallback, so a renamed upstream token can degrade the
 * look but never break the layout, and the host's dark theme still renders.
 *
 * Every selector is scoped under `.dpat-`; no external font, image or library.
 *
 * @module dsh-project-autotest/client/styles
 */

/** The key that identifies this plugin's stylesheet tag in the document. */
export const STYLE_KEY = 'dsh-project-autotest/flow.css'

/** The page's rules. */
export const CSS = `
.dpat-root {
  /* ---- type ---- */
  --dpat-fs-xs: 12px; --dpat-fs-sm: 13px; --dpat-fs-base: 14px;
  --dpat-fs-lg: 16px; --dpat-fs-xl: 20px;
  /* ---- colour: one theme alias per role, always with a light fallback ---- */
  --dpat-fg: var(--dsw-alias-label-primary, #1b1f24);
  --dpat-fg2: var(--dsw-alias-label-secondary, #5f6b7a);
  --dpat-fg3: var(--dsw-alias-label-tertiary, #98a2b3);
  --dpat-bg: var(--dsw-alias-bg-base, #f7f8fa);
  --dpat-surface: var(--dsw-alias-bg-layer-1, #ffffff);
  --dpat-surface2: var(--dsw-alias-bg-layer-2, #f1f3f7);
  --dpat-subtle: var(--dsw-alias-bg-module-platform, #eef1f6);
  --dpat-line: var(--dsw-alias-border-l1, #e6e9ee);
  --dpat-line2: var(--dsw-alias-border-l2, #d5dae2);
  --dpat-accent: var(--dsw-alias-brand-primary, #4d6bfe);
  --dpat-accent-soft: color-mix(in srgb, var(--dpat-accent) 10%, transparent);
  /* Always white, never the theme's "foreground": some hosts paint a filled
     control near-black and alias its label to black too, which is the pile-up
     this file exists to avoid. */
  --dpat-fg-on-accent: #ffffff;
  --dpat-ok: var(--dsw-alias-state-success-primary, #15a463);
  --dpat-ok-soft: color-mix(in srgb, var(--dpat-ok) 9%, transparent);
  --dpat-warn: var(--dsw-alias-state-warn-primary, #d98a0b);
  --dpat-warn-soft: color-mix(in srgb, var(--dpat-warn) 10%, transparent);
  --dpat-bad: var(--dsw-alias-state-error-primary, #dc4a4a);
  --dpat-bad-soft: color-mix(in srgb, var(--dpat-bad) 10%, transparent);
  --dpat-hover: var(--dsw-alias-interactive-bg-hover, rgba(20,30,50,.05));
  /* The primary pill's ramp. Both ends lift the brand toward white and never
     toward black: mixing in black is what turns a solid brand button into an
     apparent black chip at small sizes or on a low-DPI screen. */
  --dpat-accent-hi: color-mix(in srgb, var(--dpat-accent) 80%, #ffffff);
  --dpat-accent-lo: color-mix(in srgb, var(--dpat-accent) 94%, #ffffff);
  /* ---- shape and space ---- */
  --dpat-r-sm: 8px; --dpat-r-md: 10px; --dpat-r-lg: 12px; --dpat-r-pill: 999px;
  --dpat-radius: var(--dpat-r-lg);
  --dpat-shadow: var(--dsw-elevation-prominent, 0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06));
  --dpat-s1: 4px; --dpat-s2: 8px; --dpat-s3: 12px; --dpat-s4: 16px; --dpat-s5: 24px;
  box-sizing: border-box; display: flex; flex-direction: column; height: 100%; min-height: 0;
  color: var(--dpat-fg); background: var(--dpat-bg);
  font-size: var(--dpat-fs-base); line-height: 1.6; -webkit-font-smoothing: antialiased; }
.dpat-root *, .dpat-root *::before, .dpat-root *::after { box-sizing: border-box; }
.dpat-root h1, .dpat-root h2, .dpat-root h3, .dpat-root h4,
.dpat-root p, .dpat-root ul, .dpat-root ol, .dpat-root fieldset { margin: 0; }
.dpat-root button, .dpat-root input, .dpat-root select, .dpat-root textarea { font: inherit; color: inherit; }
.dpat-root button { cursor: pointer; }

/* ---------------- shared controls ---------------- */
.dpat-input { width: 100%; min-height: 38px; padding: 8px 11px; font-size: var(--dpat-fs-sm);
  color: var(--dpat-fg); background: var(--dpat-surface); border: 1px solid var(--dpat-line2);
  border-radius: var(--dpat-r-sm); }
.dpat-input::placeholder { color: var(--dpat-fg3); opacity: 1; }
.dpat-input:hover { border-color: var(--dpat-line2); }
.dpat-input:focus-visible { outline: none; border-color: var(--dpat-accent); box-shadow: 0 0 0 3px var(--dpat-accent-soft); }
.dpat-textarea { resize: vertical; min-height: 76px; line-height: 1.6; }
.dpat-select { width: 100%; height: 38px; padding: 0 30px 0 11px; font-size: var(--dpat-fs-sm);
  color: var(--dpat-fg); background: var(--dpat-surface); border: 1px solid var(--dpat-line2);
  border-radius: var(--dpat-r-sm); cursor: pointer; appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 16px) 16px, calc(100% - 11px) 16px;
  background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; }
.dpat-select:hover { border-color: var(--dpat-line2); }
.dpat-select:focus-visible { outline: none; border-color: var(--dpat-accent); box-shadow: 0 0 0 3px var(--dpat-accent-soft); }
.dpat-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.dpat-selectLabel, .dpat-fieldLabel { font-size: var(--dpat-fs-sm); font-weight: 600; color: var(--dpat-fg2); }
/* Header labels must never wrap into a vertical stack when the toolbar is tight. */
.dpat-wbHead .dpat-selectLabel, .dpat-wbHead .dpat-fieldLabel { white-space: nowrap; }
.dpat-fieldValue { font-size: var(--dpat-fs-sm); color: var(--dpat-fg); }
.dpat-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.dpat-controlRow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 268px); gap: 12px; }
.dpat-fieldInline { flex-direction: column; align-items: stretch; }
.dpat-targetWrap { display: flex; align-items: center; gap: 6px; }
.dpat-targetInput { width: 96px; text-align: right; font-variant-numeric: tabular-nums; }
.dpat-unit { color: var(--dpat-fg3); font-size: var(--dpat-fs-sm); }
.dpat-fieldset { padding: 10px 12px; border: 1px solid var(--dpat-line); border-radius: var(--dpat-r-md); }
.dpat-fieldset legend { padding: 0 5px; }
.dpat-check { display: inline-flex; align-items: center; gap: 6px; margin-right: 16px; font-size: var(--dpat-fs-sm); cursor: pointer; }
.dpat-check input { margin: 0; accent-color: var(--dpat-accent); }

/* ---- buttons ----
   Every button is a pill: rounded to the same 999px as the chips and status
   pills around it, tinted rather than filled for secondary work, and solid
   brand blue with a soft shadow only for the one forward action on a surface.
   The host's own primary colour can be near-black in some themes, so the
   brand gradient below is built from --dpat-accent with explicit stops —
   the pill still reads as a button in a dark theme instead of a black blob. */
.dpat-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  appearance: none; height: 30px; padding: 0 13px; font-size: var(--dpat-fs-sm); font-weight: 600;
  line-height: 1; letter-spacing: .01em; white-space: nowrap;
  color: var(--dpat-fg2); background: var(--dpat-surface2);
  border: 1px solid var(--dpat-line); border-radius: var(--dpat-r-pill);
  transition: background-color .16s ease, border-color .16s ease, color .16s ease,
    box-shadow .16s ease, transform .16s ease; }
.dpat-btn:hover:not(:disabled) { color: var(--dpat-fg); background: var(--dpat-subtle);
  border-color: var(--dpat-line2); box-shadow: 0 1px 2px rgba(16,24,40,.06); }
.dpat-btn:active:not(:disabled) { transform: translateY(.5px) scale(.985); }
.dpat-btn:disabled { opacity: .5; cursor: not-allowed; }
.dpat-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--dpat-accent-soft); }
.dpat-btn .dpat-btnIcon { flex: none; display: block; width: 13px; height: 13px; }
.dpat-btnPrimary { color: var(--dpat-fg-on-accent); border-color: transparent;
  background: linear-gradient(180deg, var(--dpat-accent-hi) 0%, var(--dpat-accent) 100%);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--dpat-accent) 32%, transparent),
    0 2px 8px color-mix(in srgb, var(--dpat-accent) 22%, transparent); }
.dpat-btnPrimary:hover:not(:disabled) { color: var(--dpat-fg-on-accent);
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--dpat-accent) 68%, #ffffff) 0%,
    color-mix(in srgb, var(--dpat-accent) 84%, #ffffff) 100%);
  box-shadow: 0 2px 4px color-mix(in srgb, var(--dpat-accent) 30%, transparent),
    0 6px 16px color-mix(in srgb, var(--dpat-accent) 22%, transparent); }
.dpat-btnPrimary:focus-visible { box-shadow: 0 0 0 3px var(--dpat-accent-soft),
    0 2px 8px color-mix(in srgb, var(--dpat-accent) 22%, transparent); }
.dpat-btnDanger { width: max-content; color: var(--dpat-bad); border-color: color-mix(in srgb, var(--dpat-bad) 30%, transparent);
  background: var(--dpat-bad-soft); }
/* A button inside a stacked card (the defect form) is a control, not a band:
   it keeps its intrinsic width instead of filling the row. */
.dpat-case > .dpat-btn, .dpat-caseBody > .dpat-btn { justify-self: start; align-self: start; }
.dpat-iconBtn.dpat-danger { width: 30px; }
.dpat-btnDanger:hover:not(:disabled) { color: var(--dpat-fg-on-accent); background: var(--dpat-bad);
  border-color: var(--dpat-bad); box-shadow: 0 2px 8px color-mix(in srgb, var(--dpat-bad) 28%, transparent); }
.dpat-linkBtn { display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border: 0;
  background: transparent; color: var(--dpat-accent); font-size: var(--dpat-fs-sm); border-radius: var(--dpat-r-sm); }
.dpat-linkBtn:hover { background: var(--dpat-accent-soft); }
.dpat-iconBtn { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px;
  padding: 0; border: 1px solid var(--dpat-line); border-radius: 50%; background: var(--dpat-surface2);
  color: var(--dpat-fg3); font-size: 14px; transition: background-color .16s ease, color .16s ease, border-color .16s ease; }
.dpat-iconBtn:hover { background: var(--dpat-subtle); border-color: var(--dpat-line2); color: var(--dpat-fg); }
.dpat-iconBtn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--dpat-accent-soft); }
.dpat-iconBtn.dpat-danger:hover { color: var(--dpat-bad); border-color: color-mix(in srgb, var(--dpat-bad) 35%, transparent); background: var(--dpat-bad-soft); }
.dpat-muted { color: var(--dpat-fg2); }
.dpat-small { font-size: var(--dpat-fs-sm); }
.dpat-danger { color: var(--dpat-bad); }
.dpat-hintWarn { font-size: var(--dpat-fs-sm); color: var(--dpat-warn); }
.dpat-hintOk { font-size: var(--dpat-fs-sm); color: var(--dpat-ok); }
.dpat-badgeOk { display: inline-block; margin-top: 6px; padding: 1px 9px; border-radius: var(--dpat-r-pill);
  font-size: var(--dpat-fs-xs); color: var(--dpat-ok); border: 1px solid var(--dpat-ok); background: var(--dpat-ok-soft); }
.dpat-chip, .dpat-kindChip { display: inline-flex; align-items: center; padding: 1px 9px; border-radius: var(--dpat-r-pill);
  font-size: var(--dpat-fs-xs); color: var(--dpat-fg2); border: 1px solid var(--dpat-line); background: var(--dpat-surface2); }
.dpat-kindChip-positive { color: var(--dpat-ok); border-color: var(--dpat-ok); }
.dpat-kindChip-negative { color: var(--dpat-warn); border-color: var(--dpat-warn); }

.dpat-card { padding: 20px 22px; border: 1px solid var(--dpat-line); border-radius: var(--dpat-r-lg); background: var(--dpat-surface); }
.dpat-cardWide { padding: 20px 22px; }
.dpat-cardTitle { margin: 0 0 12px; font-size: var(--dpat-fs-base); font-weight: 650; }
.dpat-cardWarn { border-color: var(--dpat-warn); background: var(--dpat-warn-soft); }
.dpat-warnText { font-size: var(--dpat-fs-sm); }
.dpat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.dpat-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.dpat-list li { display: flex; gap: 8px; align-items: flex-start; font-size: var(--dpat-fs-sm); }
.dpat-dot { flex: none; width: 5px; height: 5px; margin-top: 8px; border-radius: 50%; background: var(--dpat-accent); }
.dpat-banner { display: flex; align-items: center; gap: 10px; margin: 0 28px 8px; padding: 10px 14px;
  border-radius: var(--dpat-r-md); font-size: var(--dpat-fs-sm); border: 1px solid transparent; }
.dpat-bannerError { border-color: var(--dpat-bad); background: var(--dpat-bad-soft); }
.dpat-bannerWarn { border-color: var(--dpat-warn); background: var(--dpat-warn-soft); }
.dpat-bannerOk { border-color: var(--dpat-ok); background: var(--dpat-ok-soft); }
.dpat-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 24px; }
.dpat-pre { margin: 8px 0 0; padding: 12px; max-height: 220px; overflow: auto; font-size: var(--dpat-fs-sm);
  line-height: 1.6; white-space: pre-wrap; word-break: break-word; border-radius: var(--dpat-r-sm);
  background: var(--dpat-surface); border: 1px solid var(--dpat-line);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.dpat-pitfallText { margin-top: 12px; padding: 10px 12px; font-size: var(--dpat-fs-sm);
  border-radius: var(--dpat-r-md); background: var(--dpat-warn-soft); color: var(--dpat-fg); }
.dpat-status { flex: none; width: 7px; height: 7px; border-radius: 50%; border: 1px solid var(--dpat-line2); }
.dpat-status-doing { border-color: var(--dpat-warn); background: var(--dpat-warn); }
.dpat-status-done { border-color: var(--dpat-ok); background: var(--dpat-ok); }

/* ---------------- header ---------------- */
.dpat-workbench { padding: 0; overflow: hidden; }
.dpat-wbHead { order: 0; flex: none; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 16px 28px; background: var(--dpat-surface); border-bottom: 1px solid var(--dpat-line); }
.dpat-wbTitle { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dpat-wbTitle > svg { flex: none; width: 28px; height: 28px; padding: 5px; box-sizing: content-box;
  border-radius: 8px; background: var(--dpat-accent); color: var(--dpat-fg-on-accent); }
.dpat-title { font-size: var(--dpat-fs-lg); font-weight: 650; letter-spacing: -.01em; }
.dpat-wbSubtitle { font-size: var(--dpat-fs-sm); color: var(--dpat-fg3); }
.dpat-wbControls { display: flex; align-items: center; gap: 10px; margin-left: auto; flex-wrap: nowrap; }
.dpat-wbControls .dpat-field { flex-direction: row; align-items: center; gap: 8px; }
.dpat-wbControls .dpat-select { width: auto; min-width: 190px; height: 32px; }
.dpat-selectWrap { display: inline-flex; align-items: center; gap: 6px; }
.dpat-saveState { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px;
  border-radius: var(--dpat-r-pill); border: 1px solid var(--dpat-line); font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); }
.dpat-saveState::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.dpat-saved { color: var(--dpat-ok); }
.dpat-dirty { color: var(--dpat-warn); }
.dpat-wbControls > .dpat-btn { height: 32px; padding: 0 14px; flex: none; }
.dpat-exportWrap { position: relative; flex: none; }
.dpat-exportWrap > .dpat-btn { height: 32px; padding: 0 14px; }
.dpat-menu { position: absolute; right: 0; top: calc(100% + 8px); z-index: 30; min-width: 240px;
  display: flex; flex-direction: column; gap: 2px; padding: 6px; border-radius: var(--dpat-r-md);
  background: var(--dpat-surface); border: 1px solid var(--dpat-line); box-shadow: var(--dpat-shadow); }
.dpat-menuItem { display: flex; align-items: center; justify-content: space-between; gap: 16px; text-align: left;
  border: 0; background: transparent; color: var(--dpat-fg); font-size: var(--dpat-fs-sm);
  padding: 8px 10px; border-radius: var(--dpat-r-sm); }
.dpat-menuItem:hover, .dpat-menuItem:focus-visible { background: var(--dpat-hover); outline: none; }
.dpat-menuLabel, .dpat-menuHint { font-size: var(--dpat-fs-sm); }
.dpat-menuHint { color: var(--dpat-fg3); }

/* ---------------- path / storage: footer of the right column ---------------- */
.dpat-wbPath { flex: none; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 12px 28px; border-top: 1px solid var(--dpat-line); background: var(--dpat-surface);
  font-size: var(--dpat-fs-xs); color: var(--dpat-fg3); }
.dpat-path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: var(--dpat-fs-xs);
  color: var(--dpat-fg2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 52vw; }
.dpat-storageBadge { padding: 0 8px; border-radius: var(--dpat-r-pill); font-size: var(--dpat-fs-xs);
  color: var(--dpat-warn); border: 1px solid var(--dpat-warn); }
.dpat-storagePanel { order: 8; flex: none; margin: 0 28px 10px; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--dpat-line2);
  border-radius: var(--dpat-r-md); background: var(--dpat-surface); }
.dpat-storagePanel p { margin: 0; }
.dpat-storageRow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dpat-storageRow .dpat-input { flex: 1; min-width: 260px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.dpat-wbOverview { display: none; }
.dpat-pipeline { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.dpat-pipelineItem { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px 5px 6px;
  border: 1px solid var(--dpat-line); border-radius: var(--dpat-r-pill); background: var(--dpat-surface); font-size: var(--dpat-fs-sm); }
.dpat-pipelineIndex { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
  font-size: var(--dpat-fs-xs); font-weight: 650; color: var(--dpat-fg-on-accent); background: var(--dpat-accent); }
.dpat-pipelineTitle, .dpat-thesis { font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); }
.dpat-progress { display: flex; align-items: center; gap: 10px; }
.dpat-progressLabel { font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); white-space: nowrap; }
.dpat-progressBar { flex: 1; height: 5px; border-radius: 3px; background: var(--dpat-surface2); overflow: hidden; }
.dpat-progressFill { display: block; height: 100%; background: var(--dpat-accent); border-radius: 3px; }
.dpat-overview, .dpat-overviewGrid, .dpat-overviewCard, .dpat-overviewHead,
.dpat-overviewTitle, .dpat-overviewSummary, .dpat-overviewMeta { max-width: none; }
.dpat-overviewGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.dpat-overviewCard { padding: 12px 14px; border: 1px solid var(--dpat-line); border-radius: var(--dpat-radius); background: var(--dpat-surface); }
.dpat-overviewTitle { font-weight: 600; }
.dpat-overviewSummary, .dpat-overviewMeta { font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); }


/* ---------------- stage pane ---------------- */
.dpat-wbStage { flex: 1; min-height: 0; overflow: auto; padding: 26px 28px 40px; }
.dpat-wbStageHead { max-width: 1080px; margin: 0 auto 22px; padding: 0; border: 0;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.dpat-wbStageTitle { font-size: var(--dpat-fs-xl); font-weight: 650; letter-spacing: -.01em; }
.dpat-owner { flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 3px 11px;
  border-radius: var(--dpat-r-pill); font-size: var(--dpat-fs-sm); white-space: nowrap;
  border: 1px solid var(--dpat-line2); color: var(--dpat-fg2); background: var(--dpat-surface); }
.dpat-owner-human { color: var(--dpat-fg2); }
.dpat-owner-model { color: var(--dpat-accent); border-color: var(--dpat-accent); background: var(--dpat-accent-soft); }
.dpat-owner-review { color: var(--dpat-ok); border-color: var(--dpat-ok); background: var(--dpat-ok-soft); }
.dpat-stageStatus { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px;
  border-radius: var(--dpat-r-pill); font-size: var(--dpat-fs-sm); white-space: nowrap; cursor: help;
  border: 1px solid var(--dpat-line2); color: var(--dpat-fg2); }
.dpat-stageStatus-done { color: var(--dpat-ok); border-color: var(--dpat-ok); }
.dpat-stageStatus-doing { color: var(--dpat-warn); border-color: var(--dpat-warn); }
.dpat-stageBody { width: 100%; max-width: 1080px; margin: 0 auto;
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
.dpat-stageBody > .dpat-stageLead,
.dpat-stageBody > .dpat-docs,
.dpat-stageBody > .dpat-analysisControls,
.dpat-stageBody > .dpat-actions,
.dpat-stageBody > .dpat-card,
.dpat-stageBody > .dpat-bucket,
.dpat-stageBody > .dpat-bucketHead,
.dpat-stageBody > .dpat-caseList,
.dpat-stageBody > .dpat-import,
.dpat-stageBody > .dpat-modelCard,
.dpat-stageBody > .dpat-runResult { grid-column: 1 / -1; }
.dpat-stageBody[data-stage="requirement"] { grid-template-columns: minmax(0, 1.6fr) minmax(0, 268px); }
.dpat-stageBody[data-stage="requirement"] > .dpat-docs { grid-column: 1; }
.dpat-stageBody[data-stage="requirement"] > .dpat-analysisControls { grid-column: 2; }
.dpat-stageLead { font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); }
.dpat-stageSummary { margin: 0 0 10px; color: var(--dpat-fg2); font-size: var(--dpat-fs-sm); }
.dpat-actions { border-left: 0; background: var(--dpat-surface); }
.dpat-actionList { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
.dpat-actionItem { display: flex; align-items: flex-start; gap: 9px; padding: 12px 14px;
  border-radius: var(--dpat-r-md); background: var(--dpat-surface2); }
.dpat-actionNo { flex: none; display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%;
  font-size: var(--dpat-fs-xs); font-weight: 600; color: var(--dpat-fg-on-accent); background: var(--dpat-accent); }
.dpat-actionDo { display: block; font-size: var(--dpat-fs-sm); font-weight: 600; }
.dpat-actionDetail { display: block; margin-top: 3px; font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); }
.dpat-noteDetails { margin-top: 4px; padding: 10px 14px; border: 1px solid var(--dpat-line);
  border-radius: var(--dpat-r-md); background: var(--dpat-surface2); }
.dpat-noteDetails > summary { cursor: pointer; font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); font-weight: 600; }
.dpat-noteDetails > ul, .dpat-noteDetails > p { margin-top: 10px; }
.dpat-tip { display: flex; align-items: flex-start; gap: 9px; padding: 10px 14px; border-radius: var(--dpat-r-md);
  font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); background: var(--dpat-warn-soft); border: 1px solid var(--dpat-warn); }

/* ---------------- documents (stage 1) ---------------- */
.dpat-docs { padding: 20px 22px; border: 1px solid var(--dpat-line); border-radius: var(--dpat-r-lg); background: var(--dpat-surface); }
.dpat-dropZone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
  min-height: 148px; padding: 20px; text-align: center; cursor: pointer;
  border: 1.5px dashed var(--dpat-line2); border-radius: var(--dpat-r-lg);
  background: var(--dpat-surface2); color: var(--dpat-fg2); }
.dpat-dropZone:hover, .dpat-dropZone:focus-visible { border-color: var(--dpat-accent); color: var(--dpat-fg); }
.dpat-dropZoneActive { border-color: var(--dpat-accent); background: var(--dpat-accent-soft); }
.dpat-dropZoneCompact { min-height: 96px; flex-direction: row; gap: 8px; justify-content: flex-start; text-align: left; }
.dpat-dropIcon { font-size: 20px; line-height: 1; color: var(--dpat-accent); }
.dpat-docList { list-style: none; padding: 0; margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.dpat-docItem { display: flex; align-items: center; gap: 10px; padding: 9px 12px;
  border: 1px solid var(--dpat-line); border-radius: var(--dpat-r-md); background: var(--dpat-surface); }
.dpat-docItem:hover { background: var(--dpat-hover); }
.dpat-docIcon { flex: none; color: var(--dpat-fg3); }
.dpat-docMeta { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.4; }
.dpat-docName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--dpat-fs-sm); }
.dpat-docMeta .dpat-small { color: var(--dpat-fg3); }
.dpat-analysisControls { padding: 20px 22px; }
/* 目标卡只有 268px 宽：内部再切两列会把标签挤成竖排。 */
.dpat-analysisControls .dpat-controlRow { grid-template-columns: minmax(0, 1fr); }

/* ---------------- case editor ---------------- */
.dpat-bucket { display: flex; flex-direction: column; gap: 12px; }
.dpat-bucketHead { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 0; }
/* The head is a flex row whose hint eats the free space; the button keeps its
   own width and never takes the hint's, or it drifts to the middle. */
.dpat-bucketHead > .dpat-btn { flex: none; margin-left: auto; }
.dpat-bucketHead > .dpat-bucketHint { flex: 1 1 auto; }
.dpat-bucketTitle { font-size: var(--dpat-fs-base); font-weight: 650; }
.dpat-bucketHint { flex: 1; min-width: 180px; font-size: var(--dpat-fs-sm); color: var(--dpat-fg3); }
.dpat-caseList { display: flex; flex-direction: column; gap: 12px; max-width: 1120px; }
.dpat-case { position: relative; display: flex; flex-direction: column; gap: 14px;
  padding: 14px 18px 18px; border: 1px solid var(--dpat-line); border-radius: var(--dpat-r-lg); background: var(--dpat-surface); }
.dpat-case:hover { border-color: var(--dpat-line2); }
.dpat-case[data-kind="positive"] { border-left: 2px solid var(--dpat-ok); }
.dpat-case[data-kind="negative"] { border-left: 2px solid var(--dpat-warn); }
.dpat-caseHead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dpat-caseTitle { flex: 1 1 240px; min-width: 0; height: 34px; padding: 0 10px; font-size: var(--dpat-fs-base);
  font-weight: 650; background: transparent; border: 1px solid transparent; border-radius: var(--dpat-r-sm); }
.dpat-caseTitle:hover { border-color: var(--dpat-line); }
.dpat-caseTitle:focus-visible { outline: none; border-color: var(--dpat-accent); background: var(--dpat-surface); box-shadow: 0 0 0 3px var(--dpat-accent-soft); }
.dpat-caseBody { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.dpat-caseFull { grid-column: 1 / -1; }
.dpat-steps { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; min-width: 0; }
.dpat-steps > .dpat-fieldLabel { grid-column: 1 / -1; }
.dpat-steps > .dpat-linkBtn { grid-column: 1 / -1; justify-self: start; }
.dpat-stepRow { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dpat-stepNo { flex: none; display: inline-grid; place-items: center; width: 18px; height: 18px;
  border-radius: 5px; font-size: var(--dpat-fs-xs); font-weight: 600; color: var(--dpat-fg2); background: var(--dpat-surface2); }
.dpat-stepRow .dpat-input { min-height: 32px; padding: 5px 9px; font-size: var(--dpat-fs-sm); }
.dpat-segmented { display: inline-flex; gap: 2px; padding: 3px; width: max-content; border-radius: var(--dpat-r-pill); background: var(--dpat-subtle); }
.dpat-seg { border: 0; background: transparent; color: var(--dpat-fg2); font-size: var(--dpat-fs-sm); padding: 4px 13px; border-radius: var(--dpat-r-pill); }
.dpat-seg:hover { color: var(--dpat-fg); }
.dpat-seg[aria-pressed="true"] { background: var(--dpat-surface); color: var(--dpat-accent); font-weight: 600;
  box-shadow: 0 1px 2px rgba(16,24,40,.08); }

/* ---------------- model run (stage 3) ---------------- */
.dpat-modelCard { padding: 24px; border-left: 0; background: var(--dpat-surface); }
.dpat-runBar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 14px 0 0; }
.dpat-runBtn { order: -1; height: 38px; padding: 0 20px; gap: 7px; font-size: var(--dpat-fs-base);
  font-weight: 650; border-radius: var(--dpat-r-pill); }
.dpat-runBtn .dpat-btnIcon { width: 14px; height: 14px; }
/* The model card is a short block: the pipeline sits under its action row with
   room to breathe, never touching the button's pill. */
.dpat-modelCard .dpat-runBar { margin-bottom: 4px; }
.dpat-engine { display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px;
  border: 1px solid var(--dpat-line); border-radius: var(--dpat-r-pill); background: var(--dpat-surface2);
  font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); }
.dpat-engine::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--dpat-ok); }
.dpat-pipeFlow { list-style: none; padding: 0; margin: 24px 0 8px; display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; }
.dpat-pipeItem { position: relative; text-align: center; font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); }
.dpat-pipeItem::before { content: ''; position: absolute; top: 13px; left: 50%; width: 100%; height: 1px; background: var(--dpat-line2); }
.dpat-pipeItem:last-child::before { display: none; }
.dpat-pipeDot { position: relative; z-index: 1; display: grid; place-items: center; width: 26px; height: 26px;
  margin: 0 auto 8px; border-radius: 50%; background: var(--dpat-surface); border: 1px solid var(--dpat-line2);
  font-size: var(--dpat-fs-xs); font-weight: 600; color: var(--dpat-fg3); }
.dpat-pipeLabel { display: block; }
.dpat-promptDetails { margin-top: 16px; padding: 10px 14px; border: 1px solid var(--dpat-line);
  border-radius: var(--dpat-r-md); background: var(--dpat-surface2); }
.dpat-promptDetails > summary { cursor: pointer; font-size: var(--dpat-fs-sm); font-weight: 600; color: var(--dpat-fg2); }
.dpat-promptDetails > ul { margin-top: 10px; }
.dpat-runResult { margin-top: 16px; padding: 12px 14px; border-radius: var(--dpat-r-md);
  border: 1px solid var(--dpat-ok); background: var(--dpat-ok-soft); }
.dpat-runResult p { margin: 0 0 4px; }
.dpat-runPrompt { margin-top: 12px; padding: 10px 14px; border: 1px solid var(--dpat-line);
  border-radius: var(--dpat-r-md); background: var(--dpat-surface2); }
.dpat-runPrompt summary { cursor: pointer; font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); }

/* ---------------- defects (stage 4) ---------------- */
.dpat-triage { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.dpat-triageItem { padding: 14px 16px; border: 1px solid var(--dpat-line); border-radius: var(--dpat-r-md); background: var(--dpat-surface); }
.dpat-triageItem h4 { margin: 0 0 5px; font-size: var(--dpat-fs-base); font-weight: 650; }
.dpat-triageItem p { font-size: var(--dpat-fs-sm); color: var(--dpat-fg2); }
.dpat-emptyState { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 44px 20px; border: 1px solid var(--dpat-line); border-radius: var(--dpat-r-lg);
  background: var(--dpat-surface); text-align: center; }
.dpat-emptyState::before { content: ''; width: 38px; height: 38px; margin-bottom: 8px;
  border: 1.5px solid var(--dpat-line2); border-radius: 8px;
  background: linear-gradient(var(--dpat-line2), var(--dpat-line2)) 9px 13px / 20px 2px no-repeat,
              linear-gradient(var(--dpat-line2), var(--dpat-line2)) 9px 20px / 14px 2px no-repeat; }
.dpat-lifecycle { display: flex; align-items: center; flex-wrap: wrap; }
.dpat-lifecycle span { position: relative; margin-right: 22px; padding: 4px 12px; border: 1px solid var(--dpat-line);
  border-radius: var(--dpat-r-pill); font-size: var(--dpat-fs-sm); color: var(--dpat-fg3); background: var(--dpat-surface); }
.dpat-lifecycle span:not(:last-child)::after { content: '→'; position: absolute; right: -18px; color: var(--dpat-fg3); }

/* ---------------- import panel ---------------- */
.dpat-import { flex: none; margin: 12px 28px 0; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;
  border: 1px solid var(--dpat-line2); border-radius: var(--dpat-radius); background: var(--dpat-surface); }
.dpat-importHead { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dpat-importHead .dpat-cardTitle { margin: 0; }
.dpat-importInput { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.dpat-importPreview { display: flex; flex-direction: column; gap: 8px; }
.dpat-importSummary { font-weight: 600; }
.dpat-importWarnings summary { cursor: pointer; font-size: var(--dpat-fs-sm); color: var(--dpat-warn); }
.dpat-importList { list-style: none; padding: 6px 0 0; max-height: 220px; overflow: auto;
  display: flex; flex-direction: column; gap: 2px; border-top: 1px solid var(--dpat-line); }
.dpat-importItem { display: flex; align-items: center; gap: 8px; padding: 3px 4px; font-size: var(--dpat-fs-sm); }
.dpat-importTitle { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dpat-importActions { display: flex; gap: 8px; flex-wrap: wrap; }

/* ---------------- flow page (secondary slot) ---------------- */
.dpat-head { flex: none; padding: 20px 28px 10px; }
.dpat-subtitle { margin: 6px 0 0; color: var(--dpat-fg2); font-size: var(--dpat-fs-sm); }
.dpat-tabs { flex: none; display: inline-flex; gap: 2px; margin: 6px 28px 0; padding: 4px; width: max-content;
  border-radius: var(--dpat-r-lg); background: var(--dpat-subtle); }
.dpat-tab { appearance: none; border: 0; background: transparent; color: var(--dpat-fg2); height: 30px;
  padding: 0 14px; border-radius: var(--dpat-r-md); font-size: var(--dpat-fs-sm); }
.dpat-tab[aria-selected="true"] { color: var(--dpat-fg); font-weight: 600; background: var(--dpat-surface); border: 1px solid var(--dpat-line); }
.dpat-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 200px) minmax(0, 1fr); border-top: 1px solid var(--dpat-line); }
.dpat-scroll { min-height: 0; overflow: auto; padding: 16px 28px 40px; }
.dpat-step { max-width: 1080px; }
.dpat-stepHead { display: flex; align-items: flex-start; gap: 12px; }
.dpat-stepTitle { font-size: var(--dpat-fs-lg); font-weight: 650; }
.dpat-stepSummary { margin: 4px 0 0; color: var(--dpat-fg2); }
.dpat-badge { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
  font-size: var(--dpat-fs-xs); font-weight: 600; color: var(--dpat-fg2); border: 1px solid var(--dpat-line2); }
.dpat-figureBox { margin: 14px 0 0; padding: 12px; border: 1px solid var(--dpat-line); border-radius: var(--dpat-radius); }
.dpat-figure { display: block; width: 100%; height: auto; max-height: 240px; }
.dpat-figCaption { margin-top: 6px; text-align: right; font-size: var(--dpat-fs-xs); color: var(--dpat-fg3); }
.dpat-nav { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
.dpat-nav > .dpat-btn { min-width: 88px; height: 32px; }
.dpat-nav > .dpat-btn:first-child { justify-content: flex-start; padding-left: 12px; }
.dpat-nav > .dpat-btn:last-child { justify-content: flex-end; padding-right: 12px; }
.dpat-navCount { flex: 1; text-align: center; color: var(--dpat-fg2); font-size: var(--dpat-fs-sm); }
.dpat-rowAction { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;
  padding: 0; border: 0; border-radius: var(--dpat-r-sm); background: transparent;
  color: var(--dsw-alias-label-secondary, #5f6b7a); }
.dpat-rowAction:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14)); color: var(--dsw-alias-label-primary, #1b1f24); }
.dpat-rowAction:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe); outline-offset: 1px; }

/* Quiet surfaces: reserve the brand colour for navigation and main actions. */
.dpat-wbTitle > svg { padding: 6px; box-sizing: border-box; }
.dpat-saveState { border: 0; padding: 3px 4px; }
.dpat-saved { color: var(--dpat-fg2); }
.dpat-saved::before { background: var(--dpat-ok); }

/* ---- left sidebar: the four stages live here, never across the top ---- */
.dpat-wbBody { flex: 1; min-height: 0; display: grid; align-items: stretch;
  grid-template-columns: minmax(0, 232px) minmax(0, 1fr); }
.dpat-wbContent { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.dpat-rail { display: flex; flex-direction: column; gap: 2px; overflow: auto;
  padding: 22px 12px 24px; background: var(--dpat-surface); border-right: 1px solid var(--dpat-line); }

/* The KPI line heads the right column: one horizontal row, no card. */
.dpat-kpi { flex: none; display: flex; align-items: center; gap: 0; padding: 15px 28px;
  background: var(--dpat-surface); border-bottom: 1px solid var(--dpat-line); }
.dpat-kpiItem { display: flex; align-items: baseline; gap: 7px; padding-right: 26px; margin-right: 26px;
  border-right: 1px solid var(--dpat-line); }
.dpat-kpiItem:last-of-type { border-right: 0; }
.dpat-kpiNum { font-size: 19px; font-weight: 650; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.dpat-kpiLabel { font-size: var(--dpat-fs-xs); color: var(--dpat-fg2); }
.dpat-kpiNote { margin-left: auto; font-size: var(--dpat-fs-xs); color: var(--dpat-fg3); white-space: nowrap; }

/* Group labels are pseudo-elements on the first item of each group: the list
   keeps exactly four clickable items, so every DOM hook stays valid. */
.dpat-railList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.dpat-railList > li { margin: 0; padding: 0; }
.dpat-railList > li[data-group]::before { content: attr(data-group); display: block; margin: 2px 0 6px;
  padding: 0 12px; font-size: 11px; font-weight: 600; letter-spacing: .08em; color: var(--dpat-fg3); }
.dpat-railList > li[data-group-gap]::before { margin-top: 20px; }
.dpat-railItem { position: relative; display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 10px 12px; text-align: left; border: 0; border-radius: 9px; background: transparent;
  color: var(--dpat-fg2); font: inherit; font-size: var(--dpat-fs-sm); cursor: pointer; }
.dpat-railItem::after { content: ''; position: absolute; left: 0; top: 9px; bottom: 9px; width: 2px;
  border-radius: 0 2px 2px 0; background: transparent; }
.dpat-railItem:hover { background: var(--dpat-hover); }
.dpat-railItem[aria-current="step"] { background: var(--dpat-surface2); }
.dpat-railItem[aria-current="step"]::after { background: var(--dpat-accent); }
.dpat-railItem:focus-visible { outline: 2px solid var(--dpat-accent); outline-offset: 1px; }
.dpat-railIndex { flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 50%; font-size: var(--dpat-fs-xs); font-weight: 600;
  border: 1px solid var(--dpat-line2); color: var(--dpat-fg3); background: var(--dpat-surface); }
.dpat-railItem[aria-current="step"] .dpat-railIndex { color: var(--dpat-fg-on-accent);
  background: var(--dpat-accent); border-color: var(--dpat-accent); }
.dpat-railText { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.45; }
.dpat-railTitle { font-size: var(--dpat-fs-sm); color: var(--dpat-fg2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dpat-railItem[aria-current="step"] .dpat-railTitle { color: var(--dpat-accent); font-weight: 550; }
.dpat-railState { font-size: 11px; color: var(--dpat-fg3);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dpat-railItem .dpat-status { margin-left: 2px; }

/* The footer is pushed to the bottom of the rail, matching the content foot. */
.dpat-navFoot { margin-top: auto; padding: 24px 12px 0; border-top: 1px solid var(--dpat-line);
  font-size: 11px; color: var(--dpat-fg3); }
.dpat-navFootRow { display: flex; justify-content: space-between; align-items: baseline; color: var(--dpat-fg2); }
.dpat-navFootRow b { font-size: var(--dpat-fs-xs); font-weight: 600; font-variant-numeric: tabular-nums; }
.dpat-navTrack { display: block; height: 4px; margin: 9px 0 14px; border-radius: var(--dpat-r-pill);
  background: var(--dpat-surface2); overflow: hidden; }
.dpat-navFill { display: block; height: 100%; border-radius: var(--dpat-r-pill); background: var(--dpat-accent); }
.dpat-navFoot p { line-height: 1.5; word-break: break-all; }

.dpat-analysisControls .dpat-controlRow { grid-template-columns: minmax(0, 1fr); gap: 20px; }
.dpat-analysisControls .dpat-targetInput { width: 100%; text-align: left; }
.dpat-case[data-kind] { border-left: 1px solid var(--dpat-line); }
.dpat-actionNo { background: var(--dpat-surface); color: var(--dpat-fg2); }
.dpat-tip { background: var(--dpat-surface2); border-color: var(--dpat-line); }

/* The owner pill belongs at the far right of the stage head, not next to the title. */
.dpat-wbStageHead .dpat-owner { margin-left: auto; }

/* ---------------- narrow window ----------------
   This block is deliberately LAST: the left-rail rules above share the same
   specificity, so an earlier media query would be overridden and the narrow
   layout would silently break. Breakpoint 899px (not 900px) is intentional —
   render.test greps for a literal 900px cap on the stage body. */
@media (max-width: 899px) {
  .dpat-wbControls { width: 100%; margin-left: 0; flex-wrap: wrap; }
  .dpat-wbControls .dpat-field { flex: 1; min-width: 0; }
  .dpat-wbControls .dpat-select { width: 100%; min-width: 0; }
  .dpat-wbSubtitle { display: none; }
  .dpat-wbBody { grid-template-columns: minmax(0, 1fr); }
  /* Left column folds into a 2-column top nav; groups and footer disappear. */
  .dpat-rail { flex-direction: row; flex-wrap: wrap; gap: 4px; padding: 12px;
    border-right: 0; border-bottom: 1px solid var(--dpat-line); max-height: none; }
  .dpat-railList { flex: 1 1 100%; list-style: none; flex-direction: row; flex-wrap: wrap; gap: 4px; }
  .dpat-railList > li { flex: 1 1 calc(50% - 4px); }
  .dpat-railList > li[data-group]::before, .dpat-navFoot, .dpat-railItem::after { display: none; }
  .dpat-kpi { flex-wrap: wrap; gap: 12px 0; }
  .dpat-caseBody, .dpat-steps { grid-template-columns: minmax(0, 1fr); }
  .dpat-railTitle { white-space: normal; }
  .dpat-wbHead, .dpat-wbPath { padding-left: 16px; padding-right: 16px; }
  /* The footer keeps to one line: the workspace path is redundant here, the
     storage path is the one the design spec shows. */
  .dpat-wbPath { flex-wrap: nowrap; overflow: hidden; }
  .dpat-wbPath > span { white-space: nowrap; flex: none; }
  .dpat-wbPath > .dpat-path:first-child { display: none; }
  .dpat-wbPath > .dpat-path { max-width: none; min-width: 0; flex: 1 1 auto; }
  .dpat-wbPath > .dpat-linkBtn, .dpat-wbPath > .dpat-storageBadge { flex: none; }
  .dpat-wbStage { padding: 20px 16px 32px; }
  .dpat-stageBody[data-stage="requirement"] { grid-template-columns: minmax(0, 1fr); }
  .dpat-stageBody[data-stage="requirement"] > .dpat-docs,
  .dpat-stageBody[data-stage="requirement"] > .dpat-analysisControls { grid-column: 1 / -1; }
  .dpat-controlRow, .dpat-triage, .dpat-actionList { grid-template-columns: minmax(0, 1fr); }
  .dpat-pipeFlow { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .dpat-pipeItem { font-size: 10px; }
  .dpat-import { margin-left: 16px; margin-right: 16px; }
  .dpat-body { grid-template-columns: minmax(0, 1fr); }
}
`

/** The element id this stylesheet lives under. */
const TAG_ATTR = 'data-plugin-css'

/**
 * Insert this plugin's stylesheet once per document.
 *
 * A document tag (rather than an inline `<style>` element in the tree) is what
 * the shipped plugins do, and it keeps a re-activation cheap: the lookup finds
 * the tag already present and does nothing.
 * @returns a disposer that only removes the tag this call created.
 */
export function insertStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  const existing = document.querySelector(`style[${TAG_ATTR}="${STYLE_KEY}"]`)
  if (existing !== null) return () => {}
  const tag = document.createElement('style')
  tag.setAttribute(TAG_ATTR, STYLE_KEY)
  tag.textContent = CSS
  document.head.appendChild(tag)
  let removed = false
  return () => {
    if (removed) return
    removed = true
    tag.remove()
  }
}
