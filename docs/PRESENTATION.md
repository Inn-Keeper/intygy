# Intygy in code review

A 30-minute talk for engineering teams and accessibility reviewers. Includes three minutes for discussion.

## 00–02 min · What changed for someone using this page?

A pull request can change what a screen reader announces even when the page looks the same.

- **Developer** — Which element needs attention before I merge?
- **Reviewer** — Which pages did we check, and when?

**Presenter notes**

Open with the image on a home page. Imagine reviewing the diff from a screenshot alone. Would you know what a visitor hears when the image is announced? Give the room a moment to answer. Introduce Intygy as a GitHub check that brings one class of accessibility problems into that conversation. Return to the reviewer’s question at the end.

## 02–04 min · What exactly did we scan?

Each result belongs to a particular page, viewport and rendered state.

- **Page** — Choose a representative route, such as the home page.
- **Viewport** — Desktop and mobile can render different elements.
- **State** — Wait for loaded content. For a login flow, confirm an authenticated marker on every page.

**Presenter notes**

Ask someone to suggest a state of the home page a fresh visit would miss. An expanded navigation menu is a good example. Walk through why a scan of the initial page cannot answer questions about that menu. A readiness selector should appear when real content is ready. A loading shell could otherwise give the team a misleading sample.

## 04–07 min · From browser to pull request

The customer’s GitHub runner opens the page. Intygy’s hosted API keeps the history.

- **01  Render** — Playwright opens each route at each configured viewport.
- **02  Inspect** — axe-core checks the rendered page. Each failing element becomes a finding.
- **03  Compare** — The API verifies the submission, stores it in Postgres and returns the gate result. The GitHub App can then comment.

**Presenter notes**

Trace one image through all three stages. For a review of a PR, the page should come from a preview for that commit or a local build of its head. A fixed staging URL can serve yesterday’s version. A workflow token authenticates the submitting run. It cannot tell us which version the staging server actually rendered. Ask where the team currently builds its preview.

## 07–10 min · Why the first check can pass

The first successful scan establishes the set of findings the team already knows about.

- **First scan** — Existing findings enter the baseline. The check passes.
- **Later PR** — A new fingerprint fails the check. GitHub blocks merging when the team requires that check.
- **Default branch** — A verified scan of the current head updates the baseline and records fixes within the coverage scanned.

**Presenter notes**

Work a small example aloud. Suppose the first scan finds two unnamed controls. A later PR still contains both. Ask the audience to predict the result. Now add a third unnamed control and ask again. Explain why this approach lets a team adopt the check with a backlog. The original two issues still matter to users and remain visible to the team.

## 10–13 min · One image, two findings

Innkeeper Forge · PR #1 · 11 November 2026

- **The change** — <img src="/icon.svg">
- **The result** — The home page triggered image-alt on desktop and mobile. The PR comment identified the element and linked fix guidance.
- **The outcome** — The developer added alt text. The check cleared. The PR was closed without merging.

**Presenter notes**

Open the linked original comment or use the slide if the network is unavailable. Ask why there are two findings when there is one source edit. Show the home-page route, viewport and selector as the evidence that leads back to the element. Ask what wording a visitor would need if the icon were inside a link. The correct answer depends on what the link does. This PR demonstrates review feedback and a cleared check. It never entered default-branch resolution history.

