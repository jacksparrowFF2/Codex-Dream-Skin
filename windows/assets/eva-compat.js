// Windows-only EVA/MAGI compatibility layer. The canonical Dream Skin renderer
// runs first; this extension decorates its public/native parts without replacing
// upstream lifecycle, theme validation, or CDP safety behavior.
(() => {
  const BASE_STATE_KEY = "__CODEX_DREAM_SKIN_STATE__";
  const STATE_KEY = "__CODEX_EVA_COMPAT_STATE__";
  const ROOT_ATTR = "data-eva-compat";
  const OFFICE_ATTR = "data-eva-office";
  const MAGI_ID = "codex-dream-magi-module";
  const COMPOSER_STATUS_ID = "codex-dream-composer-status";
  const SUMMARY_PANEL_SELECTOR = ':is([class~="rounded-3xl"][class~="bg-token-dropdown-background"], [class~="rounded-3xl"][class~="bg-surface-elevated-secondary"])';
  const SUMMARY_ITEM_SELECTOR = ':is([class~="group/summary-panel-item"], [data-slot="thread-summary-panel-item-button"])';
  const COMPOSER_SELECTOR = ':is(.composer-surface-chrome, [data-composer-surface-variant][data-composer-layout])';
  const CLASSES = {
    summary: "dream-summary-panel",
    operation: "dream-operation-panel",
    rail: "dream-eva-thread-rail",
    record: "dream-eva-record-panel",
    section: "dream-eva-section-label",
  };

  const previous = window[STATE_KEY];
  if (typeof previous?.cleanup === "function") previous.cleanup();

  const baseState = window[BASE_STATE_KEY];
  const themeId = String(baseState?.themeId || "");
  const enabled = themeId.startsWith("preset-eva-");
  const root = document.documentElement;
  if (!enabled || !baseState || !root) {
    root?.removeAttribute(ROOT_ATTR);
    root?.removeAttribute(OFFICE_ATTR);
    document.getElementById(MAGI_ID)?.remove();
    document.getElementById(COMPOSER_STATUS_ID)?.remove();
    return;
  }

  const office = themeId === "preset-eva-office-protocol";
  const installToken = {};
  let observer = null;
  let timer = null;
  let scheduled = null;
  let lastHeavyRefresh = 0;
  let runtimeState = "ready";
  let baseCleanup = typeof baseState.cleanup === "function" ? baseState.cleanup.bind(baseState) : null;

  const visible = (element) => {
    if (!element?.getBoundingClientRect) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  };
  const setText = (element, value) => {
    if (element && element.textContent !== value) element.textContent = value;
  };
  const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));

  const taskState = () => {
    if ([...document.querySelectorAll('[class*="cadencedShimmer"], [class*="shimmerHighlight"]')]
      .some(visible)) return "run";
    const approval = [...document.querySelectorAll("button")]
      .filter((button) => visible(button) && !button.closest?.(COMPOSER_SELECTOR))
      .some((button) => /^(?:批准|同意|允许|运行|approve|allow)(?:\s|$)/i
        .test((button.textContent || "").trim()));
    return approval ? "hold" : "ready";
  };

  const taskRoute = () => {
    const home = document.querySelector('[role="main"]:has([data-testid="home-icon"])');
    return [...document.querySelectorAll('[role="main"]')]
      .filter((candidate) => candidate !== home && visible(candidate))
      .sort((left, right) => (right.innerText || right.textContent || "").length -
        (left.innerText || left.textContent || "").length)[0] || null;
  };

  const estimateContext = (route) => {
    const text = (route?.innerText || route?.textContent || "")
      .replace(/MAGI SYSTEM|MELCHIOR|BALTHASAR|CASPER|USAGE REMAINING|CONTEXT BUFFER/g, "");
    const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
    const remaining = text.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, "").replace(/\s+/g, " ");
    const tokens = Math.max(0, Math.round(cjk + remaining.length / 4 +
      (route?.querySelectorAll?.("img")?.length || 0) * 1200));
    const percent = Math.max(1, Math.min(99, Math.round(tokens / 128000 * 100)));
    const compact = tokens >= 1000 ? `${(tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1)}K` : String(tokens);
    return { tokens, percent, compact };
  };

  const readOfficialStatus = () => {
    const text = document.body?.innerText || document.body?.textContent || "";
    const context = /(?:背景信息|context)[^%]{0,100}?(?:剩余|remaining)\s*(\d{1,3})\s*%/i.exec(text);
    const quota = /7\s*(?:天|day)[^%]{0,220}?(?:剩余|remaining)\s*(\d{1,3})\s*%/i.exec(text);
    return {
      contextRemaining: context ? clampPercent(context[1]) : null,
      quotaRemaining: quota ? clampPercent(quota[1]) : null,
    };
  };

  const summaryPanels = () => [...document.querySelectorAll(SUMMARY_PANEL_SELECTOR)]
    .filter((candidate) => candidate.querySelector?.(SUMMARY_ITEM_SELECTOR));

  const ensureMagi = () => {
    const panels = summaryPanels();
    const panel = panels.find(visible) || panels[0] || null;
    document.querySelectorAll(`.${CLASSES.summary}`).forEach((candidate) =>
      candidate.classList.toggle(CLASSES.summary, panels.includes(candidate)));
    panels.forEach((candidate) => candidate.classList.add(CLASSES.summary));
    let module = document.getElementById(MAGI_ID);
    if (!panel) {
      module?.remove();
      return;
    }
    if (!module) {
      module = document.createElement("div");
      module.id = MAGI_ID;
      module.className = "dream-magi-module";
      module.setAttribute("aria-hidden", "true");
      module.innerHTML = `
        <div class="dream-magi-title"><strong>MAGI SYSTEM</strong><span>ACTIVE THEME LINK</span></div>
        <div class="dream-magi-cores">
          <span data-magi="melchior" data-state="ok"><b>MELCHIOR 1</b><i></i><em>ONLINE</em></span>
          <span data-magi="balthasar"><b>BALTHASAR 2</b><i></i><em>CHECK</em></span>
          <span data-magi="casper" data-state="ok"><b>CASPER 3</b><i></i><em>READY</em></span>
        </div>
        <div class="dream-magi-meters">
          <span class="dream-magi-meter dream-magi-meter--usage dream-usage-meter"><span><b>7D USAGE REMAINING</b><strong>CHECK</strong></span><i></i><em>OPEN STATUS TO REFRESH</em></span>
          <span class="dream-magi-meter dream-magi-meter--context dream-context-meter"><span><b data-field="context-label">CONTEXT BUFFER · EST.</b><strong>0%</strong></span><i><u></u></i><em>0 TOKENS · 128K SCALE</em></span>
        </div>`;
    }
    if (module.parentElement !== panel) panel.prepend(module);

    const panelText = panel.textContent || "";
    const changes = /(?:变更|changes?)[^+\-\d]{0,16}\+\s*(\d+)[^\-\d]{0,12}-\s*(\d+)/i.exec(panelText);
    const dirty = changes ? Number(changes[1]) + Number(changes[2]) > 0 : null;
    const balthasar = module.querySelector('[data-magi="balthasar"]');
    balthasar.dataset.state = dirty === null ? "unknown" : dirty ? "warn" : "ok";
    setText(balthasar.querySelector("em"), dirty === null ? "CHECK" : dirty ? "DIRTY" : "CLEAN");
    const casper = module.querySelector('[data-magi="casper"]');
    casper.dataset.state = runtimeState === "hold" ? "warn" : "ok";
    setText(casper.querySelector("em"), runtimeState === "run" ? "RUN" : runtimeState === "hold" ? "HOLD" : "READY");

    const official = readOfficialStatus();
    const usage = module.querySelector(".dream-magi-meter--usage");
    if (official.quotaRemaining !== null) {
      const percent = official.quotaRemaining;
      usage.dataset.state = percent <= 10 ? "alert" : percent <= 25 ? "warn" : "ok";
      usage.style.setProperty("--dream-usage-fill", `${percent}%`);
      setText(usage.querySelector("strong"), `${percent}%`);
      setText(usage.querySelector("em"), "OFFICIAL STATUS");
    } else {
      usage.dataset.state = "unknown";
      usage.style.setProperty("--dream-usage-fill", "0%");
    }

    const context = module.querySelector(".dream-magi-meter--context");
    if (official.contextRemaining !== null) {
      const percent = official.contextRemaining;
      context.dataset.state = percent <= 10 ? "alert" : percent <= 25 ? "warn" : "ok";
      context.style.setProperty("--dream-context-fill", `${percent}%`);
      setText(context.querySelector("b"), "CONTEXT REMAINING");
      setText(context.querySelector("strong"), `${percent}%`);
      setText(context.querySelector("em"), "OFFICIAL STATUS");
    } else {
      const estimated = estimateContext(taskRoute());
      context.dataset.state = estimated.percent >= 85 ? "alert" : estimated.percent >= 65 ? "warn" : "ok";
      context.style.setProperty("--dream-context-fill", `${estimated.percent}%`);
      setText(context.querySelector("b"), "CONTEXT BUFFER · EST.");
      setText(context.querySelector("strong"), `${estimated.percent}%`);
      setText(context.querySelector("em"), `${estimated.compact} TOKENS · 128K SCALE`);
    }
  };

  const ensureComposerStatus = () => {
    const composer = [...document.querySelectorAll(COMPOSER_SELECTOR)].find(visible) || null;
    let status = document.getElementById(COMPOSER_STATUS_ID);
    if (!composer) {
      status?.remove();
      return;
    }
    if (!status) {
      status = document.createElement("div");
      status.id = COMPOSER_STATUS_ID;
      status.className = "dream-composer-status";
      status.setAttribute("aria-hidden", "true");
      status.innerHTML = '<span data-field="pilot">PILOT</span><i></i><span data-field="environment">LOCAL</span><i></i><span data-field="state">READY</span>';
    }
    if (status.parentElement !== composer) composer.appendChild(status);
    const modelButton = [...composer.querySelectorAll("button")]
      .find((button) => /(?:Sol|Codex|GPT)/i.test(button.textContent || ""));
    const modelMatches = (modelButton?.textContent || "")
      .match(/(?:GPT[-\s]?\d[\w.-]*|\d(?:\.\d+)+\s*(?:Sol|Codex(?:\s+Spark)?))/gi);
    const pilot = modelMatches?.at?.(-1)?.replace(/\s+/g, " ").toUpperCase() || "PILOT";
    setText(status.querySelector('[data-field="pilot"]'), pilot);
    setText(status.querySelector('[data-field="environment"]'),
      document.body.textContent.includes("本地") ? "LOCAL" : "ENV");
    setText(status.querySelector('[data-field="state"]'), runtimeState.toUpperCase());
    status.dataset.state = runtimeState;
  };

  const ensureOperationPanels = () => {
    const found = new Set();
    for (const label of document.querySelectorAll("body *")) {
      if (label.children.length || !/(?:已编辑\s*\d+\s*个文件|edited\s*\d+\s*files?)/i
        .test(label.textContent?.trim?.() || "")) continue;
      let candidate = label.parentElement;
      let panel = null;
      for (let depth = 0; candidate && depth < 8; depth += 1, candidate = candidate.parentElement) {
        if (/rounded-(?:2xl|3xl)/.test(String(candidate.className || ""))) panel = candidate;
      }
      if (!panel) continue;
      found.add(panel);
      panel.classList.add(CLASSES.operation);
      const count = Number(/\d+/.exec(label.textContent)?.[0] || 0);
      panel.dataset.dreamOperation = `OPERATION REPORT · FILES ${String(count).padStart(2, "0")}`;
    }
    document.querySelectorAll(`.${CLASSES.operation}`).forEach((candidate) => {
      if (!found.has(candidate)) {
        candidate.classList.remove(CLASSES.operation);
        delete candidate.dataset.dreamOperation;
      }
    });
  };

  const ensureThreadRail = () => {
    const found = new Set();
    for (const list of document.querySelectorAll('[data-thread-user-message-navigation-rail-list="true"]')) {
      const rail = list.closest?.("nav");
      const items = [...list.querySelectorAll("[data-thread-user-message-navigation-item-id]")];
      if (!rail || !items.length) continue;
      found.add(rail);
      rail.classList.add(CLASSES.rail);
      const current = Math.max(0, items.findIndex((item) => item.getAttribute("aria-current") === "true"));
      rail.dataset.dreamRailPhase = `P${String(current + 1).padStart(2, "0")} · ${runtimeState === "run" ? "RUN" : runtimeState === "hold" ? "HOLD" : "SYNC"}`;
    }
    document.querySelectorAll(`.${CLASSES.rail}`).forEach((candidate) => {
      if (!found.has(candidate)) {
        candidate.classList.remove(CLASSES.rail);
        delete candidate.dataset.dreamRailPhase;
      }
    });
  };

  const ensureOffice = () => {
    const labels = new Set();
    if (office) {
      const sidebar = document.querySelector("aside.app-shell-left-panel");
      for (const candidate of sidebar?.querySelectorAll?.("span, div, p") || []) {
        if (candidate.children.length || candidate.closest?.("button, [role='button'], a")) continue;
        if (/^(?:置顶|项目|Pinned|Projects)$/i.test((candidate.textContent || "").trim())) labels.add(candidate);
      }
    }
    document.querySelectorAll(`.${CLASSES.section}`).forEach((candidate) =>
      candidate.classList.toggle(CLASSES.section, labels.has(candidate)));
    labels.forEach((candidate) => candidate.classList.add(CLASSES.section));
  };

  const ensure = () => {
    if (window[STATE_KEY]?.installToken !== installToken) return;
    root.setAttribute(ROOT_ATTR, "active");
    if (office) root.setAttribute(OFFICE_ATTR, "active");
    else root.removeAttribute(OFFICE_ATTR);
    const now = Date.now();
    if (now - lastHeavyRefresh >= 900) {
      lastHeavyRefresh = now;
      runtimeState = taskState();
      ensureMagi();
      ensureOperationPanels();
      ensureThreadRail();
      ensureOffice();
    }
    ensureComposerStatus();
  };

  const cleanup = (restoreBaseCleanup = true) => {
    const state = window[STATE_KEY];
    if (state?.installToken !== installToken) return false;
    observer?.disconnect();
    if (timer) clearInterval(timer);
    if (scheduled) clearTimeout(scheduled);
    document.getElementById(MAGI_ID)?.remove();
    document.getElementById(COMPOSER_STATUS_ID)?.remove();
    root.removeAttribute(ROOT_ATTR);
    root.removeAttribute(OFFICE_ATTR);
    for (const className of Object.values(CLASSES)) {
      document.querySelectorAll(`.${className}`).forEach((candidate) => {
        candidate.classList.remove(className);
        for (const name of [...(candidate.attributes || [])].map((attribute) => attribute.name)) {
          if (name.startsWith("data-dream-")) candidate.removeAttribute(name);
        }
      });
    }
    if (restoreBaseCleanup && window[BASE_STATE_KEY]?.cleanup === wrappedBaseCleanup) {
      window[BASE_STATE_KEY].cleanup = baseCleanup;
    }
    delete window[STATE_KEY];
    return true;
  };

  const wrappedBaseCleanup = () => {
    cleanup(false);
    return baseCleanup ? baseCleanup() : true;
  };
  baseState.cleanup = wrappedBaseCleanup;
  window[STATE_KEY] = { installToken, cleanup, ensure, themeId, office };
  if (typeof MutationObserver === "function" && document.body) {
    observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = setTimeout(() => { scheduled = null; ensure(); }, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  timer = setInterval(ensure, 1500);
  ensure();
})();
