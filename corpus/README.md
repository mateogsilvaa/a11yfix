# Benchmark corpus

Pages with accessibility violations, in two sets. `a11yfix bench` searches this directory recursively and reports
each set separately:

- **dev**: everything outside `eval/`. These pages have been read, debugged and used while writing the codemods
  and prompts. Their numbers show that the tool works on the cases it was built for; they are not an estimate of
  how it does on pages it has not seen.
- **eval**: `eval/`, the held-out set. No one has tuned anything on these pages. Its numbers are the ones to quote.

## Held-out rule

1. Pages in `eval/` are never used to write or tune codemods, rules, prompts or the verifier. "Used" means reading
   the page's markup or its per-finding outcomes (`bench/*/eval/**`) while working on a change, or adding a test
   case taken from it.
2. Aggregate eval numbers (the summary and per-rule tables in `report.md`) may be read. Do not iterate on a change
   until the eval numbers go up: decide on dev, then run eval once.
3. Once a page is used for tuning, it moves to dev, in the same commit as the change it informed: `git mv` it out
   of `eval/` into the matching folder outside it, keep its source and license, and add a row to
   [Moved from eval to dev](#moved-from-eval-to-dev). Pages never move from dev to eval.
4. New pages go to `eval/` first, with their source URL and license next to them.

### Moved from eval to dev

| Page | Date | Why |
|---|---|---|
| none yet | | |

## Dev pages

22 pages, all used while writing the codemods.

| Folder | Pages | Source | License |
|---|---|---|---|
| `handwritten/` | 10 | Written for a11yfix. Each covers one or two rules, with easy and ambiguous cases. | Apache-2.0 (this repository) |
| `external/w3c-bad/` | 4 | Inaccessible "before" pages of the W3C WAI [Before and After Demonstration](https://www.w3.org/WAI/demos/bad/) (home, news, tickets, survey). | W3C Software and Document License, see [`external/LICENSE-w3c.md`](external/LICENSE-w3c.md) |
| `external/axe-core/` | 8 | axe-core integration fixtures for each patched rule (`test/integration/rules/<rule>/`), wrapped in a page skeleton. Fixture markup unchanged. | Mozilla Public License 2.0, see [`external/LICENSE-axe-core`](external/LICENSE-axe-core) |

Deque's own demo sites are not included: they are not published under an open license.

## Eval pages

73 pages, added 2026-11-20 and not used for tuning. Each folder has a `SOURCE.md` (original URL and commit for every
page, and what was changed) and the source's `LICENSE`. Pages are copied unchanged unless `SOURCE.md` says otherwise;
images, scripts and web fonts are not included, stylesheets are.

| Folder | Pages | Source | License |
|---|---|---|---|
| `eval/startbootstrap/` | 33 | Built pages of 14 [Start Bootstrap](https://github.com/StartBootstrap) templates (landing pages, blogs, admin dashboards, a shop), with each template's stylesheet. | MIT |
| `eval/bootstrap-examples/` | 20 | Bootstrap 5.3.9 [examples](https://getbootstrap.com/docs/5.3/examples/) from the release zip, with `bootstrap.min.css`. | MIT (code), CC BY 3.0 (docs) |
| `eval/mdn/` | 13 | MDN [learning-area](https://github.com/mdn/learning-area/tree/main/accessibility) accessibility pages, several inaccessible on purpose. | CC0 1.0 |
| `eval/axe-core/` | 7 | axe-core fixtures not used in dev (`aria-allowed-attr` failures, text shadows, full-page contrast and heading tests). Same project as the dev fixtures, so the weakest held-out evidence here. | Mozilla Public License 2.0 |

Some eval pages may have no violation of the patched rules. They stay: choosing pages by how they score would bias
the set.

## Hand-written pages

| Page | Focus | Ambiguous on purpose |
|---|---|---|
| `01-bakery-images` | `image-alt` | linked logo with no text, decorative divider, an image of a table, an icon inside a link that also has text |
| `02-newsletter-labels` | `label` | text next to a control but not associated, placeholder-only email, search box next to its button |
| `03-docs-headings` | `heading-order` | sidebar `h5` before the page `h1`, `h3`/`h5` used for size |
| `04-dashboard-roles` | `aria-roles`, `aria-required-attr` | misspelled roles, abstract roles, a checkbox whose state is unknown |
| `05-settings-aria-values` | `aria-valid-attr-value`, `aria-allowed-attr` | an `aria-labelledby` pointing at a misspelled id, non-boolean values |
| `06-pricing-contrast` | `color-contrast` | shared CSS classes, inline styles, a white-on-yellow button, a badge on a dark background |
| `07-recipe-mixed` | mixed | a recipe photo, radio buttons with no checked state |
| `08-portfolio-ambiguous` | `image-alt` | images with no context at all, icon-only buttons, an email address as an image, a spacer GIF |
| `09-event-signup` | `label`, mixed | first and last name under one visible label in a table cell |
| `10-coworking-crlf` | mixed | CRLF line endings; identical markup repeated in three cards |

Keep this directory's line endings as they are (see `.gitattributes`): the CRLF page tests patch application on
Windows line endings.
