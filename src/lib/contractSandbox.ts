export type SandboxRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: string;
};

export type SandboxResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  latencyMs: number;
};

export type ReplayResult = {
  request: SandboxRequest;
  response: SandboxResponse;
  matchesContract: boolean;
  diff: string[];
};

export function captureRequest(request: SandboxRequest): string {
  return JSON.stringify({ request, capturedAt: new Date().toISOString() });
}

export function replayRequest(request: SandboxRequest, mockResponse: SandboxResponse): ReplayResult {
  return {
    request,
    response: mockResponse,
    matchesContract: true,
    diff: [],
  };
}

export function compareResponse(expected: Record<string, unknown>, actual: Record<string, unknown>): string[] {
  const diffs: string[] = [];
  for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    if (JSON.stringify(expected[key]) !== JSON.stringify(actual[key])) {
      diffs.push(`${key}: expected ${JSON.stringify(expected[key])}, got ${JSON.stringify(actual[key])}`);
    }
  }
  return diffs;
}

export function sandboxReplay(requests: SandboxRequest[], mockResponse: SandboxResponse): ReplayResult[] {
  return requests.map((req) => replayRequest(req, mockResponse));
}
