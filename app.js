const DEFAULT_API_BASE = (() => {
  const stored = window.localStorage.getItem("jshop_api_base");
  if (stored) {
    return stored;
  }
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const host = window.location.hostname || "127.0.0.1";
  return `${protocol}://${host}:8000`;
})();

const state = {
  apiBase: DEFAULT_API_BASE,
  dashboard: null,
  categories: [],
  contacts: [],
  lots: [],
  editingLotSlug: null,
  editingCategoryCode: null,
  editingContactCode: null
};

const refs = {
  apiForm: document.getElementById("apiForm"),
  apiBaseInput: document.getElementById("apiBaseInput"),
  statusMessage: document.getElementById("statusMessage"),
  dashboardCards: document.getElementById("dashboardCards"),

  lotsSearch: document.getElementById("lotsSearch"),
  lotsCategoryFilter: document.getElementById("lotsCategoryFilter"),
  refreshLotsBtn: document.getElementById("refreshLotsBtn"),
  lotsTableBody: document.getElementById("lotsTableBody"),
  lotForm: document.getElementById("lotForm"),
  lotFormTitle: document.getElementById("lotFormTitle"),
  lotCategorySelect: document.getElementById("lotCategorySelect"),
  lotResetBtn: document.getElementById("lotResetBtn"),
  lotBulkForm: document.getElementById("lotBulkForm"),
  lotBulkJson: document.getElementById("lotBulkJson"),

  categoriesTableBody: document.getElementById("categoriesTableBody"),
  categoryForm: document.getElementById("categoryForm"),
  categoryFormTitle: document.getElementById("categoryFormTitle"),
  categoryResetBtn: document.getElementById("categoryResetBtn"),

  contactsTableBody: document.getElementById("contactsTableBody"),
  contactForm: document.getElementById("contactForm"),
  contactFormTitle: document.getElementById("contactFormTitle"),
  contactResetBtn: document.getElementById("contactResetBtn")
};

function setStatus(message, type = "") {
  refs.statusMessage.textContent = message;
  refs.statusMessage.classList.remove("ok", "error");
  if (type) {
    refs.statusMessage.classList.add(type);
  }
}

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

async function apiRequest(path, options = {}) {
  const url = `${state.apiBase}${path}`;
  const settings = {
    method: options.method || "GET",
    headers: {
      Accept: "application/json"
    }
  };

  if (options.body !== undefined) {
    settings.headers["Content-Type"] = "application/json";
    settings.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, settings);

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const detail = isJson ? payload.detail || JSON.stringify(payload) : payload;
    throw new Error(`${response.status}: ${detail}`);
  }

  return payload;
}

