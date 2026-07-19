import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const windowsRoot = path.resolve(here, "..");
const template = await fs.readFile(path.join(windowsRoot, "assets", "renderer-inject.js"), "utf8");
const css = await fs.readFile(path.join(windowsRoot, "assets", "dream-skin.css"), "utf8");
const buildPayload = (config = {}) => template
  .replace("__DREAM_CSS_JSON__", JSON.stringify(".fixture { color: blue; }"))
  .replace("__DREAM_ART_JSON__", JSON.stringify("data:image/png;base64,AA=="))
  .replace("__DREAM_THEME_JSON__", JSON.stringify(config));
const payload = buildPayload();

assert.doesNotMatch(
  css,
  /main\.main-surface\s*>\s*header\.app-header-tint\s*\{[^}]*\b(?:position|z-index)\s*:/,
  "The skin must preserve Codex's native fixed header so the side-panel toggle remains reachable.",
);

assert.match(
  css,
  /\.dream-home-utility\s*\{[^}]*margin-inline-start:\s*var\(--dream-home-utility-margin-start\)\s*!important;[^}]*padding-inline-start:\s*var\(--dream-home-utility-padding-start\)\s*!important;/s,
  "The home utility bar must use renderer-measured geometry instead of a fixed gutter correction.",
);
assert.match(
  css,
  /--color-token-primary:\s*var\(--dream-accent\)\s*!important;[\s\S]*--color-token-text-link-foreground:\s*var\(--dream-accent\)\s*!important;/,
  "Native Codex accent tokens must follow the active character theme.",
);
assert.match(
  css,
  /header\[class~="sticky"\]\[class~="bg-token-dropdown-background"\],[\s\S]*\.dream-attachment-panel \[class~="bg-token-dropdown-background\/95"\][\s\S]*background:\s*color-mix\(in oklab, var\(--dream-surface-raised\) 88%, var\(--dream-accent\) 12%\)\s*!important;/,
  "Secondary-drawer and attachment-section headers must use an adaptive theme surface.",
);
assert.match(
  css,
  /\.dream-home-utility button,\s*html\.codex-dream-skin \.composer-surface-chrome button:not\(\[class~="bg-token-foreground"\]\)\s*\{[^}]*color:\s*var\(--dream-text-muted\)\s*!important;/s,
  "Composer controls must not inherit low-opacity native foreground tokens.",
);
assert.match(
  css,
  /\.composer-surface-chrome p\.placeholder::after\s*\{[^}]*color:\s*var\(--dream-text-muted\)\s*!important;[^}]*opacity:\s*1\s*!important;/s,
  "Composer placeholder text must retain explicit readable contrast.",
);
assert.match(
  css,
  /--dream-immersive-edge:\s*color-mix\(in oklab, var\(--dream-surface\) 88%, transparent\)/,
  "Light mode must use an opaque-enough home wash over dark detailed artwork.",
);
assert.match(
  css,
  /\.dream-theme-light \[class~="group\/application-menu-top-bar"\]\s*\{[^}]*background:\s*color-mix\(in oklab, var\(--dream-sidebar\) 94%, transparent\)/s,
  "Light mode must keep the native application menu readable over wide artwork.",
);
assert.match(
  css,
  /:is\(\[role="menu"\], \[role="listbox"\]\)\s*\{[^}]*background:\s*var\(--dream-menu-surface\)\s*!important;[^}]*backdrop-filter:\s*blur\(18px\)/s,
  "Semantic dropdowns and nested menus must use the themed glass surface.",
);
assert.match(
  css,
  /\[role="menuitemradio"\][^}]*\[data-state="checked"\][^}]*background:\s*var\(--dream-accent-soft\)/s,
  "Popup selections must retain a theme-colored high-contrast state.",
);
assert.match(
  css,
  /\.dream-magi-module[\s\S]*\.dream-magi-meter--context[\s\S]*--dream-context-fill/,
  "The environment panel must expose compact MAGI and estimated context telemetry.",
);
assert.match(
  css,
  /\.dream-task-status-row\[data-dream-task-state="run"\]::after\s*\{[^}]*content:\s*"SYNC 3\/5"/s,
  "The active task row must expose its discrete synchronization state.",
);
assert.match(
  css,
  /\.dream-magi-title strong\s*\{[^}]*font-size:\s*14px;[\s\S]*\.dream-magi-meters\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
  "MAGI telemetry must use a legible type scale and full-width meter rows.",
);
assert.match(css, /\.dream-magi-title > \*\s*\{[^}]*white-space:\s*nowrap;/s,
  "Larger MAGI title text must remain on one line in the narrow summary panel.");
