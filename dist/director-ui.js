"use strict";
function dirButton(label, fn) {
  const b = element("button", "text-link", label);
  b.type = "button";
  b.onclick = fn;
  return b;
}
function openDirectorDialog(title) {
  const box = byId("director-dialog");
  byId("director-heading").textContent = title;
  byId("director-body").replaceChildren();
  if (!box.open) box.showModal();
  return byId("director-body");
}
function explainDesign(entry, style) {
  const d = entry.director,
    ev = d.evidence;
  const section = element("details", "design-note");
  section.append(
    element("summary", "", "Почему этот день выглядит так?"),
    element("p", "director-origin", sourceCaption(d)),
    element(
      "p",
      "",
      (d.overrides?.designExplanation ? "Твоё пояснение. " : "") +
        style.designExplanation,
    ),
  );
  if (d.source === "ai" && d.vision)
    section.append(
      element(
        "p",
        "",
        "Модель получила миниатюры снимков и цвета, извлечённые из пикселей.",
      ),
    );
  const rule = element(
    "p",
    "",
    "Композиция — " +
      layoutNames[style.layoutVariant] +
      ". Заголовок — " +
      letteringNames[style.narrationTone] +
      ". Проявление снимка — " +
      motionSeconds(style) +
      " с.",
  );
  section.append(rule);
  const colors = element("div", "ink-swatches");
  for (const c of style.colorPalette) {
    const chip = element("i");
    chip.style.backgroundColor = c;
    chip.title = c;
    colors.append(chip);
  }
  section.append(
    colors,
    element(
      "p",
      "",
      d.overrides?.colorPalette
        ? "Цвета выбраны вручную."
        : ev.colors.length
          ? "В каждом оттенке 75% палитры оформления и 25% преобладающего цвета снимка."
          : "Использована палитра выбранной атмосферы.",
    ),
  );
  section.append(
    element(
      "p",
      "",
      "Тепло " +
        style.warmth +
        " · энергия " +
        style.energy +
        " · ностальгия " +
        style.nostalgia +
        " · напряжение " +
        style.tension +
        " из 100. Это характеристики записи.",
    ),
  );
  if (d.overrides?.atmosphere)
    section.append(
      element(
        "p",
        "",
        "Настроение выбрано вручную. Оно задаёт композицию, начертание и движение.",
      ),
    );
  if (ev.music.kind !== "none")
    section.append(
      element(
        "p",
        "",
        ev.music.kind === "link"
          ? "Музыка указана ссылкой. Учитываются только введённые сведения о треке."
          : "Для музыки использованы только название, имя файла или выбранный характер.",
      ),
    );
  return section;
}
function motionSeconds(s) {
  return +(2.65 - s.animationIntensity * 0.018).toFixed(2);
}
function directStory(article, copy, entry) {
  const d = entry.director,
    s = directedStyle(d);
  article.dataset.layout = s.layoutVariant;
  article.dataset.lettering = s.narrationTone;
  article.style.setProperty("--frame-ink", s.colorPalette[0]);
  article.style.setProperty("--tint-paper", s.colorPalette[1]);
  article.style.setProperty("--pen-color", s.colorPalette[2]);
  article.style.setProperty("--develop-time", motionSeconds(s) + "s");
  const title = copy.querySelector("h2");
  title.textContent = s.title;
  title.before(
    element(
      "small",
      "director-origin",
      entry.demo
        ? "Пример · " + atmosphereNames[s.atmosphere]
        : (d.overrides?.title
            ? "Твоё название"
            : d.source === "ai"
              ? "Название по записи"
              : "Локальное название") +
            " · " +
            atmosphereNames[s.atmosphere],
    ),
  );
  const why = explainDesign(entry, s);
  copy.append(why);
  if (!entry.demo)
    why.append(dirButton("Изменить оформление", () => editDesign(entry.date)));
}
function editDesign(date) {
  const entry = records().find((e) => e.date === date);
  if (!entry?.director) return;
  const d = entry.director,
    s = directedStyle(d),
    body = openDirectorDialog("Оформление дня"),
    form = element("form", "director-form");
  const controls = {};
  function field(name, label, type, value) {
    const l = element("label", "", label),
      el = element(
        type === "area" ? "textarea" : type === "select" ? "select" : "input",
      );
    if (el.tagName === "INPUT") el.type = type;
    if (type === "select") {
      for (const [v, n] of Object.entries(emotionNames))
        el.add(new Option(n, v));
      if (!Object.hasOwn(emotionNames, value))
        el.add(new Option(atmosphereNames[value] || value, value));
    }
    el.value = value;
    el.name = name;
    el.required = true;
    el.maxLength = name === "designExplanation" ? 420 : 120;
    l.append(el);
    form.append(l);
    controls[name] = el;
  }
  field("title", "Название дня", "text", s.title);
  field("folderTitle", "Название папки для скачивания", "text", s.folderTitle);
  field("atmosphere", "Настроение оформления", "select", s.atmosphere);
  field(
    "designExplanation",
    "Пояснение к оформлению",
    "area",
    s.designExplanation,
  );
  const colors = element("fieldset", "edit-swatches");
  colors.append(element("legend", "", "Цвета рамки, бумаги и чернил"));
  const inputs = s.colorPalette.map((c, i) => {
    const el = element("input");
    el.type = "color";
    el.value = c;
    el.setAttribute("aria-label", ["Рамка", "Бумага", "Чернила"][i]);
    colors.append(el);
    return el;
  });
  form.append(colors);
  const actions = element("div", "director-actions"),
    save = element("button", "ink-button", "Сохранить"),
    info = element("p", "msg");
  info.setAttribute("role", "status");
  async function commit(changes, reset = false) {
    save.disabled = true;
    try {
      await changeState((old) => ({
        ...old,
        entries: old.entries.map((e) => {
          if (e.date !== date || !e.director) return e;
          const over = reset ? {} : { ...e.director.overrides, ...changes };
          const director = { ...e.director, overrides: over };
          return {
            ...e,
            director,
            title: directedStyle(director).title,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
      byId("director-dialog").close();
      route();
      toast("Оформление сохранено.");
    } catch {
      info.textContent = "Не удалось сохранить оформление.";
    } finally {
      save.disabled = false;
    }
  }
  form.onsubmit = (e) => {
    e.preventDefault();
    const changed = {};
    for (const [k, el] of Object.entries(controls)) {
      const v = el.value.trim();
      if (!v) {
        el.focus();
        return;
      }
      if (v !== s[k]) changed[k] = v;
    }
    if (
      inputs.some(
        (el, i) => el.value.toLowerCase() !== s.colorPalette[i].toLowerCase(),
      )
    )
      changed.colorPalette = inputs.map((el) => el.value);
    commit(changed);
  };
  actions.append(
    save,
    dirButton("Вернуть исходное оформление", () => commit({}, true)),
  );
  form.append(actions, info);
  body.append(form);
}
function showExamples() {
  const body = openDirectorDialog("Три страницы дневника");
  body.append(
    element(
      "p",
      "director-origin",
      "Предпросмотр оформления",
    ),
  );
  const samples = [
    [
      "2025-01-12",
      "Мы с бабушкой пекли пирог. На столе остывал чай, и дома было очень уютно.",
      "coffee.jpg",
      "warm",
    ],
    [
      "2025-04-08",
      "Дождь стучал в окно. Скучаю по нашему старому дому и прогулкам после школы.",
      "memory-rain.webp",
      "blue",
    ],
    [
      "2025-07-19",
      "Последний поворот, финиш! Друзья кричали с трибун. Я ещё долго слышал этот ритм.",
      "road.jpg",
      "energy",
    ],
  ];
  for (const [date, text, file, tone] of samples) {
    const generated = MemoryContract.localMemory({ text, tone }),
      e = {
        date,
        text,
        tone,
        title: generated.title,
        photos: ["assets/" + file],
        mood: 6,
        demo: true,
        director: {
          generated,
          overrides: {},
          source: "local",
          reason: "disabled",
          evidence: { colors: [], music: { kind: "none" } },
        },
      };
    body.append(buildStory(e));
  }
}
function scoreDot(score) {
  const dot = element("i", "month-score-dot");
  dot.style.backgroundColor = "hsl(" + 1.2 * score + " 63% 44%)";
  dot.setAttribute("role", "img");
  dot.setAttribute("aria-label", "Цвет месяца, " + score + " из 100");
  dot.title = dot.getAttribute("aria-label");
  return dot;
}
function showReport(ym, report) {
  const body = openDirectorDialog(monthLabel(ym) + " · отчёт");
  const { sorted, average, best } = MemoryContract.ranked(
    report.generated.days,
  );
  const line = element(
    "p",
    "report-average",
    average.toLocaleString("ru") + " / 100",
  );
  line.prepend(scoreDot(average));
  const best_ = isBestMonth(ym, average);
  body.append(
    line,
    element("p", "month-description", monthDescription(ym)),
    ...(best_ ? [element("p", "best-month", bestMonthText(ym))] : []),
    element("p", "", report.generated.summary),
    element(
      "p",
      "director-origin",
      (report.source === "ai"
        ? "Оценка по записям"
        : "Локальная оценка · " +
          (fallbackNotes[report.reason] || fallbackNotes.offline)) +
        " Среднее по заполненным дням. При равенстве звезда у первого по дате.",
    ),
  );
  const ol = element("ol", "rank-days");
  for (const d of sorted) {
    const li = element("li"),
      a = link(
        "",
        "read/" + d.date,
        (d.date === best ? "★ " : "") +
          formatDate(d.date, { day: "numeric", month: "long" }),
      );
    a.onclick = () => byId("director-dialog").close();
    li.append(
      a,
      element("b", "", d.score + " / 100"),
      element("p", "", d.reason),
    );
    ol.append(li);
  }
  body.append(ol);
  if (report.source !== "ai")
    body.append(
      dirButton("Пересчитать", () =>
        generateReport(ym, true),
      ),
    );
}
const reportJobs = new Map();
async function generateReport(ym, enabled) {
  if (reportJobs.has(ym)) return;
  const days = monthInputs(forMonth(ym));
  if (!days.length) return;
  const signature = reportSignature(days),
    dialog = byId("director-dialog");
  const body = openDirectorDialog(monthLabel(ym) + " · отчёт");
  const status = element("p", "", "Собираем отчёт по записям…");
  status.setAttribute("role", "status");
  body.append(status);
  reportJobs.set(ym, true);
  try {
    const ctl = new AbortController();
    const answer = await directorRequest(
      "month",
      { ym, days },
      enabled,
      (v) =>
        MemoryContract.validMonth(
          v,
          days.map((d) => d.date),
        ),
      () => localMonth(days),
      (message) => {
        status.textContent = message;
      },
      ctl.signal,
    );
    const report = {
      ...answer,
      signature,
      createdAt: new Date().toISOString(),
    };
    let stored = false;
    await changeState((old) => {
      const current = monthInputs(
        (old.entries || []).filter(
          (e) => !e.demo && e.date.startsWith(ym + "-"),
        ),
      );
      if (reportSignature(current) !== signature) return old;
      stored = true;
      return { ...old, monthReports: { ...old.monthReports, [ym]: report } };
    });
    if (view === "month" && scopeMonth === ym) {
      renderMonth(ym, location.hash.split("/")[2]);
      if (dialog.open && status.isConnected) {
        if (stored) showReport(ym, report);
        else status.textContent = "Записи изменились. Открой отчёт ещё раз.";
      }
    }
  } catch {
    status.textContent = "Не удалось сохранить отчёт. Попробуй ещё раз.";
  } finally {
    reportJobs.delete(ym);
  }
}
function setupMonthReport(ym, entries) {
  const b = byId("director-report"),
    report = currentReport(ym, entries);
  byId("month-desc").textContent = monthDescription(ym);
  b.disabled = !entries.length;
  b.textContent = "Отчёт месяца";
  b.title = entries.length
    ? "Рейтинг записанных дней"
    : "Отчёт появится после первой записи";
  if (report) {
    const { average, best } = MemoryContract.ranked(report.generated.days);
    byId("month-name").append(scoreDot(average));
    b.textContent = "Отчёт · " + average.toLocaleString("ru") + " / 100";
    const card = byId("contact-sheet").querySelector(
      '[data-date="' + best + '"]',
    );
    if (card) {
      card.append(element("span", "report-star", "★"));
      card.setAttribute("aria-label", card.title + " · лучший день месяца");
      card.title += " · лучший день месяца";
    }
  }
  b.onclick = () => {
    if (report) return showReport(ym, report);
    if (reportJobs.has(ym)) {
      toast("Отчёт ещё готовится.");
      return;
    }
    const body = openDirectorDialog("Отчёт за " + monthLabel(ym).toLowerCase());
    body.append(
      element("p", "month-description", monthDescription(ym)),
      element(
        "p",
        "",
      "В рейтинг войдут только заполненные дни. Оценка считается мгновенно на этом устройстве.",
      ),
      dirButton("Составить отчёт", () => generateReport(ym, true)),
    );
  };
}

/* Minimal line motifs that appear around the photo, fixed per emotion. */
const motifPaths = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14c1 1.8 2.5 2.5 4 2.5s3-.7 4-2.5M9 9.5h.01M15 9.5h.01"/>',
  frown: '<circle cx="12" cy="12" r="9"/><path d="M8 16.5c1-1.5 2.5-2 4-2s3 .5 4 2M9 9.5h.01M15 9.5h.01"/>',
  spark: '<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z"/>',
  drop: '<path d="M12 3c3.5 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 2.5-6.5 6-11z"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.8 4.8 0 0 1 17 18z"/>',
  bolt: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.5 1 2 2 2-1-3 0-5 1-8z"/>',
  zigzag: '<path d="M3 15l4-6 4 6 4-6 4 6"/>',
  spike: '<path d="M12 3v18M4 7.5l16 9M20 7.5l-16 9"/>',
  wave: '<path d="M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0 3-3 5-2"/>',
  leaf: '<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19l8-8"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flower: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="5.5" r="2.5"/><circle cx="12" cy="18.5" r="2.5"/><circle cx="5.5" cy="12" r="2.5"/><circle cx="18.5" cy="12" r="2.5"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M16 5v14"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  chevrons: '<path d="M6 7l5 5-5 5M13 7l5 5-5 5"/>',
};
const emotionMotifs = {
  joy: ["sun", "spark", "smile", "star"],
  sadness: ["drop", "cloud", "frown", "moon"],
  anger: ["bolt", "flame", "zigzag", "spike"],
  energy: ["bolt", "chevrons", "wave", "star"],
  calm: ["leaf", "moon", "wave", "cloud"],
  nostalgia: ["film", "clock", "flower", "leaf"],
  tenderness: ["heart", "flower", "spark", "smile"],
  inspiration: ["spark", "star", "bolt", "sun"],
  anxiety: ["zigzag", "spike", "cloud", "clock"],
  loneliness: ["moon", "cloud", "drop", "leaf"],
  pride: ["star", "spark", "sun", "heart"],
  gratitude: ["heart", "flower", "leaf", "sun"],
  boredom: ["cloud", "clock", "wave", "drop"],
  curiosity: ["spark", "star", "spike", "chevrons"],
  hope: ["sun", "leaf", "spark", "flower"],
};
const legacyEmotion = {
  warm: "joy",
  melancholic: "sadness",
  energetic: "energy",
  quiet: "calm",
};
function seededRandom(text) {
  let h = 1779033703;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353) << 13 | h >>> 19;
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
/* 2 line icons of the emotion + 3 emoji drawn from the whole emoji pool, stable per analysis. */
function emotionDecor(atmosphere, seed, palette = []) {
  const key = legacyEmotion[atmosphere] || atmosphere,
    list = emotionMotifs[key];
  if (!list) return null;
  const rnd = seededRandom(seed + key),
    shuffle = (a) => {
      const r = [...a];
      for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
      }
      return r;
    };
  const slots = shuffle([1, 2, 3, 4, 5, 6]).slice(0, 5),
    icons = shuffle(list).slice(0, 2),
    pool = typeof EMOJI_POOL !== "undefined" ? EMOJI_POOL : ["✨"],
    box = element("div", "emotion-deco");
  box.setAttribute("aria-hidden", "true");
  slots.forEach((slot, i) => {
    const wrap = element("span", "deco-" + slot);
    // Random size and tilt for every piece; line icons also get their own colour.
    wrap.style.setProperty("--k", (0.75 + rnd() * 1.1).toFixed(2));
    wrap.style.rotate = Math.round(rnd() * 50 - 25) + "deg";
    if (i < 2) {
      wrap.style.color =
        palette.length && rnd() < 0.4
          ? palette[Math.floor(rnd() * palette.length)]
          : "hsl(" + Math.round(rnd() * 360) + " 58% 46%)";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.innerHTML = motifPaths[icons[i]];
      wrap.append(svg);
    } else {
      wrap.classList.add("deco-emoji");
      wrap.textContent = pool[Math.floor(rnd() * pool.length)];
    }
    box.append(wrap);
  });
  return box;
}
