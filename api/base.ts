export interface ApiResponse<T> {
  data: T | null;
  error: string | undefined;
  status: number | null;
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiCall<T>(
  url: string,
  options: FetchOptions = {},
): Promise<ApiResponse<T>> {
  const { timeoutMs = 8000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {}
      return {
        data: null,
        error: `HTTP ${response.status}: ${errorMessage}`,
        status: response.status,
      };
    }

    if (response.status === 204) {
      return { data: null, error: undefined, status: response.status };
    }

    const data = (await response.json()) as T;
    return { data, error: undefined, status: response.status };
  } catch (error) {
    clearTimeout(timeoutId);

    let message = "An unknown network error occurred";
    if (error instanceof Error) {
      message =
        error.name === "AbortError"
          ? "The request timed out. Please check your connection."
          : error.message;
    }

    return { data: null, error: message, status: null };
  }
}
