# Benchmark corpus

22 pages with accessibility violations. `a11yfix bench` searches this directory recursively.

| Folder | Pages | Source | License |
|---|---|---|---|
| `handwritten/` | 10 | Written for a11yfix. Each covers one or two rules, with easy and ambiguous cases. | Apache-2.0 (this repository) |
| `external/w3c-bad/` | 4 | Inaccessible "before" pages of the W3C WAI [Before and After Demonstration](https://www.w3.org/WAI/demos/bad/) (home, news, tickets, survey). | W3C Software and Document License, see [`external/LICENSE-w3c.md`](external/LICENSE-w3c.md) |
| `external/axe-core/` | 8 | axe-core integration fixtures for each patched rule (`test/integration/rules/<rule>/`), wrapped in a page skeleton. Fixture markup unchanged. | Mozilla Public License 2.0, see [`external/LICENSE-axe-core`](external/LICENSE-axe-core) |

Deque's own demo sites are not included: they are not published under an open license.

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
