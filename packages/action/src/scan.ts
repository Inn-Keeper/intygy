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

async function login(context: BrowserContext, baseUrl: string, auth: NonNullable<IntygyConfig["auth"]>) {
  const page = await context.newPage();
  await page.goto(new URL(auth.login_url, baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.locator(auth.user_field).first().fill(auth.user);
  await page.locator(auth.pass_field).first().fill(auth.pass);
  await page.locator(auth.submit).first().click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.close();
}

export async function runScan(config: IntygyConfig, baseUrl: string): Promise<Violation[]> {
  // Loaded lazily: playwright is external to the bundle and installed at runtime by ensureBrowser().
  const { chromium } = await import("playwright");
  const { source: axeSource } = await import("axe-core");
  const browser: Browser = await chromium.launch({ headless: true });
  const violations: Violation[] = [];
  try {
    for (const viewport of config.viewports) {
      const context = await browser.newContext({ viewport: VIEWPORTS[viewport] });
      if (config.auth) await login(context, baseUrl, config.auth);

      for (const route of config.routes) {
        const page = await context.newPage();
        const url = new URL(route, baseUrl).toString();
        core.info(`Scanning ${url} (${viewport})`);
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
        } catch {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        }
        await page.addScriptTag({ content: axeSource });
        const result = (await page.evaluate(
          (tags) =>
            // @ts-expect-error axe is injected at runtime
            axe.run(document, { runOnly: { type: "tag", values: tags } }),
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
            nodes: v.nodes.slice(0, 5).map((n) => ({
              selector: n.target.join(" "),
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
