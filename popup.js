(() => {
  const $ = (selector) => document.querySelector(selector);
  const state = { data: null, kits: [], activeKitId: null };
  let toastTimer;

  const notify = (message) => {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
  };

  const setStatus = (message = "") => {
    const status = $("#status");
    status.textContent = message;
    status.classList.toggle("visible", Boolean(message));
  };

  const copy = async (value, label) => {
    try {
      await StyleSpy.copyText(value);
      notify(`${label} copied!`);
    } catch (error) {
      console.error("Style Spy could not copy to clipboard:", error);
      notify("Could not copy. Check clipboard permissions.");
    }
  };

  const getCurrentTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  };

  const getDisplayedData = () =>
    state.kits.find((kit) => kit.id === state.activeKitId) || state.data;

  const scanPage = async () => {
    setStatus("");
    $("#domain").textContent = "Scanning visible styles…";
    try {
      const tab = await getCurrentTab();
      if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) {
        throw new Error("Style Spy can scan regular HTTP and HTTPS pages, but not this browser page.");
      }
      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { type: "STYLE_SPY_EXTRACT" });
      } catch {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["scripts/extractor.js"] });
        response = await chrome.tabs.sendMessage(tab.id, { type: "STYLE_SPY_EXTRACT" });
      }
      if (!response?.ok) throw new Error(response?.error || "The page could not be analysed.");
      state.data = response.data;
      state.activeKitId = null;
      $("#domain").textContent = response.data.domain || "Current website";
      renderExtraction();
      renderPreview(state.data, "Current page");
      fillPreviewChoices();
      setStatus(response.data.scannedElements === 0 ? "No visible page elements found." : "");
    } catch (error) {
      state.data = null;
      state.activeKitId = null;
      $("#domain").textContent = "Page unavailable";
      renderExtraction();
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const renderExtraction = (data = getDisplayedData()) => {
    const colourList = $("#colours-list");
    const fontsList = $("#fonts-list");
    colourList.replaceChildren();
    fontsList.replaceChildren();
    $("#families").replaceChildren();
    $("#colour-summary").textContent = data
      ? `${data.colours.length} colours · ranked by visible usage${data.truncated ? " · scan capped at 12,000 elements" : ""}`
      : "Ranked by visible usage";
    $("#font-summary").textContent = data ? `${data.fonts.length} common text styles` : "Common visible text styles";

    for (const colour of data?.colours || []) {
      const row = document.createElement("div");
      row.className = "colour-item";
      const swatch = document.createElement("button");
      swatch.className = "swatch";
      swatch.type = "button";
      swatch.title = `Copy ${colour.hex}`;
      swatch.style.backgroundColor = colour.hex;
      swatch.addEventListener("click", () => copy(colour.hex, colour.hex));
      const values = document.createElement("div");
      values.className = "colour-values";
      const hex = document.createElement("button");
      hex.className = "hex-value";
      hex.textContent = colour.hex;
      hex.addEventListener("click", () => copy(colour.hex, colour.hex));
      const rgb = document.createElement("button");
      rgb.className = "rgb-value";
      rgb.textContent = colour.rgb;
      rgb.addEventListener("click", () => copy(colour.rgb, "RGB value"));
      values.append(hex, rgb);
      const usage = document.createElement("span");
      usage.className = "usage";
      usage.textContent = `${colour.count} uses · ${colour.percentage}%`;
      row.append(swatch, values, usage);
      colourList.append(row);
    }

    const gradients = $("#gradients");
    gradients.replaceChildren();
    if (data?.gradients?.length) {
      gradients.hidden = false;
      gradients.textContent = `Gradients detected separately: ${data.gradients.length} styles`;
      for (const gradient of data.gradients) {
        const item = document.createElement("button");
        item.className = "font-property";
        item.textContent = `Gradient · ${gradient.count} uses`;
        item.title = gradient.value;
        item.addEventListener("click", () => copy(gradient.value, "Gradient"));
        gradients.append(" ", item);
      }
    } else {
      gradients.hidden = true;
    }

    for (const family of data?.families || []) {
      const chip = document.createElement("button");
      chip.className = "family-chip";
      chip.textContent = family.family.split(",")[0].replace(/^['"]|['"]$/g, "");
      chip.title = `${family.family} · ${family.count} uses`;
      chip.addEventListener("click", () => copy(family.family, "Font family"));
      $("#families").append(chip);
    }

    for (const font of data?.fonts || []) {
      const card = document.createElement("article");
      card.className = "font-card";
      const head = document.createElement("div");
      head.className = "font-card-head";
      const sample = document.createElement("span");
      sample.className = "font-sample";
      sample.textContent = font.role === "heading" ? "Heading sample" : font.role === "button" ? "Button sample" : "Typography sample";
      sample.style.fontFamily = font.family;
      sample.style.fontWeight = font.weight;
      sample.style.fontSize = "12px";
      const count = document.createElement("span");
      count.className = "font-count";
      count.textContent = `${font.count} uses`;
      head.append(sample, count);
      const properties = document.createElement("div");
      properties.className = "font-properties";
      const property = (label, value, title = label) => {
        const button = document.createElement("button");
        button.className = "font-property";
        button.textContent = `${label}: ${value || "normal"}`;
        button.title = `Copy ${title}`;
        button.addEventListener("click", () => copy(value || "normal", title));
        properties.append(button);
      };
      property("Family", font.family, "font family");
      property("Weight", font.weight, "font weight");
      property("Size", font.size, "font size");
      property("Line", font.lineHeight, "line height");
      if (font.colour) {
        const colourButton = document.createElement("button");
        colourButton.className = "font-property colour-property";
        colourButton.title = "Copy text colour";
        const dot = document.createElement("span");
        dot.className = "tiny-swatch";
        dot.style.backgroundColor = font.colour;
        colourButton.append(dot, document.createTextNode(font.colour));
        colourButton.addEventListener("click", () => copy(font.colour, "Text colour"));
        properties.append(colourButton);
      }
      card.append(head, properties);
      fontsList.append(card);
    }

    $("#copy-colours").disabled = !data?.colours.length;
    $("#copy-fonts").disabled = !data?.fonts.length;
    $("#save-kit").disabled = !data;
    $("#copy-css-current").disabled = !data;
  };

  const makeKit = (name, data = state.data) => ({
    id: crypto.randomUUID(),
    name,
    domain: data.domain,
    createdAt: new Date().toISOString(),
    colours: data.colours,
    fonts: data.fonts,
    families: data.families,
    gradients: data.gradients
  });

  const renderPreview = (kit, name) => {
    if (!kit) return;
    const colours = kit.colours || [];
    const getRole = (role) => colours.reduce((best, colour) =>
      (colour.roles?.[role] || 0) > (best?.roles?.[role] || 0) ? colour : best, null)?.hex;
    const preview = $("#preview");
    preview.style.setProperty("--p-bg", getRole("background") || "#f2f2f5");
    preview.style.setProperty("--p-card", getRole("background") || "#ffffff");
    preview.style.setProperty("--p-text", getRole("text") || getRole("heading") || "#242632");
    preview.style.setProperty("--p-muted", getRole("text") || "#777b86");
    preview.style.setProperty("--p-primary", colours[0]?.hex || "#6254d9");
    preview.style.setProperty("--p-secondary", colours[1]?.hex || colours[0]?.hex || "#e8e5ff");
    preview.style.removeProperty("--p-heading");
    preview.style.removeProperty("--p-heading-weight");
    preview.style.removeProperty("--p-body");
    const heading = kit.fonts?.find((font) => font.role === "heading") || kit.fonts?.[0];
    const body = kit.fonts?.find((font) => font.role === "body") || kit.fonts?.[0];
    if (heading) {
      preview.style.setProperty("--p-heading", StyleSpy.cssFontStack(heading.family));
      preview.style.setProperty("--p-heading-weight", heading.weight);
    }
    if (body) preview.style.setProperty("--p-body", StyleSpy.cssFontStack(body.family));
    $("#preview-name").textContent = name || kit.name || "Current page";
  };

  const fillPreviewChoices = () => {
    const select = $("#preview-kit");
    select.replaceChildren();
    const current = document.createElement("option");
    current.value = "current";
    current.textContent = "Current page";
    select.append(current);
    for (const kit of state.kits) {
      const option = document.createElement("option");
      option.value = kit.id;
      option.textContent = kit.name;
      select.append(option);
    }
    select.value = state.activeKitId || "current";
  };

  const renderKits = () => {
    const container = $("#kits-list");
    container.replaceChildren();
    $("#kit-count").textContent = String(state.kits.length);
    $("#empty-kits").hidden = state.kits.length > 0;
    for (const kit of state.kits) {
      const card = document.createElement("article");
      card.className = "kit-card";
      const main = document.createElement("div");
      main.className = "kit-main";
      main.tabIndex = 0;
      main.setAttribute("role", "button");
      const name = document.createElement("span");
      name.className = "kit-name";
      name.textContent = kit.name;
      const meta = document.createElement("span");
      meta.className = "kit-meta";
      meta.textContent = `${kit.domain} · ${new Date(kit.createdAt).toLocaleDateString()}`;
      const swatches = document.createElement("span");
      swatches.className = "kit-swatches";
      for (const colour of (kit.colours || []).slice(0, 6)) {
        const dot = document.createElement("span");
        dot.style.backgroundColor = colour.hex;
        dot.title = colour.hex;
        swatches.append(dot);
      }
      main.append(name, meta, swatches);
      const open = () => {
        state.activeKitId = kit.id;
        renderExtraction(kit);
        renderPreview(kit, kit.name);
        fillPreviewChoices();
        $("#preview-kit").value = kit.id;
      };
      main.addEventListener("click", open);
      main.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      });

      const actions = document.createElement("div");
      actions.className = "kit-actions";
      const action = (label, handler, title) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.title = title;
        button.addEventListener("click", handler);
        actions.append(button);
      };
      action("Open", open, "Preview this kit");
      action("Rename", () => renameKit(kit), "Rename kit");
      action("Export", () => exportKit(kit), "Download CSS");
      action("×", () => deleteKit(kit), "Delete kit");
      card.append(main, actions);
      container.append(card);
    }
  };

  const reloadKits = async () => {
    state.kits = await StyleSpy.getKits();
    renderKits();
    fillPreviewChoices();
  };

  const saveKit = async () => {
    if (!state.data) return;
    const name = window.prompt("Name this design kit:");
    if (name === null) return;
    const cleaned = name.trim();
    if (!cleaned) return notify("Enter a kit name to save.");
    if (state.kits.some((kit) => kit.name.toLocaleLowerCase() === cleaned.toLocaleLowerCase())) {
      return notify("A kit with that name already exists. Choose another name.");
    }
    try {
      const kit = makeKit(cleaned);
      state.kits.unshift(kit);
      await StyleSpy.saveKits(state.kits);
      state.activeKitId = kit.id;
      renderKits();
      fillPreviewChoices();
      $("#preview-kit").value = kit.id;
      renderPreview(kit, kit.name);
      notify("Design kit saved on this device.");
    } catch (error) {
      console.error("Style Spy could not save the kit:", error);
      state.kits = await StyleSpy.getKits();
      renderKits();
      notify("Could not save this kit.");
    }
  };

  const renameKit = async (kit) => {
    const name = window.prompt("Rename design kit:", kit.name);
    if (name === null) return;
    const cleaned = name.trim();
    if (!cleaned) return notify("Enter a kit name.");
    if (state.kits.some((item) => item.id !== kit.id && item.name.toLocaleLowerCase() === cleaned.toLocaleLowerCase())) {
      return notify("A kit with that name already exists.");
    }
    const updated = state.kits.map((item) => item.id === kit.id ? { ...item, name: cleaned } : item);
    try {
      await StyleSpy.saveKits(updated);
      state.kits = updated;
      if (state.activeKitId === kit.id) $("#preview-name").textContent = cleaned;
      renderKits();
      fillPreviewChoices();
      if (state.activeKitId === kit.id) $("#preview-kit").value = kit.id;
      notify("Kit renamed.");
    } catch (error) {
      console.error("Style Spy could not rename the kit:", error);
      notify("Could not rename this kit.");
    }
  };

  const deleteKit = async (kit) => {
    if (!window.confirm(`Delete “${kit.name}”? This cannot be undone.`)) return;
    try {
      const updated = state.kits.filter((item) => item.id !== kit.id);
      await StyleSpy.saveKits(updated);
      state.kits = updated;
      if (state.activeKitId === kit.id) {
        state.activeKitId = null;
        if (state.data) {
          renderExtraction(state.data);
          renderPreview(state.data, "Current page");
        } else {
          renderExtraction(null);
        }
      }
      renderKits();
      fillPreviewChoices();
      notify("Kit deleted.");
    } catch (error) {
      console.error("Style Spy could not delete the kit:", error);
      notify("Could not delete this kit.");
    }
  };

  const exportKit = async (kit) => {
    try {
      await StyleSpy.downloadCss(kit);
      notify("CSS export started.");
    } catch (error) {
      console.error("Style Spy could not export the kit:", error);
      notify("Could not export CSS.");
    }
  };

  const copyAllColours = () => {
    const data = getDisplayedData();
    if (data?.colours.length) {
      copy(data.colours.map((colour) => `${colour.hex}  ${colour.rgb}  (${colour.count} uses)`).join("\n"), "Colours");
    }
  };

  const copyAllFonts = () => {
    const data = getDisplayedData();
    if (data?.fonts.length) {
      copy(data.fonts.map((font) =>
        `${font.role}: ${font.family} · ${font.weight} · ${font.size} · line-height ${font.lineHeight} · ${font.colour}`
      ).join("\n"), "Fonts");
    }
  };

  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === `panel-${tab.dataset.panel}`));
  }));
  $("#refresh").addEventListener("click", scanPage);
  $("#save-kit").addEventListener("click", saveKit);
  $("#copy-colours").addEventListener("click", copyAllColours);
  $("#copy-fonts").addEventListener("click", copyAllFonts);
  $("#copy-css-current").addEventListener("click", () => {
    const data = getDisplayedData();
    if (data) copy(StyleSpy.cssForKit(makeKit("Current page", data)), "CSS variables");
  });
  $("#preview-kit").addEventListener("change", (event) => {
    if (event.target.value === "current") {
      state.activeKitId = null;
      renderExtraction(state.data);
      if (state.data) renderPreview(state.data, "Current page");
    } else {
      const kit = state.kits.find((item) => item.id === event.target.value);
      if (kit) {
        state.activeKitId = kit.id;
        renderExtraction(kit);
        renderPreview(kit, kit.name);
      }
    }
  });

  (async () => {
    try {
      await reloadKits();
    } catch (error) {
      console.error("Style Spy could not read saved kits:", error);
      setStatus("Could not read saved kits from Chrome storage.");
    }
    await scanPage();
  })();
})();
