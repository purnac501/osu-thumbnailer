const loadedFonts = new Set<string>();

/**
 * Dynamically loads a Google Font by adding a <link> stylesheet on demand.
 */
export function loadGoogleFont(fontFamily: string): Promise<void> {
  const cleanName = fontFamily.trim().replace(/['"]/g, "");
  if (!cleanName || loadedFonts.has(cleanName)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      return resolve();
    }

    const fontQuery = cleanName.replace(/ /g, "+");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}:wght@400;600;700;800;900&display=swap`;
    link.onload = () => {
      loadedFonts.add(cleanName);
      if (document.fonts) {
        document.fonts.ready.then(() => resolve());
      } else {
        resolve();
      }
    };
    link.onerror = () => {
      // Graceful fallback if offline or font not found
      loadedFonts.add(cleanName);
      resolve();
    };
    document.head.appendChild(link);
  });
}

/**
 * Registers a custom local font from a Blob or URL using CSS @font-face.
 */
export function registerCustomFont(fontName: string, fontUrl: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  const fontFace = new FontFace(fontName, `url("${fontUrl}")`);
  return fontFace.load().then((loaded) => {
    document.fonts.add(loaded);
    loadedFonts.add(fontName);
  }).catch((err) => {
    console.warn(`Could not load custom font ${fontName}:`, err);
  });
}
