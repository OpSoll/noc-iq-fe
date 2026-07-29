export type NormalizedError = {
  message: string;
  status?: number;
  correlationId?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeApiError(error: unknown): NormalizedError {
  // Axios-style response
  const response = isObject(error) ? error.response : undefined;
  const responseData = isObject(response) ? response.data : undefined;
  const responseHeaders = isObject(response) ? response.headers : undefined;

  const correlationId =
    (isObject(responseHeaders)
      ? responseHeaders["x-correlation-id"]
      : undefined) ||
    (isObject(responseData) ? responseData.correlationId : undefined) ||
    (isObject(responseData) ? responseData.requestId : undefined);

  const message =
    (isObject(responseData) ? responseData.message : undefined) ||
    (isObject(error) ? error.message : undefined) ||
    "Something went wrong";

  return {
    message: typeof message === "string" ? message : "Something went wrong",
    status: isObject(response)
      ? typeof response.status === "number"
        ? response.status
        : undefined
      : undefined,
    correlationId:
      typeof correlationId === "string" ? correlationId : undefined,
  };
}