function parseLines(raw) {
  return String(raw || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function fillCategorySelects() {
  const options = state.categories
    .map((category) => `<option value="${category.code}">${category.label} (${category.code})</option>`)
    .join("");

  refs.lotCategorySelect.innerHTML = options;

  const filterOptions = [
    '<option value="all">Все</option>',
    ...state.categories.map(
      (category) => `<option value="${category.code}">${category.label}</option>`
    )
  ];
  refs.lotsCategoryFilter.innerHTML = filterOptions.join("");
}

function renderDashboard() {
  if (!state.dashboard) {
    refs.dashboardCards.innerHTML = "";
    return;
  }

  const cards = [
    ["Лоты всего", state.dashboard.lots_total],
    ["Доступно", state.dashboard.lots_available],
    ["Продано", state.dashboard.lots_sold],
    ["Категории", state.dashboard.categories_total],
    ["Контакты", state.dashboard.contacts_total]
  ];

  refs.dashboardCards.innerHTML = cards
    .map(
      ([label, value]) => `
      <article class="card">
        <span>${label}</span>
        <strong>${value}</strong>
      </article>
    `
    )
    .join("");
}

function renderLots() {
  refs.lotsTableBody.innerHTML = state.lots
    .map((lot) => {
      const statusClass = lot.sold ? "sold" : "available";
      const statusLabel = lot.sold ? "Продан" : "В наличии";
      return `
      <tr>
        <td>${lot.slug}</td>
        <td>${lot.name}</td>
        <td>${lot.category_label}</td>
        <td>${new Intl.NumberFormat("ru-RU").format(lot.price)} ₽</td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit-lot" data-id="${lot.slug}">Изм.</button>
            <button type="button" data-action="duplicate-lot" data-id="${lot.slug}">Дубль</button>
            <button type="button" class="danger" data-action="delete-lot" data-id="${lot.slug}">Удалить</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderCategories() {
  refs.categoriesTableBody.innerHTML = state.categories
    .map(
      (category) => `
      <tr>
        <td>${category.code}</td>
        <td>${category.label}</td>
        <td>${category.sort_order}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit-category" data-id="${category.code}">Изм.</button>
            <button type="button" class="danger" data-action="delete-category" data-id="${category.code}">Удалить</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

function renderContacts() {
  refs.contactsTableBody.innerHTML = state.contacts
    .map(
      (contact) => `
      <tr>
        <td>${contact.code}</td>
        <td>${contact.label}</td>
        <td>${contact.hint || ""}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit-contact" data-id="${contact.code}">Изм.</button>
            <button type="button" class="danger" data-action="delete-contact" data-id="${contact.code}">Удалить</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

function resetLotForm() {
  state.editingLotSlug = null;
  refs.lotForm.reset();
  refs.lotFormTitle.textContent = "Новый лот";
  refs.lotForm.elements.sort_order.value = "0";
}

function resetCategoryForm() {
  state.editingCategoryCode = null;
  refs.categoryForm.reset();
  refs.categoryForm.elements.sort_order.value = "0";
  refs.categoryForm.elements.code.disabled = false;
  refs.categoryFormTitle.textContent = "Новая категория";
}

function resetContactForm() {
  state.editingContactCode = null;
  refs.contactForm.reset();
  refs.contactForm.elements.sort_order.value = "0";
  refs.contactForm.elements.is_external.checked = true;
  refs.contactForm.elements.code.disabled = false;
  refs.contactFormTitle.textContent = "Новый контакт";
}

function openLotEditor(lot) {
  state.editingLotSlug = lot.slug;
  refs.lotFormTitle.textContent = `Редактирование: ${lot.slug}`;
  refs.lotForm.elements.slug.value = lot.slug;
  refs.lotForm.elements.name.value = lot.name;
  refs.lotForm.elements.category_code.value = lot.category_code;
  refs.lotForm.elements.price.value = String(lot.price);
  refs.lotForm.elements.description.value = lot.description || "";
  refs.lotForm.elements.specs.value = (lot.specs || []).join("\n");
  refs.lotForm.elements.images.value = (lot.images || []).join("\n");
  refs.lotForm.elements.featured.checked = Boolean(lot.featured);
  refs.lotForm.elements.sold.checked = Boolean(lot.sold);
  refs.lotForm.elements.glitch_background.value = lot.glitch_background || "";
  refs.lotForm.elements.sort_order.value = String(lot.sort_order || 0);
}

function openCategoryEditor(category) {
  state.editingCategoryCode = category.code;
  refs.categoryFormTitle.textContent = `Редактирование: ${category.code}`;
  refs.categoryForm.elements.code.value = category.code;
  refs.categoryForm.elements.label.value = category.label;
  refs.categoryForm.elements.sort_order.value = String(category.sort_order || 0);
  refs.categoryForm.elements.code.disabled = true;
}

function openContactEditor(contact) {
  state.editingContactCode = contact.code;
  refs.contactFormTitle.textContent = `Редактирование: ${contact.code}`;
  refs.contactForm.elements.code.value = contact.code;
  refs.contactForm.elements.label.value = contact.label;
  refs.contactForm.elements.hint.value = contact.hint || "";
  refs.contactForm.elements.url_template.value = contact.url_template || "";
  refs.contactForm.elements.subject_template.value = contact.subject_template || "";
  refs.contactForm.elements.body_template.value = contact.body_template || "";
  refs.contactForm.elements.sort_order.value = String(contact.sort_order || 0);
  refs.contactForm.elements.is_external.checked = Boolean(contact.is_external);
  refs.contactForm.elements.icon_svg.value = contact.icon_svg || "";
  refs.contactForm.elements.code.disabled = true;
}

async function refreshDashboard() {
  state.dashboard = await apiRequest("/api/v1/admin/dashboard");
  renderDashboard();
}

async function refreshCategories() {
  state.categories = await apiRequest("/api/v1/admin/categories");
  fillCategorySelects();
  renderCategories();
}

async function refreshContacts() {
  state.contacts = await apiRequest("/api/v1/admin/contacts");
  renderContacts();
}

async function refreshLots() {
  const params = new URLSearchParams();
  const search = refs.lotsSearch.value.trim();
  const category = refs.lotsCategoryFilter.value;

  if (search) {
    params.set("q", search);
  }
  if (category && category !== "all") {
    params.set("category", category);
  }

  const query = params.toString();
  state.lots = await apiRequest(`/api/v1/admin/lots${query ? `?${query}` : ""}`);
  renderLots();
}

async function fullReload() {
  await Promise.all([refreshDashboard(), refreshCategories(), refreshContacts()]);
  await refreshLots();
}

async function connect() {
  state.apiBase = normalizeApiBase(refs.apiBaseInput.value || DEFAULT_API_BASE);
  refs.apiBaseInput.value = state.apiBase;
  window.localStorage.setItem("jshop_api_base", state.apiBase);

  setStatus("Подключение к API...", "");
  try {
    await fullReload();
    resetLotForm();
    resetCategoryForm();
    resetContactForm();
    setStatus(`Подключено к ${state.apiBase}`, "ok");
  } catch (error) {
    setStatus(`Ошибка API: ${error.message}`, "error");
  }
}

refs.apiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await connect();
});

refs.refreshLotsBtn.addEventListener("click", async () => {
  try {
    await refreshLots();
  } catch (error) {
    setStatus(`Ошибка загрузки лотов: ${error.message}`, "error");
  }
});

refs.lotsSearch.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    try {
      await refreshLots();
    } catch (error) {
      setStatus(`Ошибка поиска: ${error.message}`, "error");
    }
  }
});

refs.lotsCategoryFilter.addEventListener("change", async () => {
  try {
    await refreshLots();
  } catch (error) {
    setStatus(`Ошибка фильтрации: ${error.message}`, "error");
  }
});

refs.lotResetBtn.addEventListener("click", () => {
  resetLotForm();
});

refs.categoryResetBtn.addEventListener("click", () => {
  resetCategoryForm();
});

refs.contactResetBtn.addEventListener("click", () => {
  resetContactForm();
});

refs.lotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(refs.lotForm);

  const payload = {
    slug: String(form.get("slug") || "").trim(),
    name: String(form.get("name") || "").trim(),
    category_code: String(form.get("category_code") || "").trim(),
    price: Number(form.get("price") || 0),
    description: String(form.get("description") || ""),
    specs: parseLines(form.get("specs")),
    images: parseLines(form.get("images")),
    featured: form.get("featured") === "on",
    sold: form.get("sold") === "on",
    glitch_background: String(form.get("glitch_background") || "").trim(),
    sort_order: Number(form.get("sort_order") || 0)
  };

  try {
    if (state.editingLotSlug) {
      await apiRequest(`/api/v1/admin/lots/${state.editingLotSlug}`, {
        method: "PATCH",
        body: payload
      });
    } else {
      await apiRequest("/api/v1/admin/lots", {
        method: "POST",
        body: payload
      });
    }

    await Promise.all([refreshLots(), refreshDashboard()]);
    resetLotForm();
    setStatus("Лот сохранен", "ok");
  } catch (error) {
    setStatus(`Ошибка сохранения лота: ${error.message}`, "error");
  }
});

refs.lotBulkForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const raw = refs.lotBulkJson.value.trim();
  if (!raw) {
    setStatus("Заполните JSON для массового создания", "error");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    setStatus(`Невалидный JSON: ${error.message}`, "error");
    return;
  }

  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items) || !items.length) {
    setStatus("JSON должен содержать массив лотов", "error");
    return;
  }

  try {
    const result = await apiRequest("/api/v1/admin/lots/bulk", {
      method: "POST",
      body: {
        items
      }
    });
    await Promise.all([refreshLots(), refreshDashboard()]);
    const createdCount = Array.isArray(result.created) ? result.created.length : 0;
    const errorCount = Array.isArray(result.errors) ? result.errors.length : 0;
    setStatus(`Bulk: создано ${createdCount}, ошибок ${errorCount}`, errorCount ? "error" : "ok");
  } catch (error) {
    setStatus(`Ошибка bulk-создания: ${error.message}`, "error");
  }
});

refs.categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(refs.categoryForm);

  try {
    if (state.editingCategoryCode) {
      await apiRequest(`/api/v1/admin/categories/${state.editingCategoryCode}`, {
        method: "PATCH",
        body: {
          label: String(form.get("label") || "").trim(),
          sort_order: Number(form.get("sort_order") || 0)
        }
      });
    } else {
      await apiRequest("/api/v1/admin/categories", {
        method: "POST",
        body: {
          code: String(form.get("code") || "").trim(),
          label: String(form.get("label") || "").trim(),
          sort_order: Number(form.get("sort_order") || 0)
        }
      });
    }

    await Promise.all([refreshCategories(), refreshDashboard(), refreshLots()]);
    resetCategoryForm();
    setStatus("Категория сохранена", "ok");
  } catch (error) {
    setStatus(`Ошибка сохранения категории: ${error.message}`, "error");
  }
});

refs.contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(refs.contactForm);

  const payload = {
    code: String(form.get("code") || "").trim(),
    label: String(form.get("label") || "").trim(),
    hint: String(form.get("hint") || "").trim(),
    url_template: String(form.get("url_template") || "").trim(),
    subject_template: String(form.get("subject_template") || ""),
    body_template: String(form.get("body_template") || ""),
    is_external: form.get("is_external") === "on",
    icon_svg: String(form.get("icon_svg") || ""),
    sort_order: Number(form.get("sort_order") || 0)
  };

  try {
    if (state.editingContactCode) {
      await apiRequest(`/api/v1/admin/contacts/${state.editingContactCode}`, {
        method: "PATCH",
        body: payload
      });
    } else {
      await apiRequest("/api/v1/admin/contacts", {
        method: "POST",
        body: payload
      });
    }

    await Promise.all([refreshContacts(), refreshDashboard()]);
    resetContactForm();
    setStatus("Контакт сохранен", "ok");
  } catch (error) {
    setStatus(`Ошибка сохранения контакта: ${error.message}`, "error");
  }
});

refs.lotsTableBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const lotId = target.dataset.id;
  if (!action || !lotId) {
    return;
  }

  if (action === "edit-lot") {
    const lot = state.lots.find((item) => item.slug === lotId);
    if (lot) {
      openLotEditor(lot);
    }
    return;
  }

  if (action === "duplicate-lot") {
    const newSlug = window.prompt("Новый slug для дубликата:", `${lotId}-copy`);
    if (!newSlug) {
      return;
    }

    try {
      await apiRequest(`/api/v1/admin/lots/${lotId}/duplicate`, {
        method: "POST",
        body: {
          new_slug: newSlug.trim()
        }
      });
      await Promise.all([refreshLots(), refreshDashboard()]);
      setStatus(`Лот ${lotId} продублирован как ${newSlug.trim()}`, "ok");
    } catch (error) {
      setStatus(`Ошибка дублирования лота: ${error.message}`, "error");
    }
    return;
  }

  if (action === "delete-lot") {
    if (!window.confirm(`Удалить лот ${lotId}?`)) {
      return;
    }
    try {
      await apiRequest(`/api/v1/admin/lots/${lotId}`, { method: "DELETE" });
      await Promise.all([refreshLots(), refreshDashboard()]);
      if (state.editingLotSlug === lotId) {
        resetLotForm();
      }
      setStatus(`Лот ${lotId} удален`, "ok");
    } catch (error) {
      setStatus(`Ошибка удаления лота: ${error.message}`, "error");
    }
  }
});

refs.categoriesTableBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const code = target.dataset.id;
  if (!action || !code) {
    return;
  }

  if (action === "edit-category") {
    const category = state.categories.find((item) => item.code === code);
    if (category) {
      openCategoryEditor(category);
    }
    return;
  }

  if (action === "delete-category") {
    if (!window.confirm(`Удалить категорию ${code}?`)) {
      return;
    }
    try {
      await apiRequest(`/api/v1/admin/categories/${code}`, { method: "DELETE" });
      await Promise.all([refreshCategories(), refreshDashboard(), refreshLots()]);
      if (state.editingCategoryCode === code) {
        resetCategoryForm();
      }
      setStatus(`Категория ${code} удалена`, "ok");
    } catch (error) {
      setStatus(`Ошибка удаления категории: ${error.message}`, "error");
    }
  }
});

refs.contactsTableBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const code = target.dataset.id;
  if (!action || !code) {
    return;
  }

  if (action === "edit-contact") {
    const contact = state.contacts.find((item) => item.code === code);
    if (contact) {
      openContactEditor(contact);
    }
    return;
  }

  if (action === "delete-contact") {
    if (!window.confirm(`Удалить контакт ${code}?`)) {
      return;
    }

    try {
      await apiRequest(`/api/v1/admin/contacts/${code}`, { method: "DELETE" });
      await Promise.all([refreshContacts(), refreshDashboard()]);
      if (state.editingContactCode === code) {
        resetContactForm();
      }
      setStatus(`Контакт ${code} удален`, "ok");
    } catch (error) {
      setStatus(`Ошибка удаления контакта: ${error.message}`, "error");
    }
  }
});

refs.apiBaseInput.value = state.apiBase;
connect();
