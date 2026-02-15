const {
  STORAGE_KEY,
  APP_VERSION,
  loadData,
  saveData,
  loadTheme,
  saveTheme,
  validateDataShape,
  loadSyncUrl,
  saveSyncUrl,
} = window.KeepyStorage;
const { clampText, debounce, downloadJson, escapeHtml, isValidUrl, nowIso, parseYoutubeId, uid } = window.KeepyUtils;

const ALL_CATEGORIES_ID = "cat_all";
const NOTE_TYPES = ["youtube", "link", "quote", "text", "image", "list", "simple"];

const el = {
  app: document.querySelector(".app"),
  btnTheme: document.getElementById("btnTheme"),
  btnOpenSidebar: document.getElementById("btnOpenSidebar"),
  btnCloseSidebar: document.getElementById("btnCloseSidebar"),
  sidebar: document.getElementById("sidebar"),
  categoryList: document.getElementById("categoryList"),
  btnAddCategory: document.getElementById("btnAddCategory"),
  categoryDialog: document.getElementById("categoryDialog"),
  categoryForm: document.getElementById("categoryForm"),
  categoryDialogTitle: document.getElementById("categoryDialogTitle"),
  categoryDialogSubmit: document.getElementById("categoryDialogSubmit"),
  categoryName: document.getElementById("categoryName"),
  colorPalette: document.getElementById("colorPalette"),
  categoryContextMenu: document.getElementById("categoryContextMenu"),

  notesTitle: document.getElementById("notesTitle"),
  notesSubtitle: document.getElementById("notesSubtitle"),
  notesList: document.getElementById("notesList"),
  btnAddNote: document.getElementById("btnAddNote"),
  noteTypeDialog: document.getElementById("noteTypeDialog"),
  noteTypeForm: document.getElementById("noteTypeForm"),
  noteTypeSelect: document.getElementById("noteTypeSelect"),
  noteTitleInput: document.getElementById("noteTitleInput"),
  filterType: document.getElementById("filterType"),
  searchInput: document.getElementById("searchInput"),

  editorTitle: document.getElementById("editorTitle"),
  editorSubtitle: document.getElementById("editorSubtitle"),
  editorBody: document.getElementById("editorBody"),
  btnDeleteNote: document.getElementById("btnDeleteNote"),
  btnPinNote: document.getElementById("btnPinNote"),
  btnSaveNote: document.getElementById("btnSaveNote"),
  btnCancelNote: document.getElementById("btnCancelNote"),

  confirmDialog: document.getElementById("confirmDialog"),
  confirmTitle: document.getElementById("confirmTitle"),
  confirmText: document.getElementById("confirmText"),
  confirmForm: document.getElementById("confirmForm"),

  btnSettings: document.getElementById("btnSettings"),
  settingsMenu: document.getElementById("settingsMenu"),
  settingsWrap: document.getElementById("settingsWrap"),
  btnExport: document.getElementById("btnExport"),
  fileImport: document.getElementById("fileImport"),
  appVersion: document.getElementById("appVersion"),
  btnSync: document.getElementById("btnSync"),
  btnSyncIfNew: document.getElementById("btnSyncIfNew"),
  btnDeleteAllNotes: document.getElementById("btnDeleteAllNotes"),
  syncDialog: document.getElementById("syncDialog"),
  syncForm: document.getElementById("syncForm"),
  syncUrl: document.getElementById("syncUrl"),

  toast: document.getElementById("toast"),
};

/** @type {string|null} Id de categoría en edición; null = nueva categoría */
let editingCategoryId = null;
/** @type {string|null} Id de nota recién creada; para Cancelar = descartar */
let noteJustCreatedId = null;

/** @type {{ data: any, selectedCategoryId: string|null, selectedNoteId: string|null, search: string, filterType: string }} */
const state = {
  data: loadData(),
  selectedCategoryId: ALL_CATEGORIES_ID,
  selectedNoteId: null,
  search: "",
  filterType: "all",
};

// ---------- Theme ----------
function initTheme() {
  const saved = loadTheme();
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = saved || (prefersDark ? "dark" : "light");
  setTheme(initial);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  saveTheme(theme);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || "dark";
  setTheme(current === "dark" ? "light" : "dark");
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.toast.classList.remove("show"), 2200);
}

// ---------- Data helpers ----------
function setData(next) {
  state.data = saveData(next);
}

function getCategoryById(id) {
  return state.data.categories.find((c) => c.id === id) || null;
}

function getNoteById(id) {
  return state.data.notes.find((n) => n.id === id) || null;
}

function notesByCategory(categoryId) {
  return state.data.notes.filter((n) => n.categoryId === categoryId);
}

function computeCategoryCount(categoryId) {
  if (categoryId === ALL_CATEGORIES_ID) return state.data.notes.length;
  return state.data.notes.reduce((acc, n) => (n.categoryId === categoryId ? acc + 1 : acc), 0);
}

function notesForCurrentCategory() {
  if (state.selectedCategoryId === ALL_CATEGORIES_ID) return state.data.notes;
  return notesByCategory(state.selectedCategoryId);
}

function ensureSelection() {
  const isAll = state.selectedCategoryId === ALL_CATEGORIES_ID;
  const hasCat = isAll || (state.selectedCategoryId && getCategoryById(state.selectedCategoryId));
  if (!hasCat) {
    state.selectedCategoryId = ALL_CATEGORIES_ID;
  }
  const notes = notesForCurrentCategory();
  const hasNote = state.selectedNoteId && getNoteById(state.selectedNoteId);
  if (!hasNote) state.selectedNoteId = notes[0]?.id ?? null;
}