assert.match(
  css,
  /\.dream-task-status-row::after\s*\{[^}]*inset-inline-end:\s*34px;[^}]*font:\s*800 10px\/1/s,
  "The task status badge must remain clear of Codex's native trailing icon.",
);
assert.match(
  css,
  /\.dream-task-status-row:is\(:hover, :focus-within\)::after\s*\{[^}]*inset-inline-end:\s*92px;/s,
  "The task status badge must yield to native pin and archive controls on hover or focus.",
);
assert.match(
  css,
  /aside\.app-shell-left-panel > \[class~="cursor-col-resize"\]\s*\{[^}]*right:\s*-8px\s*!important;[^}]*width:\s*8px\s*!important;[^}]*translate:\s*none\s*!important;/s,
  "The sidebar resize target must sit outside the native scrollbar lane.",
);
assert.match(
  css,
  /main\.main-surface aside > \[class~="cursor-col-resize"\]\[class~="left-0"\]\s*\{[^}]*left:\s*0\s*!important;[^}]*width:\s*8px\s*!important;[^}]*translate:\s*none\s*!important;/s,
  "The right workspace resize target must sit beyond the conversation scrollbar lane.",
);
assert.match(
  css,
  /\.thread-scroll-container\s*\{[^}]*scrollbar-width:\s*thin;/s,
  "The conversation scrollbar must use an independent narrow track.",
);
assert.match(
  css,
  /\.dream-operation-panel::before\s*\{[^}]*content:\s*attr\(data-dream-operation\)/s,
  "Edited-file cards must receive a non-interactive operation header.",
);
assert.match(template, /USAGE REMAINING/,
  "The renderer must label account quota separately from context estimation.");
assert.match(template, /CONTEXT BUFFER · EST\./,
  "Context telemetry must be explicitly marked as an estimate.");
assert.match(template, /codex-dream-official-status-v1/,
  "Official conversation status readings must be cached after the native status surface closes.");
assert.match(template, /data-response-annotation-conversation/,
  "Cached context readings must be scoped to the currently rendered conversation.");
assert.match(template, /\(element\.textContent \|\| ""\)\.trim\(\) === "状态"/,
  "Status discovery must start from the native standalone status heading.");
assert.match(template, /7\\s\*天限额[\s\S]*重置时间/,
  "The native seven-day allowance and reset time must feed the account meter.");
assert.match(template, /CONTEXT REMAINING/,
  "Official background-information readings must replace estimates for the matching conversation.");
assert.match(template, /dream-usage-meter > em/,
  "A live upgrade must replace legacy MAGI markup that cannot display official quota metadata.");
assert.match(template, /querySelectorAll\('\[role="dialog"\], \[data-testid\*="settings" i\]'\)/,
  "Quota discovery must remain limited to visible official settings surfaces.");

