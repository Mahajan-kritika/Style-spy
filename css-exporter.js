globalThis.StyleSpy = globalThis.StyleSpy || {};

StyleSpy.cssForKit = (kit) => {
  const colours = Array.isArray(kit.colours) ? kit.colours : [];
  const fonts = Array.isArray(kit.fonts) ? kit.fonts : [];
  const findColour = (role) => colours.reduce((best, colour) =>
    (colour.roles?.[role] || 0) > (best?.roles?.[role] || 0) ? colour : best, null)?.hex;
  const heading = fonts.find((font) => font.role === "heading") || fonts[0];
  const body = fonts.find((font) => font.role === "body") || fonts[0];

  const lines = [":root {", "  /* Colours */"];
  colours.forEach((colour, index) => {
    if (/^#[0-9A-F]{6}$/i.test(colour.hex)) {
      lines.push(`  --color-${index + 1}: ${colour.hex.toUpperCase()};`);
    }
  });
  const aliases = [
    ["primary", colours[0]?.hex],
    ["secondary", colours[1]?.hex || colours[0]?.hex],
    ["text", findColour("text") || findColour("heading")],
    ["background", findColour("background")]
  ];
  aliases.forEach(([name, value]) => {
    if (value && /^#[0-9A-F]{6}$/i.test(value)) lines.push(`  --color-${name}: ${value.toUpperCase()};`);
  });

  lines.push("", "  /* Typography */");
  if (heading) lines.push(`  --font-heading: ${StyleSpy.cssFontStack(heading.family)};`);
  if (body) lines.push(`  --font-body: ${StyleSpy.cssFontStack(body.family)};`);
  if (heading && /^\d+$/.test(heading.weight)) lines.push(`  --font-heading-weight: ${heading.weight};`);
  if (body && /^\d+$/.test(body.weight)) lines.push(`  --font-body-weight: ${body.weight};`);
  if (heading && /^\d+(\.\d+)?px$/.test(heading.size)) lines.push(`  --font-heading-size: ${heading.size};`);
  if (body && /^\d+(\.\d+)?px$/.test(body.size)) lines.push(`  --font-body-size: ${body.size};`);
  lines.push("}");
  return lines.join("\n");
};

StyleSpy.cssFontStack = (familyList) => {
  const families = [];
  let current = "";
  let quote = "";
  for (const character of String(familyList || "sans-serif")) {
    if ((character === "'" || character === '"') && (!quote || quote === character)) {
      quote = quote ? "" : character;
      continue;
    }
    if (character === "," && !quote) {
      if (current.trim()) families.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) families.push(current.trim());
  return families.map((family) => {
    const cleaned = family.replace(/[\x00-\x1f\x7f]/g, "").trim();
    if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|emoji|math|fangsong)$/i.test(cleaned)) return cleaned;
    return `"${cleaned.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }).join(", ");
};

StyleSpy.downloadCss = async (kit) => {
  const safeName = (kit.name || "style-spy-kit")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .trim()
    .replace(/\.css$/i, "") || "style-spy-kit";
  const url = `data:text/css;charset=utf-8,${encodeURIComponent(StyleSpy.cssForKit(kit))}`;
  await chrome.downloads.download({ url, filename: `${safeName}.css`, saveAs: true });
};
