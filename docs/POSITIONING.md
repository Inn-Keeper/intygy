# Intygy — Positioning, ICP & Roadmap

> **One-line pitch:** Intygy turns every merge into audit-ready EN 301 549 evidence — blocking new WCAG regressions without punishing legacy debt.

This document defines who Intygy is for, how it is priced, and what to build (in what order) to move from "nice CI check" to "required compliance infrastructure."

---

## Positioning

### Category

**Continuous accessibility compliance infrastructure** — not an accessibility scanner, not an overlay widget, not a one-time audit.

Intygy sits between developer tooling (CI gates) and compliance software (VPAT/ACR, audit trails, procurement evidence). The scan engine (axe-core + Playwright) is commodity. The **persisted baseline, resolution history, and exportable dossier** are the product.

### Positioning statement

For **EU B2B product teams facing EAA enforcement**, Intygy is the **compliance system of record** that monitors every code change, prevents new WCAG 2.2 regressions, and generates a dated EN 301 549 evidence dossier from normal engineering workflow — without requiring teams to fix years of legacy debt before getting value.

### What we are NOT

| We are | We are not |
| --- | --- |
| Continuous evidence + regression prevention | A replacement for professional accessibility audits |
| Baseline-aware (new issues block, old issues track) | A "pass/fail the whole site" scanner |
| Developer-native (PR comments, merge blocking) | An overlay widget or post-hoc remediation service |
| Honest about automation limits (~50% of WCAG) | A tool that claims full EAA conformance from automation alone |

### Competitive frame

```
                    High compliance credibility
                              ▲
                              │
         Level Access         │         Intygy (target)
         Deque Enterprise     │         ─────────────────
         Siteimprove           │         Evidence + CI gate
                              │
                              │    Axle, WCAG PR Checker
                              │    (free CI gates, no dossier)
                              │
         accessiBe overlay     │
         (discredited)         │
                              └──────────────────────────────►
                         Dev-native                    Enterprise sales
```

**Win by owning the top-right quadrant for mid-market product teams:** more credible than free GitHub Actions, more developer-native than enterprise audit platforms, with a dossier no CI action currently produces.

---

## Ideal Customer Profiles (ICP)

### Primary ICP — EU B2B SaaS under EAA pressure

**Profile**

- B2B or B2C digital product sold in the EU (SaaS, e-commerce, fintech, marketplaces)
- 10–200 engineers, shipping weekly via GitHub
- No dedicated accessibility team; compliance owned by eng lead, product, or a part-time "compliance" hire
- Triggered by EAA (June 2025), customer procurement questionnaires, or board-level "accessibility risk" conversations

**Pain**

- One-time audits go stale the week after delivery
- Free CI tools block on legacy debt OR pass without producing evidence buyers can use
- Procurement and enterprise customers ask for EN 301 549 / WCAG conformance proof — not just "we use axe"

**Why Intygy**

- Baseline model: start today without a 6-month remediation project
- Every merge adds to a dated audit trail (scans, resolutions, attestations)
- Evidence dossier maps to EN 301 549 framing (the language EU procurement uses)

**Buyer vs user**

| Role | Cares about |
| --- | --- |
| **Buyer** (CTO, Head of Eng, Compliance/Legal) | Risk reduction, evidence for customers/regulators, no workflow disruption |
| **User** (frontend engineer, platform eng) | Fast PR feedback, clear fix guidance, no false positives on old issues |
| **Champion** (staff engineer, eng manager) | Baseline diff, dashboard, integration with existing preview deploys |

**Disqualifiers**

- Native mobile-only products (no web surface to scan)
- Teams without CI/CD or PR-based workflow
- Organizations that need a VPAT signed by a certified auditor *today* with zero internal process (sell audit partner bundle instead)

---

### Secondary ICP — US e-commerce / retail (ADA litigation risk)

**Profile**

- D2C e-commerce, retail, travel, food delivery
- High ADA Title III lawsuit exposure (5,000+ cases/year including state courts)
- Already have some accessibility awareness; may have been burned by overlay widgets

**Pain**

- Need provable regression prevention ("we didn't make it worse")
- Legal counsel wants dated fix history if sued
- Engineering won't accept blocking merges on 200 pre-existing violations

**Intygy angle**

- Same baseline + history model, framed as **litigation-ready change log** rather than EN 301 549 dossier
- Marketing copy shifts from "procurement evidence" to "regression prevention with audit trail"

