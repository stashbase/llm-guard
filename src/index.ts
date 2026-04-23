export type ScanFinding = {
  text_index: number;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  preview: string;
  value_sha256: string;
  range: {
    start_line: number;
    end_line: number;
  };
  value?: string;
};

export type ScanResult = {
  has_leak: boolean;
  findings: ScanFinding[];
};

export type GuardOptions = {
  async?: boolean; // default true
  ignoreHashes?: string[];
  onResult?: (res: ScanResult) => void;
};

export type InitOptions = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
};

let globalConfig: InitOptions | null = null;

export function initGuard(config: InitOptions) {
  globalConfig = {
    baseUrl: "https://api.stashbase.dev",
    timeoutMs: 5000,
    ...config,
  };
}

// --- internal request (copied/minimal from your SDK style) ---
async function request(path: string, body: any): Promise<ScanResult> {
  if (!globalConfig) {
    throw new Error(
      "llm-guard not initialized. Call initGuard({ apiKey }) first.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), globalConfig.timeoutMs);

  try {
    const res = await fetch(`${globalConfig.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${globalConfig.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// --- core API call ---
async function scanText(
  texts: string[],
  ignoreHashes?: string[],
): Promise<ScanResult> {
  return request("/scan/text", {
    texts,
    ignore_hashes: ignoreHashes,
  });
}

// --- main guard ---
export async function guard(
  input: string | string[] | (() => string | Promise<string | string[]>),
  options: GuardOptions = {},
) {
  const result = typeof input === "function" ? await input() : input;

  const texts = Array.isArray(result) ? result.map(String) : [String(result)];

  const isAsync = options.async !== false;

  if (isAsync) {
    // fire-and-forget
    scanText(texts, options.ignoreHashes)
      .then((res) => {
        if (res.has_leak) {
          if (options.onResult) {
            options.onResult(res);
          } else {
            console.warn(
              "⚠️ Potential secret leak:",
              res.findings
                .map((f) => `${f.category} (${f.preview})`)
                .join(", "),
            );
          }
        }
      })
      .catch(() => {});

    return result;
  }

  // blocking mode (rare)
  const res = await scanText(texts, options.ignoreHashes);

  if (res.has_leak) {
    console.warn(
      "⚠️ Potential secret leak:",
      res.findings.map((f) => `${f.category} (${f.preview})`).join(", "),
    );
  }

  return result;
}

// --- optional helper ---
export async function sanitize(
  text: string | string[],
  options?: GuardOptions,
) {
  return guard(text, options);
}
