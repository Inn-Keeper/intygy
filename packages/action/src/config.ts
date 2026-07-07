import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

// The serve variant must come before the plain-url one: zod strips unknown
// keys, so {serve, url} would otherwise match {url} and silently drop `serve`.
const TargetSchema = z.union([
  z.literal("preview"),
  z.object({
    serve: z.string(),
    url: z.string().url(),
    readyTimeoutMs: z.number().int().positive().default(120_000),
  }),
  z.object({ url: z.string().url() }),
]);

const AuthSchema = z.object({
  login_url: z.string(),
  user: z.string(),
  pass: z.string(),
  user_field: z.string().default("input[type=email], input[name=email], input[name=username]"),
  pass_field: z.string().default("input[type=password]"),
  submit: z.string().default("button[type=submit]"),
});

export const ConfigSchema = z.object({
  target: TargetSchema.default("preview"),
  routes: z.array(z.string().startsWith("/")).min(1),
  ruleset: z.enum(["wcag22-aa", "wcag21-aa"]).default("wcag22-aa"),
  viewports: z.array(z.enum(["desktop", "mobile"])).min(1).default(["desktop"]),
  auth: AuthSchema.optional(),
});

export type IntygyConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(path: string): IntygyConfig {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `Could not read ${path}. Add an intygy.yml to your repository root (see the Intygy quickstart).`
    );
  }
  const parsed = ConfigSchema.safeParse(parse(raw));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`intygy.yml is invalid:\n${issues}`);
  }
  return parsed.data;
}
