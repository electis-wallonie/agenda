// Focus — to-do list (jour / semaine / objectifs)
// Les données sont stockées dans le localStorage du navigateur.

const STORAGE_KEY = "focus-todo-v1";

const LISTS = [
  { id: "today", title: "Aujourd'hui", icon: "☀️", hint: "Ce que je dois faire dans la journée." },
  { id: "week", title: "Cette semaine", icon: "📅", hint: "Ce que je dois boucler avant dimanche." },
  { id: "goals", title: "Objectifs", icon: "🎯", hint: "Mes objectifs et les trucs importants." },
];

// ---------- Stockage ----------
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* stockage indisponible */ }
  return { tasks: [], doneLog: {} };
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

let state = load();
if (!state.tasks) state.tasks = [];
if (!state.doneLog) state.doneLog = {};

const todayKey = () => new Date().toLocaleDateString("sv-SE");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- Rendu ----------
const board = document.getElementById("board");
const tpl = document.getElementById("list-template");
const listEls = {};

function buildLists() {
  LISTS.forEach((cfg) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.list = cfg.id;
    node.id = cfg.id;
    node.querySelector("h2").textContent = cfg.title;
    node.querySelector("input").setAttribute("aria-label", `Ajouter une tâche — ${cfg.title}`);

    const form = node.querySelector(".add");
    const input = form.querySelector("input");
    const flag = form.querySelector(".flag-toggle");

    flag.addEventListener("click", () => {
      const on = flag.classList.toggle("on");
      flag.setAttribute("aria-pressed", on ? "true" : "false");
      input.focus();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addTask(cfg.id, text, flag.classList.contains("on"));
      input.value = "";
      flag.classList.remove("on");
      flag.setAttribute("aria-pressed", "false");
      input.focus();
    });

    board.appendChild(node);
    listEls[cfg.id] = node;
  });
}

function renderList(listId) {
  const node = listEls[listId];
  const ul = node.querySelector(".items");
  ul.innerHTML = "";

  const tasks = state.tasks
    .filter((t) => t.list === listId)
    .sort((a, b) => (b.important - a.important) || (a.createdAt - b.createdAt));

  tasks.forEach((t) => ul.appendChild(renderItem(t)));

  node.querySelector(".count").textContent = tasks.length;
  node.classList.toggle("has-items", tasks.length > 0);
}

function renderItem(task) {
  const li = document.createElement("li");
  li.className = "item" + (task.important ? " important" : "");
  li.dataset.id = task.id;

  const check = document.createElement("button");
  check.className = "check";
  check.setAttribute("aria-label", "Cocher comme fait");
  check.textContent = "✓";
  check.addEventListener("click", () => completeTask(task.id, li));

  const text = document.createElement("span");
  text.className = "item-text";
  text.textContent = task.text;
  text.title = "Double-clic pour modifier";
  text.addEventListener("dblclick", () => editTask(task.id, text));

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const star = document.createElement("button");
  star.className = "icon-btn star" + (task.important ? " on" : "");
  star.title = task.important ? "Retirer « important »" : "Marquer comme important";
  star.textContent = "★";
  star.setAttribute("aria-label", star.title);
  star.addEventListener("click", () => toggleImportant(task.id));

  const del = document.createElement("button");
  del.className = "icon-btn";
  del.title = "Supprimer";
  del.textContent = "✕";
  del.setAttribute("aria-label", "Supprimer");
  del.addEventListener("click", () => deleteTask(task.id, li));

  actions.append(star, del);
  li.append(check, text);
  if (task.important) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = "Important";
    li.appendChild(tag);
  }
  li.appendChild(actions);
  return li;
}

function renderStats() {
  document.getElementById("stat-open").textContent = state.tasks.length;
  document.getElementById("stat-important").textContent = state.tasks.filter((t) => t.important).length;
  const done = state.doneLog[todayKey()] || 0;
  const openToday = state.tasks.filter((t) => t.list === "today").length;
  const total = done + openToday;
  document.getElementById("stat-progress").textContent = `${done} / ${total}`;
  document.getElementById("progress-bar").style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
}

function renderAll() {
  LISTS.forEach((l) => renderList(l.id));
  renderStats();
}

// ---------- Actions ----------
function addTask(list, text, important) {
  state.tasks.push({ id: uid(), list, text, important: !!important, createdAt: Date.now() });
  save();
  renderList(list);
  renderStats();
}

function completeTask(id, li) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || li.classList.contains("leaving")) return;

  li.classList.add("done");
  setTimeout(() => li.classList.add("leaving"), 250);

  setTimeout(() => {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    const k = todayKey();
    state.doneLog[k] = (state.doneLog[k] || 0) + 1;
    save();
    renderList(task.list);
    renderStats();
    toast(task.important ? "Bien joué, une tâche importante en moins !" : "Tâche terminée");
  }, 700);
}

function deleteTask(id, li) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  li.classList.add("leaving");
  setTimeout(() => {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    save();
    renderList(task.list);
    renderStats();
  }, 450);
}

function toggleImportant(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  task.important = !task.important;
  save();
  renderList(task.list);
  renderStats();
}

function editTask(id, span) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  const input = document.createElement("input");
  input.value = task.text;
  input.maxLength = 140;
  input.className = "item-text";
  input.style.cssText = "background:transparent;border:none;outline:none;color:inherit;font:inherit;";
  span.replaceWith(input);
  input.focus();
  input.select();

  const finish = (commit) => {
    const v = input.value.trim();
    if (commit && v) { task.text = v; save(); }
    renderList(task.list);
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

// ---------- UI ----------
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
}

function setHeader() {
  const now = new Date();
  document.getElementById("today-date").textContent = now.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
  const h = now.getHours();
  const hello = h < 6 ? "Bonne nuit" : h < 18 ? "Bonjour" : "Bonsoir";
  document.getElementById("greeting").textContent = `${hello}, on avance ?`;
}

function setupNav() {
  const links = document.querySelectorAll(".nav-link");
  links.forEach((a) => a.addEventListener("click", () => {
    links.forEach((l) => l.classList.remove("active"));
    a.classList.add("active");
  }));
  document.getElementById("new-task").addEventListener("click", () => {
    const input = listEls.today.querySelector(".add input");
    listEls.today.scrollIntoView({ behavior: "smooth", block: "center" });
    input.focus({ preventScroll: true });
  });
}

// ---------- Init ----------
setHeader();
setupNav();
buildLists();
renderAll();
