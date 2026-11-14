/**
 * Styles for the flow page, following the official client-plugin convention:
 * one `<style>` tag keyed by `data-plugin-css`, inserted once per document and
 * reused afterwards.
 *
 * Every colour reads a DSH theme alias with a literal fallback, and every other
 * value (radius, font size) has a fallback too, so a renamed upstream token can
 * degrade the look but never break the layout.
 *
 * @module dsh-project-autotest/client/styles
 */

/** The key that identifies this plugin's stylesheet tag in the document. */
export const STYLE_KEY = 'dsh-project-autotest/flow.css'

/** The page's rules. */
export const CSS = `
.dpat-root { --dpat-fg: var(--dsw-alias-label-primary, #1f2328);
  --dpat-fg2: var(--dsw-alias-label-secondary, #59636e);
  --dpat-line: var(--dsw-alias-border-l1, rgba(127,127,127,.28));
  --dpat-line2: var(--dsw-alias-border-l2, rgba(127,127,127,.45));
  --dpat-surface: var(--dsw-alias-bg-layer-1, transparent);
  --dpat-surface2: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.06));
  --dpat-accent: var(--dsw-alias-brand-primary, #2563eb);
  --dpat-warn: var(--dsw-alias-state-warn-primary, #d97706);
  --dpat-hover: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));
  --dpat-radius: var(--dsw-radius-lg, 12px);
  box-sizing: border-box; display: flex; flex-direction: column; height: 100%; min-height: 0;
  color: var(--dpat-fg); background: var(--dsw-alias-bg-base, transparent);
  font-size: 13px; line-height: 1.65; }
.dpat-head { flex: none; padding: 20px 28px 10px; }
.dpat-title { margin: 0; font-size: 20px; line-height: 1.35; font-weight: 600; }
.dpat-subtitle { margin: 6px 0 0; color: var(--dpat-fg2); font-size: 13px; }
/* Segmented tabs: copy of the host's tab chrome, renamed under this prefix. */
.dpat-tabs { flex: none; display: inline-flex; gap: 2px; margin: 6px 28px 0; padding: 4px; width: max-content;
  border-radius: var(--dsw-radius-lg, 12px); background: var(--dsw-alias-bg-module-platform, var(--dpat-surface2)); }
.dpat-tab { appearance: none; border: 0.5px solid transparent; background: transparent; color: var(--dpat-fg2);
  font: inherit; height: 30px; padding: 0 14px; border-radius: var(--dsw-radius-md, 8px); cursor: pointer; }
.dpat-tab:hover { color: var(--dpat-fg); }
.dpat-tab[aria-selected="true"] { color: var(--dpat-fg); font-weight: 600;
  background: var(--dsw-alias-bg-layer-2, #fff); border-color: var(--dpat-line2); }
.dpat-tab:focus-visible { outline: 2px solid var(--dpat-accent); outline-offset: 1px; }
.dpat-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
  gap: 0; margin-top: 12px; border-top: 0.5px solid var(--dpat-line); }
.dpat-rail { min-height: 0; overflow: auto; padding: 12px 10px 24px 12px;
  border-right: 0.5px solid var(--dpat-line); }
.dpat-rail ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.dpat-railItem { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
  border: 0; background: transparent; color: var(--dpat-fg2); font: inherit; cursor: pointer;
  padding: 6px 8px; border-radius: var(--dsw-radius-md, 8px); }
.dpat-railItem:hover { background: var(--dpat-hover); color: var(--dpat-fg); }
.dpat-railItem[aria-current="step"] { background: var(--dpat-hover); color: var(--dpat-fg); font-weight: 600; }
.dpat-railItem:focus-visible { outline: 2px solid var(--dpat-accent); outline-offset: 1px; }
.dpat-railTitle { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dpat-badge { flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%; font-size: 11px; font-weight: 600; line-height: 1;
  color: var(--dpat-fg2); border: 1px solid var(--dpat-line2); background: var(--dpat-surface); }
.dpat-railItem[aria-current="step"] .dpat-badge { color: var(--dsw-alias-label-primary-foreground, #fff);
  background: var(--dpat-accent); border-color: var(--dpat-accent); }
.dpat-scroll { min-height: 0; overflow: auto; padding: 16px 28px 40px; }
.dpat-step { max-width: 860px; }
.dpat-stepHead { display: flex; align-items: flex-start; gap: 12px; }
.dpat-stepHead .dpat-badge { width: 26px; height: 26px; font-size: 13px; margin-top: 2px; }
.dpat-stepTitle { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.4; }
.dpat-stepSummary { margin: 4px 0 0; color: var(--dpat-fg2); }
.dpat-figureBox { margin: 14px 0 0; padding: 12px; border: 0.5px solid var(--dpat-line);
  border-radius: var(--dpat-radius); background: var(--dpat-surface); }
.dpat-figure { display: block; width: 100%; height: auto; max-height: 240px; color: var(--dpat-fg); }
.dpat-figCaption { margin-top: 6px; text-align: right; font-size: 11px; color: var(--dsw-alias-label-tertiary, var(--dpat-fg2)); }
.dpat-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-top: 12px; }
.dpat-field { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px;
  border: 0.5px solid var(--dpat-line); border-radius: var(--dpat-radius); background: var(--dpat-surface); }
.dpat-fieldLabel { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary, var(--dpat-fg2)); }
.dpat-fieldValue { color: var(--dpat-fg); }
.dpat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
.dpat-card { margin: 0; padding: 12px 14px; border: 0.5px solid var(--dpat-line);
  border-radius: var(--dpat-radius); background: var(--dpat-surface); }
.dpat-cardTitle { margin: 0 0 8px; font-size: 12px; font-weight: 600; color: var(--dpat-fg2); }
.dpat-cardWarn { border-color: var(--dpat-warn); background: color-mix(in srgb, var(--dpat-warn) 7%, transparent); }
.dpat-cardWarn .dpat-cardTitle { color: var(--dpat-warn); }
.dpat-warnText { margin: 0; color: var(--dpat-fg); }
.dpat-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.dpat-list li { display: flex; gap: 8px; align-items: flex-start; }
.dpat-dot { flex: none; width: 5px; height: 5px; margin-top: 8px; border-radius: 50%; background: var(--dpat-accent); }
.dpat-nav { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
.dpat-navCount { flex: 1; text-align: center; color: var(--dpat-fg2); font-size: 12px; }
.dpat-btn { appearance: none; cursor: pointer; font: inherit; font-size: 12px; height: 30px;
  padding: 0 14px; border-radius: var(--dsw-radius-md, 8px); border: 0.5px solid var(--dpat-line2);
  background: transparent; color: var(--dpat-fg); }
.dpat-btn:hover:not(:disabled) { background: var(--dpat-hover); }
.dpat-btn:disabled { opacity: .4; cursor: not-allowed; }
.dpat-btn:focus-visible { outline: 2px solid var(--dpat-accent); outline-offset: 1px; }
.dpat-btnPrimary { color: var(--dsw-alias-label-primary-foreground, #fff);
  background: var(--dsw-alias-button-primary-fill, var(--dpat-accent)); border-color: transparent; }
.dpat-btnPrimary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, var(--dpat-accent)); }
/* Overview: the pipeline strip plus one card per step. */
.dpat-overview { max-width: 1000px; display: flex; flex-direction: column; gap: 12px; }
.dpat-cardWide { padding: 14px 16px; }
.dpat-pipeline { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.dpat-pipelineItem { display: flex; align-items: center; gap: 6px; padding: 6px 10px;
  border: 0.5px solid var(--dpat-line); border-radius: 999px; background: var(--dpat-surface2); font-size: 12px; }
.dpat-pipelineItem + .dpat-pipelineItem::before { content: '→'; margin-left: -2px; color: var(--dpat-fg2); }
.dpat-pipelineIndex { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;
  border-radius: 50%; font-size: 10px; font-weight: 600; color: var(--dsw-alias-label-primary-foreground, #fff);
  background: var(--dpat-accent); }
.dpat-thesis { margin: 10px 0 0; color: var(--dpat-fg2); }
.dpat-overviewGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.dpat-overviewCard { display: flex; flex-direction: column; gap: 8px; text-align: left; cursor: pointer; font: inherit;
  padding: 12px 14px; border: 0.5px solid var(--dpat-line); border-radius: var(--dpat-radius);
  background: var(--dpat-surface); color: var(--dpat-fg); }
.dpat-overviewCard:hover { border-color: var(--dpat-line2); background: var(--dpat-surface2); }
.dpat-overviewCard:focus-visible { outline: 2px solid var(--dpat-accent); outline-offset: 1px; }
.dpat-overviewHead { display: flex; align-items: center; gap: 8px; }
.dpat-overviewTitle { font-weight: 600; }
.dpat-overviewSummary { color: var(--dpat-fg2); font-size: 12.5px; }
.dpat-overviewCard .dpat-figure { max-height: 120px; }
.dpat-overviewMeta { display: flex; flex-direction: column; gap: 2px; font-size: 12px;
  padding-top: 8px; border-top: 0.5px dashed var(--dpat-line); }
/* Narrow columns (a split pane or a small window): the rail collapses above the body. */
@media (max-width: 760px) {
  .dpat-head { padding: 14px 16px 6px; }
  .dpat-tabs { margin: 4px 16px 0; }
  .dpat-body { grid-template-columns: minmax(0, 1fr); }
  .dpat-rail { border-right: 0; border-bottom: 0.5px solid var(--dpat-line); max-height: 132px; padding: 8px; }
  .dpat-scroll { padding: 12px 16px 32px; }
}

/* ---------------- workbench ---------------- */
.dpat-workbench { padding: 0; }
.dpat-wbHead { flex: none; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 16px 24px 12px; border-bottom: 0.5px solid var(--dpat-line); }
.dpat-wbTitle { display: flex; align-items: center; gap: 8px; color: var(--dpat-fg); }
.dpat-wbTitle .dpat-title { font-size: 17px; }
.dpat-wbControls { display: flex; align-items: center; gap: 12px; margin-left: auto; flex-wrap: wrap; }
.dpat-selectWrap { display: inline-flex; align-items: center; gap: 6px; }
.dpat-selectLabel { font-size: 11px; color: var(--dsw-alias-label-tertiary, var(--dpat-fg2)); white-space: nowrap; }
.dpat-select { height: 30px; max-width: 260px; padding: 0 8px; font: inherit; font-size: 12.5px;
  color: var(--dpat-fg); background: var(--dpat-surface); border: 0.5px solid var(--dpat-line2);
  border-radius: var(--dsw-radius-md, 8px); }
.dpat-select:focus-visible { outline: 2px solid var(--dpat-accent); outline-offset: 1px; }
.dpat-saveState { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; border: 0.5px solid var(--dpat-line2); }
.dpat-saved { color: var(--dsw-alias-state-success-primary, var(--dpat-fg2)); border-color: var(--dsw-alias-state-success-primary, var(--dpat-line2)); }
.dpat-dirty { color: var(--dsw-alias-state-warn-primary, var(--dpat-fg2)); border-color: var(--dsw-alias-state-warn-primary, var(--dpat-line2)); }
.dpat-exportWrap { position: relative; }
.dpat-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; min-width: 220px;
  display: flex; flex-direction: column; padding: 4px; border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-overlay, var(--dpat-surface)); border: 0.5px solid var(--dpat-line2);
  box-shadow: var(--dsw-elevation-prominent, 0 8px 24px rgba(0,0,0,.18)); }
.dpat-menuItem { display: flex; justify-content: space-between; gap: 16px; text-align: left; border: 0;
  background: transparent; color: var(--dpat-fg); font: inherit; font-size: 12.5px; cursor: pointer;
  padding: 7px 10px; border-radius: var(--dsw-radius-sm, 6px); }
.dpat-menuItem:hover { background: var(--dpat-hover); }
.dpat-menuHint { color: var(--dsw-alias-label-tertiary, var(--dpat-fg2)); font-size: 11px; }
.dpat-iconBtn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  padding: 0; border: 0.5px solid transparent; border-radius: var(--dsw-radius-md, 8px);
  background: transparent; color: var(--dpat-fg2); font-size: 14px; cursor: pointer; }
.dpat-iconBtn:hover { background: var(--dpat-hover); color: var(--dpat-fg); }
.dpat-iconBtn.abbr { font-size: 12px; }
.dpat-danger:hover { color: var(--dsw-alias-state-error-primary, #d33); }
.dpat-banner { display: flex; align-items: center; gap: 12px; margin: 8px 24px 0; padding: 8px 12px;
  border-radius: var(--dsw-radius-md, 8px); font-size: 12.5px; }
.dpat-bannerError { color: var(--dsw-alias-label-primary, var(--dpat-fg));
  border: 0.5px solid var(--dsw-alias-state-error-primary, #d33);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d33) 8%, transparent); }
.dpat-bannerWarn { color: var(--dsw-alias-label-primary, var(--dpat-fg));
  border: 0.5px solid var(--dsw-alias-state-warn-primary, #d97706);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 9%, transparent); }
.dpat-bannerOk { color: var(--dsw-alias-label-primary, var(--dpat-fg));
  border: 0.5px solid var(--dsw-alias-state-success-primary, #2a2);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2a2) 8%, transparent); }
.dpat-wbPath { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 6px 24px 0; }
.dpat-path { font-size: 11.5px; color: var(--dsw-alias-label-tertiary, var(--dpat-fg2));
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60vw; }
.dpat-wbOverview { flex: none; padding: 10px 24px 12px; border-bottom: 0.5px solid var(--dpat-line); }
.dpat-wbOverview .dpat-pipeline { margin: 0; }
.dpat-wbOverview { max-width: none; }
.dpat-progress { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.dpat-progressLabel { font-size: 11.5px; color: var(--dpat-fg2); white-space: nowrap; }
.dpat-progressBar { flex: 1; height: 5px; border-radius: 3px; background: var(--dpat-surface2); overflow: hidden; }
.dpat-progressFill { display: block; height: 100%; background: var(--dpat-accent); border-radius: 3px; }
.dpat-wbBody { flex: 1; min-height: 0; display: grid;
  /* Left rail 260px (was 210) + 50: the stage names no longer truncate. */
  grid-template-columns: minmax(0, 260px) minmax(0, 1fr); }
.dpat-rail { border-right: 0.5px solid var(--dpat-line); padding: 12px 8px; overflow: auto; }
.dpat-railMeta { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 4px 10px 10px;
  border-bottom: 0.5px solid var(--dpat-line); margin-bottom: 8px; }
.dpat-railLabel { font-size: 11px; color: var(--dsw-alias-label-tertiary, var(--dpat-fg2)); }
.dpat-railValue { font-size: 12px; font-weight: 600; text-align: right; }
.dpat-railList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.dpat-railItem { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
  border: 0; background: transparent; color: var(--dpat-fg2); font: inherit; font-size: 12.5px; cursor: pointer;
  padding: 6px 8px; border-radius: var(--dsw-radius-md, 8px); }
.dpat-railItem:hover { background: var(--dpat-hover); color: var(--dpat-fg); }
.dpat-railItem[aria-current="step"] { background: var(--dpat-hover); color: var(--dpat-fg); font-weight: 600; }
.dpat-railIndex { flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%; font-size: 10.5px; border: 1px solid var(--dpat-line2); }
.dpat-railTitle { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dpat-status { flex: none; width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--dpat-line2); }
.dpat-status-doing { border-color: var(--dsw-alias-state-warn-primary, #d97706); background: transparent;
  box-shadow: inset 0 0 0 2px var(--dsw-alias-state-warn-primary, #d97706); }
.dpat-status-done { border-color: var(--dsw-alias-state-success-primary, #2a2); background: var(--dsw-alias-state-success-primary, #2a2); }
.dpat-wbStage { min-height: 0; overflow: auto; padding: 16px 24px 40px; }
.dpat-wbStageHead { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
.dpat-wbStageTitle { margin: 0; font-size: 15px; font-weight: 600; }
.dpat-stageBody { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: none; }
.dpat-stageLead { margin: 0; color: var(--dpat-fg2); font-size: 12.5px; }
.dpat-stageSummary { margin: 0 0 10px; color: var(--dpat-fg); }
.dpat-pitfallText { margin: 10px 0 0; padding: 8px 10px; font-size: 12.5px; border-radius: var(--dsw-radius-md, 8px);
  border-left: 3px solid var(--dsw-alias-state-warn-primary, #d97706);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 7%, transparent); }
.dpat-segmented { display: inline-flex; gap: 2px; padding: 3px; margin-bottom: 10px; width: max-content;
  border-radius: var(--dsw-radius-md, 8px); background: var(--dpat-surface2); }
.dpat-seg { border: 0.5px solid transparent; background: transparent; color: var(--dpat-fg2); font: inherit;
  font-size: 12px; padding: 4px 12px; border-radius: var(--dsw-radius-sm, 6px); cursor: pointer; }
.dpat-seg[aria-pressed="true"] { background: var(--dsw-alias-bg-layer-2, #fff); border-color: var(--dpat-line2);
  color: var(--dpat-fg); font-weight: 600; }
.dpat-bucket { display: flex; flex-direction: column; gap: 10px; }
.dpat-bucketHead { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dpat-bucketTitle { margin: 0; font-size: 13px; font-weight: 600; }
.dpat-bucketHint { margin: 0; flex: 1; font-size: 12px; color: var(--dsw-alias-label-tertiary, var(--dpat-fg2)); }
.dpat-caseList { display: flex; flex-direction: column; gap: 10px; }
/* A case card holds a lot of prose; past ~1100px the line gets hard to scan,
   so the list keeps a readable measure and stays flush left. */
.dpat-caseList { max-width: 1100px; }
.dpat-case { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 0.5px solid var(--dpat-line);
  border-radius: var(--dpat-radius); background: var(--dpat-surface); }
.dpat-case[data-kind="negative"] { border-left: 3px solid var(--dsw-alias-state-warn-primary, #d97706); }
.dpat-case[data-kind="positive"] { border-left: 3px solid var(--dsw-alias-state-success-primary, #2a2); }
.dpat-caseHead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dpat-caseTitle { flex: 1; min-width: 180px; height: 30px; padding: 0 10px; font: inherit; font-size: 13px; font-weight: 600;
  color: var(--dpat-fg); background: transparent; border: 0.5px solid var(--dpat-line2); border-radius: var(--dsw-radius-md, 8px); }
.dpat-caseTitle:focus-visible { outline: 2px solid var(--dpat-accent); outline-offset: 1px; }
.dpat-steps { display: flex; flex-direction: column; gap: 4px; }
.dpat-stepRow { display: flex; align-items: center; gap: 8px; }
.dpat-stepNo { flex: none; width: 18px; text-align: right; font-size: 11px; color: var(--dsw-alias-label-tertiary, var(--dpat-fg2)); }
.dpat-input { width: 100%; box-sizing: border-box; padding: 6px 10px; font: inherit; font-size: 12.5px;
  color: var(--dpat-fg); background: var(--dpat-surface); border: 0.5px solid var(--dpat-line2);
  border-radius: var(--dsw-radius-md, 8px); }
.dpat-textarea { resize: vertical; line-height: 1.5; }
.dpat-input:focus-visible { outline: 2px solid var(--dpat-accent); outline-offset: 1px; }
.dpat-empty { padding: 40px 24px; display: flex; flex-direction: column; gap: 6px; }
.dpat-muted { color: var(--dsw-alias-label-tertiary, var(--dpat-fg2)); }
.dpat-small { font-size: 12px; }
.dpat-linkBtn { background: none; border: 0; color: var(--dpat-accent); font: inherit; font-size: 12px;
  cursor: pointer; padding: 2px 4px; border-radius: var(--dsw-radius-sm, 6px); }
.dpat-linkBtn:hover { text-decoration: underline; }
/* The session-row hover button: square, icon-only, same wash as the row's own
   controls. */
.dpat-rowAction { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;
  padding: 0; border: 0; border-radius: var(--dsw-radius-sm, 6px); background: transparent;
  color: var(--dsw-alias-label-secondary, inherit); cursor: pointer; }
.dpat-rowAction:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14));
  color: var(--dsw-alias-label-primary, inherit); }
.dpat-rowAction:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4a9eff); outline-offset: 1px; }
/* Two columns once the stage pane is wide enough: the width freed by lifting
   the 900px cap goes to a second reading column rather than to longer lines. */
@media (min-width: 1180px) {
  .dpat-stageBody { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
  /* A stage whose content is ONE reading flow (the case editor's two buckets,
     the defect list) must span the full width as a single column: letting the
     buckets become grid cells pushed the negative bucket into the right-hand
     column, so the editor started a whole column away from its own heading. */
  .dpat-stageBody > .dpat-stageLead,
  .dpat-stageBody > .dpat-docs,
  .dpat-stageBody > .dpat-analysisControls,
  .dpat-stageBody > .dpat-modelCard,
  .dpat-stageBody > .dpat-runResult,
  .dpat-stageBody > .dpat-bucket,
  .dpat-stageBody > .dpat-bucketHead,
  .dpat-stageBody > .dpat-caseList,
  .dpat-stageBody > .dpat-import { grid-column: 1 / -1; }
  .dpat-importList { max-height: 320px; }
}

@media (max-width: 760px) {
  .dpat-wbBody { grid-template-columns: minmax(0, 1fr); }
  .dpat-rail { border-right: 0; border-bottom: 0.5px solid var(--dpat-line); max-height: 180px; }
  .dpat-wbHead { padding: 12px 16px; }
  .dpat-wbStage { padding: 12px 16px 32px; }
}


/* ---- workbench: analysis targets, self-check, triage, regression ---- */
.dpat-controlRow { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.dpat-fieldInline { flex-direction: row; align-items: center; gap: 8px; border: 0; padding: 0; background: none; }
.dpat-targetWrap { display: inline-flex; align-items: center; gap: 4px; }
.dpat-targetInput { width: 88px; text-align: right; }
.dpat-unit { color: var(--dsw-alias-label-tertiary, var(--dpat-fg2)); font-size: 12px; }
.dpat-fieldset { margin: 0; padding: 8px 10px; border: 0.5px solid var(--dpat-line); border-radius: var(--dsw-radius-md, 8px); }
.dpat-check { display: inline-flex; align-items: center; gap: 6px; margin-right: 14px; font-size: 12.5px; cursor: pointer; }
.dpat-check input { margin: 0; accent-color: var(--dpat-accent); }
.dpat-badgeOk { display: inline-block; margin-top: 6px; padding: 1px 8px; border-radius: 999px; font-size: 11px;
  color: var(--dsw-alias-state-success-primary, #2a2); border: 0.5px solid var(--dsw-alias-state-success-primary, #2a2); }
.dpat-hintWarn { margin: 0; font-size: 12px; color: var(--dsw-alias-state-warn-primary, #d97706); }
.dpat-hintOk { font-size: 12px; color: var(--dsw-alias-state-success-primary, #2a2); }
.dpat-btnDanger { color: var(--dsw-alias-state-error-primary, #d33); border-color: var(--dsw-alias-state-error-primary, #d33); }

/* ---- import panel ---- */
.dpat-import { flex: none; margin: 10px 24px 0; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;
  border: 0.5px solid var(--dpat-line2); border-radius: var(--dpat-radius);
  background: var(--dsw-alias-bg-layer-2, var(--dpat-surface)); }
.dpat-importHead { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dpat-importHead .dpat-cardTitle { margin: 0; }
.dpat-dropZone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  min-height: 92px; padding: 14px; text-align: center; cursor: pointer;
  border: 1.5px dashed var(--dpat-line2); border-radius: var(--dsw-radius-md, 8px);
  color: var(--dpat-fg2); background: var(--dpat-surface); outline-offset: 2px; }
.dpat-dropZone:hover, .dpat-dropZone:focus-visible { color: var(--dpat-fg); border-color: var(--dpat-accent); }
.dpat-dropZoneActive { border-color: var(--dpat-accent); background: var(--dpat-hover); color: var(--dpat-fg); }
.dpat-dropIcon { font-size: 20px; line-height: 1; }
.dpat-importInput { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.dpat-importPreview { display: flex; flex-direction: column; gap: 8px; }
.dpat-importSummary { margin: 0; font-weight: 600; }
.dpat-importWarnings summary { cursor: pointer; font-size: 12px; color: var(--dsw-alias-state-warn-primary, #d97706); }
.dpat-importList { list-style: none; margin: 0; padding: 0; max-height: 220px; overflow: auto;
  display: flex; flex-direction: column; gap: 2px; border-top: 0.5px solid var(--dpat-line); padding-top: 6px; }
.dpat-importItem { display: flex; align-items: center; gap: 8px; padding: 3px 4px; font-size: 12.5px; }
.dpat-importTitle { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dpat-kindChip { flex: none; padding: 0 7px; border-radius: 999px; font-size: 11px; line-height: 18px;
  border: 0.5px solid var(--dpat-line2); color: var(--dpat-fg2); }
.dpat-kindChip-positive { color: var(--dsw-alias-state-success-primary, #2a2); border-color: var(--dsw-alias-state-success-primary, #2a2); }
.dpat-kindChip-negative { color: var(--dsw-alias-state-warn-primary, #d97706); border-color: var(--dsw-alias-state-warn-primary, #d97706); }
.dpat-importActions { display: flex; gap: 8px; flex-wrap: wrap; }
@media (max-width: 760px) { .dpat-import { margin: 8px 16px 0; } }

/* keep precedence: motion rule last */
/* ---- who does the work: model / human markers ---- */
/* flex: none matters: the stage head wraps, and a wrapping flex container
   otherwise stretches a shrinkable inline-flex badge past its content. */
/* Derived status: a pill that explains itself, never a control. */
.dpat-stageStatus { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 1px 10px;
  border-radius: 999px; font-size: 11.5px; line-height: 18px; white-space: nowrap; cursor: help;
  border: 0.5px solid var(--dpat-line2); color: var(--dpat-fg2); }
.dpat-stageStatus-done { color: var(--dsw-alias-state-success-primary, #2a2); border-color: var(--dsw-alias-state-success-primary, #2a2); }
.dpat-stageStatus-doing { color: var(--dsw-alias-state-warn-primary, #d97706); border-color: var(--dsw-alias-state-warn-primary, #d97706); }
.dpat-owner { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 1px 9px; border-radius: 999px;
  font-size: 11.5px; line-height: 18px; white-space: nowrap; border: 0.5px solid var(--dpat-line2); color: var(--dpat-fg2); }
.dpat-owner-human { color: var(--dsw-alias-brand-primary, #2563eb); border-color: var(--dsw-alias-brand-primary, #2563eb); }
.dpat-owner-model { color: var(--dsw-alias-state-success-primary, #2a2); border-color: var(--dsw-alias-state-success-primary, #2a2); }
.dpat-owner-review { color: var(--dsw-alias-state-warn-primary, #d97706); border-color: var(--dsw-alias-state-warn-primary, #d97706); }
.dpat-actions { border-left: 3px solid var(--dsw-alias-brand-primary, #2563eb); }
.dpat-actionList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.dpat-actionItem { display: flex; align-items: flex-start; gap: 9px; }
.dpat-actionNo { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;
  margin-top: 1px; border-radius: 50%; font-size: 10.5px; font-weight: 600; color: var(--dsw-alias-label-primary-foreground, #fff);
  background: var(--dsw-alias-brand-primary, #2563eb); }
.dpat-actionDo { display: block; font-weight: 600; }
.dpat-actionDetail { display: block; margin-top: 1px; font-size: 12px; color: var(--dsw-alias-label-tertiary, var(--dpat-fg2)); }
.dpat-dropZoneCompact { min-height: 64px; flex-direction: row; gap: 8px; justify-content: flex-start; text-align: left; }
.dpat-docList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.dpat-docItem { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: var(--dsw-radius-sm, 6px); }
.dpat-docItem:hover { background: var(--dpat-hover); }
.dpat-docIcon { flex: none; }
.dpat-docMeta { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.35; }
.dpat-docName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dpat-runBar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 12px 0 4px; }
.dpat-runBtn { height: 34px; padding: 0 18px; font-size: 13px; font-weight: 600; }
.dpat-runResult { margin-top: 10px; padding: 10px 12px; border-radius: var(--dsw-radius-md, 8px);
  border: 0.5px solid var(--dsw-alias-state-success-primary, #2a2);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2a2) 7%, transparent); }
.dpat-runResult p { margin: 0 0 4px; }
.dpat-runPrompt summary { cursor: pointer; font-size: 12px; color: var(--dpat-fg2); }
.dpat-pre { margin: 8px 0 0; padding: 10px; max-height: 220px; overflow: auto; font-size: 11.5px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; border-radius: var(--dsw-radius-sm, 6px);
  background: var(--dpat-surface2); border: 0.5px solid var(--dpat-line); }
.dpat-modelCard { border-left: 3px solid var(--dsw-alias-state-success-primary, #2a2); }

@media (prefers-reduced-motion: reduce) { .dpat-root *, .dpat-root *::before { transition: none !important; } }
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
