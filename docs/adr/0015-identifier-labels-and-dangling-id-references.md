# 0015. Suspicious: labels that restate an identifier, id references to nothing

## Context
The naive baseline (ADR 0014) got patches verified that a reviewer would reject. Two kinds can be recognized from the
markup alone, without guessing what the author meant:

- `aria-label` taken from the control's `name` or `id` (`<input name="first">` → `aria-label="first"`). Axe sees a
  name; a screen-reader user hears the developer's identifier, which is often an abbreviation (`org`), a fragment
  (`first` for one of two inputs under "Name") or a word that is not what the field is for.
- An id-reference attribute set to something that is not an id on the page (`aria-controls="false"`). Axe's
  `aria-required-attr` only checks that the attribute is present, and `aria-valid-attr-value` does not reject every
  dangling reference (a combobox's `aria-controls`, `aria-describedby`). The patch states a relationship that does not
  exist.

The first one has a hard case: `name="email"` → `aria-label="Email"` is a sensible label, and "email" is a real word.
A dictionary would not help (`first`, `last` and `days` are real words too, and they are wrong labels here). What
separates a good `aria-label="Email"` from a bad one is not the word, it is whether it agrees with what sighted users
see next to the field.

## Decision
Two suspicion checks in `suspicionReasons` (core, so they apply to every rule and every generator):

1. **Label restates an identifier.** An `aria-label` added by the patch on an element inside the edit is suspicious
   when every word of it appears in the element's `name` or `id` (same word split as `restatesFileName`: case,
   `_`, `-` and camelCase are separators), **unless** the label contains, word for word, a whole visible text segment
   next to the element: a text node under its parent or grandparent (not crossing `<form>`, `<main>` or `<body>`,
   and not the control's own options), the nearest non-blank sibling on each side (`<p>Contact</p> <input>`, even
   directly under a `<form>`), its `placeholder` or its `title`. That is WCAG 2.5.3 (label in name) applied
   to the patch: `name="email"` → `aria-label="Email"` is accepted when "Email" (or "E-mail") is the visible text in
   the previous cell, and flagged when the only visible text is a placeholder like `you@example.com`, or when the
   label is one word out of a sentence ("weekly" next to "Send me the weekly digest too"). A label that says more
   than the identifier (`name="first_name"` → `aria-label="First name as on your ticket"`) is not affected.
2. **Dangling id reference.** For `aria-activedescendant`, `aria-controls`, `aria-describedby`, `aria-details`,
   `aria-errormessage`, `aria-flowto`, `aria-labelledby` and `aria-owns`, every id token that matches no `id` on the
   patched page is collected before and after the patch. Any reference that is dangling after the patch and was not
   before is suspicious. Pre-existing broken references are not the patch's doing; a reference broken by the patch
   (its target id removed or renamed) is.

Both are additive: no existing check changed.

## Consequences
The flagged patches land in `rejected_suspicious`, so by default they still appear in the output patch for review
(ADR 0008) and `--strict` drops them. A correct label taken from an identifier with no matching visible text (for
example `aria-label="Email"` next to a field whose only visible hint is the placeholder `you@example.com`) is now
flagged. We accept that: the verifier cannot tell it from `aria-label="org"` without judgment, and a person reviews
suspicious patches anyway. The visible-text rule only looks two levels up and one sibling across, so a label whose
visible text sits further away (a heading three levels up) is flagged too.

Tier 0 is unaffected by construction: its label codemod either points `aria-labelledby` at existing visible text
(resolving id), wraps visible text in a `<label>`, or copies the placeholder into `aria-label` (which is a visible
segment); `aria-valid-attr-value` only rewrites id references to an existing id. Measured numbers are in the
benchmark reports, not here.
