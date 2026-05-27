import type {
  BasicAuthProtection,
  DashboardProtection,
  FrameworkRequest,
  FrameworkResponse,
} from "./types";

export async function withDashboardProtection(
  protection: DashboardProtection,
  request: FrameworkRequest,
  next: () => Promise<FrameworkResponse>,
): Promise<FrameworkResponse> {
  if (protection.type !== "basic") {
    return next();
  }

  if (hasValidBasicAuth(request, protection)) {
    return next();
  }

  return {
    status: 401,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="bullstudio"',
    },
    body: "Authentication required",
  };
}

function hasValidBasicAuth(
  request: FrameworkRequest,
  protection: BasicAuthProtection,
): boolean {
  const authorization = getHeader(request.headers, "authorization");

  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  const credentials = decodeBasicAuthCredentials(authorization.slice(6));
  const separator = credentials.indexOf(":");
  const username =
    separator === -1 ? credentials : credentials.slice(0, separator);
  const password = separator === -1 ? "" : credentials.slice(separator + 1);

  return username === protection.username && password === protection.password;
}

function decodeBasicAuthCredentials(encodedCredentials: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(encodedCredentials, "base64").toString("utf8");
  }

  return atob(encodedCredentials);
}

function getHeader(
  headers: FrameworkRequest["headers"],
  name: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const normalizedName = name.toLowerCase();

  for (const [headerName, value] of Object.entries(headers)) {
    if (headerName.toLowerCase() !== normalizedName) {
      continue;
    }

    return Array.isArray(value) ? value[0] : value;
  }

  return undefined;
}
