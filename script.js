const DEFAULT_ADMIN = {
  email: "admin",
  password: "admin123",
};

const ROUTE = window.location.pathname;

const state = {
  user: null,
  items: [],
  popularItems: [],
  editingItemId: null,
};

const elements = {
  body: document.body,
  topbar: document.querySelector(".topbar"),
  main: document.querySelector("main"),
  home: document.getElementById("home"),
  popularSection: document.getElementById("popularSection"),
  catalog: document.getElementById("catalog"),
  auth: document.getElementById("auth"),
  profileSection: document.getElementById("profileSection"),
  adminSection: document.getElementById("adminSection"),
  authTitle: document.getElementById("authTitle"),
  authEyebrow: document.getElementById("authEyebrow"),
  authLead: document.getElementById("authLead"),
  loginLink: document.getElementById("loginLink"),
  registerLink: document.getElementById("registerLink"),
  popularGrid: document.getElementById("popularGrid"),
  catalogGrid: document.getElementById("catalogGrid"),
  authStatus: document.getElementById("authStatus"),
  profileStatus: document.getElementById("profileStatus"),
  itemStatus: document.getElementById("itemStatus"),
  userPanel: document.getElementById("userPanel"),
  logoutButton: document.getElementById("logoutButton"),
  profileForm: document.getElementById("profileForm"),
  editProfileButton: document.getElementById("editProfileButton"),
  registerForm: document.getElementById("registerForm"),
  loginForm: document.getElementById("loginForm"),
  resetPasswordForm: document.getElementById("resetPasswordForm"),
  forgotPasswordButton: document.getElementById("forgotPasswordButton"),
  itemForm: document.getElementById("itemForm"),
  resetItemForm: document.getElementById("resetItemForm"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
};

function setStatus(node, message, isError = false) {
  if (!node) {
    return;
  }

  node.textContent = message;
  node.style.color = isError ? "#b42318" : "#6f6559";
}

function getPasswordValidationError(password) {
  if (password.length < 6) {
    return "Пароль должен содержать минимум 6 символов.";
  }
  if (!/\p{Lu}/u.test(password)) {
    return "Пароль должен содержать хотя бы одну заглавную букву.";
  }
  if (!/\p{Nd}/u.test(password)) {
    return "Пароль должен содержать хотя бы одну цифру.";
  }
  if (!/[^\p{L}\p{N}]/u.test(password)) {
    return "Пароль должен содержать хотя бы один символ.";
  }
  return null;
}

function formatCreatedAt(value) {
  if (!value) {
    return "сейчас";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPhoneForDisplay(phone) {
  const raw = String(phone || "").trim();
  if (!raw) {
    return "-";
  }
  return raw.startsWith("+") ? raw : `+${raw}`;
}

function isHomeRoute() {
  return ROUTE === "/";
}

function isLoginRoute() {
  return ROUTE === "/auth/login";
}

function isRegisterRoute() {
  return ROUTE === "/auth/register";
}

function isProfileRoute() {
  return ROUTE === "/profile";
}

function isResetPasswordRoute() {
  return ROUTE === "/auth/reset-password";
}

function isAdminUser() {
  return Boolean(state.user && state.user.role === "admin");
}

function showSection(section, show) {
  if (!section) {
    return;
  }

  section.classList.toggle("is-hidden", !show);
}

function syncAdminSectionVisibility() {
  showSection(elements.adminSection, isProfileRoute() && isAdminUser());
}

function setAuthMode({ eyebrow, title, lead, showLogin, showRegister, showReset = false, activeLink }) {
  elements.authEyebrow.textContent = eyebrow;
  elements.authTitle.textContent = title;
  elements.authLead.textContent = lead;
  elements.loginForm.classList.toggle("is-hidden", !showLogin);
  elements.registerForm.classList.toggle("is-hidden", !showRegister);
  elements.resetPasswordForm?.classList.toggle("is-hidden", !showReset);
  elements.loginLink.classList.toggle("is-active", activeLink === "login");
  elements.registerLink.classList.toggle("is-active", activeLink === "register");
}

function isAuthRoute() {
  return isLoginRoute() || isRegisterRoute() || isResetPasswordRoute();
}

function ensureResetCodeField() {
  if (!elements.resetPasswordForm) {
    return null;
  }

  let codeInput = elements.resetPasswordForm.querySelector('input[name="code"]');
  if (codeInput) {
    return codeInput;
  }

  codeInput = document.createElement("input");
  codeInput.type = "text";
  codeInput.name = "code";
  codeInput.placeholder = "Код из письма";
  codeInput.inputMode = "numeric";
  codeInput.maxLength = 6;
  codeInput.required = true;

  const passwordInput = elements.resetPasswordForm.querySelector('input[name="password"]');
  if (passwordInput) {
    elements.resetPasswordForm.insertBefore(codeInput, passwordInput);
  } else {
    elements.resetPasswordForm.appendChild(codeInput);
  }

  return codeInput;
}

function applyBodyState(mode) {
  elements.body.classList.toggle("route-auth", mode === "auth");
  elements.body.classList.toggle("route-profile", mode === "profile");
  elements.body.classList.toggle("route-home", mode === "home");
}

function applyRouteLayout() {
  if (isLoginRoute()) {
    applyBodyState("auth");
    showSection(elements.home, false);
    showSection(elements.popularSection, false);
    showSection(elements.catalog, false);
    showSection(elements.auth, true);
    showSection(elements.profileSection, false);
    showSection(elements.adminSection, false);
    setAuthMode({
      eyebrow: "/auth/login",
      title: "Вход в аккаунт",
      lead: "Введите email и пароль, чтобы открыть профиль и получить доступ к защищенным действиям.",
      showLogin: true,
      showRegister: false,
      activeLink: "login",
    });
    return;
  }

  if (isRegisterRoute()) {
    applyBodyState("auth");
    showSection(elements.home, false);
    showSection(elements.popularSection, false);
    showSection(elements.catalog, false);
    showSection(elements.auth, true);
    showSection(elements.profileSection, false);
    showSection(elements.adminSection, false);
    setAuthMode({
      eyebrow: "/auth/register",
      title: "Регистрация нового пользователя",
      lead: "Заполните короткую форму, и система сразу авторизует вас и перенаправит в профиль.",
      showLogin: false,
      showRegister: true,
      activeLink: "register",
    });
    return;
  }

  if (isProfileRoute()) {
    applyBodyState("profile");
    showSection(elements.home, false);
    showSection(elements.popularSection, false);
    showSection(elements.catalog, false);
    showSection(elements.auth, false);
    showSection(elements.profileSection, true);
    showSection(elements.adminSection, false);
    syncAdminSectionVisibility();
    return;
  }

  if (isResetPasswordRoute()) {
    applyBodyState("auth");
    showSection(elements.home, false);
    showSection(elements.popularSection, false);
    showSection(elements.catalog, false);
    showSection(elements.auth, true);
    showSection(elements.profileSection, false);
    showSection(elements.adminSection, false);
    setAuthMode({
      eyebrow: "/auth/reset-password",
      title: "Сброс пароля",
      lead: "Введите новый пароль, чтобы завершить восстановление аккаунта.",
      showLogin: false,
      showRegister: false,
      showReset: true,
      activeLink: "",
    });
    return;
  }

  applyBodyState("home");
  showSection(elements.home, true);
  showSection(elements.popularSection, true);
  showSection(elements.catalog, true);
  showSection(elements.auth, false);
  showSection(elements.profileSection, false);
  showSection(elements.adminSection, false);
  setAuthMode({
    eyebrow: "Аккаунт",
    title: "Регистрация и вход",
    lead: "Войдите, чтобы увидеть профиль и управлять меню, или создайте новый аккаунт за пару шагов.",
    showLogin: true,
    showRegister: true,
    activeLink: "",
  });
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
  if (!node) {
    return;
  }

  if (!items.length) {
    node.innerHTML = '<div class="empty-state">Ничего не найдено. Попробуйте другой запрос.</div>';
    return;
  }

  node.innerHTML = items.map((item) => renderFoodCard(item, allowManage)).join("");
}

function renderUser() {
  elements.logoutButton.hidden = !state.user;

  if (!state.user) {
    elements.userPanel.innerHTML = "<p>Авторизуйтесь, чтобы увидеть данные профиля.</p>";
    if (elements.profileForm) {
      elements.profileForm.reset();
      elements.profileForm.classList.add("is-hidden");
    }
    if (elements.editProfileButton) {
      elements.editProfileButton.hidden = true;
      elements.editProfileButton.textContent = "Изменить";
    }
    setStatus(elements.profileStatus, "");
    setStatus(elements.authStatus, "Пока никто не вошел в систему.");
    syncAdminSectionVisibility();
    return;
  }

  setStatus(
    elements.authStatus,
    `Вы вошли как ${state.user.email}.`
  );

  elements.userPanel.innerHTML = `
    <article class="user-card">
      <strong>Имя</strong>
      <span>${state.user.name || "-"}</span>
    </article>
    <article class="user-card">
      <strong>Email</strong>
      <span>${state.user.email}</span>
    </article>
    <article class="user-card">
      <strong>Телефон</strong>
      <span>${formatPhoneForDisplay(state.user.phone)}</span>
    </article>
    <article class="user-card">
      <strong>Дата регистрации</strong>
      <span>${formatCreatedAt(state.user.createdAt)}</span>
    </article>
  `;

  if (elements.profileForm) {
    elements.profileForm.elements.name.value = state.user.name || "";
    elements.profileForm.elements.phone.value = state.user.phone || "";
  }
  if (elements.editProfileButton) {
    elements.editProfileButton.hidden = false;
  }
  syncAdminSectionVisibility();
}

async function loadPopularItems() {
  if (isLoginRoute() || isRegisterRoute() || isResetPasswordRoute() || isProfileRoute()) {
    return;
  }

  state.popularItems = await request("/api/items?popular=true");
  renderGrid(elements.popularGrid, state.popularItems, false);
}

async function loadCatalog(search = "") {
  if (isLoginRoute() || isRegisterRoute() || isResetPasswordRoute() || isProfileRoute()) {
    return;
  }

  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  state.items = await request(`/api/items${query}`);
  renderGrid(elements.catalogGrid, state.items, Boolean(state.user));
}

async function loginAsDefaultAdmin() {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(DEFAULT_ADMIN),
  });

  state.user = response.user;
  renderUser();
  setStatus(elements.authStatus, "Выполнен вход под администратором по умолчанию.");
}

async function loadCurrentUser() {
  try {
    state.user = await request("/api/auth/me");
    if (state.user && isAuthRoute()) {
      window.location.href = "/profile";
      return;
    }
  } catch (error) {
    if (isProfileRoute()) {
      window.location.href = "/auth/login";
      return;
    }

    if (isHomeRoute()) {
      try {
        await loginAsDefaultAdmin();
      } catch (loginError) {
        state.user = null;
        setStatus(elements.authStatus, loginError.message, true);
      }
    } else {
      state.user = null;
      setStatus(elements.authStatus, "Введите данные для входа или регистрации.");
    }
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
  const payload = Object.fromEntries(new FormData(elements.registerForm).entries());
  const passwordError = getPasswordValidationError(String(payload.password || ""));
  if (passwordError) {
    setStatus(elements.authStatus, passwordError, true);
    return;
  }

  try {
    const response = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    state.user = response.user;
    elements.registerForm.reset();
    renderUser();
    window.location.href = "/profile";
  } catch (error) {
    setStatus(elements.authStatus, error.message, true);
  }
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(elements.loginForm).entries());

  try {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    state.user = response.user;
    elements.loginForm.reset();
    renderUser();
    window.location.href = "/profile";
  } catch (error) {
    setStatus(elements.authStatus, error.message, true);
  }
});

