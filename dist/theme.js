"use strict";
function setting(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
function syncBrowserPaper() {
  const body = document.body;
  const token =
    { month: "--album-sheet", year: "--archive-board" }[body?.dataset.view] ||
    "--paper";
  const color = body && getComputedStyle(body).getPropertyValue(token).trim();
  document.querySelector('meta[name="theme-color"]').content =
    color ||
    (document.documentElement.dataset.theme === "night"
      ? "#37352f"
      : "#eee8de");
}
function applyPaper(value, save = false) {
  const mode = value === "night" ? "night" : "day";
  document.documentElement.dataset.theme = mode;
  syncBrowserPaper();
  if (save) saveSetting("ottenki-theme", mode);
}
{
  const url = new URL(location.href),
    choice = url.searchParams.get("theme");
  applyPaper(
    choice || setting("ottenki-theme", "day"),
    choice === "night" || choice === "day",
  );
  if (choice) url.searchParams.delete("theme");
  if (url.searchParams.get("view") === "example")
    url.searchParams.delete("view");
  if (url.href !== location.href) history.replaceState(null, "", url);
}
window.addEventListener("storage", (e) => {
  if (e.key === "ottenki-theme") applyPaper(e.newValue);
});
