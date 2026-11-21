# Intygy positioning

Intygy helps web teams catch new accessibility findings during code review and show
what they have checked since their last audit.

## Who it serves

The initial buyer is an engineering lead at an EU B2B software company that ships
through GitHub and receives accessibility questions from customers. Developers need
a specific element to fix. The colleague answering procurement questions needs the
scope, date, and limits of the evidence.

## Available today

The first successful scan records existing findings. Later PR checks flag new findings
on the configured routes and viewports. Verified default-branch scans maintain the
baseline and its dated issue history. The signed HTML dossier shows recorded coverage,
15 criteria, and any recorded manual attestations. Automated results alone cannot
establish WCAG or EN 301 549 conformance.

In Innkeeper Forge, one image missing alt text produced a finding on both mobile and
desktop. The developer added alt text and the check cleared. [Original PR comment](https://github.com/Inn-Keeper/innkeeper-forge/pull/1#issuecomment-6804225570)

## Proposed pilot

Pick one GitHub repository and a few representative routes. Establish the baseline,
review one regression with a developer, and ask the person handling procurement to use
the dossier to answer a real coverage question. Record what they could answer and what
still required manual evidence.

## Strategy assumptions · November 21, 2026

| Proposal | What would justify it |
| --- | --- |
| Test team pricing at €49 per repository per month and an evidence tier at €149. | Design partners identify a recurring need and willingness to pay. |
| Prioritize self-service onboarding and organization sign-in. | Manual key delivery or bearer-link sharing prevents teams from adopting the pilot. |
| Explore a broader register, manual attestation UI, PDF export, and later VPAT-aligned reporting. | Reviewers identify missing evidence or a required delivery format in a real procurement review. |

These are proposed prices and development priorities. The hosted MVP currently provides
manual onboarding and signed HTML reports.
