// The few GitHub REST calls the action makes, on plain fetch. `fetch` is
// injectable so tests never reach the network.

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface GitHubOptions {
  token: string;
  /** owner/name */
  repo: string;
  /** $GITHUB_API_URL; GitHub Enterprise Server has its own. */
  apiUrl?: string;
  fetch?: typeof fetch;
}

export interface PullFile {
  filename: string;
  status: string;
  patch?: string;
}

export interface Review {
  id: number;
  body: string | null;
  commit_id: string;
  html_url?: string;
}

export interface ReviewCommentRef {
  body: string;
}

export class GitHub {
  private readonly api: string;
  private readonly fetch: typeof fetch;

  constructor(private readonly o: GitHubOptions) {
    this.api = (o.apiUrl ?? "https://api.github.com").replace(/\/+$/, "");
    this.fetch = o.fetch ?? fetch;
  }

  async request<T>(method: string, route: string, body?: unknown): Promise<T> {
    const res = await this.fetch(`${this.api}/repos/${this.o.repo}${route}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.o.token}`,
        "x-github-api-version": "2022-11-28",
        "user-agent": "verifa11y-action",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try {
        const j = JSON.parse(text) as { message?: string; errors?: unknown };
        msg = [j.message, j.errors ? JSON.stringify(j.errors) : ""].filter(Boolean).join(" ");
      } catch {
        // not JSON
      }
      throw new GitHubError(res.status, `${method} ${route}: ${res.status} ${msg.slice(0, 500)}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  /** Every page of a list endpoint (100 per page, at most `maxPages`). */
  async all<T>(route: string, maxPages = 30): Promise<T[]> {
    const out: T[] = [];
    const sep = route.includes("?") ? "&" : "?";
    for (let page = 1; page <= maxPages; page++) {
      const items = await this.request<T[]>("GET", `${route}${sep}per_page=100&page=${page}`);
      out.push(...items);
      if (items.length < 100) break;
    }
    return out;
  }

  listFiles(pr: number): Promise<PullFile[]> {
    return this.all<PullFile>(`/pulls/${pr}/files`);
  }

  listReviews(pr: number): Promise<Review[]> {
    return this.all<Review>(`/pulls/${pr}/reviews`);
  }

  listReviewComments(pr: number): Promise<ReviewCommentRef[]> {
    return this.all<ReviewCommentRef>(`/pulls/${pr}/comments`);
  }

  createReview(pr: number, payload: unknown): Promise<Review> {
    return this.request<Review>("POST", `/pulls/${pr}/reviews`, payload);
  }
}
