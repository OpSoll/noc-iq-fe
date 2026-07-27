import { refreshAccessToken } from "@/services/auth.service";

export type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type FetchMiddleware = (
  input: RequestInfo | URL,
  init: RequestInit,
  next: FetchFunction,
) => Promise<Response>;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "";

const generateCorrelationId = (): string => {
  return crypto.randomUUID();
};

const getAccessToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem("accessToken");
};

const authMiddleware: FetchMiddleware = async (
  input,
  init,
  next,
) => {
  const headers = new Headers(init.headers);

  const accessToken = getAccessToken();

  if (accessToken) {
    headers.set(
      "Authorization",
      `Bearer ${accessToken}`,
    );
  }

  return next(input, {
    ...init,
    headers,
  });
};

const correlationMiddleware: FetchMiddleware =
  async (input, init, next) => {
    const headers = new Headers(init.headers);

    headers.set(
      "X-Correlation-ID",
      generateCorrelationId(),
    );

    return next(input, {
      ...init,
      headers,
    });
  };

const errorMiddleware: FetchMiddleware = async (
  input,
  init,
  next,
) => {
  const response = await next(input, init);

  if (response.ok) {
    return response;
  }

  let details: unknown;

  try {
    details = await response.json();
  } catch {
    details = undefined;
  }

  const message =
    typeof details === "object" &&
    details !== null &&
    "message" in details &&
    typeof details.message === "string"
      ? details.message
      : response.statusText ||
        "An API request failed";

  throw new ApiError(
    message,
    response.status,
    undefined,
    details,
  );
};