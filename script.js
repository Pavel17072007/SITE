const state = {
  user: null,
  items: [],
  popularItems: [],
  editingItemId: null,
};

const elements = {
  popularGrid: document.getElementById("popularGrid"),
  catalogGrid: document.getElementById("catalogGrid"),
  authStatus: document.getElementById("authStatus"),
  itemStatus: document.getElementById("itemStatus"),
  userPanel: document.getElementById("userPanel"),
  logoutButton: document.getElementById("logoutButton"),
  registerForm: document.getElementById("registerForm"),
  loginForm: document.getElementById("loginForm"),
  itemForm: document.getElementById("itemForm"),
  resetItemForm: document.getElementById("resetItemForm"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
};

function setStatus(node, message, isError = false) {
  node.textContent = message;
  node.style.color = isError ? "#b42318" : "#6f6559";
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "same-origin",
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof data === "object" && data.error ? data.error : "Ошибка запроса";
    throw new Error(message);
  }

  return data;
}

function renderFoodCard(item, showAdminActions = false) {
  return `
    <article class="food-card">
      <img src="${item.image}" alt="${item.title}" />
      <div class="food-card-body">
        <div class="food-topline">
          <span>${item.restaurant}</span>
          <span>${item.deliveryTime}</span>
        </div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <div class="food-meta">
          <span>${item.category}</span>
          <span>${item.rating} · ${item.reviews} отзывов</span>
        </div>
        <div class="food-actions">
          <button class="primary-button" type="button">${Number(item.price).toFixed(2)} BYN</button>
          ${
            showAdminActions
              ? `<button class="ghost-button" type="button" data-edit-id="${item.id}">Редактировать</button>
                 <button class="ghost-button" type="button" data-delete-id="${item.id}">Удалить</button>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderGrid(node, items, allowManage = false) {
  if (!items.length) {
    node.innerHTML = `<div class="empty-state">Ничего не найдено. Попробуйте другой запрос.</div>`;
    return;
  }

  node.innerHTML = items.map((item) => renderFoodCard(item, allowManage)).join("");
}

function renderUser() {
  elements.logoutButton.hidden = !state.user;

  if (!state.user) {
    elements.userPanel.innerHTML = "<p>Авторизуйтесь, чтобы увидеть данные из GET /api/auth/me.</p>";
    setStatus(elements.authStatus, "Пока никто не вошел в систему.");
    return;
  }

  setStatus(
    elements.authStatus,
    `Вы вошли как ${state.user.login}. Теперь доступны защищенные методы для /api/items.`
  );

  elements.userPanel.innerHTML = `
    <article class="user-card">
      <strong>Логин</strong>
      <span>${state.user.login}</span>
    </article>
    <article class="user-card">
      <strong>Телефон</strong>
      <span>${state.user.phone}</span>
    </article>
    <article class="user-card">
      <strong>Роль</strong>
      <span>${state.user.role}</span>
    </article>
  `;
}

async function loadPopularItems() {
  state.popularItems = await request("/api/items?popular=true");
  renderGrid(elements.popularGrid, state.popularItems, false);
}

async function loadCatalog(search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  state.items = await request(`/api/items${query}`);
  renderGrid(elements.catalogGrid, state.items, Boolean(state.user));
}

async function loadCurrentUser() {
  try {
    state.user = await request("/api/auth/me");
  } catch (error) {
    state.user = null;
  }
  renderUser();
  if (state.items.length) {
    renderGrid(elements.catalogGrid, state.items, Boolean(state.user));
  }
}

function resetItemForm() {
  elements.itemForm.reset();
  elements.itemForm.elements.id.value = "";
  state.editingItemId = null;
  setStatus(elements.itemStatus, "Форма очищена. Можно создавать новое блюдо.");
}

function fillItemForm(item) {
  state.editingItemId = item.id;
  elements.itemForm.elements.id.value = item.id;
  elements.itemForm.elements.title.value = item.title;
  elements.itemForm.elements.restaurant.value = item.restaurant;
  elements.itemForm.elements.category.value = item.category;
  elements.itemForm.elements.price.value = item.price;
  elements.itemForm.elements.rating.value = item.rating;
  elements.itemForm.elements.reviews.value = item.reviews;
  elements.itemForm.elements.deliveryTime.value = item.deliveryTime;
  elements.itemForm.elements.image.value = item.image;
  elements.itemForm.elements.description.value = item.description;
  elements.itemForm.elements.popular.checked = item.popular;
  setStatus(elements.itemStatus, `Редактирование блюда: ${item.title}`);
  elements.itemForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

elements.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.registerForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.user = response.user;
    elements.registerForm.reset();
    renderUser();
    await loadCatalog(elements.searchInput.value.trim());
    setStatus(elements.authStatus, response.message);
  } catch (error) {
    setStatus(elements.authStatus, error.message, true);
  }
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.loginForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.user = response.user;
    elements.loginForm.reset();
    renderUser();
    await loadCatalog(elements.searchInput.value.trim());
    setStatus(elements.authStatus, response.message);
  } catch (error) {
    setStatus(elements.authStatus, error.message, true);
  }
});

elements.logoutButton.addEventListener("click", async () => {
  try {
    const response = await request("/api/auth/logout", { method: "POST" });
    state.user = null;
    renderUser();
    resetItemForm();
    await loadCatalog(elements.searchInput.value.trim());
    setStatus(elements.authStatus, response.message);
  } catch (error) {
    setStatus(elements.authStatus, error.message, true);
  }
});

elements.searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await loadCatalog(elements.searchInput.value.trim());
  } catch (error) {
    setStatus(elements.itemStatus, error.message, true);
  }
});

elements.itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(elements.itemForm);
  const payload = Object.fromEntries(formData.entries());
  payload.popular = elements.itemForm.elements.popular.checked;

  const isEditing = Boolean(payload.id);
  const itemId = payload.id;
  delete payload.id;

  try {
    const response = await request(isEditing ? `/api/items/${itemId}` : "/api/items", {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });

    resetItemForm();
    await loadPopularItems();
    await loadCatalog(elements.searchInput.value.trim());
    setStatus(
      elements.itemStatus,
      isEditing ? `Блюдо "${response.title}" обновлено.` : `Блюдо "${response.title}" создано.`
    );
  } catch (error) {
    setStatus(elements.itemStatus, error.message, true);
  }
});

elements.resetItemForm.addEventListener("click", resetItemForm);

elements.catalogGrid.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-id]");
  const deleteButton = event.target.closest("[data-delete-id]");

  if (editButton) {
    const id = Number(editButton.dataset.editId);
    const item = state.items.find((entry) => entry.id === id);
    if (item) {
      fillItemForm(item);
    }
    return;
  }

  if (deleteButton) {
    const id = Number(deleteButton.dataset.deleteId);

    try {
      const response = await request(`/api/items/${id}`, { method: "DELETE" });
      if (state.editingItemId === id) {
        resetItemForm();
      }
      await loadPopularItems();
      await loadCatalog(elements.searchInput.value.trim());
      setStatus(elements.itemStatus, response.message);
    } catch (error) {
      setStatus(elements.itemStatus, error.message, true);
    }
  }
});

async function init() {
  try {
    await Promise.all([loadPopularItems(), loadCatalog(), loadCurrentUser()]);
    setStatus(
      elements.itemStatus,
      "CRUD готов: GET /api/items и /api/items/:id публичны, POST/PUT/DELETE защищены авторизацией."
    );
  } catch (error) {
    setStatus(elements.itemStatus, error.message, true);
  }
}

init();