// ---------- Rendering ----------
function render() {
  ensureSelection();
  renderCategories();
  renderNotesHeader();
  renderNotes();
  renderEditor();
  renderVersionPill();
}

function renderVersionPill() {
  if (!el.appVersion) return;
  const dataVer = state.data?.version ?? "—";
  const appVer = state.data?.appVersion || APP_VERSION;
  el.appVersion.textContent = `v${appVer} • data v${dataVer}`;
}

function renderCategories() {
  el.categoryList.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = `category-item category-item-all ${ALL_CATEGORIES_ID === state.selectedCategoryId ? "active" : ""}`;
  allBtn.type = "button";
  allBtn.dataset.catId = ALL_CATEGORIES_ID;
  const allCount = state.data.notes.length;
  allBtn.innerHTML = `
    <div class="cat-left">
      <span class="cat-dot cat-dot-all"></span>
      <span class="cat-name">Todas</span>
    </div>
    <span class="cat-count">${allCount}</span>
  `;
  allBtn.addEventListener("click", () => {
    state.selectedCategoryId = ALL_CATEGORIES_ID;
    state.selectedNoteId = null;
    if (window.innerWidth <= 780) closeSidebar();
    render();
  });
  el.categoryList.appendChild(allBtn);

  for (const c of state.data.categories) {
    const row = document.createElement("div");
    row.className = `category-item ${c.id === state.selectedCategoryId ? "active" : ""}`;
    row.dataset.catId = c.id;
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    const count = computeCategoryCount(c.id);
    const color = c.color || "#7C3AED";
    row.innerHTML = `
      <div class="cat-left">
        <span class="cat-dot" style="background:${escapeHtml(color)}; box-shadow: 0 0 0 4px ${hexToRgba(color, 0.16)}"></span>
        <span class="cat-name">${escapeHtml(c.name)}</span>
      </div>
      <span class="cat-count">${count}</span>
    `;

    let longPressTimer = null;
    let contextMenuOpened = false;

    const clearLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    row.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      contextMenuOpened = false;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        contextMenuOpened = true;
        showCategoryContextMenu(c, row);
      }, 500);
    });
    row.addEventListener("pointerup", clearLongPress);
    row.addEventListener("pointerleave", clearLongPress);
    row.addEventListener("pointercancel", clearLongPress);

    row.addEventListener("click", (e) => {
      if (contextMenuOpened) {
        contextMenuOpened = false;
        return;
      }
      state.selectedCategoryId = c.id;
      state.selectedNoteId = null;
      if (window.innerWidth <= 780) closeSidebar();
      render();
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        state.selectedCategoryId = c.id;
        state.selectedNoteId = null;
        if (window.innerWidth <= 780) closeSidebar();
        render();
      }
    });

    el.categoryList.appendChild(row);
  }
}

function renderNotesHeader() {
  if (state.selectedCategoryId === ALL_CATEGORIES_ID) {
    el.notesTitle.textContent = "Todas";
    el.notesSubtitle.textContent = `${state.data.notes.length} notas en todas las categorías`;
    el.btnAddNote.disabled = true;
    el.btnAddNote.classList.add("hidden");
    return;
  }
  const cat = getCategoryById(state.selectedCategoryId);
  el.notesTitle.textContent = cat ? cat.name : "Notas";
  el.notesSubtitle.textContent = cat ? `${computeCategoryCount(cat.id)} notas` : "Selecciona una categoría";
  el.btnAddNote.disabled = !cat;
  el.btnAddNote.classList.remove("hidden");
}

