(() => {
  const { nowIso } = window.KeepyUtils;

  const STORAGE_KEY = "keepy:data:v1";
  const THEME_KEY = "keepy:theme";
  const APP_VERSION = "0.6.2";
  const SYNC_URL_KEY = "keepy:syncUrl";

  function defaultData() {
    const created = nowIso();
    return {
      version: 1,
      appVersion: APP_VERSION,
      updatedAt: created,
      categories: [
        {
          id: "cat_general",
          name: "General",
          color: "#7C3AED",
          icon: "bookmark",
          createdAt: created,
          updatedAt: created,
        },
      ],
      notes: [],
    };
  }

  function validateDataShape(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.version !== 1) return null;
  if (!Array.isArray(raw.categories) || !Array.isArray(raw.notes)) return null;
  return raw;
  }

  function loadData() {
  const s = localStorage.getItem(STORAGE_KEY);
  if (!s) return defaultData();
  try {
    const parsed = JSON.parse(s);
    const valid = validateDataShape(parsed);
    if (!valid) return defaultData();
    // Normaliza campos nuevos
    if (!valid.appVersion) valid.appVersion = APP_VERSION;
    return valid;
  } catch {
    return defaultData();
  }
  }

  function saveData(data) {
  const toSave = { ...data, updatedAt: nowIso() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  return toSave;
  }

  function loadTheme() {
  return localStorage.getItem(THEME_KEY);
  }

  function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  }

  function loadSyncUrl() {
    return localStorage.getItem(SYNC_URL_KEY);
  }

  function saveSyncUrl(url) {
    localStorage.setItem(SYNC_URL_KEY, url);
  }

  window.KeepyStorage = {
    STORAGE_KEY,
    THEME_KEY,
    APP_VERSION,
    SYNC_URL_KEY,
    defaultData,
    validateDataShape,
    loadData,
    saveData,
    loadTheme,
    saveTheme,
    loadSyncUrl,
    saveSyncUrl,
  };
})();

