const API_ROOT = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload?.error
        ? payload.error
        : "Something went wrong.";
    throw new Error(message);
  }

  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body || {}),
    }),
  patch: (path, body) =>
    request(path, {
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body || {}),
    }),
  delete: (path) =>
    request(path, {
      method: "DELETE",
    }),
};