function renderNotes() {
  el.notesList.innerHTML = "";
  const catId = state.selectedCategoryId;
  if (!catId) {
    el.notesList.innerHTML = `<div class="empty-state"><div><div class="empty-title">Sin categoría</div><div class="empty-text">Crea una categoría para empezar.</div></div></div>`;
    return;
  }

  const q = state.search.trim().toLowerCase();
  const typeFilter = state.filterType;

  const baseNotes = catId === ALL_CATEGORIES_ID ? state.data.notes : state.data.notes.filter((n) => n.categoryId === catId);
  const notes = baseNotes
    .filter((n) => (typeFilter === "all" ? true : n.type === typeFilter))
    .filter((n) => {
      if (!q) return true;
      const hay = `${n.title ?? ""}\n${n.content ?? ""}\n${n.url ?? ""}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    });

  if (!notes.length) {
    const emptyText = catId === ALL_CATEGORIES_ID ? "Usa el buscador o elige una categoría para crear una nota." : "Crea una nota para esta categoría.";
    el.notesList.innerHTML = `<div class="empty-state"><div><div class="empty-title">Nada por aquí</div><div class="empty-text">${emptyText}</div></div></div>`;
    return;
  }

  for (const n of notes) {
    const card = document.createElement("div");
    card.className = `note-card ${n.id === state.selectedNoteId ? "active" : ""}`;
    card.dataset.noteId = n.id;
    const typeLabel = typeLabelOf(n.type);
    const title = n.title?.trim() ? n.title.trim() : typeLabel;
    const preview = n.type === "list" ? contentToListHtml(n.content || "") : escapeHtml(buildNotePreviewText(n));
    const media = buildNoteMediaHtml(n);
    card.innerHTML = `
      <div class="note-top">
        <div class="note-title">${escapeHtml(title)}</div>
        <div class="note-badges">
          ${n.pinned ? `<span class="badge pin">Fijada</span>` : ""}
          <span class="badge">${escapeHtml(typeLabel)}</span>
        </div>
      </div>
      <div class="note-preview">${preview}</div>
      ${media}
    `;
    card.addEventListener("click", () => {
      state.selectedNoteId = n.id;
      noteJustCreatedId = null;
      if (window.innerWidth <= 780) el.app.classList.add("mobile-editor");
      render();
    });
    el.notesList.appendChild(card);
  }
}

function renderEditor() {
  const note = state.selectedNoteId ? getNoteById(state.selectedNoteId) : null;
  el.btnDeleteNote.disabled = !note;
  el.btnPinNote.disabled = !note;
  if (el.btnSaveNote) el.btnSaveNote.disabled = !note;
  if (el.btnCancelNote) el.btnCancelNote.disabled = !note;

  if (!note) {
    el.editorTitle.textContent = "Detalle";
    el.editorSubtitle.textContent = "Selecciona una nota";
    el.editorBody.innerHTML = `
      <div class="empty-state">
        <div>
          <div class="empty-title">Nada seleccionado</div>
          <div class="empty-text">Elige una nota para ver y editar su contenido.</div>
        </div>
      </div>
    `;
    return;
  }

  const titleText =
    note.type === "simple" ? "Simple" : (note.title?.trim() || typeLabelOf(note.type));
  el.editorTitle.textContent = titleText;
  el.editorSubtitle.textContent = `${typeLabelOf(note.type)} • Última edición: ${formatShortDate(
    note.updatedAt || note.createdAt,
  )}`;

  el.editorBody.innerHTML = buildEditorHtml(note);
  wireEditorEvents(note);
}

// ---------- Editor templates ----------
function buildEditorHtml(note) {
  const commonTop = `
    <div class="editor-card">
      <div class="editor-grid">
        <label class="field">
          <span>Título</span>
          <input id="edTitle" maxlength="80" value="${escapeHtml(note.title || "")}" placeholder="Opcional" />
        </label>
        <label class="field">
          <span>Tipo</span>
          <select id="edType">
            ${NOTE_TYPES.map((t) => `<option value="${t}" ${t === note.type ? "selected" : ""}>${escapeHtml(typeLabelOf(t))}</option>`)
              .join("")}
          </select>
        </label>
      </div>
      <div class="hint">Se guarda automáticamente en Local Storage.</div>
    </div>
  `;

  const body = buildTypeEditor(note);
  return `${commonTop}<div style="height:12px"></div>${body}`;
}

function buildTypeEditor(note) {
  if (note.type === "youtube") return buildYoutubeEditor(note);
  if (note.type === "link") return buildLinkEditor(note);
  if (note.type === "quote") return buildQuoteEditor(note);
  if (note.type === "text") return buildTextEditor(note);
  if (note.type === "image") return buildImageEditor(note);
  if (note.type === "list") return buildListEditor(note);
  if (note.type === "simple") return buildSimpleEditor(note);
  return `<div class="editor-card"><div class="empty-text">Tipo no soportado.</div></div>`;
}

function buildYoutubeEditor(note) {
  const url = (note.url || "").trim();
  const vid = url ? parseYoutubeId(url) : null;
  const thumb = vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : "";
  const safeOpenUrl =
    url && isValidUrl(url) && (url.startsWith("http:") || url.startsWith("https:"))
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="editor-link">${escapeHtml(url)}</a>`
      : '<span class="hint">Escribe una URL válida y pincha sobre ella para abrir.</span>';
  return `
    <div class="editor-card">
      <div class="editor-grid single">
        <label class="field">
          <span>URL de YouTube</span>
          <input id="edUrl" value="${escapeHtml(url)}" placeholder="https://www.youtube.com/watch?v=..." />
        </label>
        <label class="field">
          <span>Notas</span>
          <textarea id="edContent" placeholder="¿Qué quieres recordar?">${escapeHtml(note.content || "")}</textarea>
        </label>
      </div>
      <div class="editor-open-link">${safeOpenUrl}</div>
      <div class="preview-row">
        ${
          thumb
            ? `<div class="preview"><img src="${escapeHtml(thumb)}" alt="Miniatura de YouTube" /><div class="preview-meta">Vista previa</div></div>`
            : `<div class="hint">Pega un enlace válido de YouTube para ver una miniatura.</div>`
        }
      </div>
    </div>
  `;
}

function buildLinkEditor(note) {
  const url = (note.url || "").trim();
  const safeOpenUrl =
    url && isValidUrl(url) && (url.startsWith("http:") || url.startsWith("https:"))
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="editor-link">${escapeHtml(url)}</a>`
      : '<span class="hint">Escribe una URL válida y pincha sobre ella para abrir.</span>';
  return `
    <div class="editor-card">
      <div class="editor-grid single">
        <label class="field">
          <span>URL</span>
          <input id="edUrl" value="${escapeHtml(url)}" placeholder="https://..." />
        </label>
        <label class="field">
          <span>Descripción</span>
          <textarea id="edContent" placeholder="Resumen / por qué lo guardas…">${escapeHtml(note.content || "")}</textarea>
        </label>
      </div>
      <div class="editor-open-link">${safeOpenUrl}</div>
      <div class="hint">${url ? `Dominio: ${escapeHtml(safeHostname(url))}` : "Tip: pega cualquier enlace (artículo, tienda, etc.)"}</div>
    </div>
  `;
}

function buildQuoteEditor(note) {
  return `
    <div class="editor-card">
      <div class="editor-grid single">
        <label class="field">
          <span>Frase</span>
          <textarea id="edContent" placeholder="Escribe una frase memorable…">${escapeHtml(note.content || "")}</textarea>
        </label>
        <label class="field">
          <span>Autor (opcional)</span>
          <input id="edAuthor" maxlength="60" value="${escapeHtml(note.author || "")}" placeholder="Ej: Carl Sagan" />
        </label>
      </div>
      <div class="hint">Vista previa:</div>
      <div class="preview">
        <div class="preview-meta">
          “${escapeHtml(clampText(note.content || "", 160))}”
          ${note.author ? `<div style="margin-top:6px; color: var(--text); font-weight: 700;">— ${escapeHtml(note.author)}</div>` : ""}
        </div>
      </div>
    </div>
  `;
}

function buildTextEditor(note) {
  return `
    <div class="editor-card">
      <div class="editor-grid single">
        <label class="field">
          <span>Contenido</span>
          <textarea id="edContent" placeholder="Escribe aquí tu nota larga / artículo…">${escapeHtml(note.content || "")}</textarea>
        </label>
      </div>
      <div class="hint">Tip: usa títulos y saltos de línea para leer mejor.</div>
    </div>
  `;
}

function buildListEditor(note) {
  const lines = (note.content || "").split(/\r?\n/).filter((s) => s !== null && s !== undefined);
  const lisHtml =
    lines.length > 0
      ? lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")
      : "<li><br></li>";
  return `
    <div class="editor-card">
      <label class="field">
        <span>Elementos del listado</span>
        <ul contenteditable="true" id="edListContent" class="editor-list-input" data-placeholder="Añade elementos…">${lisHtml}</ul>
      </label>
      <div class="hint">Enter para nueva línea.</div>
    </div>
  `;
}

function buildSimpleEditor(note) {
  return `
    <div class="editor-card">
      <div class="hint">Nota simple: solo título. Puedes cambiar el tipo arriba si quieres añadir más.</div>
    </div>
  `;
}

function buildImageEditor(note) {
  const src = note.image?.src || "";
  const alt = note.image?.alt || "";
  const previewHtml = src
    ? `<div class="preview"><a href="${escapeHtml(src)}" target="_blank" rel="noopener noreferrer" class="preview-image-link" title="Abrir imagen completa"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt || "Imagen guardada")}" /></a><div class="preview-meta">Vista previa (pincha para abrir completa)</div></div>`
    : `<div class="hint">Pega una URL, usa el botón Pegar o sube un archivo para previsualizar.</div>`;
  return `
    <div class="editor-card">
      <div class="editor-grid">
        <label class="field">
          <span>URL de imagen</span>
          <input id="edImgUrl" value="${escapeHtml(src && !src.startsWith("data:") ? src : "")}" placeholder="https://..." />
        </label>
        <label class="field">
          <span>Subir imagen (se guarda como DataURL)</span>
          <input id="edImgFile" type="file" accept="image/*" />
        </label>
        <label class="field">
          <span>Portapapeles</span>
          <button type="button" class="btn subtle" id="btnPasteImage">Pegar imagen</button>
        </label>
        <label class="field" style="grid-column: 1 / -1;">
          <span>Texto alternativo (opcional)</span>
          <input id="edImgAlt" maxlength="120" value="${escapeHtml(alt)}" placeholder="Descripción breve de la imagen" />
        </label>
      </div>
      <div class="preview-row">
        ${previewHtml}
      </div>
      <div class="hint">Aviso: Local Storage tiene límites. Para muchas imágenes grandes conviene usar URL o IndexedDB.</div>
    </div>
  `;
}