function createFixture({
  shellPresent,
  sidebarPresent = true,
  composerPresent = false,
  staleSkin = false,
  homePresent = false,
  utilityPresent = false,
  secondaryPanelsPresent = false,
  shellAppearance = "dark",
  computedColorScheme = "",
  osAppearance = "light",
  analysisFixture = null,
}) {
  const nodes = new Map();
  const rootClasses = new Set(staleSkin ? ["codex-dream-skin"] : []);
  const rootStyles = new Map(staleSkin ? [["--dream-art", "url(\"blob:stale\")"]] : []);
  const revokedUrls = [];
  const observers = [];
  let objectUrlCount = 0;
  let hasShell = shellPresent;
  let root;

  const queueRootClassMutation = () => {
    for (const observer of observers) {
      if (observer.target !== root || !observer.options?.attributes) continue;
      if (observer.options.attributeFilter && !observer.options.attributeFilter.includes("class")) continue;
      observer.records.push({ type: "attributes", attributeName: "class", target: root });
    }
  };
  const makeClassList = (classes = new Set(), onMutation = () => {}) => ({
    add(...values) {
      let changed = false;
      for (const value of values) {
        if (!classes.has(value)) { classes.add(value); changed = true; }
      }
      if (changed) onMutation();
    },
    remove(...values) {
      let changed = false;
      for (const value of values) changed = classes.delete(value) || changed;
      if (changed) onMutation();
    },
    toggle(value, enabled) {
      const changed = enabled ? !classes.has(value) : classes.has(value);
      if (enabled) classes.add(value);
      else classes.delete(value);
      if (changed) onMutation();
    },
    contains(value) { return classes.has(value); },
  });

  root = {
    className: shellAppearance,
    classList: makeClassList(rootClasses, queueRootClassMutation),
    getAttribute() { return null; },
    style: {
      setProperty(key, value) { rootStyles.set(key, value); },
      removeProperty(key) { rootStyles.delete(key); },
    },
    appendChild(node) {
      node.parentElement = root;
      nodes.set(node.id, node);
    },
  };
  const body = {
    className: "",
    getAttribute() { return null; },
    appendChild(node) {
      node.parentElement = body;
      nodes.set(node.id, node);
    },
  };
  const shellMain = {
    classList: makeClassList(),
    getBoundingClientRect() {
      return { left: 290, top: 36, width: 990, height: 784 };
    },
  };
  const routeClasses = new Set();
  const utilityClasses = new Set();
  const utilityStyles = new Map();
  const utilityNode = {
    classList: makeClassList(utilityClasses),
    style: {
      setProperty(key, value) { utilityStyles.set(key, value); },
      removeProperty(key) { utilityStyles.delete(key); },
    },
    getBoundingClientRect() { return { left: 310, right: 990, width: 680 }; },
  };
  const composerNode = {
    getBoundingClientRect() {
      return { left: 290, right: 1010, top: 690, bottom: 790, width: 720, height: 100 };
    },
  };
  const drawerClasses = new Set();
  const summaryClasses = new Set();
  const attachmentClasses = new Set();
  const drawerNode = { classList: makeClassList(drawerClasses) };
  const attachmentNode = { classList: makeClassList(attachmentClasses) };
  const summaryNode = {
    classList: makeClassList(summaryClasses),
    querySelector(selector) {
      return selector === '[class~="group/summary-panel-item"]' ? {} : null;
    },
  };
  const routeMain = {
    classList: makeClassList(routeClasses),
    querySelector(selector) {
      return selector === ".composer-surface-chrome" && utilityPresent ? composerNode : null;
    },
    querySelectorAll(selector) {
      if (selector === '[class*="_homeUtilityBar_"]' && utilityPresent) return [utilityNode];
      return [];
    },
  };
  const staleHome = { classList: makeClassList(new Set(["dream-home"])) };
  const staleShell = { classList: makeClassList(new Set(["dream-home-shell"])) };

  const createElement = (tagName) => {
    if (tagName === "canvas" && analysisFixture) {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            drawImage() {},
            getImageData() { return { data: analysisFixture.pixels }; },
          };
        },
      };
    }
    return {
      id: "",
      dataset: {},
      style: {},
      classList: makeClassList(),
      parentElement: null,
      textContent: "",
      innerHTML: "",
      setAttribute() {},
      remove() { nodes.delete(this.id); },
    };
  };
  if (staleSkin) {
    const style = createElement();
    style.id = "codex-dream-skin-style";
    nodes.set(style.id, style);
    const chrome = createElement();
    chrome.id = "codex-dream-skin-chrome";
    nodes.set(chrome.id, chrome);
  }

  const document = {
    documentElement: root,
    head: root,
    body,
    createElement,
    getElementById(id) { return nodes.get(id) ?? null; },
    querySelector(selector) {
      if (selector === "main.main-surface") return hasShell ? shellMain : null;
      if (selector === "aside.app-shell-left-panel") return hasShell && sidebarPresent ? {} : null;
      if (selector === '[role="main"]:has([data-testid="home-icon"])') {
        return hasShell && homePresent ? routeMain : null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[role="main"]') return hasShell ? [routeMain] : [];
      if (selector === ".composer-surface-chrome") return hasShell && composerPresent ? [composerNode] : [];
      if (selector === ".dream-task") return routeClasses.has("dream-task") ? [routeMain] : [];
      if (selector === ".dream-home-utility") {
        return utilityClasses.has("dream-home-utility") ? [utilityNode] : [];
      }
      if (selector === '[class~="absolute"][class~="top-0"][class~="bottom-0"][class~="left-0"][class~="border-l"][class~="bg-token-main-surface-primary"]') {
        return secondaryPanelsPresent ? [drawerNode] : [];
      }
      if (selector === '[class~="rounded-3xl"][class~="bg-token-dropdown-background"]') {
        return secondaryPanelsPresent ? [summaryNode] : [];
      }
      if (selector === ".dream-secondary-drawer") {
        return drawerClasses.has("dream-secondary-drawer") ? [drawerNode] : [];
      }
      if (selector === ".dream-summary-panel") {
        return summaryClasses.has("dream-summary-panel") ? [summaryNode] : [];
      }
      if (selector === '[class~="max-h-[320px]"][class~="bg-token-dropdown-background/90"]') {
        return secondaryPanelsPresent ? [attachmentNode] : [];
      }
      if (selector === ".dream-attachment-panel") {
        return attachmentClasses.has("dream-attachment-panel") ? [attachmentNode] : [];
      }
      if (!staleSkin) return [];
      if (selector === ".dream-home") return [staleHome];
      if (selector === ".dream-home-shell") return [staleShell];
      return [];
    },
  };
  const context = {
    window: {
      innerHeight: 820,
      matchMedia() { return { matches: osAppearance === "dark" }; },
    },
    document,
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.records = [];
        this.target = null;
        this.options = null;
        observers.push(this);
      }
      observe(target, options = {}) {
        this.target = target;
        this.options = options;
      }
      disconnect() {
        this.target = null;
        this.records = [];
      }
      takeRecords() {
        const records = this.records;
        this.records = [];
        return records;
      }
    },
    URL: {
      createObjectURL() { objectUrlCount += 1; return `blob:fixture-${objectUrlCount}`; },
      revokeObjectURL(value) { revokedUrls.push(value); },
    },
    Blob,
    Uint8Array,
    atob,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 2,
    clearTimeout: () => {},
    getComputedStyle(element) {
      if (element === utilityNode) {
        return { paddingInlineStart: "8px", paddingInlineEnd: "8px" };
      }
      return { colorScheme: computedColorScheme };
    },
  };
  if (analysisFixture) {
    context.Image = class {
      naturalWidth = analysisFixture.naturalWidth;
      naturalHeight = analysisFixture.naturalHeight;
      set src(_) { this.onload(); }
    };
  }

  return {
    context,
    nodes,
    observers,
    rootClasses,
    rootStyles,
    revokedUrls,
    routeClasses,
    utilityClasses,
    utilityStyles,
    drawerClasses,
    summaryClasses,
    attachmentClasses,
    setShellPresent(value) { hasShell = value; },
  };
}

