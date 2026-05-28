interface BullstudioRuntimeConfig {
  mode?: "embedded";
  basePath?: string;
  dashboardIdentity?: {
    title: string;
    logo?: {
      src: string;
      alt: string;
    };
  };
  documentIdentity?: {
    title: string;
    favicon?: string;
  };
}

declare global {
  interface Window {
    __BULLSTUDIO__?: BullstudioRuntimeConfig;
  }
}

export function getBasePath(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return normalizeBasePath(window.__BULLSTUDIO__?.basePath);
}

export function getApiUrl(): string {
  const basePath = getBasePath();

  if (typeof window !== "undefined") {
    return `${window.location.origin}${basePath}/api/trpc`;
  }

  return `${basePath}/api/trpc`;
}

export function getAssetUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${getBasePath()}${normalizedPath}`;
}

export function getDashboardIdentity() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.__BULLSTUDIO__?.dashboardIdentity;
}

export function getDocumentIdentity() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.__BULLSTUDIO__?.documentIdentity;
}

function normalizeBasePath(basePath: string | undefined): string {
  if (!basePath || basePath === "/") {
    return "";
  }

  return `/${basePath.replace(/^\/+|\/+$/g, "")}`;
}
