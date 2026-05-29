import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  DashboardProtection,
  FrameworkRequest,
  FrameworkResponse,
  SessionDashboardProtection,
} from "./types";
import { toAbsoluteUrl } from "./url";

const DEFAULT_COOKIE_NAME = "bullstudio_session";
const DEFAULT_TOKEN_TTL_SECONDS = 24 * 60 * 60;

interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

export function isCredentialProtection(
  protection: DashboardProtection,
): protection is SessionDashboardProtection {
  return protection.type === "session" || protection.type === "basic";
}

export async function handleDashboardAuthRequest(
  protection: DashboardProtection,
  request: FrameworkRequest,
): Promise<FrameworkResponse | null> {
  const pathname = new URL(toAbsoluteUrl(request.url)).pathname;

  if (!pathname.startsWith("/api/auth/")) {
    return null;
  }

  if (!isCredentialProtection(protection)) {
    return jsonResponse({ authEnabled: false, authenticated: true });
  }

  if (pathname === "/api/auth/session" && request.method === "GET") {
    const session = verifySessionCookie(request, protection);
    return jsonResponse(
      session
        ? { authEnabled: true, authenticated: true, username: session.sub }
        : { authEnabled: true, authenticated: false },
    );
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    const credentials = parseLoginBody(request.body);

    if (
      credentials.username !== protection.username ||
      credentials.password !== protection.password
    ) {
      return jsonResponse({ error: "Invalid username or password." }, 401);
    }

    const now = Math.floor(Date.now() / 1000);
    const ttl = protection.tokenTtlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;
    const token = signSessionToken(
      {
        sub: protection.username,
        iat: now,
        exp: now + ttl,
      },
      getSessionSecret(protection),
    );

    return jsonResponse(
      {
        authEnabled: true,
        authenticated: true,
        username: protection.username,
      },
      200,
      {
        "Set-Cookie": serializeCookie(getCookieName(protection), token, {
          httpOnly: true,
          maxAge: ttl,
          path: getCookiePath(request),
          sameSite: "Lax",
        }),
      },
    );
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return jsonResponse({ authEnabled: true, authenticated: false }, 200, {
      "Set-Cookie": serializeCookie(getCookieName(protection), "", {
        httpOnly: true,
        maxAge: 0,
        path: getCookiePath(request),
        sameSite: "Lax",
      }),
    });
  }

  return {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: "Not Found",
  };
}

export function getAuthenticatedSession(
  protection: DashboardProtection,
  request: FrameworkRequest,
): { authenticated: boolean; username?: string } {
  if (!isCredentialProtection(protection)) {
    return { authenticated: true };
  }

  const session = verifySessionCookie(request, protection);

  return session
    ? { authenticated: true, username: session.sub }
    : { authenticated: false };
}

export function isPublicDashboardRequest(request: FrameworkRequest): boolean {
  const pathname = new URL(toAbsoluteUrl(request.url)).pathname;

  return (
    pathname === "/login" ||
    pathname.startsWith("/assets/") ||
    pathname === "/logo.svg" ||
    pathname.startsWith("/api/auth/")
  );
}

export function getLoginRedirectResponse(
  request: FrameworkRequest,
): FrameworkResponse {
  const url = new URL(toAbsoluteUrl(request.url));
  const currentPath = `${url.pathname}${url.search}`;
  const redirect =
    currentPath === "/" || currentPath.startsWith("/login")
      ? ""
      : `?redirect=${encodeURIComponent(currentPath)}`;

  return {
    status: 302,
    headers: {
      Location: `${getCookiePath(request).replace(/\/$/, "")}/login${redirect}`,
    },
  };
}

function verifySessionCookie(
  request: FrameworkRequest,
  protection: SessionDashboardProtection,
): SessionPayload | null {
  const token = getCookie(request, getCookieName(protection));

  if (!token) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(
    `${encodedHeader}.${encodedPayload}`,
    getSessionSecret(protection),
  );

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.sub !== protection.username ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.exp <= now
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function signSessionToken(payload: SessionPayload, secret: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${header}.${body}`;

  return `${unsignedToken}.${sign(unsignedToken, secret)}`;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getCookie(
  request: FrameworkRequest,
  cookieName: string,
): string | undefined {
  const cookie = getHeader(request.headers, "cookie");

  if (!cookie) {
    return undefined;
  }

  for (const pair of cookie.split(";")) {
    const separator = pair.indexOf("=");
    const name =
      separator === -1 ? pair.trim() : pair.slice(0, separator).trim();

    if (name === cookieName) {
      return separator === -1 ? "" : pair.slice(separator + 1).trim();
    }
  }

  return undefined;
}

function parseLoginBody(body: unknown): {
  username?: string;
  password?: string;
} {
  const text =
    typeof body === "string"
      ? body
      : body instanceof Uint8Array
        ? Buffer.from(body).toString("utf8")
        : "";

  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text) as {
      username?: unknown;
      password?: unknown;
    };
    return {
      username:
        typeof parsed.username === "string" ? parsed.username : undefined,
      password:
        typeof parsed.password === "string" ? parsed.password : undefined,
    };
  } catch {
    return {};
  }
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): FrameworkResponse {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly: boolean;
    maxAge: number;
    path: string;
    sameSite: "Lax";
  },
): string {
  return [
    `${name}=${value}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
    options.httpOnly ? "HttpOnly" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function getCookieName(protection: SessionDashboardProtection): string {
  return protection.cookieName ?? DEFAULT_COOKIE_NAME;
}

function getSessionSecret(protection: SessionDashboardProtection): string {
  return protection.sessionSecret ?? protection.password;
}

function getCookiePath(request: FrameworkRequest): string {
  if (!request.basePath || request.basePath === "/") {
    return "/";
  }

  return `/${request.basePath.replace(/^\/+|\/+$/g, "")}`;
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
