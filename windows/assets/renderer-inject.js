((cssText, artDataUrl, rawConfig) => {
  const STATE_KEY = "__CODEX_DREAM_SKIN_STATE__";
  const STYLE_ID = "codex-dream-skin-style";
  const CHROME_ID = "codex-dream-skin-chrome";
  const ROOT_CLASSES = [
    "codex-dream-skin",
    "dream-theme-light",
    "dream-theme-dark",
    "dream-art-wide",
    "dream-art-standard",
    "dream-art-fit-height",
    "dream-focus-left",
    "dream-focus-center",
    "dream-focus-right",
    "dream-safe-left",
    "dream-safe-center",
    "dream-safe-right",
    "dream-safe-none",
    "dream-task-ambient",
    "dream-task-banner",
    "dream-task-off",
  ];
  const ROOT_PROPERTIES = [
    "--dream-art",
    "--dream-art-position",
    "--dream-focus-x",
    "--dream-focus-y",
    "--dream-accent",
    "--dream-accent-ink",
    "--dream-image-luma",
  ];
  const HOME_UTILITY_CLASS = "dream-home-utility";
  const HOME_UTILITY_PROPERTIES = [
    "--dream-home-utility-margin-start",
    "--dream-home-utility-margin-end",
    "--dream-home-utility-padding-start",
    "--dream-home-utility-padding-end",
  ];
  const SECONDARY_DRAWER_CLASS = "dream-secondary-drawer";
  const SUMMARY_PANEL_CLASS = "dream-summary-panel";
  const ATTACHMENT_PANEL_CLASS = "dream-attachment-panel";
  const MAGI_MODULE_ID = "codex-dream-magi-module";
  const STATUS_CACHE_KEY = "codex-dream-official-status-v1";
  const COMPOSER_STATUS_ID = "codex-dream-composer-status";
  const TASK_ROW_CLASS = "dream-task-status-row";
  const OPERATION_PANEL_CLASS = "dream-operation-panel";
  const THREAD_RAIL_CLASS = "dream-eva-thread-rail";
  const RAIL_PREVIEW_CLASS = "dream-eva-record-panel";
  const installToken = {};
  let samplingNativeShell = false;
  let observer = null;
  let nativeQueryClient = null;
  let nativeConversationManager = null;
  let nativeTelemetryRoot = null;
  let nativeTelemetryLastScan = 0;
  window.__CODEX_DREAM_SKIN_DISABLED__ = false;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value)));
  const luminance = (red, green, blue) => {
    const linear = [red, green, blue].map((value) => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  };
  const parseHexColor = (value) => {
    const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value || "");
    if (!match) return null;
    const hex = match[1].length === 3
      ? [...match[1]].map((character) => character + character).join("")
      : match[1];
    return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  };
  const defaultProfile = {
    appearance: "dark",
    accent: [108, 131, 142],
    focusX: .5,
    focusY: .5,
    aspect: 1.6,
    luma: .32,
    safeArea: "center",
  };

  const normalizeConfig = (value) => {
    const config = value && typeof value === "object" ? value : {};
    const art = config.art && typeof config.art === "object" ? config.art : {};
    const hasNumber = (candidate) =>
      (typeof candidate === "number" || (typeof candidate === "string" && candidate.trim() !== "")) &&
      Number.isFinite(Number(candidate));
    const requestedAccent = typeof config?.palette?.accent === "string"
      ? config.palette.accent.trim()
      : "";
    const safeAccent = /^(?:#[\da-f]{3,8}|(?:rgb|hsl|oklch|oklab)\([^;{}]{1,96}\))$/i.test(requestedAccent)
      ? requestedAccent
      : null;
    const appearance = ["auto", "light", "dark"].includes(config.appearance)
      ? config.appearance
      : "auto";
    const safeArea = ["auto", "left", "right", "center", "none"].includes(art.safeArea)
      ? art.safeArea
      : "auto";
    const taskMode = ["auto", "ambient", "banner", "off"].includes(art.taskMode)
      ? art.taskMode
      : "auto";
    const metadataRatio = Number(config?.artMetadata?.ratio);
    return {
      appearance,
      safeArea,
      taskMode,
      focusX: hasNumber(art.focusX) ? clamp(art.focusX) : null,
      focusY: hasNumber(art.focusY) ? clamp(art.focusY) : null,
      accent: safeAccent,
      accentRgb: parseHexColor(safeAccent),
      initialAspect: Number.isFinite(metadataRatio) && metadataRatio > 0 ? metadataRatio : null,
    };
  };

  const previous = window[STATE_KEY];
  if (previous?.observer) previous.observer.disconnect();
  if (previous?.timer) clearInterval(previous.timer);
  if (previous?.scheduler?.timeout) clearTimeout(previous.scheduler.timeout);
  if (previous?.resizeHandler) window.removeEventListener?.("resize", previous.resizeHandler);
  if (previous?.artUrl) URL.revokeObjectURL(previous.artUrl);
  const artUrl = (() => {
    const comma = artDataUrl.indexOf(",");
    const binary = atob(artDataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const mime = /^data:([^;,]+)/.exec(artDataUrl)?.[1] || "image/png";
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  })();
  const config = normalizeConfig(rawConfig);
  let profile = {
    ...defaultProfile,
    aspect: config.initialAspect ?? defaultProfile.aspect,
  };
  const existingStyle = document.getElementById(STYLE_ID);
  if (existingStyle) {
    existingStyle.textContent = cssText;
    existingStyle.dataset.dreamVersion = "3";
  }

  const analyzeArt = () => new Promise((resolve) => {
    if (typeof Image !== "function") {
      resolve(defaultProfile);
      return;
    }
    const image = new Image();
    image.onload = () => {
      try {
        const width = 48;
        const height = Math.max(12, Math.round(width * image.naturalHeight / image.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext?.("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas is unavailable");
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        let count = 0;
        let totalRed = 0;
        let totalGreen = 0;
        let totalBlue = 0;
        let totalBrightness = 0;
        const samples = [];
        const sampleMap = new Array(width * height);
        for (let offset = 0; offset < pixels.length; offset += 4) {
          if (pixels[offset + 3] < 96) continue;
          const red = pixels[offset];
          const green = pixels[offset + 1];
          const blue = pixels[offset + 2];
          const light = (.2126 * red + .7152 * green + .0722 * blue) / 255;
          const sample = { red, green, blue, light, index: offset / 4 };
          samples.push(sample);
          sampleMap[sample.index] = sample;
          totalRed += red;
          totalGreen += green;
          totalBlue += blue;
          totalBrightness += light;
          count += 1;
        }
        if (!count) throw new Error("Image contains no opaque pixels");
        const average = [totalRed / count, totalGreen / count, totalBlue / count];
        const averageBrightness = totalBrightness / count;
        const information = (start, end) => {
          let total = 0;
          let totalSquared = 0;
          let edges = 0;
          let edgeCount = 0;
          let sampleCount = 0;
          for (let y = 0; y < height; y += 1) {
            for (let x = start; x < end; x += 1) {
              const sample = sampleMap[y * width + x];
              if (!sample) continue;
              total += sample.light;
              totalSquared += sample.light * sample.light;
              sampleCount += 1;
              const previousSample = x > start ? sampleMap[y * width + x - 1] : null;
              const above = y > 0 ? sampleMap[(y - 1) * width + x] : null;
              if (previousSample) { edges += Math.abs(sample.light - previousSample.light); edgeCount += 1; }
              if (above) { edges += Math.abs(sample.light - above.light); edgeCount += 1; }
            }
          }
          const mean = sampleCount ? total / sampleCount : 0;
          const variance = sampleCount ? Math.max(0, totalSquared / sampleCount - mean * mean) : 1;
          return Math.sqrt(variance) * .58 + (edgeCount ? edges / edgeCount : 1) * .42;
        };
        const zoneWidth = Math.max(1, Math.floor(width * .38));
        const leftInformation = information(0, zoneWidth);
        const rightInformation = information(width - zoneWidth, width);
        let safeArea = "center";
        if (leftInformation < rightInformation * .86) safeArea = "left";
        else if (rightInformation < leftInformation * .86) safeArea = "right";
        let focusWeight = 0;
        let focusX = 0;
        let focusY = 0;
        let accentWeight = 0;
        let accent = [0, 0, 0];
        for (const sample of samples) {
          const x = sample.index % width;
          const y = Math.floor(sample.index / width);
          const difference = Math.sqrt(
            (sample.red - average[0]) ** 2 +
            (sample.green - average[1]) ** 2 +
            (sample.blue - average[2]) ** 2,
          ) / 441.7;
          const saliency = .03 + difference ** 1.35;
          focusX += (x / Math.max(1, width - 1)) * saliency;
          focusY += (y / Math.max(1, height - 1)) * saliency;
          focusWeight += saliency;
          const max = Math.max(sample.red, sample.green, sample.blue);
          const min = Math.min(sample.red, sample.green, sample.blue);
          const saturation = max ? (max - min) / max : 0;
          const usableLight = 1 - Math.min(1, Math.abs(sample.light - .46) / .54);
          const weight = saturation ** 2 * (.15 + usableLight);
          accent[0] += sample.red * weight;
          accent[1] += sample.green * weight;
          accent[2] += sample.blue * weight;
          accentWeight += weight;
        }
        const resolvedAccent = accentWeight > 1
          ? accent.map((channel) => Math.round(channel / accentWeight))
          : average.map((channel) => Math.round(channel));
        let resolvedFocusX = clamp(focusX / focusWeight);
        if (safeArea === "left") resolvedFocusX = Math.max(.64, resolvedFocusX);
        if (safeArea === "right") resolvedFocusX = Math.min(.36, resolvedFocusX);
        resolve({
          appearance: averageBrightness >= .58 ? "light" : "dark",
          accent: resolvedAccent,
          focusX: resolvedFocusX,
          focusY: clamp(focusY / focusWeight),
          aspect: image.naturalWidth / Math.max(1, image.naturalHeight),
          luma: clamp(averageBrightness),
          safeArea,
        });
      } catch {
        resolve(defaultProfile);
      }
    };
    image.onerror = () => resolve(defaultProfile);
    image.src = artUrl;
  });

  const detectShellAppearance = () => {
    const root = document.documentElement;
    const body = document.body;
    const classes = `${root?.className || ""} ${body?.className || ""}`
      .toLowerCase()
      .replace(/\bdream-theme-(?:dark|light)\b/g, "");
    if (/\b(dark|electron-dark|theme-dark|appearance-dark)\b/.test(classes)) return "dark";
    if (/\b(light|electron-light|theme-light|appearance-light)\b/.test(classes)) return "light";

    const dataTheme = (
      root?.getAttribute?.("data-theme") ||
      root?.getAttribute?.("data-appearance") ||
      root?.getAttribute?.("data-color-mode") ||
      body?.getAttribute?.("data-theme") ||
      body?.getAttribute?.("data-appearance") ||
      ""
    ).toLowerCase();
    if (dataTheme.includes("dark")) return "dark";
    if (dataTheme.includes("light")) return "light";

    try {
      const hadSkin = root?.classList?.contains?.("codex-dream-skin");
      const savedSkinClasses = hadSkin
        ? ROOT_CLASSES.filter((className) => root.classList.contains(className))
        : [];
      samplingNativeShell = true;
      if (hadSkin) root.classList.remove(...ROOT_CLASSES);
      try {
        const colorScheme = getComputedStyle(root).colorScheme || "";
        if (colorScheme.includes("dark") && !colorScheme.includes("light")) return "dark";
        if (colorScheme.includes("light") && !colorScheme.includes("dark")) return "light";
      } finally {
        if (hadSkin) root.classList.add(...savedSkinClasses);
        observer?.takeRecords?.();
        samplingNativeShell = false;
      }
    } catch {
      samplingNativeShell = false;
    }
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {}
    return "light";
  };

  const clearSkinDom = () => {
    const root = document.documentElement;
    root?.classList.remove(...ROOT_CLASSES);
    for (const property of ROOT_PROPERTIES) root?.style.removeProperty(property);
    document.querySelectorAll(".dream-home").forEach((node) => node.classList.remove("dream-home"));
    document.querySelectorAll(".dream-task").forEach((node) => node.classList.remove("dream-task"));
    document.querySelectorAll(".dream-home-shell").forEach((node) => node.classList.remove("dream-home-shell"));
    document.querySelectorAll(`.${HOME_UTILITY_CLASS}`).forEach((node) => {
      node.classList.remove(HOME_UTILITY_CLASS);
      for (const property of HOME_UTILITY_PROPERTIES) node.style?.removeProperty?.(property);
    });
    document.querySelectorAll(`.${SECONDARY_DRAWER_CLASS}`).forEach((node) => node.classList.remove(SECONDARY_DRAWER_CLASS));
    document.querySelectorAll(`.${SUMMARY_PANEL_CLASS}`).forEach((node) => node.classList.remove(SUMMARY_PANEL_CLASS));
    document.querySelectorAll(`.${ATTACHMENT_PANEL_CLASS}`).forEach((node) => node.classList.remove(ATTACHMENT_PANEL_CLASS));
    document.querySelectorAll(`.${TASK_ROW_CLASS}`).forEach((node) => {
      node.classList.remove(TASK_ROW_CLASS);
      delete node.dataset?.dreamTaskState;
    });
    document.querySelectorAll(`.${OPERATION_PANEL_CLASS}`).forEach((node) => {
      node.classList.remove(OPERATION_PANEL_CLASS);
      delete node.dataset?.dreamOperation;
    });
    document.querySelectorAll(`.${THREAD_RAIL_CLASS}`).forEach((node) => {
      node.classList.remove(THREAD_RAIL_CLASS);
      delete node.dataset?.dreamRailPhase;
      delete node.dataset?.dreamRailRuntime;
      node.style?.removeProperty?.("--dream-rail-phase-y");
      node.querySelectorAll?.("[data-dream-rail-state]").forEach((item) => delete item.dataset?.dreamRailState);
    });
    document.querySelectorAll(`.${RAIL_PREVIEW_CLASS}`).forEach((node) => {
      node.classList.remove(RAIL_PREVIEW_CLASS);
      delete node.dataset?.dreamRecord;
      delete node.dataset?.dreamRecordStatus;
    });
    document.getElementById(MAGI_MODULE_ID)?.remove();
    document.getElementById(COMPOSER_STATUS_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(CHROME_ID)?.remove();
  };

  const applyProfile = (root) => {
    const focusX = config.focusX ?? profile.focusX;
    const focusY = config.focusY ?? profile.focusY;
    const appearance = config.appearance === "auto" ? detectShellAppearance() : config.appearance;
    const focus = focusX < .4 ? "left" : focusX > .6 ? "right" : "center";
    const safeArea = config.safeArea === "auto" ? (profile.safeArea ||
      (focus === "left" ? "right" : focus === "right" ? "left" : "center")) : config.safeArea;
    const taskMode = config.taskMode === "auto"
      ? profile.aspect >= 2.25 ? "banner" : "ambient"
      : config.taskMode;
    const accent = config.accent || `rgb(${profile.accent.join(" ")})`;
    const accentInk = luminance(...(config.accentRgb || profile.accent)) > .18
      ? "rgb(26 24 28)"
      : "rgb(250 248 251)";
    root.classList.toggle("dream-theme-light", appearance === "light");
    root.classList.toggle("dream-theme-dark", appearance === "dark");
    root.classList.toggle("dream-art-wide", profile.aspect >= 1.75);
    root.classList.toggle("dream-art-standard", profile.aspect < 1.75);
    const viewportWidth = Number(window.innerWidth || document.documentElement?.clientWidth || 0);
    const viewportHeight = Number(window.innerHeight || document.documentElement?.clientHeight || 0);
    const viewportAspect = viewportHeight > 0 ? viewportWidth / viewportHeight : 0;
    root.classList.toggle("dream-art-fit-height",
      profile.aspect >= 1.75 && viewportAspect > profile.aspect + .02);
    for (const value of ["left", "center", "right"]) {
      root.classList.toggle(`dream-focus-${value}`, focus === value);
    }
    for (const value of ["left", "center", "right", "none"]) {
      root.classList.toggle(`dream-safe-${value}`, safeArea === value);
    }
    for (const value of ["ambient", "banner", "off"]) {
      root.classList.toggle(`dream-task-${value}`, taskMode === value);
    }
    root.style.setProperty("--dream-art", `url("${artUrl}")`);
    root.style.setProperty("--dream-art-position", `${Math.round(focusX * 100)}% ${Math.round(focusY * 100)}%`);
    root.style.setProperty("--dream-focus-x", String(focusX));
    root.style.setProperty("--dream-focus-y", String(focusY));
    root.style.setProperty("--dream-accent", accent);
    root.style.setProperty("--dream-accent-ink", accentInk);
    root.style.setProperty("--dream-image-luma", profile.luma.toFixed(3));
  };

  const alignHomeUtility = (utility, composer) => {
    const wasSampling = samplingNativeShell;
    samplingNativeShell = true;
    try {
      utility.classList.remove(HOME_UTILITY_CLASS);
      for (const property of HOME_UTILITY_PROPERTIES) utility.style?.removeProperty?.(property);
      const utilityRect = utility.getBoundingClientRect?.();
      const composerRect = composer?.getBoundingClientRect?.() || utilityRect;
      const nativeStyle = getComputedStyle(utility);
      if (!utilityRect || !composerRect) {
        utility.classList.add(HOME_UTILITY_CLASS);
        return;
      }
      const clampOffset = (value) => Math.max(-32, Math.min(32, Math.round(value * 10) / 10));
      /* The hashed home utility is a centered w-full flex item. Inline margins
         move each rendered edge by twice their value, so compensate half of
         the native edge inset rather than applying the raw difference. */
      const marginStart = clampOffset((composerRect.left - utilityRect.left) / 2);
      const marginEnd = clampOffset((utilityRect.right - composerRect.right) / 2);
      const paddingStart = Number.parseFloat(nativeStyle.paddingInlineStart || nativeStyle.paddingLeft) || 0;
      const paddingEnd = Number.parseFloat(nativeStyle.paddingInlineEnd || nativeStyle.paddingRight) || 0;
      utility.style.setProperty("--dream-home-utility-margin-start", `${marginStart}px`);
      utility.style.setProperty("--dream-home-utility-margin-end", `${marginEnd}px`);
      utility.style.setProperty("--dream-home-utility-padding-start", `${paddingStart + Math.max(0, -marginStart)}px`);
      utility.style.setProperty("--dream-home-utility-padding-end", `${paddingEnd + Math.max(0, -marginEnd)}px`);
      utility.classList.add(HOME_UTILITY_CLASS);
    } finally {
      observer?.takeRecords?.();
      samplingNativeShell = wasSampling;
    }
  };

  const setText = (element, value) => {
    if (element && element.textContent !== value) element.textContent = value;
  };

  const setState = (element, value) => {
    if (element && element.dataset.state !== value) element.dataset.state = value;
  };

  const isVisible = (element) => {
    if (!element?.getBoundingClientRect) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  };

  const taskRuntimeState = () => {
    const running = [...document.querySelectorAll('[class*="cadencedShimmer"], [class*="shimmerHighlight"]')]
      .some(isVisible);
    if (running) return "run";
    const approvalButtons = [...document.querySelectorAll("button")]
      .filter((button) => isVisible(button) && !button.closest?.(".composer-surface-chrome"));
    if (approvalButtons.some((button) => /^(?:批准|同意|允许|运行|approve|allow)(?:\s|$)/i
      .test((button.textContent || "").trim()))) return "hold";
    return "ready";
  };

  const estimateContext = (route) => {
    const text = (route?.innerText || route?.textContent || "")
      .replace(/MAGI SYSTEM|MELCHIOR|BALTHASAR|CASPER|USAGE REMAINING|CONTEXT BUFFER/g, "");
    const cjkCount = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
    const remaining = text.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, "").replace(/\s+/g, " ");
    const imageCount = route?.querySelectorAll?.("img")?.length || 0;
    const tokens = Math.max(0, Math.round(cjkCount + remaining.length / 4 + imageCount * 1200));
    const percent = Math.max(1, Math.min(99, Math.round(tokens / 128000 * 100)));
    const compact = tokens >= 1000 ? `${(tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1)}K` : String(tokens);
    return { tokens, percent, compact };
  };

  const clampPercent = (value) => Math.max(0, Math.min(100, Number(value)));

  const currentConversationId = () => {
    const counts = new Map();
    document.querySelectorAll("[data-response-annotation-conversation]").forEach((element) => {
      if (!isVisible(element)) return;
      const value = element.getAttribute("data-response-annotation-conversation") || "";
      if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    return [...counts].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
  };

  const discoverNativeTelemetrySources = () => {
    const root = window.__codexRoot?._internalRoot?.current || null;
    if (root !== nativeTelemetryRoot && root?.alternate !== nativeTelemetryRoot &&
        nativeTelemetryRoot?.alternate !== root) {
      nativeTelemetryRoot = root;
      nativeQueryClient = null;
      nativeConversationManager = null;
    }
    if (!root || (nativeQueryClient && nativeConversationManager)) return;
    const now = Date.now();
    if (now - nativeTelemetryLastScan < 30000) return;
    nativeTelemetryLastScan = now;
    const consider = (value) => {
      if (!value || (typeof value !== "object" && typeof value !== "function")) return;
      if (!nativeConversationManager && value.conversations instanceof Map &&
          typeof value.getConversation === "function") nativeConversationManager = value;
      if (!nativeQueryClient && typeof value.getQueryData === "function" &&
          typeof value.getQueryCache === "function") {
        try {
          const cache = value.getQueryCache();
          if (typeof cache?.getAll === "function" && cache.getAll().some((query) => query?.queryHash === '["rate-limit-status"]')) {
            nativeQueryClient = value;
          }
        } catch (_) { /* Codex internals are optional */ }
      }
    };
    const stack = [root];
    let visited = 0;
    while (stack.length && visited < 20000 && (!nativeQueryClient || !nativeConversationManager)) {
      const fiber = stack.pop();
      visited += 1;
      if (fiber?.sibling) stack.push(fiber.sibling);
      if (fiber?.child) stack.push(fiber.child);
      let hook = fiber?.memoizedState;
      for (let depth = 0; hook && depth < 48; depth += 1, hook = hook.next) {
        if (typeof hook !== "object" && typeof hook !== "function") break;
        consider(hook.memoizedState);
        consider(hook.baseState);
        if (!("next" in hook)) break;
      }
    }
  };

  const formatResetDate = (unixSeconds) => {
    const date = new Date(Number(unixSeconds) * 1000);
    if (!Number.isFinite(date.getTime())) return "";
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const formatTokenScale = (tokens) => {
    const value = Number(tokens);
    if (!Number.isFinite(value) || value <= 0) return "";
    return value >= 1000 ? `${Math.round(value / 1000)}K` : String(Math.round(value));
  };

  const readNativeTelemetry = () => {
    discoverNativeTelemetrySources();
    const sessionId = currentConversationId();
    const result = {
      sessionId,
      contextRemaining: null,
      contextUsed: "",
      contextTotal: "",
      quotaRemaining: null,
      quotaReset: "",
      capturedAt: Date.now(),
      source: "auto",
    };
    try {
      const rateStatus = nativeQueryClient?.getQueryData?.(["rate-limit-status"]);
      const rateLimit = rateStatus?.rate_limit;
      const windows = [rateLimit?.primary_window, rateLimit?.secondary_window]
        .filter((windowData) => Number.isFinite(Number(windowData?.limit_window_seconds)));
      const sevenDayWindow = windows.sort((left, right) =>
        Number(right.limit_window_seconds) - Number(left.limit_window_seconds))[0];
      if (sevenDayWindow) {
        result.quotaRemaining = clampPercent(100 - Number(sevenDayWindow.used_percent || 0));
        result.quotaReset = formatResetDate(sevenDayWindow.reset_at);
      }
    } catch (_) { /* fall through to status-card cache */ }
    try {
      const conversation = sessionId && (nativeConversationManager?.getConversation?.(sessionId) ||
        nativeConversationManager?.conversations?.get?.(sessionId));
      const usage = conversation?.latestTokenUsageInfo;
      const used = Number(usage?.last?.totalTokens);
      const total = Number(usage?.modelContextWindow);
      if (Number.isFinite(used) && Number.isFinite(total) && total > 0) {
        result.contextRemaining = clampPercent(Math.round((1 - used / total) * 100));
        result.contextUsed = Math.max(0, Math.round(used)).toLocaleString("en-US");
        result.contextTotal = formatTokenScale(total);
      }
    } catch (_) { /* fall through to status-card cache */ }
    if (result.quotaRemaining === null && result.contextRemaining === null) return null;
    writeStatusCache(result);
    return result;
  };

  const parseConversationStatusText = (text) => {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    const session = /会话\s*[:：]\s*([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})/i.exec(normalized);
    const context = /背景信息\s*[:：]\s*剩余\s*(\d{1,3})\s*%[\s\S]{0,80}?已使用\s*([\d,]+)\s*\/\s*(?:共\s*)?([\d,.]+\s*[KMG]?)/i.exec(normalized);
    const quota = /7\s*天限额\s*[:：][\s\S]{0,220}?剩余\s*(\d{1,3})\s*%[\s\S]{0,80}?重置时间\s*[:：]\s*([^）)\n]{1,40})/i.exec(normalized);
    if (!session || (!context && !quota)) return null;
    return {
      sessionId: session[1],
      contextRemaining: context ? clampPercent(context[1]) : null,
      contextUsed: context?.[2] || "",
      contextTotal: context?.[3]?.replace(/\s+/g, "") || "",
      quotaRemaining: quota ? clampPercent(quota[1]) : null,
      quotaReset: quota?.[2]?.trim() || "",
      capturedAt: Date.now(),
    };
  };

  const writeStatusCache = (status) => {
    try { window.sessionStorage?.setItem(STATUS_CACHE_KEY, JSON.stringify(status)); } catch (_) { /* best effort */ }
  };

  const readStatusCache = () => {
    try {
      const parsed = JSON.parse(window.sessionStorage?.getItem(STATUS_CACHE_KEY) || "null");
      if (!parsed || Date.now() - Number(parsed.capturedAt) > 24 * 60 * 60 * 1000) return null;
      return parsed;
    } catch (_) { return null; }
  };

  const findConversationStatus = () => {
    const headings = [...document.querySelectorAll("body *")]
      .filter((element) => isVisible(element) && (element.textContent || "").trim() === "状态");
    for (const heading of headings) {
      let candidate = heading.parentElement;
      for (let depth = 0; candidate && depth < 7; depth += 1, candidate = candidate.parentElement) {
        const text = candidate.innerText || candidate.textContent || "";
        if (!/会话\s*[:：]\s*[0-9a-f-]{36}/i.test(text) || !/背景信息\s*[:：]/.test(text) || !/7\s*天限额\s*[:：]/.test(text)) continue;
        const hasClose = [...candidate.querySelectorAll("button, [role='button'], span")]
          .some((element) => (element.textContent || "").trim() === "关闭");
        if (!hasClose) continue;
        const parsed = parseConversationStatusText(text);
        if (parsed) {
          writeStatusCache(parsed);
          return { ...parsed, source: "live" };
        }
      }
    }
    const native = readNativeTelemetry();
    if (native) return native;
    const cached = readStatusCache();
    return cached ? { ...cached, source: "cached" } : null;
  };

  const findUsage = (officialStatus) => {
    if (officialStatus?.quotaRemaining !== null && officialStatus?.quotaRemaining !== undefined) {
      const percent = clampPercent(officialStatus.quotaRemaining);
      return {
        label: `${percent}%`, percent,
        state: percent <= 10 ? "alert" : percent <= 25 ? "warn" : "ok",
        meta: `${officialStatus.source === "cached" ? "LAST · " : officialStatus.source === "auto" ? "AUTO · " : ""}7D LIMIT${officialStatus.quotaReset ? ` · RESET ${officialStatus.quotaReset}` : ""}`,
      };
    }
    const settingsRoots = [...document.querySelectorAll('[role="dialog"], [data-testid*="settings" i]')]
      .filter((candidate) => /(?:用量|usage)/i.test(candidate.textContent || ""));
    for (const candidate of settingsRoots) {
      const text = candidate.textContent.replace(/\s+/g, " ");
      const remaining = /(?:剩余|remaining)[^\d%]{0,24}(\d{1,3})\s*%/i.exec(text) ||
        /(\d{1,3})\s*%[^\d%]{0,24}(?:剩余|remaining)/i.exec(text);
      if (remaining) {
        const percent = clampPercent(remaining[1]);
        return { label: `${percent}%`, percent, state: percent <= 15 ? "alert" : percent <= 30 ? "warn" : "ok", meta: "SETTINGS USAGE" };
      }
      const credits = /(?:credits?|额度)[^\d]{0,16}([\d,.]+)/i.exec(text);
      if (credits) return { label: credits[1], percent: 0, state: "ok", meta: "SETTINGS USAGE" };
    }
    return { label: "CHECK", percent: 0, state: "unknown", meta: "OPEN STATUS TO REFRESH" };
  };

  const statusCell = (module, name) => module.querySelector?.(`[data-magi="${name}"]`);

  const ensureMagiModule = (summaryPanel, route, composer, runtimeState) => {
    let module = document.getElementById(MAGI_MODULE_ID);
    if (module && !module.querySelector?.(".dream-usage-meter > em")) {
      module.remove();
      module = null;
    }
    if (!summaryPanel) {
      module?.remove();
      return;
    }
    if (!module) {
      module = document.createElement("div");
      module.id = MAGI_MODULE_ID;
      module.className = "dream-magi-module";
      module.setAttribute("aria-hidden", "true");
      module.innerHTML = `
        <div class="dream-magi-title"><strong>MAGI SYSTEM</strong><span>ACTIVE THEME LINK</span></div>
        <div class="dream-magi-cores">
          <span data-magi="melchior"><b>MELCHIOR 1</b><i></i><em>ONLINE</em></span>
          <span data-magi="balthasar"><b>BALTHASAR 2</b><i></i><em>CHECK</em></span>
          <span data-magi="casper"><b>CASPER 3</b><i></i><em>READY</em></span>
        </div>
        <div class="dream-magi-meters">
          <span class="dream-magi-meter dream-magi-meter--usage dream-usage-meter"><span><b>7D USAGE REMAINING</b><strong>CHECK</strong></span><i></i><em>OPEN STATUS TO REFRESH</em></span>
          <span class="dream-magi-meter dream-magi-meter--context dream-context-meter"><span><b data-field="context-label">CONTEXT BUFFER · EST.</b><strong>0%</strong></span><i><u></u></i><em>0 TOKENS · 128K SCALE</em></span>
        </div>`;
    }
    if (module.parentElement !== summaryPanel) {
      if (typeof summaryPanel.prepend !== "function" || typeof module.querySelector !== "function") return;
      summaryPanel.prepend(module);
    }

    const text = summaryPanel.textContent || "";
    const changeMatch = /(?:变更|changes?)[^+\-\d]{0,16}\+\s*(\d+)[^\-\d]{0,12}-\s*(\d+)/i.exec(text);
    const dirty = changeMatch ? Number(changeMatch[1]) + Number(changeMatch[2]) > 0 : null;
    const melchior = statusCell(module, "melchior");
    const balthasar = statusCell(module, "balthasar");
    const casper = statusCell(module, "casper");
    setState(melchior, "ok");
    setState(balthasar, dirty === null ? "unknown" : dirty ? "warn" : "ok");
    setText(balthasar?.querySelector?.("em"), dirty === null ? "CHECK" : dirty ? "DIRTY" : "CLEAN");
    setState(casper, runtimeState === "hold" ? "warn" : "ok");
    setText(casper?.querySelector?.("em"), runtimeState === "run" ? "RUN" : runtimeState === "hold" ? "HOLD" : "READY");

    const officialStatus = findConversationStatus();
    const usage = findUsage(officialStatus);
    const usageMeter = module.querySelector(".dream-usage-meter");
    setState(usageMeter, usage.state);
    setText(usageMeter?.querySelector("strong"), usage.label);
    setText(usageMeter?.querySelector("em"), usage.meta);
    usageMeter?.style?.setProperty("--dream-usage-fill", `${usage.percent}%`);

    const contextMeter = module.querySelector(".dream-context-meter");
    const sameConversation = officialStatus?.sessionId && officialStatus.sessionId === currentConversationId();
    if (sameConversation && officialStatus.contextRemaining !== null) {
      const remaining = clampPercent(officialStatus.contextRemaining);
      setState(contextMeter, remaining <= 10 ? "alert" : remaining <= 25 ? "warn" : "ok");
      setText(contextMeter?.querySelector('[data-field="context-label"]') || contextMeter?.querySelector("b"), "CONTEXT REMAINING");
      setText(contextMeter?.querySelector("strong"), `${remaining}%`);
      setText(contextMeter?.querySelector("em"), `${officialStatus.source === "cached" ? "LAST · " : officialStatus.source === "auto" ? "AUTO · " : ""}USED ${officialStatus.contextUsed} · TOTAL ${officialStatus.contextTotal}`);
      contextMeter?.style?.setProperty("--dream-context-fill", `${remaining}%`);
    } else {
      const context = estimateContext(route);
      setState(contextMeter, context.percent >= 85 ? "alert" : context.percent >= 65 ? "warn" : "ok");
      setText(contextMeter?.querySelector('[data-field="context-label"]') || contextMeter?.querySelector("b"), "CONTEXT BUFFER · EST.");
      setText(contextMeter?.querySelector("strong"), `${context.percent}%`);
      setText(contextMeter?.querySelector("em"), `${context.compact} TOKENS · 128K SCALE`);
      contextMeter?.style?.setProperty("--dream-context-fill", `${context.percent}%`);
    }
  };

  const ensureComposerStatus = (composer, runtimeState) => {
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
      status.innerHTML = "<span data-field=\"pilot\">PILOT</span><i></i><span data-field=\"environment\">LOCAL</span><i></i><span data-field=\"state\">READY</span>";
    }
    if (status.parentElement !== composer) {
      if (typeof composer.appendChild !== "function" || typeof status.querySelector !== "function") return;
      composer.appendChild(status);
    }
    const modelButton = [...(composer.querySelectorAll?.("button") || [])]
      .find((button) => /(?:Sol|Codex|GPT)/i.test(button.textContent || ""));
    const modelMatches = (modelButton?.textContent || "").match(/(?:GPT[-\s]?\d[\w.-]*|\d(?:\.\d+)+\s*(?:Sol|Codex(?:\s+Spark)?))/gi);
    const pilot = modelMatches?.at?.(-1)?.replace(/\s+/g, " ").toUpperCase() || "PILOT";
    setText(status.querySelector('[data-field="pilot"]'), pilot);
    setText(status.querySelector('[data-field="environment"]'), document.body.textContent.includes("本地") ? "LOCAL" : "ENV");
    setText(status.querySelector('[data-field="state"]'), runtimeState === "run" ? "RUN" : runtimeState === "hold" ? "HOLD" : "READY");
    status.dataset.state = runtimeState;
  };

  const ensureTaskRows = (runtimeState) => {
    const rows = new Set(document.querySelectorAll(
      'aside.app-shell-left-panel [role="button"][aria-current="page"]',
    ));
    for (const candidate of document.querySelectorAll(`.${TASK_ROW_CLASS}`)) {
      if (!rows.has(candidate)) {
        candidate.classList.remove(TASK_ROW_CLASS);
        delete candidate.dataset?.dreamTaskState;
      }
    }
    for (const candidate of rows) {
      candidate.classList.add(TASK_ROW_CLASS);
      candidate.dataset.dreamTaskState = runtimeState;
    }
  };

  const ensureOperationPanels = () => {
    const panels = new Set();
    const labels = [...document.querySelectorAll("body *")].filter((candidate) =>
      candidate.children.length === 0 &&
      /(?:已编辑\s*\d+\s*个文件|edited\s*\d+\s*files?)/i.test(candidate.textContent?.trim?.() || ""));
    for (const label of labels) {
      const count = Number(/\d+/.exec(label.textContent)?.[0] || 0);
      let candidate = label.parentElement;
      let panel = null;
      for (let depth = 0; candidate && depth < 8; depth += 1, candidate = candidate.parentElement) {
        const className = String(candidate.className || "");
        const text = candidate.textContent || "";
        if (/rounded-(?:2xl|3xl)/.test(className) && text.length > label.textContent.length + 20) panel = candidate;
      }
      if (!panel) continue;
      panels.add(panel);
      panel.classList.add(OPERATION_PANEL_CLASS);
      panel.dataset.dreamOperation = `OPERATION REPORT · FILES ${String(count).padStart(2, "0")}`;
    }
    for (const candidate of document.querySelectorAll(`.${OPERATION_PANEL_CLASS}`)) {
      if (!panels.has(candidate)) {
        candidate.classList.remove(OPERATION_PANEL_CLASS);
        delete candidate.dataset?.dreamOperation;
      }
    }
  };

  const ensureThreadRail = (runtimeState) => {
    const rails = new Set();
    for (const list of document.querySelectorAll('[data-thread-user-message-navigation-rail-list="true"]')) {
      const rail = list.closest?.("nav");
      if (!rail) continue;
      const items = [...list.querySelectorAll("[data-thread-user-message-navigation-item-id]")];
      if (!items.length) continue;
      rails.add(rail);
      rail.classList.add(THREAD_RAIL_CLASS);
      const nativeCurrent = items.reduce((latest, item, index) =>
        item.getAttribute("aria-current") === "true" ? index : latest, -1);
      const currentIndex = nativeCurrent >= 0 ? nativeCurrent : items.length - 1;
      const stateLabel = runtimeState === "run" ? "RUN" : runtimeState === "hold" ? "HOLD" : "SYNC";
      rail.dataset.dreamRailPhase = `P${String(currentIndex + 1).padStart(2, "0")} · ${stateLabel}`;
      rail.dataset.dreamRailRuntime = runtimeState;
      items.forEach((item, index) => {
        item.dataset.dreamRailState = index < currentIndex ? "complete" : index === currentIndex ? "current" : "pending";
      });
      const current = items[currentIndex];
      const phaseY = current.offsetTop - Number(list.scrollTop || 0) + Number(current.offsetHeight || 10) / 2;
      rail.style?.setProperty?.("--dream-rail-phase-y", `${Math.max(8, phaseY)}px`);
    }
    for (const candidate of document.querySelectorAll(`.${THREAD_RAIL_CLASS}`)) {
      if (rails.has(candidate)) continue;
      candidate.classList.remove(THREAD_RAIL_CLASS);
      delete candidate.dataset?.dreamRailPhase;
      delete candidate.dataset?.dreamRailRuntime;
      candidate.style?.removeProperty?.("--dream-rail-phase-y");
      candidate.querySelectorAll?.("[data-dream-rail-state]").forEach((item) => delete item.dataset?.dreamRailState);
    }
  };

  const ensureRailPreviewPanels = () => {
    const panels = new Set([...document.querySelectorAll(
      '[class~="w-80"][class~="rounded-xl"][class~="bg-token-dropdown-background/95"]',
    )].filter((candidate) => {
      const portal = candidate.closest?.('[class~="select-none"][class~="whitespace-normal"][class~="!z-20"]');
      return portal && !candidate.closest?.('[role="menu"], [role="dialog"]');
    }));
    for (const panel of panels) {
      const text = panel.textContent || "";
      const visual = /\.(?:png|jpe?g|webp)\b/i.test(text) || Boolean(panel.querySelector?.("img"));
      panel.classList.add(RAIL_PREVIEW_CLASS);
      panel.dataset.dreamRecord = visual ? "VISUAL RECORD · IMG-01" : "MESSAGE RECORD · THREAD";
      panel.dataset.dreamRecordStatus = visual ? "RENDER COMPLETE" : "ARCHIVE ONLINE";
    }
    for (const candidate of document.querySelectorAll(`.${RAIL_PREVIEW_CLASS}`)) {
      if (panels.has(candidate)) continue;
      candidate.classList.remove(RAIL_PREVIEW_CLASS);
      delete candidate.dataset?.dreamRecord;
      delete candidate.dataset?.dreamRecordStatus;
    }
  };

  const ensure = () => {
    if (window.__CODEX_DREAM_SKIN_DISABLED__) return;
    const root = document.documentElement;
    if (!root || !document.body) return;

    const shellMain = document.querySelector("main.main-surface");
    const shellSidebar = document.querySelector("aside.app-shell-left-panel");
    const shellComposer = [...document.querySelectorAll(".composer-surface-chrome")].find(isVisible) || null;
    if (!shellMain || (!shellSidebar && !shellComposer)) {
      clearSkinDom();
      return;
    }

    root.classList.add("codex-dream-skin");
    applyProfile(root);

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || root).appendChild(style);
    }
    if (style.dataset.dreamVersion !== "3") {
      style.textContent = cssText;
      style.dataset.dreamVersion = "3";
    }

    const home = document.querySelector('[role="main"]:has([data-testid="home-icon"])');
    for (const candidate of document.querySelectorAll('[role="main"]')) {
      candidate.classList.toggle("dream-home", candidate === home);
      candidate.classList.toggle("dream-task", candidate !== home);
    }
    const utilityBars = new Set(home ? home.querySelectorAll('[class*="_homeUtilityBar_"]') : []);
    for (const candidate of document.querySelectorAll(`.${HOME_UTILITY_CLASS}`)) {
      if (!utilityBars.has(candidate)) {
        candidate.classList.remove(HOME_UTILITY_CLASS);
        for (const property of HOME_UTILITY_PROPERTIES) candidate.style?.removeProperty?.(property);
      }
    }
    const homeComposer = home?.querySelector?.(".composer-surface-chrome") || null;
    for (const candidate of utilityBars) alignHomeUtility(candidate, homeComposer);
    shellMain.classList.toggle("dream-home-shell", Boolean(home));

    const secondaryDrawers = new Set(document.querySelectorAll(
      '[class~="absolute"][class~="top-0"][class~="bottom-0"][class~="left-0"]' +
      '[class~="border-l"][class~="bg-token-main-surface-primary"]',
    ));
    for (const candidate of document.querySelectorAll(`.${SECONDARY_DRAWER_CLASS}`)) {
      if (!secondaryDrawers.has(candidate)) candidate.classList.remove(SECONDARY_DRAWER_CLASS);
    }
    for (const candidate of secondaryDrawers) candidate.classList.add(SECONDARY_DRAWER_CLASS);

    const summaryPanels = new Set([...document.querySelectorAll(
      '[class~="rounded-3xl"][class~="bg-token-dropdown-background"]',
    )].filter((candidate) => candidate.querySelector('[class~="group/summary-panel-item"]')));
    for (const candidate of document.querySelectorAll(`.${SUMMARY_PANEL_CLASS}`)) {
      if (!summaryPanels.has(candidate)) candidate.classList.remove(SUMMARY_PANEL_CLASS);
    }
    for (const candidate of summaryPanels) candidate.classList.add(SUMMARY_PANEL_CLASS);

    const attachmentPanels = new Set(document.querySelectorAll(
      '[class~="max-h-[320px]"][class~="bg-token-dropdown-background/90"]',
    ));
    for (const candidate of document.querySelectorAll(`.${ATTACHMENT_PANEL_CLASS}`)) {
      if (!attachmentPanels.has(candidate)) candidate.classList.remove(ATTACHMENT_PANEL_CLASS);
    }
    for (const candidate of attachmentPanels) candidate.classList.add(ATTACHMENT_PANEL_CLASS);

    const taskRoute = [...document.querySelectorAll('[role="main"]')]
      .filter((candidate) => candidate !== home && isVisible(candidate))
      .sort((left, right) => (right.innerText || right.textContent || "").length -
        (left.innerText || left.textContent || "").length)[0] ||
      (isVisible(shellMain) ? shellMain : null);
    const composer = shellComposer;
    const runtimeState = taskRuntimeState();
    ensureMagiModule([...summaryPanels][0] || null, taskRoute, composer, runtimeState);
    ensureComposerStatus(composer, runtimeState);
    ensureTaskRows(runtimeState);
    ensureOperationPanels();
    ensureThreadRail(runtimeState);
    ensureRailPreviewPanels();

    let chrome = document.getElementById(CHROME_ID);
    if (!chrome || chrome.parentElement !== document.body) {
      chrome?.remove();
      chrome = document.createElement("div");
      chrome.id = CHROME_ID;
      chrome.setAttribute("aria-hidden", "true");
      document.body.appendChild(chrome);
    }
    chrome.classList.toggle("dream-home-shell", Boolean(home));
  };

  const cleanup = () => {
    const state = window[STATE_KEY];
    if (state?.installToken !== installToken) return false;
    window.__CODEX_DREAM_SKIN_DISABLED__ = true;
    clearSkinDom();
    state?.observer?.disconnect();
    if (state?.timer) clearInterval(state.timer);
    if (state?.scheduler?.timeout) clearTimeout(state.scheduler.timeout);
    if (state?.resizeHandler) window.removeEventListener?.("resize", state.resizeHandler);
    if (state?.artUrl) URL.revokeObjectURL(state.artUrl);
    delete window[STATE_KEY];
    return true;
  };

  const scheduler = { timeout: null };
  const scheduleEnsure = () => {
    if (scheduler.timeout) clearTimeout(scheduler.timeout);
    scheduler.timeout = setTimeout(() => {
      scheduler.timeout = null;
      ensure();
    }, 180);
  };
  const resizeHandler = () => scheduleEnsure();
  window.addEventListener?.("resize", resizeHandler);
  observer = new MutationObserver(() => {
    if (samplingNativeShell) return;
    scheduleEnsure();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-theme", "data-appearance", "data-color-mode"],
  });
  const timer = setInterval(ensure, 5000);
  window[STATE_KEY] = {
    ensure, cleanup, observer, timer, scheduler, resizeHandler, artUrl, profile, config, installToken, version: "1.2.0",
  };
  ensure();
  analyzeArt().then((result) => {
    const state = window[STATE_KEY];
    if (state?.installToken !== installToken || window.__CODEX_DREAM_SKIN_DISABLED__) return;
    profile = result;
    state.profile = result;
    ensure();
  });
  return { installed: true, version: "1.2.0", adaptive: true };
})(__DREAM_CSS_JSON__, __DREAM_ART_JSON__, __DREAM_THEME_JSON__)