function wireEditorEvents(note) {
  const saveDebounced = debounce(() => {
    setData(state.data);
    renderNotes(); // refresca previews sin rerender completo
  }, 250);

  const inputTitle = document.getElementById("edTitle");
  const selectType = document.getElementById("edType");
  if (inputTitle) {
    inputTitle.addEventListener("input", () => {
      note.title = inputTitle.value;
      note.updatedAt = nowIso();
      saveDebounced();
    });
  }

  if (selectType) {
    selectType.addEventListener("change", () => {
      note.type = selectType.value;
      note.updatedAt = nowIso();
      // Limpiar campos específicos para evitar basura cruzada
      if (note.type !== "image") delete note.image;
      if (note.type !== "quote") delete note.author;
      if (note.type === "text" || note.type === "list" || note.type === "simple") {
        delete note.url;
      }
      if (note.type === "simple") delete note.content;
      setData(state.data);
      renderEditor();
      renderNotes();
    });
  }

  const edUrl = document.getElementById("edUrl");
  if (edUrl) {
    edUrl.addEventListener("input", () => {
      note.url = edUrl.value.trim();
      note.updatedAt = nowIso();
      saveDebounced();
      // refresca editor (miniatura y dominio)
      renderEditor();
    });
  }

  const edContent = document.getElementById("edContent");
  if (edContent) {
    edContent.addEventListener("input", () => {
      note.content = edContent.value;
      note.updatedAt = nowIso();
      saveDebounced();
    });
  }

  const edListContent = document.getElementById("edListContent");
  if (edListContent && note.type === "list") {
    const syncListToNote = () => {
      const lines = Array.from(edListContent.querySelectorAll("li")).map((li) => li.textContent || "");
      note.content = lines.join("\n");
      note.updatedAt = nowIso();
      saveDebounced();
    };
    edListContent.addEventListener("input", syncListToNote);
    edListContent.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const sel = window.getSelection();
      let li = sel?.anchorNode;
      while (li && li !== edListContent) {
        if (li.nodeName === "LI") break;
        li = li.parentNode;
      }
      if (!li || li.nodeName !== "LI") return;
      e.preventDefault();
      const next = document.createElement("li");
      next.innerHTML = "<br>";
      if (li.nextSibling) edListContent.insertBefore(next, li.nextSibling);
      else edListContent.appendChild(next);
      next.focus?.();
      sel?.removeAllRanges();
      const range = document.createRange();
      range.setStart(next, 0);
      range.collapse(true);
      sel?.addRange(range);
      syncListToNote();
    });
  }

  const edAuthor = document.getElementById("edAuthor");
  if (edAuthor) {
    edAuthor.addEventListener("input", () => {
      note.author = edAuthor.value.trim();
      note.updatedAt = nowIso();
      saveDebounced();
    });
  }

  const edImgUrl = document.getElementById("edImgUrl");
  if (edImgUrl) {
    edImgUrl.addEventListener("input", () => {
      const v = edImgUrl.value.trim();
      note.image = note.image || { src: "", alt: "" };
      note.image.src = v;
      note.updatedAt = nowIso();
      saveDebounced();
      renderEditor();
      renderNotes();
    });
  }

  const edImgAlt = document.getElementById("edImgAlt");
  if (edImgAlt) {
    edImgAlt.addEventListener("input", () => {
      note.image = note.image || { src: "", alt: "" };
      note.image.alt = edImgAlt.value;
      note.updatedAt = nowIso();
      saveDebounced();
    });
  }

  const edImgFile = document.getElementById("edImgFile");
  if (edImgFile) {
    edImgFile.addEventListener("change", async () => {
      const file = edImgFile.files?.[0];
      if (!file) return;
      if (file.size > 1_200_000) {
        showToast("Imagen grande: puede exceder el límite del Local Storage.");
      }
      const dataUrl = await fileToDataUrl(file);
      note.image = note.image || { src: "", alt: "" };
      note.image.src = dataUrl;
      note.updatedAt = nowIso();
      setData(state.data);
      render();
    });
  }

  const btnPasteImage = document.getElementById("btnPasteImage");
  if (btnPasteImage) {
    btnPasteImage.addEventListener("click", async () => {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith("image/")) {
              const blob = await item.getType(type);
              const file = new File([blob], "pasted.png", { type: blob.type });
              if (file.size > 1_200_000) showToast("Imagen grande: puede exceder el límite del Local Storage.");
              const dataUrl = await fileToDataUrl(file);
              note.image = note.image || { src: "", alt: "" };
              note.image.src = dataUrl;
              note.updatedAt = nowIso();
              setData(state.data);
              render();
              showToast("Imagen pegada.");
              return;
            }
          }
        }
        showToast("No hay ninguna imagen en el portapapeles.");
      } catch (err) {
        showToast("No se pudo leer el portapapeles. Prueba a pegar con Ctrl+V.");
      }
    });
  }
}

