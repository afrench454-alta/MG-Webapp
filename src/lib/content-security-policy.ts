export function reportOnlyContentPolicy(serviceUrl: string | undefined, development: boolean): string {
  let serviceOrigin = "";
  try {
    const url = serviceUrl ? new URL(serviceUrl) : null;
    if (url && (url.protocol === "https:" || url.protocol === "http:")) {
      serviceOrigin = url.origin;
    }
  } catch {
    // An invalid Supabase URL contributes no source expressions.
  }

  const developmentScript = development ? " 'unsafe-eval' https://va.vercel-scripts.com" : "";
  const storagePhotos = serviceOrigin ? ` ${serviceOrigin}/storage/v1/object/sign/` : "";
  const serviceConnection = serviceOrigin ? ` ${serviceOrigin}` : "";

  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self'${developmentScript}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${storagePhotos}`,
    "font-src 'self'",
    `connect-src 'self'${serviceConnection}`,
    "manifest-src 'self'",
    "worker-src 'self'",
  ].join("; ");
}