elements.profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!state.user) {
    setStatus(elements.profileStatus, "Сначала войдите в аккаунт.", true);
    return;
  }

  const name = String(elements.profileForm.elements.name.value || "").trim();
  const phone = String(elements.profileForm.elements.phone.value || "").trim();

  try {
    const response = await request("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify({ name, phone }),
    });

    state.user = response.user;
    renderUser();
    elements.profileForm?.classList.add("is-hidden");
    if (elements.editProfileButton) {
      elements.editProfileButton.textContent = "Изменить";
    }
    setStatus(elements.profileStatus, response.message || "Профиль успешно обновлен.");
  } catch (error) {
    setStatus(elements.profileStatus, error.message, true);
  }
});

elements.editProfileButton?.addEventListener("click", () => {
  const isHidden = elements.profileForm?.classList.contains("is-hidden");
  if (!elements.profileForm || !state.user) {
    return;
  }

  if (isHidden) {
    elements.profileForm.elements.name.value = state.user.name || "";
    elements.profileForm.elements.phone.value = state.user.phone || "";
    elements.profileForm.classList.remove("is-hidden");
    elements.editProfileButton.textContent = "Отменить";
  } else {
    elements.profileForm.classList.add("is-hidden");
    elements.editProfileButton.textContent = "Изменить";
  }
});