const main = createFixture({ shellPresent: true });
const mainResult = vm.runInNewContext(payload, main.context);
assert.equal(mainResult.installed, true);
assert.equal(main.rootClasses.has("codex-dream-skin"), true);
assert.equal(main.rootStyles.get("--dream-art"), 'url("blob:fixture-1")');
assert.equal(main.nodes.has("codex-dream-skin-style"), true);
assert.equal(main.nodes.has("codex-dream-skin-chrome"), true);
assert.equal(main.rootClasses.has("dream-theme-dark"), true);
assert.equal(main.rootClasses.has("dream-art-standard"), true);
assert.equal(main.rootClasses.has("dream-task-ambient"), true);
assert.equal(main.routeClasses.has("dream-task"), true);
assert.equal(main.context.window.__CODEX_DREAM_SKIN_STATE__.cleanup(), true);

const collapsedSidebar = createFixture({ shellPresent: true, sidebarPresent: false, composerPresent: true });
const collapsedResult = vm.runInNewContext(payload, collapsedSidebar.context);
assert.equal(collapsedResult.adaptive, true,
  "A visible main surface and composer must keep the skin active while the sidebar is collapsed.");
assert.equal(collapsedSidebar.rootClasses.has("codex-dream-skin"), true);
assert.equal(main.rootClasses.has("codex-dream-skin"), false);
assert.equal(main.rootClasses.has("dream-theme-dark"), false);
assert.equal(main.nodes.has("codex-dream-skin-style"), false);
assert.equal(main.nodes.has("codex-dream-skin-chrome"), false);
assert.deepEqual(main.revokedUrls, ["blob:fixture-1"]);

