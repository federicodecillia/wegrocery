// Nightly UI check against a demo deployment (DEMO_MODE, one-click sign-in,
// fake data): the main pages at a phone and a desktop width, checked with axe
// for serious accessibility problems and for horizontal scrolling, plus four
// keyboard checks. Run by .github/workflows/ui-check.yml after the demo
// reset; locally: UI_CHECK_URL=http://localhost:3000 node scripts/ui-check.mjs
// (with `playwright` and `@axe-core/playwright` installed next to it).
//
// It only reads, except the order stepper check, which adds two of a product
// and takes them away again (the draft it saved is deleted when the form is
// back to the confirmed order). Never point it at a deployment with real
// members: it signs in through the demo buttons, which only DEMO_MODE has.
//
// Exit code 1 when anything fails; a Markdown summary goes to
// $GITHUB_STEP_SUMMARY when set, else to stdout.

import { appendFileSync } from "node:fs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = (process.env.UI_CHECK_URL ?? "").replace(/\/$/, "");
if (!BASE) {
  console.error("UI_CHECK_URL is not set.");
  process.exit(2);
}

const WIDTHS = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 900 } },
};
const MEMBER_PAGES = ["/", "/ordine", "/storico", "/storico?tab=movimenti", "/guida", "/guida/ordinare", "/notifiche", "/profilo", "/ricarica", "/changelog"];
const ADMIN_PAGES = ["/admin", "/admin?tab=cassa", "/admin?tab=soci", "/admin?tab=catalogo"];
// Serious problems fail the run; minor and moderate ones are listed only.
const FAILING_IMPACT = new Set(["serious", "critical"]);

// The demo may be English or Italian: every label is matched in both.
const L = {
  member: /as User|come Utente/i,
  admin: /as Admin|come Admin/i,
  editOrder: /^(✎ )?(Edit order|Modifica( l'ordine)?)$/i,
  // "Add <name>" on a product at 0, not "Add one: <name>".
  add: /^(Add|Aggiungi) (?!one:|uno:)/,
  closeCycle: /^(Close cycle|Chiudi ciclo)/i,
};

const failures = [];
const notes = [];
const fail = (msg) => failures.push(msg);

async function signIn(browser, width, who) {
  const ctx = await browser.newContext({ ...WIDTHS[width], locale: "it-IT" });
  const page = await ctx.newPage();
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(`${BASE}/login`, { timeout: 60_000 });
      break;
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  await page.getByRole("button", { name: who === "admin" ? L.admin : L.member }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  return { ctx, page };
}

async function checkPage(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) fail(`${label}: the page scrolls horizontally`);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  for (const v of violations) {
    const line = `${label}: axe ${v.id} (${v.impact}, ${v.nodes.length}) ${v.help}`;
    if (FAILING_IMPACT.has(v.impact)) fail(line);
    else notes.push(line);
  }
}

async function visit(page, path, label) {
  const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60_000 });
  if (!res || res.status() >= 400) {
    fail(`${label}: HTTP ${res?.status() ?? "no response"}`);
    return false;
  }
  return true;
}

// 1. Order stepper: two Enter presses on "+" give 2 (focus stays on "+"
//    when the "−" appears), then two presses on "−" restore the order.
//    The quantity is read from the stepper's live region ("<name>: 2").
async function stepperCheck(page) {
  await visit(page, "/ordine", "stepper");
  const edit = page.getByRole("button", { name: L.editOrder });
  if (await edit.count()) await edit.first().click();
  const add = page.getByRole("button", { name: L.add }).first();
  if (!(await add.count())) {
    notes.push("stepper: no product with quantity 0, check skipped");
    return;
  }
  await add.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => {
    const el = document.activeElement;
    const live = el?.parentElement?.querySelector("[aria-live]")?.textContent ?? "";
    return { onPlus: el?.hasAttribute("data-plus") ?? false, qty: (live.match(/(\d+)\s*$/) ?? [])[1] ?? "?" };
  });
  if (!state.onPlus) fail('stepper: focus left "+" after the first Enter');
  else if (state.qty !== "2") fail(`stepper: two Enter presses on "+" gave ${state.qty}, expected 2`);
  // Put it back: "−" twice (at 0 the "−" goes away and focus returns to "+").
  for (let i = 0; i < 2; i++) {
    const done = await page.evaluate(() => {
      const minus = document.activeElement?.parentElement?.querySelector("button:not([data-plus])");
      if (!(minus instanceof HTMLButtonElement)) return true;
      minus.focus();
      return false;
    });
    if (done) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1200); // the draft autosave runs after 800 ms
}