elements.forgotPasswordButton?.addEventListener("click", async () => {
  const email = String(elements.loginForm.elements.email.value || "").trim();

  if (!email) {
    setStatus(elements.authStatus, "Введите email для восстановления пароля.", true);
    elements.loginForm.elements.email.focus();
    return;
  }

  try {
    const response = await request("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    ensureResetCodeField();
    elements.resetPasswordForm?.classList.remove("is-hidden");

    setStatus(
      elements.authStatus,
      response.message || "Если такой email существует, код восстановления отправлен."
    );
  } catch (error) {
    setStatus(elements.authStatus, error.message, true);
  }
});

elements.resetPasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = String(elements.loginForm?.elements?.email?.value || "").trim().toLowerCase();
  const code = String(elements.resetPasswordForm.elements.code?.value || "").trim();
  const password = String(elements.resetPasswordForm.elements.password.value || "");

  if (!email) {
    setStatus(elements.authStatus, "Введите email для восстановления пароля.", true);
    elements.loginForm?.elements?.email?.focus();
    return;
  }

  if (!code || code.length !== 6) {
    setStatus(elements.authStatus, "Введите 6-значный код из письма.", true);
    return;
  }

  const passwordError = getPasswordValidationError(password);
  if (passwordError) {
    setStatus(elements.authStatus, passwordError, true);
    return;
  }

  try {
    const response = await request("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, code, password }),
    });

    elements.resetPasswordForm.reset();
    setStatus(elements.authStatus, response.message || "Пароль успешно обновлен.");
    setTimeout(() => {
      window.location.href = "/auth/login";
    }, 1200);
  } catch (error) {
    setStatus(elements.authStatus, error.message, true);
  }
});

elements.logoutButton.addEventListener("click", async () => {
  try {
    await request("/api/auth/logout", { method: "POST" });
    state.user = null;
    renderUser();
    resetItemForm();

    if (isProfileRoute()) {
      window.location.href = "/auth/login";
      return;
    }

    if (isHomeRoute()) {
      await loginAsDefaultAdmin();
      await loadCatalog(elements.searchInput.value.trim());
      return;
    }

    window.location.href = "/auth/login";
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
  applyRouteLayout();

  if (isResetPasswordRoute()) {
    ensureResetCodeField();
    setStatus(elements.authStatus, "Используйте код из письма, чтобы задать новый пароль.");
  }

  try {
    await Promise.all([loadPopularItems(), loadCatalog(), loadCurrentUser()]);
    setStatus(elements.itemStatus, "");
  } catch (error) {
    setStatus(elements.itemStatus, error.message, true);
  }
}

init();