**Caution:** US buyers often default to Deque/Level Access for legal credibility. Enter via eng champions, not legal/compliance RFPs, until dossier format matures.

---

### Tertiary ICP — EU public-sector suppliers & govtech

**Profile**

- Software vendors responding to public tenders requiring EN 301 549 / WCAG conformance
- Need Accessibility Conformance Reports (ACR / VPAT INT edition)

**Intygy angle**

- Continuous monitoring + exportable register as *supplement* to periodic formal assessment
- Long sales cycle; partner with accessibility audit firms who white-label or resell Intygy monitoring

**Caution:** Procurement officers expect VPAT-format ACRs with methodology sections. Do not pursue this ICP until Phase 3 export formats ship.

---

## Value pillars (mapped to existing architecture)

| Pillar | What exists today | What "must-have" requires |
| --- | --- | --- |
| **Regression gate** | Action + axe-core + Playwright, PR blocking | Marketplace listing, preview URL auto-detection, <5 min setup |
| **Legacy debt tolerance** | Server-side baseline (`baselines` table), first scan = green | Dashboard burn-down charts, baseline issue assignment |
| **Evidence dossier** | `/p/:id/evidence`, 15-criterion register, attestation schema | Full WCAG 2.2 AA register, PDF/VPAT-aligned export, auth |
| **Audit trail** | Scans + violations + `resolved_at` timestamps | Immutable log, export API, retention policies |
| **Manual criteria** | `attestations` table | UI for compliance officer attestation workflow |

---

## Pricing

Pricing follows **repos monitored + evidence tier**, not scan volume (customers pay CI minutes; we pay Postgres). Evidence is the upsell; the CI gate is the wedge.

### Tier overview

| | **Free** | **Team** | **Compliance** | **Enterprise** |
| --- | --- | --- | --- | --- |
| **Price** | €0 | €49/repo/mo | €149/repo/mo | Custom |
| **Repos** | 1 public repo | Up to 5 private | Unlimited | Unlimited |
| **PR scanning** | ✓ | ✓ | ✓ | ✓ |
| **Baseline diff** | ✓ | ✓ | ✓ | ✓ |
| **Dashboard** | ✓ | ✓ | ✓ | ✓ |
| **Evidence dossier** | View-only, watermarked | Full HTML | Full + PDF export | Full + API + custom branding |
| **Criteria register** | 15-item subset | Full WCAG 2.2 AA | Full + EN 301 549 mapping | Full + custom criteria sets |
| **Manual attestations** | — | 3 seats | Unlimited seats | Unlimited + SSO |
| **Auth** | UUID obscurity | Email + org | Email + org | SSO (SAML/OIDC) |
| **Hosting** | Shared (EU) | Shared (EU) | Dedicated DB option | Self-hosted or private cloud |
| **Support** | Community | Email, 48h | Email, 24h | Dedicated CSM |
| **Data retention** | 90 days | 1 year | 3 years | Custom |

### Pricing rationale

- **€49/repo/mo (Team):** Below Deque/Level Access ($500+/mo), above "free GitHub Action" — priced as dev infrastructure (similar to Codecov, Snyk Team tier for a single product).
- **€149/repo/mo (Compliance):** The dossier export and attestation workflow justify 3× — this is where EAA-driven buyers land. A single avoided procurement rejection or audit re-run pays for years of subscription.
- **Enterprise:** Gov suppliers, banks, large marketplaces. ACV target €15k–€60k/yr via annual contracts + audit partner channel.

### What not to price on (yet)

- Scan count / CI minutes (customer-owned cost; creates billing confusion)
- Violation count (punishes honesty — teams with more baseline issues are the ones who need you)
- Per-seat for engineers (creates adoption friction; price the repo, not the headcount)

### Launch pricing strategy

1. **Design partners (0–10 customers):** Free Compliance tier for 6 months in exchange for weekly feedback + logo/testimonial rights.
2. **Public launch:** Team tier only; Compliance tier gated behind waitlist until PDF export ships.
3. **Annual discount:** 2 months free on annual prepay (standard B2B SaaS).

---

## Go-to-market motion

### Phase 0 — Design partners (now → first 10 customers)

**Channel:** Direct outreach, founder-led

**Targets:** EU B2B SaaS companies, 20–80 engineers, known to ship on GitHub, recently asked about EAA in engineering Slack communities or on LinkedIn.

**Offer:** "We install Intygy on your repo in a 30-minute call. You get Compliance-tier features free for 6 months. We get feedback on the evidence dossier."

