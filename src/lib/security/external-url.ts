const PRIVATE_IPV4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

export function validateServerIntegrationBaseUrl(raw: string, production = process.env.NODE_ENV === "production"): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Academy integration URL is invalid"); }
  if (url.username || url.password || url.hash) throw new Error("Academy integration URL is invalid");
  if (production && url.protocol !== "https:") throw new Error("Academy integration URL must use HTTPS");
  if (!production && !["http:", "https:"].includes(url.protocol)) throw new Error("Academy integration URL protocol is invalid");
  const hostname = url.hostname.toLowerCase();
  if (production && (hostname === "localhost" || hostname.endsWith(".local") || hostname === "::1" || PRIVATE_IPV4.test(hostname))) {
    throw new Error("Academy integration URL host is not allowed");
  }
  return url;
}