const reinjected = createFixture({ shellPresent: true });
vm.runInNewContext(payload, reinjected.context);
const firstState = reinjected.context.window.__CODEX_DREAM_SKIN_STATE__;
vm.runInNewContext(payload, reinjected.context);
const secondState = reinjected.context.window.__CODEX_DREAM_SKIN_STATE__;
assert.notEqual(secondState.installToken, firstState.installToken);
assert.equal(secondState.artUrl, "blob:fixture-2");
assert.equal(reinjected.rootStyles.get("--dream-art"), 'url("blob:fixture-2")');
assert.deepEqual(reinjected.revokedUrls, ["blob:fixture-1"]);
assert.equal(firstState.cleanup(), false);
assert.equal(secondState.cleanup(), true);

const auxiliary = createFixture({ shellPresent: false, staleSkin: true });
const auxiliaryResult = vm.runInNewContext(payload, auxiliary.context);
assert.equal(auxiliaryResult.installed, true);
assert.equal(auxiliary.rootClasses.has("codex-dream-skin"), false);
assert.equal(auxiliary.rootStyles.has("--dream-art"), false);
assert.equal(auxiliary.nodes.has("codex-dream-skin-style"), false);
assert.equal(auxiliary.nodes.has("codex-dream-skin-chrome"), false);

auxiliary.setShellPresent(true);
auxiliary.context.window.__CODEX_DREAM_SKIN_STATE__.ensure();
assert.equal(auxiliary.rootClasses.has("codex-dream-skin"), true);
assert.equal(auxiliary.nodes.has("codex-dream-skin-style"), true);
assert.equal(auxiliary.nodes.has("codex-dream-skin-chrome"), true);

const configured = createFixture({
  shellPresent: true,
  homePresent: true,
  utilityPresent: true,
  secondaryPanelsPresent: true,
});
const configuredPayload = buildPayload({
  appearance: "light",
  palette: { accent: "#d45a70" },
  art: { focusX: .15, focusY: .8, safeArea: "right", taskMode: "off" },
});
const configuredResult = vm.runInNewContext(configuredPayload, configured.context);
assert.equal(configuredResult.adaptive, true);
assert.equal(configured.rootClasses.has("dream-theme-light"), true);
assert.equal(configured.rootClasses.has("dream-theme-dark"), false);
assert.equal(configured.rootClasses.has("dream-focus-left"), true);
assert.equal(configured.rootClasses.has("dream-safe-right"), true);
assert.equal(configured.rootClasses.has("dream-task-off"), true);
assert.equal(configured.rootStyles.get("--dream-art-position"), "15% 80%");
assert.equal(configured.rootStyles.get("--dream-accent"), "#d45a70");
assert.equal(configured.rootStyles.get("--dream-accent-ink"), "rgb(26 24 28)");
assert.equal(configured.routeClasses.has("dream-home"), true);
assert.equal(configured.routeClasses.has("dream-task"), false);
assert.equal(configured.utilityClasses.has("dream-home-utility"), true);
assert.equal(configured.utilityStyles.get("--dream-home-utility-margin-start"), "-10px");
assert.equal(configured.utilityStyles.get("--dream-home-utility-margin-end"), "-10px");
assert.equal(configured.utilityStyles.get("--dream-home-utility-padding-start"), "18px");
assert.equal(configured.utilityStyles.get("--dream-home-utility-padding-end"), "18px");
assert.equal(configured.drawerClasses.has("dream-secondary-drawer"), true);
assert.equal(configured.summaryClasses.has("dream-summary-panel"), true);
assert.equal(configured.attachmentClasses.has("dream-attachment-panel"), true);
assert.equal(configured.context.window.__CODEX_DREAM_SKIN_STATE__.cleanup(), true);
assert.equal(configured.utilityClasses.has("dream-home-utility"), false);
assert.equal(configured.utilityStyles.size, 0);
assert.equal(configured.drawerClasses.has("dream-secondary-drawer"), false);
assert.equal(configured.summaryClasses.has("dream-summary-panel"), false);
assert.equal(configured.attachmentClasses.has("dream-attachment-panel"), false);

