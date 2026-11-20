# a11yfix with any AI agent

a11yfix does not care who writes a patch. It cares whether the patch survives the verifier. That works in two
directions.

## 1. An agent writes tier-1 patches: `--generator-cmd`

```sh
a11yfix fix findings.json --verify --generator-cmd "<command>"
# or once for every run
export A11YFIX_GENERATOR_CMD="<command>"
```

For every finding that tier 0 cannot fix, a11yfix runs `<command>` through the shell, writes the request to its
stdin, and reads its stdout.

**Request (`--generator-input text`, the default).** One plain-text prompt: the system instructions (minimal patch,
one violation, never hide or delete, describe function not appearance, ...), the source file with line numbers, and
the finding (rule, axe's help and failure summary, the element's source and DOM, context, rule guidance, limits). It
works with any CLI that takes a prompt on stdin.

**Request (`--generator-input json`).** One JSON object, for scripts that build their own request:

```json
{
  "system": "…the system instructions…",
  "file": "…the full source file…",
  "sourceFile": "corpus/handwritten/01-bakery-images.html",
  "prompt": "…the finding as text…",
  "finding": { "id": "f_0003", "ruleId": "image-alt", "selector": "…", "sourceSnippet": "…", "…": "…" },
  "schema": { "…": "the JSON schema of the answer" }
}
```

**Answer.** A patch object on stdout:

```json
{ "findingId": "f_0003", "rationale": "…", "before": "<img src=\"cake.jpg\">", "after": "<img src=\"cake.jpg\" alt=\"Three-tier lemon cake\">", "confidence": "medium" }
```

`before` must be an exact substring of the file. Prose and markdown fences around the object are fine: a11yfix takes
the first JSON object in the output that matches the schema. If there is none, it runs the command again (at most
twice more) with the error appended to the request. A command that cannot start stops the run; a non-zero exit with
no output, or a timeout (5 minutes per attempt), counts as a failed attempt.

The patch then goes through shape validation and the full verifier (axe, static checks, accessibility tree, focus
order, pixels). Nothing the agent says is trusted: a vague or harmful patch ends up rejected with a reason in the
report, not in `a11yfix.patch`.

| Command | Status in this repository |
|---|---|
| `ollama run qwen3:8b --think=false` | Tested end to end; the [local benchmark](../bench/local-qwen3-8b/report.md) uses it. Offline. |
| `claude -p` | Protocol tested; the CLI must be signed in (`claude` once interactively). |
| `codex exec -`, `llm -m <model>`, `aider --message-file -`, … | Not tested here. Anything that reads stdin and prints the answer works. |
| a script of yours | See the test agent in [`packages/core/test/fixtures/agents/alt-agent.mjs`](../packages/core/test/fixtures/agents/alt-agent.mjs). |

**Privacy.** The command receives the full source of the page being fixed. Use a model or service you are allowed to
send that page to; with a local model nothing leaves the machine. Token usage is not reported for commands (a11yfix
cannot know it).

## 2. An agent uses a11yfix as its judge

An agent that edits HTML (in an editor, in a CI bot) can call the CLI and read JSON:

```sh
a11yfix audit page.html --out findings.json          # what is wrong, with exact source lines
# the agent writes patch.json for one finding: {findingId, rationale, before, after, confidence}
a11yfix verify page.html patch.json --findings findings.json --out verdict.json
echo $?                                              # 0 = verified, 1 = rejected
```

`verdict.json` has the status, the reason, the new violations, and the accessibility-tree, focus and visual results.
A reasonable agent loop: audit, pick a finding, propose the smallest patch, verify, and if it is rejected read the
reason and try again, or leave the finding for a person. `fix --verify` does the same for every finding at once and
writes a `git apply` patch.

Instructions you can paste into an agent's configuration (`AGENTS.md`, `CLAUDE.md`, a system prompt):

```text
When you change HTML for accessibility, use a11yfix to check your work:
1. `a11yfix audit <file> --out findings.json` lists violations with exact source lines.
2. Fix one finding at a time with the smallest edit. Never hide, delete, or silence (aria-hidden, role="presentation",
   inert, display:none, generic alt text) to make a violation disappear.
3. Write the edit as {"findingId", "rationale", "before", "after", "confidence"} to patch.json; "before" must be copied
   exactly from the file.
4. Run `a11yfix verify <file> patch.json --findings findings.json`. Apply the edit only if it exits 0. If it is
   rejected, read the reason; do not work around the verifier.
```
