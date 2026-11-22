"use strict";
function element(tag, cls = "", text = "") {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}
function icon(name) {
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg"),
    use = document.createElementNS(ns, "use");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", "#" + name);
  svg.append(use);
  return svg;
}
function link(cls, path, text = "") {
  const a = element("a", cls, text);
  a.href = "#" + path;
  return a;
}
let toastTimer,
  view = "",
  scopeYear = today.slice(0, 4),
  scopeMonth = today.slice(0, 7),
  filmDate = "";
function toast(message) {
  clearTimeout(toastTimer);
  const el = byId("toast");
  el.textContent = message;
  el.hidden = false;
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3100);
}
function go(path) {
  if (location.hash === "#" + path) route();
  else location.hash = path;
}
const screenElements = {
  welcome: "welcome",
  writer: "writer",
  year: "year-view",
  month: "month-view",
  reader: "reader",
};
function route() {
  if (!state) return;
  if (view === "writer" && currentDraft) updateWritingFields();
  choiceWidgets.forEach((w) => w.close());
  const [page, value, spread] = location.hash.slice(1).split("/");
  const signed = Boolean(state.profile?.name?.trim());
  let next = "welcome",
    date = today;
  if (signed) {
    next =
      { year: "year", month: "month", read: "reader", write: "writer" }[page] ||
      "writer";
    if (next === "month") {
      if (validDay(value + "-01")) scopeMonth = value;
      scopeYear = scopeMonth.slice(0, 4);
    } else if (next === "year") {
      if (/^(?!0000)\d{4}$/.test(value || "")) scopeYear = value;
    } else {
      date = validDay(value) && value <= today ? value : today;
      scopeYear = date.slice(0, 4);
      scopeMonth = date.slice(0, 7);
      if (
        next === "reader" &&
        !forMonth(scopeMonth).some((e) => e.date === date)
      )
        next = "month";
    }
  }
  // On the album board, playback belongs below the prints; account tools follow the board.
  if (next === "year" && view !== "year") {
    byId("year-view").append(byId("play-dock"));
    byId("pages").after(document.querySelector(".mast"));
  } else if (view === "year" && next !== "year") {
    byId("sound").after(byId("play-dock"));
    byId("pages").before(document.querySelector(".mast"));
  }
  view = next;
  document.body.dataset.view = next;
  document.body.dataset.season = seasonOf(scopeMonth);
  document.body.dataset.month = scopeMonth.slice(5, 7);
  syncBrowserPaper();
  Object.entries(screenElements).forEach(([name, id]) => {
    byId(id).hidden = name !== next;
  });
  byId("main-nav").hidden = byId("account-tools").hidden = !signed;
  const albums = byId("albums-nav"),
    write = byId("write-nav");
  albums.href = "#year/" + scopeYear;
  document.querySelector(".brand").href = signed ? "#year/" + scopeYear : "#";
  albums.removeAttribute("aria-current");
  write.removeAttribute("aria-current");
  if (signed)
    (next === "writer" ? write : albums).setAttribute("aria-current", "page");
  if (next === "writer") showComposer(date);
  if (next === "year") renderYear(scopeYear);
  if (next === "month") renderMonth(scopeMonth, spread);
  if (next === "reader") renderReader(date);
  if (next !== "reader") window.scrollTo({ top: 0, behavior: "instant" });
  document.title =
    {
      writer: "Запись дня",
      year: "Альбомы " + scopeYear,
      month: monthLabel(scopeMonth),
      reader: "Лента · " + monthLabel(scopeMonth),
      welcome: "Фотоальбом дней",
    }[next] + " — DAYTRACE";
}
let demographicsLoad;
async function loadDemographics() {
  if (!demographicsLoad) {
    demographicsLoad = Promise.all(
      ["countries", "life-data"].map(async (key) => {
        const response = await fetch("assets/" + key + ".json");
        if (!response.ok) throw Error();
        return response.json();
      }),
    )
      .then(([world, local]) => {
        countries = world;
        kz = local;
        names =
          typeof Intl.DisplayNames === "function"
            ? new Intl.DisplayNames(["ru"], { type: "region" })
            : null;
        for (const code of Object.keys(countries).sort((a, b) =>
          countryName(a).localeCompare(countryName(b), "ru"),
        ))
          byId("country").add(new Option(countryName(code), code));
      })
      .catch((error) => {
        demographicsLoad = null;
        throw error;
      });
  }
  return demographicsLoad;
}
function showLife() {
  const p = {
    name: byId("profile-name").value.trim(),
    birthday: byId("birth").value,
    sex: byId("sex").value,
    city: byId("city").value.trim(),
    country: byId("country").value,
  };
  const note = byId("life-note");
  if (!countries || !validProfile(p)) {
    note.textContent =
      "Если заполнить эти поля, здесь появится доля прожитого от средней продолжительности жизни.";
    return;
  }
  const r = estimate(p),
    percent = Math.min(100, (100 * r.lived) / r.total).toLocaleString("ru", {
      maximumFractionDigits: 1,
    });
  note.textContent =
    percent +
    "% уже позади · " +
    r.region +
    ". Ориентир рассчитан по средней продолжительности жизни при рождении.";
}
async function openPrefs(profile) {
  const dlg = byId("prefs");
  byId("dialog-title").textContent = profile ? "Профиль" : "Настройки";
  byId("profile-form").hidden = !profile;
  byId("settings-panel").hidden = profile;
  byId("night-paper").checked =
    document.documentElement.dataset.theme === "night";
  byId("hover-sound").checked = setting("daytrace-hover", "on") === "on";
  if (profile) {
    const p = state.profile;
    byId("profile-name").value = p.name;
    byId("birth").value = p.birthday || "";
    byId("birth").max = today;
    byId("city").value = p.city || "";
    byId("sex").value = p.sex || "all";
    byId("country").value = p.country || "";
    byId("profile-msg").textContent = "";
    byId("life-options").open = false;
    loadDemographics()
      .then(() => {
        byId("country").value = p.country || "";
        showLife();
      })
      .catch(() => {
        byId("life-note").textContent = "Статистика сейчас недоступна.";
      });
    showLife();
  }
  dlg.showModal();
}
function initPreferences() {
  byId("profile-open").onclick = () => openPrefs(true);
  byId("settings-open").onclick = () => openPrefs(false);
  byId("prefs").addEventListener("click", (e) => {
    if (e.target !== byId("prefs")) return;
    const b = e.target.getBoundingClientRect();
    if (
      e.clientX < b.left ||
      e.clientX > b.right ||
      e.clientY < b.top ||
      e.clientY > b.bottom
    )
      e.target.close();
  });
  byId("hover-sound").onchange = (e) =>
    saveSetting("daytrace-hover", e.target.checked ? "on" : "off");
  byId("night-paper").onchange = (e) =>
    applyPaper(e.target.checked ? "night" : "day", true);
  byId("profile-form").oninput = showLife;
  byId("profile-form").onsubmit = async (e) => {
    e.preventDefault();
    const name = byId("profile-name").value.trim(),
      msg = byId("profile-msg");
    if (!name) {
      msg.textContent = "Введи имя.";
      return;
    }
    const data = {
      name,
      birthday: byId("birth").value,
      city: byId("city").value.trim(),
      sex: byId("sex").value,
      country: countries ? byId("country").value : state.profile.country || "",
    };
    try {
      await changeState((old) => ({
        ...old,
        profile: { ...old.profile, ...data },
      }));
      byId("prefs").close();
      toast("Профиль сохранён.");
    } catch {
      msg.textContent = "Не удалось сохранить профиль.";
    }
  };
}
async function boot() {
  try {
    db = await openDB();
    state = await readState();
    if (state.demo || state.entries?.some((e) => e.demo)) {
      await changeState((old) => ({
        ...old,
        profile: old.profile?.demo ? null : old.profile,
        entries: (old.entries || []).filter((e) => !e.demo),
        demo: false,
      }));
    }
    initComposer();
    initAlbums();
    initPreferences();
    byId("name-form").onsubmit = async (e) => {
      e.preventDefault();
      const field = byId("first-name"),
        name = field.value.trim();
      if (!name) {
        byId("name-error").textContent = "Введи имя.";
        field.focus();
        return;
      }
      const submit = e.submitter || e.target.querySelector("button");
      submit.disabled = true;
      try {
        await changeState((old) => ({
          ...old,
          profile: { ...old.profile, name },
          demo: false,
        }));
        history.replaceState(null, "", "#write");
        route();
        byId("thoughts").focus({ preventScroll: true });
      } catch {
        byId("name-error").textContent =
          "Не удалось сохранить имя. Проверь, доступно ли хранилище сайта.";
      } finally {
        submit.disabled = false;
      }
    };
    window.addEventListener("hashchange", route);
    route();
  } catch (error) {
    console.error(error);
    byId("boot-error").hidden = false;
    byId("boot-error").textContent =
      "Дневник не смог открыться. Проверь, разрешено ли сайту сохранять данные, и обнови страницу.";
  }
}
boot();