function setupImagePasteHandler() {
  document.removeEventListener("paste", handleImagePaste);
  document.addEventListener("paste", handleImagePaste);
}

function handleImagePaste(e) {
  const note = state.selectedNoteId ? getNoteById(state.selectedNoteId) : null;
  if (!note || note.type !== "image") return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      const file = items[i].getAsFile();
      if (!file) return;
      e.preventDefault();
      if (file.size > 1_200_000) showToast("Imagen grande: puede exceder el límite del Local Storage.");
      fileToDataUrl(file).then((dataUrl) => {
        note.image = note.image || { src: "", alt: "" };
        note.image.src = dataUrl;
        note.updatedAt = nowIso();
        setData(state.data);
        render();
        showToast("Imagen pegada.");
      });
      return;
    }
  }
}

// ---------- Actions ----------
function openSidebar() {
  el.sidebar.classList.add("open");
}
function closeSidebar() {
  el.sidebar.classList.remove("open");
}

function openCategoryDialog() {
  editingCategoryId = null;
  el.categoryDialogTitle.textContent = "Nueva categoría";
  el.categoryDialogSubmit.textContent = "Crear";
  el.categoryName.value = "";
  el.colorPalette.querySelectorAll(".color-swatch").forEach((s, i) => {
    s.classList.toggle("active", i === 0);
  });
  el.categoryDialog.showModal();
  setTimeout(() => el.categoryName.focus(), 0);
}

function openEditCategoryDialog(cat) {
  editingCategoryId = cat.id;
  el.categoryDialogTitle.textContent = "Editar categoría";
  el.categoryDialogSubmit.textContent = "Guardar";
  el.categoryName.value = cat.name || "";
  const color = (cat.color || "#7C3AED").toLowerCase();
  let found = false;
  el.colorPalette.querySelectorAll(".color-swatch").forEach((s) => {
    const match = (s.dataset.color || "").toLowerCase() === color;
    if (match) found = true;
    s.classList.toggle("active", match);
  });
  if (!found) el.colorPalette.querySelector(".color-swatch").classList.add("active");
  el.categoryDialog.showModal();
  setTimeout(() => el.categoryName.focus(), 0);
}

function createCategory({ name, color }) {
  const ts = nowIso();
  const cat = {
    id: uid("cat"),
    name: name.trim(),
    color: color || "#7C3AED",
    icon: "bookmark",
    createdAt: ts,
    updatedAt: ts,
  };
  state.data.categories.push(cat);
  setData(state.data);
  state.selectedCategoryId = cat.id;
  state.selectedNoteId = null;
  render();
  showToast("Categoría creada.");
}

function updateCategory(id, { name, color }) {
  const cat = state.data.categories.find((c) => c.id === id);
  if (!cat) return;
  cat.name = (name || "").trim();
  cat.color = color || cat.color || "#7C3AED";
  cat.updatedAt = nowIso();
  setData(state.data);
  render();
  showToast("Categoría actualizada.");
}

