import * as core from "@actions/core";
import type { Browser, BrowserContext } from "playwright";
import type { IntygyConfig } from "./config";
import type { Violation, ViewportName } from "../../shared/types";


const RULESET_TAGS: Record<IntygyConfig["ruleset"], string[]> = {
  "wcag22-aa": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
  "wcag21-aa": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
};

const VIEWPORTS: Record<ViewportName, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
};

interface AxeResultLike {
  violations: Array<{
    id: string;
    tags: string[];
    impact: Violation["impact"];
    description: string;
    helpUrl: string;
    nodes: Array<{ target: string[]; html: string }>;
  }>;
}

async function login(context: BrowserContext, baseUrl: string, auth: NonNullable<IntygyConfig["auth"]>, timeout: number) {
  const page = await context.newPage();

  try {
    const response = await page.goto(new URL(auth.login_url, baseUrl).toString(), { waitUntil: "domcontentloaded" });

    if (!response?.ok()) throw new Error(`HTTP ${response?.status() ?? "unknown"}`);

    await page.locator(auth.user_field).first().fill(auth.user);
    await page.locator(auth.pass_field).first().fill(auth.pass);
    await page.locator(auth.submit).first().click();
    await page.locator(auth.success_selector).first().waitFor({ state: "visible", timeout });
  } catch {
    throw new Error("Authentication failed: the configured success_selector did not confirm login.");
  } finally {
    await page.close();
  }
}

function routeIdentity(url: string): string {
  const parsed = new URL(url);

  return parsed.origin + parsed.pathname.replace(/\/$/, "") + parsed.search + parsed.hash;
}

export async function runScan(config: IntygyConfig, baseUrl: string): Promise<Violation[]> {
  // Loaded lazily: playwright is external to the bundle and installed at runtime by ensureBrowser().
  const { chromium } = await import("playwright");
  const { default: axeModule } = await import("axe-core");
  const axeSource = axeModule.source;
  const browser: Browser = await chromium.launch({ headless: true });
  const violations: Violation[] = [];
  try {
    for (const viewport of config.viewports) {
      const context = await browser.newContext({ viewport: VIEWPORTS[viewport] });
      context.setDefaultTimeout(config.readyTimeoutMs);
      if (config.auth) await login(context, baseUrl, config.auth, config.readyTimeoutMs);

      for (const route of config.routes) {
        const page = await context.newPage();
        const url = new URL(route, baseUrl).toString();

        if (new URL(url).origin !== new URL(baseUrl).origin) throw new Error("Scan route must stay on the target origin.");

        core.info(`Scanning ${url} (${viewport})`);
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });

        if (!response?.ok()) throw new Error(`Scan failed: HTTP ${response?.status() ?? "unknown"} on ${route}.`);
        if (routeIdentity(page.url()) !== routeIdentity(url)) throw new Error(`Scan failed: unexpected redirect for ${route}.`);
        if (config.auth) {
          await page.locator(config.auth.success_selector).first().waitFor({ state: "visible" })
            .catch(() => { throw new Error(`Authentication not confirmed on ${route}.`); });
        }

        await page.locator(config.readySelector).first().waitFor({ state: "visible" });
        if (routeIdentity(page.url()) !== routeIdentity(url)) throw new Error(`Scan failed: unexpected redirect for ${route}.`);
        await page.addScriptTag({ content: axeSource });
        const result = (await page.evaluate(
          (tags) =>
            // Explicit page global: a captured module variable is renamed by ncc.
            (window as unknown as { axe: typeof import("axe-core") }).axe.run(
              document, { runOnly: { type: "tag", values: tags } }
            ),
          RULESET_TAGS[config.ruleset]
        )) as AxeResultLike;

        for (const v of result.violations) {
          violations.push({
            ruleId: v.id,
            wcag: v.tags.filter((t) => t.startsWith("wcag")),
            impact: v.impact,
            description: v.description,
            helpUrl: v.helpUrl,
            route,
            viewport,
            nodes: v.nodes.map((n) => ({
              // Keep iframe/shadow boundaries; joining them as CSS loses identity.
              selector: n.target.length === 1 && typeof n.target[0] === "string" ? n.target[0] : JSON.stringify(n.target),
              html: n.html?.slice(0, 300),
            })),
          });
        }
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return violations;
}
