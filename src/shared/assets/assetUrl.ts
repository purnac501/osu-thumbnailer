export function resolveAssetUrl(path: string | undefined): string | undefined {
    if (!path)
        return path;
    if (path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("data:") ||
        path.startsWith("blob:")) {
        return path;
    }
    const base = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL
        ? import.meta.env.BASE_URL
        : "/";
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${normalizedBase}${cleanPath}`;
}
