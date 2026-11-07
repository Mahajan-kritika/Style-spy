globalThis.StyleSpy = globalThis.StyleSpy || {};

StyleSpy.copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(String(text));
  } catch (error) {
    const field = document.createElement("textarea");
    field.value = String(text);
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied) throw error;
  }
};