[Read the original PR comment](https://github.com/Inn-Keeper/innkeeper-forge/pull/1#issuecomment-6804225570)

## 13–16 min · Did the team fix checkout?

Illustrative scenario · A finding is open on /checkout at the mobile viewport.

- **Run A** — The default-branch scan covers only the home page.
- **Run B** — The next scan checks /checkout on desktop only.
- **Run C** — The current default-branch scan checks /checkout on mobile with the original ruleset. The finding is absent.

**Presenter notes**

Read each run in order and invite a show of hands after each one. In A, the team has no fresh checkout evidence. In B, the route matches but the viewport differs. C is the first run with matching route, viewport and ruleset, so the missing finding can resolve. Ask what happens if C runs against a stale commit. Its result goes into history and the current baseline stays intact. This exercise is illustrative, separate from the recorded PR.

## 16–19 min · What can we tell a customer?

Start with the latest accepted default-branch scan.

- **Scope** — Read the commit, date, routes, viewports and ruleset.
- **History** — Follow when a recorded finding appeared, resolved or reopened.
- **Criteria** — The HTML dossier covers a partial register of 15 criteria and includes dated manual attestations where available.

**Presenter notes**

Give the audience a procurement question: ‘Did you check mobile checkout in the release we are buying?’ Ask them which fields they would read before answering. If checkout is missing, the honest answer is that this scan supplies no evidence about it. If present, distinguish the recorded automated result from what a human has tested. Ask a volunteer to phrase a two-sentence response naming both the scope and the outstanding question.

## 19–22 min · Would this alt text help a visitor?

An automated check can flag a missing text alternative. A person judges its meaning in context.

- **Example A** — An image is the only content of a link. What destination or action should its accessible name convey?
- **Example B** — The same image sits beside text that already names the link. Would repeating the text help?

**Presenter notes**

Give the room 30 seconds to compare the two cases in pairs. Invite two descriptions for the first image and ask what task each supports. For the second, discuss whether the image is decorative in this context and whether an empty alternative avoids duplicate announcements. Return to the real PR: a cleared automated rule is useful feedback, but the team still needs to evaluate meaning, interaction and other states before making a conformance claim.

## 22–25 min · Who can submit or read results?

Submitting a scan and opening a report use different credentials.

- **Submission** — A repository-specific API key and a GitHub Actions workflow token identify the project and submitting run.
- **Storage** — Scan, findings and baseline changes commit together. A failed PR comment leaves the accepted scan available.
- **Reading** — Anyone holding a signed report link can read that project’s reports for 30 days. There is no user login.

**Presenter notes**

Ask who receives PR comments and who might forward an evidence link. Explain why that matters for a team whose findings are confidential. Use a non-confidential project for a trial. Walk through a missing comment: first inspect the run summary and dashboard, since a delivery failure can happen after the scan was accepted. The GitHub App supplies repository metadata and posts comments. These permissions are separate from possession of a report link.

## 25–27 min · Try one page before requiring a check

Choose one GitHub repository, one reachable page and one person who owns that page.

- **Connect** — Install the App for the repo, request its project key and save it as the INTYGY_KEY Actions secret.
- **Scan** — Use the Quickstart trial workflow for a deployed default-branch page. Open Dashboard from the Actions summary.
- **Expand** — For PRs, scan a matching preview or build the app in Actions. Verify the default-branch run before requiring the check.

**Presenter notes**

Point the audience to the Quickstart. The key is issued manually, so arrange it ahead of a live session. If a team has no public deployment, take the local build path instead. Ask the engineering lead to name a first route and the reviewer to identify one coverage question they expect the report to answer. Mention fork contributions before recommending a required check: ordinary fork runs lack the project secret.

[Open the Quickstart](https://github.com/Inn-Keeper/intygy/blob/main/docs/QUICKSTART.md)

## 27–30 min · Which page would you start with?

Choose a route where a regression would interrupt a real task.

- **For engineering** — What new finding should stop the next merge?
- **For the reviewer** — What could you answer from the scan record, and what would you test by hand?

**Presenter notes**

Reserve the final three minutes for questions. If the room is quiet, ask one person to name a route, a user task and a state beyond initial load. Ask a second person what scope they would want in a report before accepting a claim about that task. Close by returning to the opening image: the developer received a specific element to fix, and the reviewer can explain the scope of the evidence.

[Visit Intygy](https://intygy-landing.vercel.app/)

[Recorded live verification](../CHANGELOG.md#live-verification-on-2026-11-11) · [Architecture and evidence semantics](./ARCHITECTURE.md)
