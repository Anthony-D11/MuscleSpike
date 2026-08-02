export interface ApiResponse<T> {
  data: T | null;
  error: string | undefined;
  status: number | null;
  message?: string | null;
}

export async function apiCall<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<ApiResponse<T>> {
  const { timeoutMs = 8000, body, headers, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const isFormData = body instanceof FormData;
    const requestHeaders = new Headers(headers);

    if (!isFormData && !requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json");
    }

    let finalBody: BodyInit | undefined = undefined;
    if (body) {
      finalBody = isFormData ? body : JSON.stringify(body);
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: requestHeaders,
      body: finalBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        data: null,
        error: responseData.error || response.statusText,
        status: response.status,
      };
    }

    return {
      data: responseData.data as T,
      error: responseData.error || undefined,
      message: responseData.message || null,
      status: response.status,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    let message = "Network Error";

    if (error instanceof Error) {
      message =
        error.name === "AbortError" ? "Request timed out" : error.message;
    }

    return { data: null, error: message, status: null };
  }
}