**Message:**

> Your next enterprise customer will ask for EN 301 549 proof. Intygy generates it automatically from every merge — without making you fix 200 old violations first.

**Success metric:** 3 design partners actively using Intygy on default-branch merges within 30 days.

---

### Phase 1 — Product-led growth (10 → 100 customers)

**Channel:** GitHub Marketplace listing, content marketing, EU compliance communities

**Content themes:**

- "EAA compliance without stopping the sprint" (baseline model)
- "What procurement officers actually want in an accessibility report" (education → dossier)
- "Why overlay widgets fail and CI gates don't" (anti-accessiBe positioning)

**Conversion path:**

```
GitHub Marketplace (Free tier, 1 public repo)
  → First PR scan → dashboard link in job summary
  → Evidence dossier preview (watermarked)
  → Upgrade prompt: "Export PDF for your next customer security questionnaire"
```

**Success metric:** 20% Free → Team conversion within 60 days of first scan.

---

### Phase 2 — Audit partner channel (100+ customers)

Partner with 2–3 EU accessibility audit firms. They sell the human audit; Intygy provides continuous monitoring + dossier between audits.

**Partner pitch:** "Your clients' conformance reports expire on delivery. Intygy keeps the evidence current and sends you alerts when manual re-assessment is needed."

**Revenue split:** 20% partner referral fee on Compliance/Enterprise tiers.

---

## Feature roadmap

Ordered by impact on moving from "nice CI check" to "required compliance infrastructure." Each phase has a **gate criterion** — do not start the next phase until the gate is met.

### Phase 1 — Sellable SaaS (weeks 1–6)

**Goal:** A stranger can go from zero to blocking PRs in under 10 minutes, without SQL queries.

| # | Feature | Why now |
| --- | --- | --- |
| 1.1 | **Managed hosted API** (`api.intygy.eu`) | Self-hosting kills conversion; `.env.example` already points here |
| 1.2 | **Onboarding UI** — install GitHub App → pick repos → copy workflow snippet | Eliminates `select api_key from projects` |
| 1.3 | **Auth on dashboard + evidence routes** | Cannot charge money with UUID obscurity |
| 1.4 | **Stripe billing** (Team tier) | Revenue |
| 1.5 | **GitHub Marketplace listing** | Discovery |
| 1.6 | **Publish Action** (`uses: intygy/action@v1`) with committed `dist/` | Distribution |

**Gate:** 3 design partners onboarded without founder assistance.

---

### Phase 2 — Evidence credibility (weeks 7–12)

**Goal:** The dossier is something a compliance officer would attach to a customer questionnaire — not just an internal dashboard.

| # | Feature | Why now |
| --- | --- | --- |
| 2.1 | **Full WCAG 2.2 AA criteria register** (extend `CRITERIA` in `evidence.ts`) | 15-item subset undermines procurement claims |
| 2.2 | **Criterion ↔ axe rule mapping** — show which rules were tested, which need manual attestation | Separates machine-verified from manual (already modeled via `automatable` field) |
| 2.3 | **Attestation UI** — compliance officer signs off on manual criteria (`attestations` table) | Closes the "automation only covers ~50%" gap honestly |
| 2.4 | **PDF export** of evidence dossier | What buyers actually attach to emails |
| 2.5 | **Baseline burn-down dashboard** — open issues over time, resolution velocity | Proves continuous improvement to auditors |
| 2.6 | **Screenshots in PR comments** | Reduces time-to-fix; matches Axle parity |

**Gate:** 1 design partner uses PDF export in a real customer/procurement interaction.

---

### Phase 3 — Procurement-grade output (weeks 13–20)

**Goal:** Intygy output is recognisable in formal procurement and audit contexts.

| # | Feature | Why now |
| --- | --- | --- |
| 3.1 | **VPAT INT edition export** (ACR format) | What EU public-sector tenders require |
| 3.2 | **Methodology section** — scan config, routes, viewports, ruleset, tool versions | ETSI TR 101 551 requires documented methodology |
| 3.3 | **Immutable audit log** — append-only scan history with tamper-evident timestamps | Legal/procurement defensibility |
| 3.4 | **Compliance tier launch** (€149/repo/mo) | Monetise evidence features |
| 3.5 | **Multi-repo org dashboard** | Upsell path for companies with 3+ products |
| 3.6 | **Email alerts** — new regressions, attestation expiry, scan failures | Keeps compliance officer in loop without logging into dashboard |

