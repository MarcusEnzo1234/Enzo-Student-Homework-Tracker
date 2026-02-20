(() => {
  "use strict";

  // ---------- tiny helpers ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const pad2 = (n) => String(n).padStart(2, "0");

  function safeParse(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function nowId() {
    // stable enough for demo
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function hashLite(str) {
    // demo-only hash (not secure)
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  // ---------- storage keys ----------
  const KEYS = {
    users: "hw_users_v1",
    session: "hw_session_v1",
    lastEmail: "hw_last_email_v1",
    data: (email) => `hw_data_v1_${email}`
  };

  function loadUsers() {
    return safeParse(localStorage.getItem(KEYS.users) || "[]", []);
  }
  function saveUsers(users) {
    localStorage.setItem(KEYS.users, JSON.stringify(users));
  }
  function setSession(email) {
    localStorage.setItem(KEYS.session, email);
    localStorage.setItem(KEYS.lastEmail, email);
  }
  function getSession() {
    return localStorage.getItem(KEYS.session) || "";
  }
  function clearSession() {
    localStorage.removeItem(KEYS.session);
  }
  function getLastEmail() {
    return localStorage.getItem(KEYS.lastEmail) || "";
  }

  function defaultData() {
    const t = todayISO();
    return {
      items: [
        { id: nowId(), task: "English reading: Chapter 2", subject: "English", due: t, priority: "medium", status: "todo", createdAt: Date.now() },
        { id: nowId(), task: "Solve 10 algebra problems", subject: "Math", due: t, priority: "high", status: "doing", createdAt: Date.now() }
      ]
    };
  }

  function loadData(email) {
    const raw = localStorage.getItem(KEYS.data(email));
    if (!raw) return defaultData();
    const d = safeParse(raw, defaultData());
    d.items ||= [];
    return d;
  }
  function saveData(email, data) {
    localStorage.setItem(KEYS.data(email), JSON.stringify(data));
  }

  // ---------- elements ----------
  const authScreen = $("#authScreen");
  const appScreen = $("#appScreen");

  const authTitle = $("#authTitle");
  const authSubtitle = $("#authSubtitle");

  const authMsg = $("#authMsg");
  const regMsg = $("#regMsg");
  const forgotMsg = $("#forgotMsg");

  const loginForm = $("#loginForm");
  const registerForm = $("#registerForm");
  const forgotForm = $("#forgotForm");

  const loginEmail = $("#loginEmail");
  const loginPass = $("#loginPass");
  const regName = $("#regName");
  const regEmail = $("#regEmail");
  const regPass = $("#regPass");
  const forgotEmail = $("#forgotEmail");
  const forgotPass = $("#forgotPass");

  const toggleLoginPass = $("#toggleLoginPass");
  const toggleRegPass = $("#toggleRegPass");
  const goRecovery = $("#goRecovery");

  const welcomeLine = $("#welcomeLine");
  const logoutBtn = $("#logoutBtn");

  const addHwForm = $("#addHwForm");
  const hwTask = $("#hwTask");
  const hwSubject = $("#hwSubject");
  const hwDue = $("#hwDue");
  const hwPriority = $("#hwPriority");
  const hwStatus = $("#hwStatus");
  const appMsg = $("#appMsg");

  const filterStatus = $("#filterStatus");
  const sortBy = $("#sortBy");
  const hwList = $("#hwList");

  const statTotal = $("#statTotal");
  const statToday = $("#statToday");
  const statOverdue = $("#statOverdue");

  // ---------- state ----------
  let currentEmail = "";
  let currentUser = null;
  let data = null;

  // ---------- UI helpers ----------
  function setMsg(el, text, type = "") {
    el.className = "msg" + (type ? ` ${type}` : "");
    el.textContent = text;
  }

  function showPanel(tab) {
    $$(".tabBtn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    $$(".authForm").forEach(f => f.classList.toggle("active", f.dataset.panel === tab));

    // clear messages
    setMsg(authMsg, "");
    setMsg(regMsg, "");
    setMsg(forgotMsg, "");
  }

  $$(".tabBtn").forEach(btn => {
    btn.addEventListener("click", () => showPanel(btn.dataset.tab));
  });

  goRecovery.addEventListener("click", () => showPanel("forgot"));

  function setPassToggle(btn, input) {
    btn.addEventListener("click", () => {
      input.type = (input.type === "password") ? "text" : "password";
    });
  }
  setPassToggle(toggleLoginPass, loginPass);
  setPassToggle(toggleRegPass, regPass);

  // ---------- auth title: Hello Again ----------
  function updateHelloAgain() {
    const last = getLastEmail();
    if (last) {
      authTitle.textContent = "Hello Again!";
      authSubtitle.textContent = "Welcome back — sign in to continue tracking homework.";
      loginEmail.value = last;
    } else {
      authTitle.textContent = "Welcome!";
      authSubtitle.textContent = "Let’s get started with your study routine.";
    }
  }

  // ---------- auth actions ----------
  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = regName.value.trim();
    const email = regEmail.value.trim().toLowerCase();
    const pass = regPass.value;

    if (!name || !email || !pass) return;

    const users = loadUsers();
    if (users.some(u => u.email === email)) {
      setMsg(regMsg, "That email is already registered. Try logging in.", "bad");
      return;
    }

    users.push({ name, email, passHash: hashLite(pass) });
    saveUsers(users);

    saveData(email, defaultData());
    setSession(email);

    boot();
  });

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim().toLowerCase();
    const pass = loginPass.value;

    const users = loadUsers();
    const u = users.find(x => x.email === email);

    if (!u) {
      setMsg(authMsg, "Account not found. Please register first.", "bad");
      return;
    }
    if (u.passHash !== hashLite(pass)) {
      setMsg(authMsg, "Wrong password. Try again.", "bad");
      return;
    }

    setSession(email);
    boot();
  });

  forgotForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = forgotEmail.value.trim().toLowerCase();
    const newPass = forgotPass.value;

    const users = loadUsers();
    const idx = users.findIndex(u => u.email === email);

    if (idx === -1) {
      setMsg(forgotMsg, "No account found for that email.", "bad");
      return;
    }

    users[idx].passHash = hashLite(newPass);
    saveUsers(users);

    setMsg(forgotMsg, "Password reset! You can log in now.", "ok");
    showPanel("login");
    loginEmail.value = email;
    loginPass.value = "";
  });

  logoutBtn.addEventListener("click", () => {
    clearSession();
    currentEmail = "";
    currentUser = null;
    data = null;
    showAuth();
  });

  // ---------- app logic ----------
  function dueLabel(dueISO) {
    const t = todayISO();
    if (dueISO === t) return "Due today";
    if (dueISO < t) return "Overdue";
    return `Due ${dueISO}`;
  }

  function priorityRank(p) {
    if (p === "high") return 0;
    if (p === "medium") return 1;
    return 2;
  }

  function statusText(s) {
    if (s === "todo") return "To Do";
    if (s === "doing") return "In Progress";
    return "Done";
  }

  function render() {
    if (!currentUser || !data) return;

    welcomeLine.textContent = `Welcome, ${currentUser.name}. Stay organized and win the week.`;

    const items = [...data.items];
    const filt = filterStatus.value;

    let shown = items;
    if (filt !== "all") shown = shown.filter(i => i.status === filt);

    // sort
    const sort = sortBy.value;
    if (sort === "dueSoon") {
      shown.sort((a, b) => (a.due || "").localeCompare(b.due || ""));
    } else if (sort === "priority") {
      shown.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    } else if (sort === "newest") {
      shown.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    // stats
    const t = todayISO();
    const total = data.items.length;
    const dueToday = data.items.filter(i => i.due === t && i.status !== "done").length;
    const overdue = data.items.filter(i => i.due < t && i.status !== "done").length;

    statTotal.textContent = String(total);
    statToday.textContent = String(dueToday);
    statOverdue.textContent = String(overdue);

    // list
    hwList.innerHTML = "";
    if (shown.length === 0) {
      const empty = document.createElement("li");
      empty.className = "hwItem";
      empty.innerHTML = `
        <div class="hwTop">
          <div>
            <div class="hwTask">No homework here yet.</div>
            <div class="muted small">Add a task on the left — you got this.</div>
          </div>
        </div>
      `;
      hwList.appendChild(empty);
      return;
    }

    shown.forEach(item => {
      const li = document.createElement("li");
      li.className = "hwItem";

      const dueTag = dueLabel(item.due);
      const dueIsOver = item.due < todayISO() && item.status !== "done";

      li.innerHTML = `
        <div class="hwTop">
          <div>
            <div class="hwTask">${escapeHtml(item.task)}</div>
            <div class="muted small">${escapeHtml(item.subject)} • ${escapeHtml(statusText(item.status))}</div>
          </div>
          <div class="badgeRow">
            <span class="badge ${item.priority}">${cap(item.priority)} Priority</span>
            <span class="badge ${dueIsOver ? "high" : "low"}">${escapeHtml(dueTag)}</span>
          </div>
        </div>

        <div class="hwMeta">
          <div>Due: <strong>${escapeHtml(item.due)}</strong></div>
          <div>Status: <strong>${escapeHtml(statusText(item.status))}</strong></div>
        </div>

        <div class="hwActions">
          <button class="smallBtn" type="button" data-action="cycle" data-id="${item.id}">Next Status</button>
          <button class="smallBtn dangerBtn" type="button" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      `;

      hwList.appendChild(li);
    });

    // wire buttons
    hwList.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const action = btn.getAttribute("data-action");
        if (action === "delete") removeItem(id);
        if (action === "cycle") cycleStatus(id);
      });
    });
  }

  function cap(s){ return s ? s[0].toUpperCase() + s.slice(1) : s; }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }

  function removeItem(id) {
    data.items = data.items.filter(i => i.id !== id);
    saveData(currentEmail, data);
    render();
  }

  function cycleStatus(id) {
    const it = data.items.find(i => i.id === id);
    if (!it) return;

    // todo -> doing -> done -> todo
    if (it.status === "todo") it.status = "doing";
    else if (it.status === "doing") it.status = "done";
    else it.status = "todo";

    saveData(currentEmail, data);
    render();
  }

  addHwForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const task = hwTask.value.trim();
    const subject = hwSubject.value.trim();
    const due = hwDue.value;
    const priority = hwPriority.value;
    const status = hwStatus.value;

    if (!task || !subject || !due) return;

    data.items.push({
      id: nowId(),
      task,
      subject,
      due,
      priority,
      status,
      createdAt: Date.now()
    });

    saveData(currentEmail, data);
    hwTask.value = "";
    hwSubject.value = "";
    hwPriority.value = "medium";
    hwStatus.value = "todo";

    setMsg(appMsg, "Added! Keep going 🔥", "ok");
    setTimeout(() => setMsg(appMsg, ""), 1200);

    render();
  });

  filterStatus.addEventListener("change", render);
  sortBy.addEventListener("change", render);

  // ---------- screens ----------
  function showAuth() {
    appScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    updateHelloAgain();
    showPanel("login");
  }

  function showApp() {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
  }

  // ---------- boot ----------
  function boot() {
    updateHelloAgain();

    const session = getSession();
    if (!session) {
      showAuth();
      return;
    }

    currentEmail = session;
    const users = loadUsers();
    currentUser = users.find(u => u.email === currentEmail) || null;

    if (!currentUser) {
      clearSession();
      showAuth();
      return;
    }

    data = loadData(currentEmail);

    // default due date today on add form
    hwDue.value = todayISO();

    showApp();
    render();
  }

  boot();
})();