async function confirmDeleteCategory(cat) {
  const count = computeCategoryCount(cat.id);
  el.confirmTitle.textContent = "Eliminar categoría";
  el.confirmText.textContent =
    count > 0
      ? `¿Eliminar «${escapeHtml(cat.name)}»? Se eliminarán también las ${count} notas que contiene.`
      : `¿Eliminar la categoría «${escapeHtml(cat.name)}»?`;
  el.confirmDialog.showModal();
  const result = await waitDialogResult(el.confirmDialog);
  if (result !== "ok") return;
  deleteCategory(cat.id);
}

function deleteCategory(id) {
  state.data.categories = state.data.categories.filter((c) => c.id !== id);
  state.data.notes = state.data.notes.filter((n) => n.categoryId !== id);
  if (state.selectedCategoryId === id) {
    state.selectedCategoryId = ALL_CATEGORIES_ID;
    state.selectedNoteId = null;
  }
  setData(state.data);
  render();
  showToast("Categoría eliminada.");
}

function showCategoryContextMenu(cat, rowEl) {
  const menu = el.categoryContextMenu;
  const rect = rowEl.getBoundingClientRect();
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.hidden = false;

  const closeMenu = () => {
    menu.hidden = true;
    document.removeEventListener("click", closeMenu);
  };

  setTimeout(() => document.addEventListener("click", closeMenu), 0);

  menu.querySelector('[data-action="edit"]').onclick = (e) => {
    e.stopPropagation();
    closeMenu();
    openEditCategoryDialog(cat);
  };
  menu.querySelector('[data-action="delete"]').onclick = (e) => {
    e.stopPropagation();
    closeMenu();
    confirmDeleteCategory(cat);
  };
}

function openNoteTypeDialog() {
  el.noteTitleInput.value = "";
  el.noteTypeSelect.value = "simple";
  el.noteTypeDialog.showModal();
  setTimeout(() => el.noteTitleInput.focus(), 0);
}

function createNote({ type, title }) {
  if (!state.selectedCategoryId) return;
  const ts = nowIso();
  const note = {
    id: uid("note"),
    categoryId: state.selectedCategoryId,
    type,
    title: title?.trim() || "",
    content: "",
    url: "",
    pinned: false,
    createdAt: ts,
    updatedAt: ts,
  };
  if (type === "image") note.image = { src: "", alt: "" };
  if (type === "quote") note.author = "";

  state.data.notes.push(note);
  setData(state.data);
  state.selectedNoteId = note.id;
  noteJustCreatedId = note.id;
  render();
  if (window.innerWidth <= 780) el.app.classList.add("mobile-editor");
  showToast("Nota creada.");
}

async function confirmDeleteNote() {
  const note = state.selectedNoteId ? getNoteById(state.selectedNoteId) : null;
  if (!note) return;
  el.confirmTitle.textContent = "Eliminar nota";
  el.confirmText.textContent = "Esta acción no se puede deshacer.";
  el.confirmDialog.showModal();
  const result = await waitDialogResult(el.confirmDialog);
  if (result !== "ok") return;

  state.data.notes = state.data.notes.filter((n) => n.id !== note.id);
  setData(state.data);
  state.selectedNoteId = null;
  render();
  showToast("Nota eliminada.");
}

function togglePinNote() {
  const note = state.selectedNoteId ? getNoteById(state.selectedNoteId) : null;
  if (!note) return;
  note.pinned = !note.pinned;
  note.updatedAt = nowIso();
  setData(state.data);
  render();
  showToast(note.pinned ? "Nota fijada." : "Nota desfijada.");
}

function exportBackup() {
  downloadJson("keepy.backup.json", state.data);
  showToast("Exportado: keepy.backup.json");
}

async function confirmDeleteAllNotes() {
  el.confirmTitle.textContent = "Eliminar todo";
  el.confirmText.textContent =
    "¿Estás seguro? Se exportará primero una copia de seguridad (keepy.backup.json) y después se borrarán todas las notas y todas las categorías.";
  el.confirmDialog.showModal();
  const result = await waitDialogResult(el.confirmDialog);
  if (result !== "ok") return;

  exportBackup();
  const ts = nowIso();
  state.data.notes = [];
  state.data.categories = [
    {
      id: "cat_general",
      name: "General",
      color: "#7C3AED",
      icon: "bookmark",
      createdAt: ts,
      updatedAt: ts,
    },
  ];
  state.data.updatedAt = ts;
  setData(state.data);
  state.selectedCategoryId = ALL_CATEGORIES_ID;
  state.selectedNoteId = null;
  render();
  closeSettings();
  showToast("Todo eliminado. Se ha guardado una copia.");
}

async function importBackupFromFile(file) {
  const text = await file.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    showToast("JSON inválido.");
    return;
  }
  const valid = validateDataShape(parsed);
  if (!valid) {
    showToast("Formato de backup no válido (version 1).");
    return;
  }

  // Reemplazar
  setData(valid);
  state.selectedCategoryId = null;
  state.selectedNoteId = null;
  render();
  showToast("Importado (reemplazado) correctamente.");
}

async function openSyncDialog() {
  el.syncDialog.showModal();
  const result = await waitDialogResult(el.syncDialog);
  if (result !== "ok") return;
  const url = el.syncUrl.value.trim();
  if (url) saveSyncUrl(url);
  await syncFromGithubRaw(url);
}

async function syncFromGithubRaw(url) {
  if (!isValidUrl(url)) {
    showToast("URL inválida.");
    return;
  }
  try {
    showToast("Descargando JSON…");
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = await res.json();
    const valid = validateDataShape(parsed);
    if (!valid) {
      showToast("El JSON remoto no tiene el formato esperado.");
      return;
    }
    setData(valid); // reemplazar
    state.selectedCategoryId = null;
    state.selectedNoteId = null;
    render();
    showToast("Sync completado (reemplazado).");
  } catch (e) {
    showToast(`Error sync: ${String(e.message || e)}`);
  }
}

