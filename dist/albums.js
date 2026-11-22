"use strict";
const seasonNames = {
  winter: "Зима",
  spring: "Весна",
  summer: "Лето",
  autumn: "Осень",
};
const romans = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];
function validDay(v) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v || "") &&
    v.slice(0, 4) !== "0000" &&
    Number.isFinite(ordinal(v)) &&
    dateAt(ordinal(v)) === v
  );
}
function seasonOf(ym) {
  return [
    "winter",
    "winter",
    "spring",
    "spring",
    "spring",
    "summer",
    "summer",
    "summer",
    "autumn",
    "autumn",
    "autumn",
    "winter",
  ][Number(ym.slice(5, 7)) - 1];
}
function monthLabel(ym) {
  const m = formatDate(ym + "-01", { month: "long" });
  return m[0].toUpperCase() + m.slice(1);
}
function records() {
  return (state.entries || [])
    .filter((e) => !e.demo && validDay(e.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function forMonth(ym) {
  return records().filter((e) => e.date.startsWith(ym + "-"));
}
function dateCount(n) {
  const form = new Intl.PluralRules("ru").select(n);
  return (
    n +
    " " +
    ({ one: "запись", few: "записи", many: "записей" }[form] || "записей")
  );
}
function offsetMonth(ym, delta) {
  const index = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5)) - 1 + delta,
    y = Math.floor(index / 12);
  if (y < 1 || y > 9999) return null;
  return (
    String(y).padStart(4, "0") + "-" + String((index % 12) + 1).padStart(2, "0")
  );
}
function addDate(ym, entries) {
  const max = ym === today.slice(0, 7) ? Number(today.slice(8)) : 31,
    used = new Set(entries.map((e) => e.date));
  if (ym > today.slice(0, 7)) return "";
  // Start at today in the current album and at the first blank day in older albums.
  const order = Array.from({ length: max }, (_, i) =>
    ym === today.slice(0, 7) ? max - i : i + 1,
  );
  return (
    order
      .map((n) => ym + "-" + String(n).padStart(2, "0"))
      .find((d) => validDay(d) && !used.has(d)) || ""
  );
}
function renderYear(year) {
  const yearNumber = Number(year);
  byId("year-number").value = yearNumber;
  byId("year-prev").disabled = yearNumber <= 1;
  byId("year-next").disabled = yearNumber >= 9999;

  const counts = Array(12).fill(0);
  for (const entry of records()) {
    if (entry.date.slice(0, 4) === year)
      counts[Number(entry.date.slice(5, 7)) - 1]++;
  }
  const cards = romans.map((roman, index) => {
    const number = String(index + 1).padStart(2, "0");
    const ym = year + "-" + number;
    const card = link("month-card", "month/" + ym);
    if (ym === today.slice(0, 7)) card.setAttribute("aria-current", "date");
    card.style.setProperty(
      "--cover",
      'url("assets/annual-' + number + '.webp")',
    );
    const illustration = element("span", "month-cover");
    illustration.setAttribute("aria-hidden", "true");
    illustration.append(element("span", "", roman));
    const caption = element("span", "month-foot");
    caption.append(
      element("strong", "", monthLabel(ym)),
      element("small", "", dateCount(counts[index])),
    );
    const report = currentReport(ym, forMonth(ym));
    if (report)
      caption
        .querySelector("strong")
        .append(scoreDot(MemoryContract.ranked(report.generated.days).average));
    card.append(illustration, caption);
    return card;
  });
  byId("months").replaceChildren(...cards);
}

const datesPerSheet = 14;
let lastReadDate = "";
const rotations = [
  -6.7, 3.6, -2.7, 2.7, -5.3, 3.5, 4, 1.2, 2.9, 7.1, -6.1, 2.8, -5.4, 2.8, 4,
];
function monthPath(date) {
  const spread = Math.ceil(Number(date.slice(8)) / datesPerSheet);
  return "month/" + date.slice(0, 7) + (spread > 1 ? "/" + spread : "");
}
function dayPrint(date, entry, slot) {
  const future = date > today;
  const label =
    formatDate(date) +
    " — " +
    (entry
      ? entry.title || "Запись дня"
      : future
        ? "День ещё впереди"
        : "Добавить запись");
  const className = entry ? "contact-card" : "unwritten-print";
  const card =
    future && !entry
      ? element("div", className)
      : link(className, (entry ? "read/" : "write/") + date);
  card.dataset.date = date;
  if (entry && date === lastReadDate) card.classList.add("last-read");
  card.style.setProperty("--turn", rotations[slot] + "deg");
  card.setAttribute("aria-label", label);
  card.title = label;
  if (future && !entry) card.setAttribute("aria-disabled", "true");
  if (date === today) card.setAttribute("aria-current", "date");
  const number = element("span", "day-no", String(Number(date.slice(8))));
  const mat = element("span", "contact-img");
  if (entry) {
    if (entry.photos?.[0]) {
      const img = element("img");
      img.src = entry.photos[0];
      img.alt = "";
      mat.append(img);
    } else
      mat.append(
        element(
          "span",
          "print-excerpt",
          entry.title || entry.text || "Запись дня",
        ),
      );
    bindPhotoAudio(mat, entry);
  } else {
    const glyph = element("span", "unknown-mark", "?");
    glyph.setAttribute("aria-hidden", "true");
    mat.append(glyph);
  }
  card.append(number, mat);
  return card;
}
function renderMonth(ym, requestedSheet) {
  const entries = forMonth(ym),
    saved = new Map(entries.map((e) => [e.date, e]));
  const endOfMonth = new Date(ym + "-01T00:00:00Z");
  endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1, 0);
  const length = endOfMonth.getUTCDate();
  const sheets = Math.ceil(length / datesPerSheet);
  const current = Math.min(
    sheets,
    Math.max(
      1,
      Number.isInteger(Number(requestedSheet)) ? Number(requestedSheet) : 1,
    ),
  );
  const first = (current - 1) * datesPerSheet + 1,
    last = Math.min(length, current * datesPerSheet);
  byId("month-name").textContent = new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(ym + "-01T00:00:00Z"));
  byId("month-year").textContent = ym.slice(0, 4);
  byId("month-count").textContent =
    monthLabel(ym) + " · " + dateCount(entries.length);
  byId("month-year-link").href = "#year/" + ym.slice(0, 4);
  byId("month-prev").disabled = !offsetMonth(ym, -1);
  byId("month-next").disabled = !offsetMonth(ym, 1);
  const grid = byId("contact-sheet"),
    nodes = [];
  for (let day = first; day <= last; day++) {
    const date = ym + "-" + String(day).padStart(2, "0");
    nodes.push(dayPrint(date, saved.get(date), day - first));
  }
  const next = addDate(ym, entries),
    hint = next
      ? "Добавить запись"
      : ym > today.slice(0, 7)
        ? "Месяц ещё впереди"
        : "Все доступные дни заполнены";
  const add = next
    ? link("add-print", "write/" + next)
    : element("div", "add-print");
  add.style.setProperty("--turn", rotations[nodes.length] + "deg");
  add.title = hint;
  add.setAttribute("aria-label", hint);
  const number = element("span", "day-no", "\u00a0"),
    mat = element("span", "contact-img");
  mat.append(icon("plus"));
  add.append(number, mat);
  if (!next) add.setAttribute("aria-disabled", "true");
  grid.replaceChildren(...nodes, add);
  const ranges = byId("spread-nav");
  ranges.replaceChildren();
  for (let page = 1; page <= sheets; page++) {
    const low = (page - 1) * datesPerSheet + 1,
      high = Math.min(page * datesPerSheet, length);
    const a = link(
      "spread-link",
      "month/" + ym + (page === 1 ? "" : "/" + page),
      low + "–" + high,
    );
    a.setAttribute("aria-label", "Дни с " + low + " по " + high);
    if (page === current) a.setAttribute("aria-current", "page");
    ranges.append(a);
  }
  setupMonthReport(ym, entries);
}

