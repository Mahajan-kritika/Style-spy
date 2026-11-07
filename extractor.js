(() => {
  if (globalThis.__styleSpyExtractorInstalled) return;
  globalThis.__styleSpyExtractorInstalled = true;

  const normalizeColor = (value) => {
    const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)%?)?\s*\)$/i);
    if (!match) return null;
    const alpha = match[4] === undefined ? 1 : Number(match[4]);
    if (alpha <= 0.01) return null;
    const channels = match.slice(1, 4).map((part) => Math.max(0, Math.min(255, Math.round(Number(part)))));
    const hex = `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    return {
      hex,
      rgb: `rgb(${channels.join(", ")})`
    };
  };

  const extract = async () => {
    const colours = new Map();
    const fonts = new Map();
    const families = new Map();
    const gradients = new Map();
    const nodes = document.body
      ? [document.documentElement, document.body, ...document.body.querySelectorAll("*")]
      : [];
    const limit = Math.min(nodes.length, 12000);
    let visited = 0;

    const addColour = (value, role) => {
      const colour = normalizeColor(value);
      if (!colour) return;
      const entry = colours.get(colour.hex) || { ...colour, count: 0, roles: {} };
      entry.count += 1;
      entry.roles[role] = (entry.roles[role] || 0) + 1;
      colours.set(colour.hex, entry);
    };

    for (let index = 0; index < limit; index += 1) {
      if (index > 0 && index % 400 === 0) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const element = nodes[index];
      if (!(element instanceof HTMLElement)) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.right < 0 ||
          rect.top > innerHeight || rect.left > innerWidth) continue;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" ||
          Number(style.opacity) === 0 || style.contentVisibility === "hidden") continue;
      if (typeof element.checkVisibility === "function" &&
          !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      visited += 1;

      const tag = element.tagName.toLowerCase();
      const role = tag === "a" ? "link" :
        (/^h[1-6]$/.test(tag) ? "heading" :
          (tag === "button" || element.getAttribute("role") === "button" ? "button" : "other"));
      addColour(style.backgroundColor, "background");
      addColour(style.color, role === "other" ? "text" : role);
      for (const side of ["Top", "Right", "Bottom", "Left"]) {
        if (style[`border${side}Style`] !== "none" && style[`border${side}Style`] !== "hidden" &&
            parseFloat(style[`border${side}Width`]) > 0) {
          addColour(style[`border${side}Color`], "border");
        }
      }

      if (style.backgroundImage && style.backgroundImage !== "none" &&
          /gradient\(/i.test(style.backgroundImage)) {
        const key = style.backgroundImage;
        gradients.set(key, (gradients.get(key) || 0) + 1);
      }

      const hasDirectText = Array.from(element.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
      );
      if (hasDirectText || (element.children.length === 0 && element.textContent.trim())) {
        const family = style.fontFamily.trim();
        const weight = style.fontWeight;
        const size = style.fontSize;
        const lineHeight = style.lineHeight;
        const textColour = normalizeColor(style.color)?.hex || "";
        const key = [family, weight, size, lineHeight, textColour].join("|");
        const fontRole = /^h[1-6]$/.test(tag) ? "heading" :
          (tag === "button" || element.getAttribute("role") === "button" ? "button" : "body");
        const entry = fonts.get(key) || {
          family,
          weight,
          size,
          lineHeight,
          colour: textColour,
          count: 0,
          roles: {}
        };
        entry.count += 1;
        entry.roles[fontRole] = (entry.roles[fontRole] || 0) + 1;
        fonts.set(key, entry);
        families.set(family, (families.get(family) || 0) + 1);
      }

    }

    const colourList = [...colours.values()].sort((a, b) => b.count - a.count);
    const totalColourUses = colourList.reduce((total, colour) => total + colour.count, 0) || 1;
    const fontList = [...fonts.values()]
      .map(({ roles, ...font }) => ({
        ...font,
        role: Object.entries(roles).sort((a, b) => b[1] - a[1])[0]?.[0] || "body"
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    return {
      domain: location.hostname,
      capturedAt: new Date().toISOString(),
      scannedElements: visited,
      truncated: nodes.length > limit,
      colours: colourList.slice(0, 60).map((colour) => ({
        ...colour,
        percentage: Math.round((colour.count / totalColourUses) * 1000) / 10
      })),
      fonts: fontList,
      families: [...families.entries()]
        .map(([family, count]) => ({ family, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
      gradients: [...gradients.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([value, count]) => ({ value, count }))
    };
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "STYLE_SPY_EXTRACT") return false;
    extract()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    return true;
  });
})();
