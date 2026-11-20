// Path filters for the `paths` input, without a dependency: `**`, `*`, `?`,
// `{a,b}` and `[...]` on forward-slash, repository-relative paths. A pattern
// starting with `!` excludes. Same meaning as in `on.pull_request.paths`.

const SPECIAL = /[.*+?^${}()|[\]\\/]/g;

export function globToRegExp(glob: string): RegExp {
  let re = "";
  let group = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?"; // `**/`: zero or more directories
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (c === "{") {
      group++;
      re += "(?:";
    } else if (c === "}" && group > 0) {
      group--;
      re += ")";
    } else if (c === "," && group > 0) {
      re += "|";
    } else if (c === "[") {
      const end = glob.indexOf("]", i + 2);
      if (end < 0) {
        re += "\\[";
        continue;
      }
      let cls = glob.slice(i + 1, end);
      if (cls.startsWith("!")) cls = `^${cls.slice(1)}`;
      re += `[${cls.replace(/\\/g, "\\\\")}]`;
      i = end;
    } else {
      re += c.replace(SPECIAL, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

/** Split the `paths` input: newlines or commas, `#` comments, blanks ignored. */
export function parsePatterns(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s !== "" && !s.startsWith("#"));
}

/** True when `file` matches at least one pattern and no `!` pattern. */
export function matchesAny(file: string, patterns: string[]): boolean {
  const p = file.split("\\").join("/");
  let included = false;
  for (const pat of patterns) {
    if (pat.startsWith("!")) {
      if (globToRegExp(pat.slice(1)).test(p)) return false;
    } else if (!included && globToRegExp(pat).test(p)) {
      included = true;
    }
  }
  return included;
}