function fetchWithTimeout(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { cache: "no-store", signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function syncIfNewerFromGithub() {
  const url = (loadSyncUrl && loadSyncUrl()) || (el.syncUrl && el.syncUrl.value) || "https://raw.githubusercontent.com/ivanulisescl/keepy/main/keepy.backup.json";
  if (!url || !isValidUrl(url)) {
    showToast("URL de sync inválida.");
    return;
  }
  try {
    showToast("Revisando versión en repo…");
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = await res.json();
    const valid = validateDataShape(parsed);
    if (!valid) {
      showToast("El JSON remoto no tiene el formato esperado.");
      return;
    }

    const localAppVersion = state.data?.appVersion || APP_VERSION;
    const remoteAppVersion = valid.appVersion || "";
    const localUpdated = state.data?.updatedAt || "";
    const remoteUpdated = valid.updatedAt || "";

    let isNewer = false;
    if (remoteAppVersion) {
      isNewer = compareSemver(remoteAppVersion, localAppVersion) > 0;
    } else if (remoteUpdated && localUpdated) {
      isNewer = new Date(remoteUpdated) > new Date(localUpdated);
    }

    if (!isNewer) {
      showToast(`Sin nueva versión (local v${localAppVersion}${remoteAppVersion ? `, repo v${remoteAppVersion}` : ""}).`);
      return;
    }

    if (url) saveSyncUrl(url);
    setData(valid);
    state.selectedCategoryId = null;
    state.selectedNoteId = null;
    render();

    // En PWA instalada, forzar recarga para cargar código nuevo y evitar caché vieja
    showToast("Datos actualizados. Recargando aplicación…");
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) reg.update();
      });
    }
    setTimeout(() => window.location.reload(), 1800);
  } catch (e) {
    const msg = e.name === "AbortError" ? "Tiempo de espera agotado" : String(e.message || e);
    showToast(`Error: ${msg}`);
  }
}

function compareSemver(a, b) {
  const pa = String(a).trim().replace(/^v/i, "").split(".").map((x) => Number.parseInt(x, 10));
  const pb = String(b).trim().replace(/^v/i, "").split(".").map((x) => Number.parseInt(x, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = Number.isFinite(pa[i]) ? pa[i] : 0;
    const db = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

// ---------- Utilities ----------
function typeLabelOf(type) {
  switch (type) {
    case "youtube":
      return "YouTube";
    case "link":
      return "Enlace";
    case "quote":
      return "Frase";
    case "text":
      return "Texto";
    case "image":
      return "Imagen";
    case "list":
      return "Listado";
    case "simple":
      return "Simple";
    default:
      return "Nota";
  }
}

/** Convierte contenido de listado (líneas) en HTML <ul> con viñetas */
function contentToListHtml(content) {
  const lines = (content || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return '<span class="muted">Aún no hay elementos.</span>';
  return `<ul class="note-list-preview">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
}

function buildNotePreviewText(note) {
  if (note.type === "youtube") {
    const vid = note.url ? parseYoutubeId(note.url) : null;
    const prefix = note.url ? "Video" : "Sin enlace";
    const extra = note.content ? ` • ${clampText(note.content, 120)}` : "";
    return `${prefix}${vid ? ` (${vid})` : ""}${extra}`;
  }
  if (note.type === "link") {
    const host = note.url ? safeHostname(note.url) : "";
    const text = note.content ? clampText(note.content, 140) : "";
    return `${host ? `${host} • ` : ""}${text || clampText(note.url || "Sin enlace", 140)}`;
  }
  if (note.type === "quote") {
    const q = clampText(note.content || "", 150);
    return note.author ? `“${q}” — ${note.author}` : `“${q}”`;
  }
  if (note.type === "text") return clampText(note.content || "", 170) || "Texto vacío";
  if (note.type === "list") {
    const lines = (note.content || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    return lines.length ? lines.slice(0, 5).map((l) => `• ${l}`).join(" ") : "Listado vacío";
  }
  if (note.type === "image") {
    const alt = note.image?.alt?.trim() ? note.image.alt.trim() : "";
    return alt ? clampText(alt, 160) : "Imagen";
  }
  if (note.type === "simple") return ""; // El título ya se muestra en la tarjeta
  return clampText(note.content || "", 160);
}

function buildNoteMediaHtml(note) {
  if (note.type === "youtube" && note.url) {
    const vid = parseYoutubeId(note.url);
    if (!vid) return "";
    const thumb = `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
    return `<div class="note-media"><img loading="lazy" src="${escapeHtml(thumb)}" alt="Miniatura de YouTube" /></div>`;
  }
  if (note.type === "image" && note.image?.src) {
    const imgSrc = note.image.src;
    const imgAlt = escapeHtml(note.image.alt || "Imagen");
    return `<div class="note-media"><a href="${escapeHtml(imgSrc)}" target="_blank" rel="noopener noreferrer" class="note-media-image-link" title="Abrir imagen completa"><img loading="lazy" src="${escapeHtml(imgSrc)}" alt="${imgAlt}" /></a></div>`;
  }
  return "";
}

function safeHostname(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function formatShortDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function hexToRgba(hex, alpha) {
  try {
    const h = hex.replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = Number.parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  } catch {
    return `rgba(124,58,237,${alpha})`;
  }
}

function waitDialogResult(dialogEl) {
  return new Promise((resolve) => {
    const handler = () => {
      dialogEl.removeEventListener("close", handler);
      resolve(dialogEl.returnValue || "cancel");
    };
    dialogEl.addEventListener("close", handler);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("No se pudo leer el archivo."));
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(file);
  });
}

// ---------- Settings menu ----------
function toggleSettings() {
  el.settingsMenu.classList.toggle("open");
}
function closeSettings() {
  el.settingsMenu.classList.remove("open");
}

// ---------- Events ----------
el.btnTheme.addEventListener("click", toggleTheme);

el.btnSettings.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleSettings();
});
el.settingsWrap.addEventListener("click", (e) => {
  e.stopPropagation();
});

el.btnOpenSidebar.addEventListener("click", openSidebar);
el.btnCloseSidebar.addEventListener("click", closeSidebar);
el.sidebar.addEventListener("click", (e) => {
  e.stopPropagation();
});
document.addEventListener("click", (e) => {
  // Cerrar sidebar en móvil
  if (window.innerWidth <= 780 && el.sidebar.classList.contains("open")) {
    const inside = el.sidebar.contains(e.target);
    const opener = el.btnOpenSidebar.contains(e.target);
    if (!inside && !opener) closeSidebar();
  }
  // Cerrar settings menu
  if (el.settingsMenu.classList.contains("open")) {
    if (!el.settingsWrap.contains(e.target)) closeSettings();
  }
});

el.btnAddCategory.addEventListener("click", openCategoryDialog);
el.colorPalette.addEventListener("click", (e) => {
  const swatch = e.target.closest(".color-swatch");
  if (!swatch) return;
  el.colorPalette.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("active"));
  swatch.classList.add("active");
});
el.categoryDialog.addEventListener("close", () => {
  if (el.categoryDialog.returnValue !== "ok") return;
  const name = el.categoryName.value.trim();
  if (!name) return;
  const activeSwatch = el.colorPalette.querySelector(".color-swatch.active");
  const color = activeSwatch ? activeSwatch.dataset.color : "#7C3AED";
  if (editingCategoryId) {
    updateCategory(editingCategoryId, { name, color });
    editingCategoryId = null;
  } else {
    createCategory({ name, color });
  }
});

