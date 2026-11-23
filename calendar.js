// Focus — calendrier mensuel connecté à Google Agenda
// Utilise Google Identity Services (OAuth côté navigateur) + l'API REST Google Calendar.

(() => {
  const CID_KEY = "focus-gcal-client-id";
  const TOKEN_KEY = "focus-gcal-token";
  const SCOPE = "https://www.googleapis.com/auth/calendar.events";
  const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  const $ = (id) => document.getElementById(id);
  const monthEl = $("cal-month");
  const grid = $("cal-grid");
  const statusEl = $("gcal-status");
  const dayTitle = $("day-title");
  const dayList = $("day-events");
  const form = $("event-form");
  const modal = $("gcal-modal");
  const notify = (msg) => (typeof toast === "function" ? toast(msg) : console.log(msg));

  let view = firstOfMonth(new Date());
  let selected = startOfDay(new Date());
  let events = [];
  let token = loadToken();
  let tokenClient = null;
  let tokenClientId = null;

  // ---------- Dates ----------
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function ymd(d) { return d.toLocaleDateString("sv-SE"); }
  function parseYmd(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  function hhmm(d) { return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }

  function gridRange() {
    const offset = (view.getDay() + 6) % 7; // semaine commençant le lundi
    const start = addDays(view, -offset);
    return { start, end: addDays(start, 42) };
  }

  // ---------- Identifiant & jeton ----------
  function getClientId() {
    const fromConfig = window.FOCUS_CONFIG && window.FOCUS_CONFIG.googleClientId;
    if (fromConfig) return fromConfig.trim();
    try { return (localStorage.getItem(CID_KEY) || "").trim(); } catch (e) { return ""; }
  }

  function loadToken() {
    try {
      const t = JSON.parse(localStorage.getItem(TOKEN_KEY));
      if (t && t.exp > Date.now() + 60000) return t.value;
    } catch (e) { /* ignore */ }
    return null;
  }
  function saveToken(value, expiresIn) {
    token = value;
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ value, exp: Date.now() + expiresIn * 1000 })); } catch (e) { /* ignore */ }
  }
  function clearToken() {
    token = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }

  // ---------- Connexion Google ----------
  function connect() {
    const cid = getClientId();
    if (!cid) { openModal(); return; }
    if (location.protocol === "file:") {
      notify("Google Agenda fonctionne quand l'app est en ligne (https) ou sur localhost.");
      return;
    }
    if (!(window.google && google.accounts && google.accounts.oauth2)) {
      notify("Chargement de Google… réessaie dans une seconde.");
      return;
    }
    if (!tokenClient || tokenClientId !== cid) {
      tokenClientId = cid;
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cid,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) { notify("Connexion à Google refusée."); return; }
          saveToken(resp.access_token, Number(resp.expires_in) || 3600);
          notify("Google Agenda connecté");
          renderStatus();
          fetchEvents();
        },
        error_callback: () => notify("Connexion à Google annulée."),
      });
    }
    tokenClient.requestAccessToken();
  }

  function disconnect() {
    if (token && window.google && google.accounts && google.accounts.oauth2) {
      google.accounts.oauth2.revoke(token, () => {});
    }
    clearToken();
    events = [];
    notify("Google Agenda déconnecté");
    renderAll();
  }

  // ---------- API ----------
  async function api(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (res.status === 401) {
      clearToken();
      renderAll();
      notify("Session Google expirée, reconnecte-toi.");
      throw new Error("auth");
    }
    if (!res.ok) throw new Error(await res.text());
    return res.status === 204 ? null : res.json();
  }

  function normalize(e) {
    const allDay = !!e.start.date;
    const start = allDay ? parseYmd(e.start.date) : new Date(e.start.dateTime);
    const end = allDay ? parseYmd(e.end.date) : new Date(e.end.dateTime);
    return { id: e.id, title: e.summary || "(Sans titre)", start, end, allDay, link: e.htmlLink };
  }

  let fetchSeq = 0;
  async function fetchEvents() {
    if (!token) { events = []; renderAll(); return; }
    const seq = ++fetchSeq;
    const { start, end } = gridRange();
    const params = new URLSearchParams({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    $("cal-loading").hidden = false;
    try {
      const data = await api(`${API}?${params}`);
      if (seq !== fetchSeq) return;
      events = (data.items || []).filter((e) => e.status !== "cancelled" && e.start).map(normalize);
    } catch (e) {
      if (e.message !== "auth") notify("Impossible de charger Google Agenda.");
    } finally {
      if (seq === fetchSeq) $("cal-loading").hidden = true;
    }
    renderAll();
  }

  async function createEvent(title, time, durationMin) {
    let body;
    if (time) {
      const [h, m] = time.split(":").map(Number);
      const start = new Date(selected); start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + durationMin * 60000);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      body = { summary: title, start: { dateTime: start.toISOString(), timeZone }, end: { dateTime: end.toISOString(), timeZone } };
    } else {
      body = { summary: title, start: { date: ymd(selected) }, end: { date: ymd(addDays(selected, 1)) } };
    }
    const created = await api(API, { method: "POST", body: JSON.stringify(body) });
    events.push(normalize(created));
    events.sort((a, b) => a.start - b.start);
    renderAll();
    notify("Ajouté à Google Agenda");
  }

  async function deleteEvent(id) {
    await api(`${API}/${encodeURIComponent(id)}`, { method: "DELETE" });
    events = events.filter((e) => e.id !== id);
    renderAll();
    notify("Événement supprimé");
  }

  function eventsOn(day) {
    const next = addDays(day, 1);
    return events.filter((e) => (e.start < next && e.end > day) || sameDay(e.start, day));
  }

  // ---------- Rendu ----------
  function renderGrid() {
    monthEl.textContent = view.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    grid.innerHTML = "";
    const { start } = gridRange();
    const today = startOfDay(new Date());

    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cal-day";
      if (d.getMonth() !== view.getMonth()) cell.classList.add("other");
      if (sameDay(d, today)) cell.classList.add("today");
      if (sameDay(d, selected)) cell.classList.add("selected");

      const num = document.createElement("span");
      num.className = "num";
      num.textContent = d.getDate();
      cell.appendChild(num);

      const evs = eventsOn(d);
      if (evs.length) {
        cell.classList.add("has-events");
        evs.slice(0, 2).forEach((e) => {
          const chip = document.createElement("span");
          chip.className = "chip";
          chip.textContent = (e.allDay ? "" : hhmm(e.start) + " ") + e.title;
          cell.appendChild(chip);
        });
        if (evs.length > 2) {
          const more = document.createElement("span");
          more.className = "chip more";
          more.textContent = `+${evs.length - 2}`;
          cell.appendChild(more);
        }
        const dot = document.createElement("span");
        dot.className = "dot";
        cell.appendChild(dot);
      }

      cell.addEventListener("click", () => {
        selected = d;
        if (d.getMonth() !== view.getMonth()) {
          view = firstOfMonth(d);
          renderAll();
          fetchEvents();
        } else {
          renderAll();
        }
      });
      grid.appendChild(cell);
    }
  }

  function renderStatus() {
    const side = document.getElementById("sidebar-gcal");
    if (side) {
      side.classList.toggle("on", !!token);
      side.querySelector(".status-text").textContent = token ? "Google Agenda connecté" : "Google Agenda non connecté";
    }
    statusEl.innerHTML = "";
    if (token) {
      statusEl.className = "gcal-status connected";
      const label = document.createElement("span");
      label.innerHTML = '<i class="live"></i>Google Agenda connecté';
      const btn = document.createElement("button");
      btn.className = "link-btn";
      btn.textContent = "Déconnecter";
      btn.addEventListener("click", disconnect);
      statusEl.append(label, btn);
    } else {
      statusEl.className = "gcal-status";
      const btn = document.createElement("button");
      btn.className = "gcal-btn";
      btn.innerHTML = '<span class="g">G</span>Connecter Google Agenda';
      btn.addEventListener("click", connect);
      const gear = document.createElement("button");
      gear.className = "icon-btn";
      gear.title = "Réglages Google";
      gear.textContent = "⚙";
      gear.addEventListener("click", openModal);
      statusEl.append(btn, gear);
    }
  }

  function renderDay() {
    const label = selected.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    dayTitle.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    dayList.innerHTML = "";

    if (!token) {
      dayList.innerHTML = '<li class="day-empty">Connecte Google Agenda pour voir et ajouter tes événements.</li>';
    } else {
      const evs = eventsOn(selected);
      if (!evs.length) dayList.innerHTML = '<li class="day-empty">Aucun événement ce jour-là.</li>';
      evs.forEach((e) => {
        const li = document.createElement("li");
        li.className = "day-event";

        const time = document.createElement("span");
        time.className = "ev-time";
        time.textContent = e.allDay ? "Journée" : `${hhmm(e.start)} – ${hhmm(e.end)}`;

        const title = document.createElement("a");
        title.className = "ev-title";
        title.textContent = e.title;
        if (e.link) { title.href = e.link; title.target = "_blank"; title.rel = "noopener"; }

        const del = document.createElement("button");
        del.className = "icon-btn ev-del";
        del.title = "Supprimer de Google Agenda";
        del.textContent = "✕";
        del.addEventListener("click", async () => {
          // 1er clic = demande de confirmation, 2e clic = suppression
          if (!del.classList.contains("confirm")) {
            del.classList.add("confirm");
            del.textContent = "Supprimer ?";
            setTimeout(() => { del.classList.remove("confirm"); del.textContent = "✕"; }, 3000);
            return;
          }
          try { await deleteEvent(e.id); } catch (err) { if (err.message !== "auth") notify("Suppression impossible."); }
        });

        li.append(time, title, del);
        dayList.appendChild(li);
      });
    }

    form.classList.toggle("disabled", !token);
    form.querySelectorAll("input, select, button").forEach((el) => (el.disabled = !token));
  }

  function renderAll() {
    renderGrid();
    renderStatus();
    renderDay();
  }

  // ---------- Modale réglages ----------
  function openModal() {
    $("gcal-client-id").value = getClientId();
    modal.hidden = false;
    setTimeout(() => $("gcal-client-id").focus(), 50);
  }
  function closeModal() { modal.hidden = true; }

  $("gcal-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  $("gcal-save").addEventListener("click", () => {
    const v = $("gcal-client-id").value.trim();
    if (!v.endsWith(".apps.googleusercontent.com")) {
      notify("L'ID client doit finir par .apps.googleusercontent.com");
      return;
    }
    try { localStorage.setItem(CID_KEY, v); } catch (e) { /* ignore */ }
    closeModal();
    connect();
  });

  // ---------- Navigation & formulaire ----------
  $("cal-prev").addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderAll(); fetchEvents(); });
  $("cal-next").addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderAll(); fetchEvents(); });
  $("cal-today").addEventListener("click", () => { view = firstOfMonth(new Date()); selected = startOfDay(new Date()); renderAll(); fetchEvents(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!token) { connect(); return; }
    const title = $("event-title").value.trim();
    if (!title) return;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await createEvent(title, $("event-time").value, Number($("event-duration").value));
      $("event-title").value = "";
      $("event-time").value = "";
    } catch (err) {
      if (err.message !== "auth") notify("Impossible d'ajouter l'événement.");
    } finally {
      btn.disabled = !token;
    }
  });

  // ---------- Init ----------
  renderAll();
  if (token) fetchEvents();
})();
