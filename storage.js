globalThis.StyleSpy = globalThis.StyleSpy || {};

StyleSpy.getKits = async () => {
  const result = await chrome.storage.local.get({ kits: [] });
  return Array.isArray(result.kits) ? result.kits : [];
};

StyleSpy.saveKits = async (kits) => chrome.storage.local.set({ kits });