function albumPhoto(entry) {
  const photos = entry.photos || [],
    outer = element("div", "story-photo"),
    paper = element("figure", "instant story-print"),
    frame = element("div", "print-image"),
    caption = element("figcaption", "print-caption");
  const img = element("img"),
    count = element("span", "slide-count");
  let i = 0;
  function show(index) {
    i = (index + photos.length) % photos.length;
    img.src = photos[i];
    img.alt =
      "Снимок " +
      (i + 1) +
      " из " +
      photos.length +
      " · " +
      formatDate(entry.date);
    count.textContent = i + 1 + " / " + photos.length;
  }
  if (photos.length) {
    frame.append(img);
    show(0);
  }
  caption.append(
    element(
      "span",
      "",
      formatDate(entry.date, { day: "numeric", month: "long" }),
    ),
    icon("heart"),
  );
  if (photos.length > 1) {
    let swipeStart = null;
    for (const [direction, delta, key, label] of [
      ["back", -1, "left", "Предыдущий снимок"],
      ["forward", 1, "right", "Следующий снимок"],
    ]) {
      const b = element("button", "photo-direction " + direction),
        s = element("span");
      b.type = "button";
      b.setAttribute("aria-label", label);
      s.append(icon(key));
      b.append(s);
      b.onclick = () => {
        show(i + delta);
      };
      frame.append(b);
    }
    frame.addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        show(i + (e.key === "ArrowLeft" ? -1 : 1));
      }
    });
    frame.addEventListener(
      "touchstart",
      (e) => {
        const t = e.changedTouches[0];
        swipeStart = [t.clientX, t.clientY];
      },
      { passive: true },
    );
    frame.addEventListener(
      "touchend",
      (e) => {
        if (!swipeStart) return;
        const t = e.changedTouches[0],
          dx = t.clientX - swipeStart[0],
          dy = t.clientY - swipeStart[1];
        swipeStart = null;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          if (e.cancelable) e.preventDefault();
          show(i + (dx < 0 ? 1 : -1));
        } else if (Math.abs(dx) < 9 && Math.abs(dy) < 9) {
          const side = e.target.closest(".photo-direction");
          if (side && e.cancelable) {
            e.preventDefault();
            show(i + (side.classList.contains("forward") ? 1 : -1));
          }
        }
      },
      { passive: false },
    );
    frame.addEventListener("touchcancel", () => {
      swipeStart = null;
    });
    caption.append(count);
  }
  bindPhotoAudio(frame, entry);
  paper.append(frame, caption);
  outer.append(paper);
  if (trackSource(entry)) {
    const disc = element("button", "mini-disc");
    disc.type = "button";
    disc.dataset.date = entry.date;
    disc.setAttribute("aria-label", "Воспроизвести музыку дня");
    disc.onclick = () => startTrack(entry);
    outer.append(disc);
  }
  return outer;
}
function buildStory(entry) {
  const article = element("article", "story"),
    copy = element("div", "story-copy"),
    tools = element("div", "story-tools");
  article.id = "story-" + entry.date;
  article.dataset.date = entry.date;
  const date = element("time", "story-date", formatDate(entry.date));
  date.dateTime = entry.date;
  const swatch = element("i"),
    tone = palette[toneOf(entry)];
  swatch.style.backgroundColor = tone.color;
  swatch.title = tone.name;
  swatch.setAttribute("role", "img");
  swatch.setAttribute("aria-label", "Оттенок — " + tone.name);
  date.prepend(swatch);
  copy.append(
    date,
    element("h2", "", seasonNames[seasonOf(entry.date)]),
    element("p", "story-text", entry.text),
  );
  const edit = link("text-link", "write/" + entry.date, "Редактировать");
  tools.append(edit);
  const embedded = typeof linkPlayer === "function" && linkPlayer(entry);
  if (embedded) copy.append(embedded);
  if (!entry.demo) copy.append(tools);
  if (entry.director) directStory(article, copy, entry);
  article.append(albumPhoto(entry), copy);
  if (entry.director) {
    const decor = emotionDecor(
      directedStyle(entry.director).atmosphere,
      entry.date + (entry.director.analyzedAt || ""),
      directedStyle(entry.director).colorPalette,
    );
    if (decor) article.querySelector(".story-photo")?.append(decor);
  }
  return article;
}
function renderReader(date) {
  lastReadDate = date;
  const ym = date.slice(0, 7),
    list = forMonth(ym);
  byId("back-month").href = byId("reader-end").href = "#" + monthPath(date);
  const container = byId("stories");
  container.replaceChildren(...list.map(buildStory));
  syncPlayer();
  const target = byId("story-" + date) || container.firstElementChild;
  const develop = filmDate === date;
  filmDate = "";
  if (!target) return;
  if (develop) {
    target.classList.add("develop");
    toast("Готово! День в альбоме.");
  }
  requestAnimationFrame(() => {
    if (target.isConnected && view === "reader") {
      if (target === container.firstElementChild)
        window.scrollTo({ top: 0, behavior: "instant" });
      else target.scrollIntoView({ block: "start", behavior: "instant" });
    }
  });
}
function initAlbums() {
  byId("month-prev").onclick = () => go("month/" + offsetMonth(scopeMonth, -1));
  byId("month-next").onclick = () => go("month/" + offsetMonth(scopeMonth, 1));
  const yearMove = (n) => {
    if (n >= 1 && n <= 9999) go("year/" + String(n).padStart(4, "0"));
  };
  byId("year-prev").onclick = () => yearMove(Number(scopeYear) - 1);
  byId("year-next").onclick = () => yearMove(Number(scopeYear) + 1);
  byId("year-number").onchange = (e) => {
    if (e.target.value && e.target.validity.valid) yearMove(+e.target.value);
    else e.target.value = Number(scopeYear);
  };
  byId("read-start").onclick = () =>
    byId("stories").firstElementChild?.scrollIntoView({
      behavior: reduce() ? "instant" : "smooth",
    });
}