// 2. The cycle close review (admin) closes with Esc, without closing anything.
async function escCheck(page) {
  await visit(page, "/admin", "esc");
  const open = page.getByRole("button", { name: L.closeCycle });
  if (!(await open.count())) {
    notes.push("esc: no open cycle to review, check skipped");
    return;
  }
  await open.first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  if (await dialog.count()) fail("esc: the cycle close review did not close with Esc");
}

// 3. Focus comes back to the row after a movement's sheet closes (phone).
async function focusReturnCheck(page) {
  await visit(page, "/storico?tab=movimenti", "focus-return");
  const row = page.locator('[role="tabpanel"] button').first();
  if (!(await row.count())) {
    notes.push("focus-return: no movement, check skipped");
    return;
  }
  await row.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const back = await row.evaluate((el) => el === document.activeElement);
  if (!back) fail("focus-return: closing a movement's sheet did not return focus to its row");
}

// 4. A Profile row reached with Tab shows a visible outline.
async function focusVisibleCheck(page) {
  await visit(page, "/profilo", "focus-visible");
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const inMain = await page.evaluate(() => {
      const el = document.activeElement;
      return el instanceof HTMLElement && el.closest("main") !== null && (el.tagName === "A" || el.tagName === "BUTTON");
    });
    if (!inMain) continue;
    const style = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    if (style.style === "none" || style.width < 2) fail(`focus-visible: a Profile control has no visible outline (${style.style} ${style.width}px)`);
    return;
  }
  fail("focus-visible: Tab never reached a control in the Profile");
}

// A keyboard check that throws (a dialog that never opened) fails on its own
// and leaves the other checks running.
async function guarded(label, check) {
  try {
    await check();
  } catch (e) {
    fail(`${label}: ${firstLine(e)}`);
  }
}

function firstLine(e) {
  return e instanceof Error ? e.message.split("\n")[0] : String(e);
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  for (const width of Object.keys(WIDTHS)) {
    const anon = await browser.newContext({ ...WIDTHS[width], locale: "it-IT" });
    const login = await anon.newPage();
    if (await visit(login, "/login", `${width} /login`)) await checkPage(login, `${width} /login`);
    await anon.close();

    const member = await signIn(browser, width, "member");
    for (const path of MEMBER_PAGES) {
      if (await visit(member.page, path, `${width} ${path}`)) await checkPage(member.page, `${width} ${path}`);
    }
    if (width === "phone") {
      await guarded("stepper", () => stepperCheck(member.page));
      await guarded("focus-return", () => focusReturnCheck(member.page));
    } else {
      await guarded("focus-visible", () => focusVisibleCheck(member.page));
    }
    await member.ctx.close();

    const admin = await signIn(browser, width, "admin");
    for (const path of ADMIN_PAGES) {
      if (await visit(admin.page, path, `${width} ${path}`)) await checkPage(admin.page, `${width} ${path}`);
    }
    if (width === "desktop") await guarded("esc", () => escCheck(admin.page));
    await admin.ctx.close();
  }
} catch (e) {
  fail(`run aborted: ${firstLine(e)}`);
} finally {
  await browser.close();
}

const pages = 2 * (1 + MEMBER_PAGES.length + ADMIN_PAGES.length);
const summary = [
  `## UI check: ${failures.length === 0 ? "passed" : `${failures.length} problem(s)`}`,
  "",
  `${BASE}, ${pages} page views at 390 and 1280 px, 4 keyboard checks.`,
  "",
  ...(failures.length ? ["### Failing", ...failures.map((f) => `- ${f}`), ""] : []),
  ...(notes.length ? ["### Notes (not failing)", ...notes.map((n) => `- ${n}`), ""] : []),
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
console.log(summary);
process.exit(failures.length ? 1 : 0);
