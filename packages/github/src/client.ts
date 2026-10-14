export interface PullFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export class GitHub {
  constructor(private token: string, private apiBase = "https://api.github.com") {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const r = await fetch(`${this.apiBase}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/vnd.github+json",
        "user-agent": "weft",
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!r.ok) throw new Error(`github ${r.status} ${path}: ${await r.text()}`);
    if (r.status === 204) return undefined as T;
    return (await r.json()) as T;
  }

  get<T>(path: string) { return this.req<T>(path); }
  post<T>(path: string, body: unknown) {
    return this.req<T>(path, { method: "POST", body: JSON.stringify(body) });
  }
  patch<T>(path: string, body: unknown) {
    return this.req<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  async prFiles(owner: string, repo: string, number: number): Promise<PullFile[]> {
    const out: PullFile[] = [];
    for (let page = 1; page <= 30; page++) {
      const batch = await this.get<PullFile[]>(
        `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100&page=${page}`,
      );
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  }

  async prDiff(owner: string, repo: string, number: number): Promise<string> {
    const r = await fetch(`${this.apiBase}/repos/${owner}/${repo}/pulls/${number}`, {
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/vnd.github.v3.diff",
        "user-agent": "weft",
      },
    });
    if (!r.ok) throw new Error(`diff ${r.status}`);
    return r.text();
  }

  submitReview(owner: string, repo: string, number: number, body: {
    event: "APPROVE" | "COMMENT" | "REQUEST_CHANGES";
    body?: string;
    comments?: Array<{ path: string; line: number; body: string }>;
  }) {
    return this.post<{ html_url?: string }>(
      `/repos/${owner}/${repo}/pulls/${number}/reviews`,
      body,
    );
  }

  comment(owner: string, repo: string, number: number, body: string) {
    return this.post<{ html_url?: string }>(
      `/repos/${owner}/${repo}/issues/${number}/comments`,
      { body },
    );
  }
}
