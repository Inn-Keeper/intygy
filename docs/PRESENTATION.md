# Intygy in two slides

## Catching missing alt text during code review

**Innkeeper Forge · Pull request #1 · November 11, 2026**

The home page gained an image without alternative text.

```html
<img src="/icon.svg">
```

| What Intygy found | What the developer saw |
| --- | --- |
| One affected image on two viewports | Two findings on the home page, one desktop and one mobile |
| Missing alternative text | The image selector, WCAG 1.1.1 Non-text Content, and a link to fix guidance |

The developer added alt text in the next commit. The recorded live check cleared. The PR was closed without merging.

[Show the original bot comment](https://github.com/Inn-Keeper/innkeeper-forge/pull/1#issuecomment-6804225570) · [Show the fix](https://github.com/Inn-Keeper/innkeeper-forge/pull/1/commits)

---

## What can a reviewer establish from the evidence page?

**“Which parts of the product did you check, and what still needs human review?”**

| On the evidence page | How to read it |
| --- | --- |
| Recorded coverage | Start with the latest verified default-branch scan. Its recorded coverage defines where the automated findings apply. An open finding outside that coverage still needs verification. |
| Partial criteria register | Read the automated result alongside any dated manual attestation. The MVP tracks 15 criteria. A reviewer still needs to assess the quality of alternative text by inspecting the image in context. |
| Issue history | Follow dated events to see which findings entered the baseline and which were later verified as resolved. |

**Presenter note.** This is a reading guide based on the evidence page implementation. The November 11 trial verified that the default-branch scan and evidence page worked. It did not exercise a resolved-issue history live. The closed PR on slide one illustrates developer feedback only.

[Evidence page implementation](../packages/api/src/lib/evidence.ts) · [Live verification notes](../CHANGELOG.md#live-verification-on-2026-11-11)
