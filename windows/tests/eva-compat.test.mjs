import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const windowsRoot = path.resolve(testRoot, "..");
const source = await fs.readFile(path.join(windowsRoot, "assets", "eva-compat.js"), "utf8");
const css = await fs.readFile(path.join(windowsRoot, "assets", "eva-compat.css"), "utf8");
const injector = await fs.readFile(path.join(windowsRoot, "scripts", "injector.mjs"), "utf8");

for (const token of [
  "preset-eva-", "__CODEX_EVA_COMPAT_STATE__", "codex-dream-magi-module",
  "dream-operation-panel", "dream-eva-thread-rail", "preset-eva-office-protocol",
]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
for (const token of [
  '[data-eva-compat="active"]', ".dream-magi-module", ".dream-operation-panel",
  ".dream-eva-thread-rail", '[data-eva-office="active"]',
]) assert.ok(css.includes(token), `missing EVA CSS contract: ${token}`);
for (const token of ["eva-compat.css", "eva-compat.js", ".update(evaTemplate)"]) {
  assert.ok(injector.includes(token), `injector does not bind EVA asset: ${token}`);
}

function fixture(themeId) {
  const attributes = new Map();
  const root = {
    attributes: [],
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
    getAttribute(name) { return attributes.get(name) ?? null; },
  };
  const baseCleanup = () => true;
  const document = {
    documentElement: root,
    body: { innerText: "", textContent: "" },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const window = {
    innerHeight: 800,
    __CODEX_DREAM_SKIN_STATE__: { themeId, cleanup: baseCleanup },
  };
  class MutationObserver {
    observe() {}
    disconnect() {}
  }
  const context = vm.createContext({
    window, document, MutationObserver,
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: () => 1,
    clearTimeout() {},
    Date, Number, String, Math, RegExp, Set,
  });
  vm.runInContext(source, context);
  return { attributes, window, baseCleanup };
}

const evaIds = [
  "preset-eva-rei-mari", "preset-eva-rei-mari-midnight",
  "preset-eva-rei-mari-midnight-barefoot", "preset-eva-rei",
  "preset-eva-rei-lcl-silence", "preset-eva-mari", "preset-eva-asuka",
  "preset-eva-asuka-overdrive", "preset-eva-office-protocol",
  "preset-eva-nerv-terminal", "preset-eva-unit-01-awakening",
  "preset-eva-asuka-rei-summer-pool",
];
for (const id of evaIds) {
  const result = fixture(id);
  assert.equal(result.attributes.get("data-eva-compat"), "active", `${id} did not enable EVA compatibility`);
  assert.ok(result.window.__CODEX_EVA_COMPAT_STATE__, `${id} did not publish extension state`);
  assert.notEqual(result.window.__CODEX_DREAM_SKIN_STATE__.cleanup, result.baseCleanup,
    `${id} did not chain upstream cleanup`);
  assert.equal(result.attributes.get("data-eva-office"),
    id === "preset-eva-office-protocol" ? "active" : undefined);
  assert.equal(result.window.__CODEX_EVA_COMPAT_STATE__.cleanup(), true);
  assert.equal(result.attributes.has("data-eva-compat"), false);
}

const ordinary = fixture("preset-gothic-void-crusade");
assert.equal(ordinary.attributes.has("data-eva-compat"), false);
assert.equal(ordinary.window.__CODEX_EVA_COMPAT_STATE__, undefined);
assert.equal(ordinary.window.__CODEX_DREAM_SKIN_STATE__.cleanup, ordinary.baseCleanup);

console.log("PASS: EVA compatibility activation, isolation, cleanup, and twelve-theme contract.");
