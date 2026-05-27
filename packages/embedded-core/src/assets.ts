import type {
  DashboardIdentity,
  DashboardLogo,
  DocumentIdentity,
  FrameworkRequest,
  FrameworkResponse,
  ResolvedDashboardConfig,
} from "./types";
import { getPathname } from "./url";

export async function handleDashboardAsset(
  request: FrameworkRequest,
  config: ResolvedDashboardConfig,
): Promise<FrameworkResponse> {
  const pathname = getPathname(request.url);

  if (request.method === "GET" || request.method === "HEAD") {
    if (pathname.endsWith("/assets/app.js")) {
      return {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Type": "application/javascript; charset=utf-8",
        },
        body:
          request.method === "HEAD"
            ? undefined
            : `window.__BULLSTUDIO__=${JSON.stringify({
                mode: "embedded",
                dashboardIdentity: config.dashboardIdentity,
                documentIdentity: config.documentIdentity,
              })};`,
      };
    }

    return {
      status: 200,
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/html; charset=utf-8",
      },
      body:
        request.method === "HEAD"
          ? undefined
          : `<!doctype html><html><head><title>${escapeHtml(
              config.documentIdentity.title,
            )}</title>${renderFavicon(
              config.documentIdentity,
            )}<script type="module" src="./assets/app.js"></script></head><body><div id="root">${renderDashboardIdentity(
              config.dashboardIdentity,
            )}</div></body></html>`,
    };
  }

  return {
    status: 405,
    headers: {
      Allow: "GET, HEAD",
    },
    body: "Method Not Allowed",
  };
}

function renderFavicon(identity: DocumentIdentity): string {
  if (!identity.favicon) {
    return "";
  }

  return `<link rel="icon" href="${escapeHtml(identity.favicon)}">`;
}

function renderDashboardIdentity(identity: DashboardIdentity): string {
  return `${renderDashboardLogo(identity.logo)}<span>${escapeHtml(
    identity.title,
  )}</span>`;
}

function renderDashboardLogo(logo: DashboardLogo | undefined): string {
  if (!logo) {
    return "";
  }

  return `<img src="${escapeHtml(logo.src)}" alt="${escapeHtml(logo.alt)}">`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}