**Gate:** First paying Compliance-tier customer.

---

### Phase 4 — Platform expansion (weeks 21–30)

**Goal:** Reduce platform risk and expand TAM without diluting the evidence wedge.

| # | Feature | Why now |
| --- | --- | --- |
| 4.1 | **GitLab CI component** | ~30% of EU enterprise uses GitLab |
| 4.2 | **Vercel / Netlify preview auto-detection** | Remove `intygy.yml` manual config for common stacks |
| 4.3 | **Route → file mapping** (v1.5 in README) | "This PR introduced the violation" — developer delight |
| 4.4 | **Evidence API** (JSON export for GRC tools) | Enterprise tier enabler |
| 4.5 | **SSO** (SAML/OIDC) | Enterprise procurement requirement |
| 4.6 | **Audit partner portal** — read-only dossier access for external auditors | Channel enablement |

**Gate:** 20% of revenue from non-GitHub or Enterprise tier.

---

### Explicitly deferred (do not build until Phase 4+)

These are tempting but do not move the "must-have" needle:

| Feature | Why defer |
| --- | --- |
| AI-generated fix suggestions | Axle owns this; competes on Claude costs, not evidence |
| Static analysis (axe-linter equivalent) | Different product surface; partner with Deque instead |
| Overlay widget / runtime remediation | FTC-discredited category |
| Mobile app scanning | Different test infrastructure; web-first ICP |
| Bitbucket / Azure DevOps | Small EU share; GitLab first |
| Full human audit marketplace | Partner, don't build |

---

## Messaging by audience

### For engineering leaders (champion)

> Intygy blocks new accessibility regressions in every PR without making you fix 200 old violations first. Your team keeps shipping; compliance gets a dated audit trail automatically.

### For compliance / legal (buyer)

> Under the EAA, a one-time audit is not enough. Intygy produces continuous EN 301 549 evidence from your normal release process — every merge, every fix, every attestation, dated and exportable.

### For procurement (external)

> This dossier documents automated WCAG 2.2 AA monitoring on every code change since [date], with separate tracking for manually attested criteria. Methodology and scan configuration are included.

### Anti-positioning (vs overlays)

> Intygy never injects code into your production site. It scans, records, and blocks regressions at the source — the same approach recommended by accessibility experts and required by EU law.

---

## Success metrics

### North star

**Merges monitored per month across all customers** — proxy for evidence volume and habit formation.

### Stage metrics

| Stage | Metric | Target |
| --- | --- | --- |
| Design partners | Active repos with scans in last 7 days | 3 → 10 |
| PLG launch | Free → Team conversion (60-day) | 20% |
| Compliance tier | PDF exports per month | 50+ |
| Revenue | MRR | €5k (≈100 Team or 35 Compliance repos) |
| Retention | Logo churn (monthly) | < 3% |
| Evidence quality | Design partner NPS on dossier usefulness | ≥ 40 |

### Leading indicators (weekly)

- PR checks run (total + unique repos)
- New violations blocked (proves gate works)
- Baseline issues resolved (proves burn-down works)
- Evidence page views + PDF downloads
- Attestations recorded (proves compliance officer engagement)

---

## Risks & mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Free CI actions (Axle, a11yGuard) are "good enough" | High | Do not compete on scanning; compete on evidence export |
| "Automation ≠ conformance" disclaimer scares buyers | Medium | Honest attestation workflow; partner with audit firms |
| Enterprise buyers require Deque/Level Access brand | Medium | Enter mid-market first; partner upmarket later |
| Self-host friction limits adoption | High (today) | Phase 1 managed SaaS is non-negotiable |
| EAA enforcement slower than expected | Low | ADA litigation covers US ICP; market is dual-regulation |
| axe-core coverage ceiling (~50%) | Certain | Document clearly; attestation workflow for manual criteria |

---

## Summary

**Market:** Strong and regulation-driven (~$880M, 6–10% CAGR).

**Wedge:** EN 301 549 evidence dossier from merge history — not the scan engine.

**ICP:** EU B2B SaaS, 10–200 engineers, GitHub, EAA pressure, no dedicated a11y team.

**Price:** €49/repo (Team) for the gate; €149/repo (Compliance) for the evidence.

**Next 6 weeks:** Managed SaaS, onboarding UI, auth, Stripe, Marketplace — then make the dossier exportable and credible.

The CI gate gets you installed. The evidence dossier gets you paid. The attestation workflow keeps you honest — and keeps customers from churning to a free Action.
