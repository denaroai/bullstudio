export function getPathname(url: string): string {
  return new URL(toAbsoluteUrl(url)).pathname;
}

export function toAbsoluteUrl(url: string): string {
  return URL.canParse(url) ? url : `http://bullstudio.local${url}`;
}