el.btnAddNote.addEventListener("click", openNoteTypeDialog);
el.noteTypeDialog.addEventListener("close", () => {
  if (el.noteTypeDialog.returnValue !== "ok") return;
  createNote({ type: el.noteTypeSelect.value, title: el.noteTitleInput.value });
});

el.filterType.addEventListener("change", () => {
  state.filterType = el.filterType.value;
  renderNotes();
});

el.searchInput.addEventListener(
  "input",
  debounce(() => {
    state.search = el.searchInput.value;
    renderNotes();
  }, 150),
);

el.btnDeleteNote.addEventListener("click", confirmDeleteNote);
el.btnPinNote.addEventListener("click", togglePinNote);

function goBackFromEditor() {
  noteJustCreatedId = null;
  state.selectedNoteId = null;
  if (window.innerWidth <= 780) el.app.classList.remove("mobile-editor");
  render();
}

el.btnSaveNote.addEventListener("click", () => {
  goBackFromEditor();
  showToast("Guardado.");
});
el.btnCancelNote.addEventListener("click", async () => {
  const note = state.selectedNoteId ? getNoteById(state.selectedNoteId) : null;
  if (note && state.selectedNoteId === noteJustCreatedId) {
    el.confirmTitle.textContent = "Descartar nota";
    el.confirmText.textContent = "¿Descartar esta nota recién creada? No se guardará.";
    el.confirmDialog.showModal();
    const result = await waitDialogResult(el.confirmDialog);
    if (result !== "ok") return;
    state.data.notes = state.data.notes.filter((n) => n.id !== note.id);
    setData(state.data);
  }
  goBackFromEditor();
});

el.btnExport.addEventListener("click", () => {
  exportBackup();
  closeSettings();
});
el.fileImport.addEventListener("change", async () => {
  const file = el.fileImport.files?.[0];
  if (!file) return;
  await importBackupFromFile(file);
  el.fileImport.value = "";
  closeSettings();
});

el.btnSyncIfNew.addEventListener("click", () => {
  closeSettings();
  syncIfNewerFromGithub().catch(() => {});
});
el.btnSync.addEventListener("click", () => {
  closeSettings();
  openSyncDialog();
});
el.btnDeleteAllNotes.addEventListener("click", () => {
  confirmDeleteAllNotes();
});

// ---------- Boot ----------
initTheme();
setupImagePasteHandler();
// First render (Todas por defecto)
state.selectedCategoryId = ALL_CATEGORIES_ID;
render();

// Exponer para debug rápido (opcional)
window.__KEEPY__ = { state, STORAGE_KEY };

// PWA: registrar service worker (requiere http/https o localhost)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./service-worker.js");
      // Forzar actualización inmediata del SW
      reg.update();
    } catch {
      // En file:// o entornos no soportados puede fallar; no bloquea la app.
    }
  });
}

// Workaround iOS/Android PWA: ajustar altura visible cuando el teclado se abre
if (window.visualViewport) {
  const vv = window.visualViewport;
  const adjustHeight = () => {
    document.documentElement.style.setProperty("--vvh", vv.height + "px");
  };
  vv.addEventListener("resize", adjustHeight);
  adjustHeight();
}

// Fix: en algunos WebView de PWA, los inputs no reciben focus al primer tap.
// Forzamos focus explícito en cada input/textarea al hacer click.
document.addEventListener("click", (e) => {
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    // Pequeño delay para evitar conflictos con el evento nativo
    setTimeout(() => {
      if (document.activeElement !== e.target) {
        e.target.focus();
      }
    }, 50);
  }
}, true);