const analysisPixels = new Uint8ClampedArray(48 * 12 * 4);
for (let index = 0; index < 48 * 12; index += 1) {
  const offset = index * 4;
  const x = index % 48;
  const subject = x >= 34 && x <= 42;
  analysisPixels[offset] = subject ? 210 : 246;
  analysisPixels[offset + 1] = subject ? 84 : 239;
  analysisPixels[offset + 2] = subject ? 112 : 237;
  analysisPixels[offset + 3] = 255;
}
const analyzed = createFixture({
  shellPresent: true,
  analysisFixture: { naturalWidth: 1200, naturalHeight: 400, pixels: analysisPixels },
});
vm.runInNewContext(payload, analyzed.context);
await Promise.resolve();
assert.equal(analyzed.rootClasses.has("dream-theme-dark"), true);
assert.equal(analyzed.rootClasses.has("dream-theme-light"), false);
assert.equal(analyzed.rootClasses.has("dream-art-wide"), true);
assert.equal(analyzed.rootClasses.has("dream-task-banner"), true);
assert.equal(analyzed.rootClasses.has("dream-safe-left"), true);
assert.notEqual(analyzed.rootStyles.get("--dream-accent"), "rgb(216 104 119)");

const darkAccent = createFixture({ shellPresent: true });
vm.runInNewContext(buildPayload({ palette: { accent: "#56317d" } }), darkAccent.context);
assert.equal(darkAccent.rootStyles.get("--dream-accent-ink"), "rgb(250 248 251)");

const standardArt = createFixture({
  shellPresent: true,
  analysisFixture: { naturalWidth: 800, naturalHeight: 800, pixels: analysisPixels },
});
vm.runInNewContext(payload, standardArt.context);
await Promise.resolve();
assert.equal(standardArt.rootClasses.has("dream-art-standard"), true);
assert.equal(standardArt.rootClasses.has("dream-task-ambient"), true);
assert.equal(standardArt.rootClasses.has("dream-task-banner"), false);

const mediumWide = createFixture({
  shellPresent: true,
  analysisFixture: { naturalWidth: 2100, naturalHeight: 1000, pixels: analysisPixels },
});
vm.runInNewContext(payload, mediumWide.context);
await Promise.resolve();
assert.equal(mediumWide.rootClasses.has("dream-art-wide"), true);
assert.equal(mediumWide.rootClasses.has("dream-task-ambient"), true);
assert.equal(mediumWide.rootClasses.has("dream-task-banner"), false);

const nativeLight = createFixture({ shellPresent: true, shellAppearance: "light" });
vm.runInNewContext(payload, nativeLight.context);
assert.equal(nativeLight.rootClasses.has("dream-theme-light"), true);
assert.equal(nativeLight.rootClasses.has("dream-theme-dark"), false);

const nativeComputedDark = createFixture({
  shellPresent: true,
  shellAppearance: "",
  computedColorScheme: "dark",
  osAppearance: "light",
});
vm.runInNewContext(payload, nativeComputedDark.context);
assert.equal(nativeComputedDark.rootClasses.has("dream-theme-dark"), true);
assert.equal(nativeComputedDark.rootClasses.has("dream-theme-light"), false);
nativeComputedDark.context.window.__CODEX_DREAM_SKIN_STATE__.ensure();
assert.equal(nativeComputedDark.rootClasses.has("dream-theme-dark"), true);
const nativeObserver = nativeComputedDark.observers[0];
nativeObserver.takeRecords();
nativeComputedDark.context.window.__CODEX_DREAM_SKIN_STATE__.ensure();
assert.equal(nativeObserver.takeRecords().length, 0,
  "Sampling the native computed color-scheme must not queue a self-triggering root mutation pass.");

const metadataWide = createFixture({ shellPresent: true });
vm.runInNewContext(buildPayload({ artMetadata: { ratio: 16 / 9 } }), metadataWide.context);
assert.equal(metadataWide.rootClasses.has("dream-art-wide"), true);
assert.equal(metadataWide.rootClasses.has("dream-art-standard"), false);

console.log("PASS: renderer applies adaptive theme metadata and preserves transparent auxiliary windows.");
