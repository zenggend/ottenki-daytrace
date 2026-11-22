"use strict";
let writeDate = "",
  currentDraft = null,
  savingDay = false;
const dateDrafts = new Map();
let uploadsInFlight = 0;
function freshDraft(e) {
  return {
    text: e?.text || "",
    photos: [...(e?.photos || [])],
    originalPhotos: [
      ...(e?.originalPhotos || (e?.photos || []).map(() => null)),
    ],
    useAI:
      e?.director?.requestedAI ??
      localStorage.getItem("daytrace-local-model") !== "off",
    song: e?.song || "",
    url: e?.songUrl || "",
    energy: e?.energy || "",
    rating: e?.manualMood ? e.mood : null,
    tone: e?.tone || "",
    audio: e?.audio || null,
    audioName: e?.audioName || "",
    musicOpen: Boolean(e && musicCaption(e)),
  };
}
function updateWritingFields() {
  if (!currentDraft) return;
  Object.assign(currentDraft, {
    text: byId("thoughts").value,
    useAI: byId("director-enabled").checked,
    song: byId("song-name").value,
    url: byId("song-url").value,
    energy: byId("energy").value,
    tone: byId("entry-tone").value,
  });
}
function writingBusy() {
  for (const group of document.querySelectorAll(
    ".write-visual, .write-copy > :not(.save-line)",
  ))
    group.inert = savingDay;
  byId("save-day").disabled = Boolean(uploadsInFlight || savingDay);
  byId("photos").disabled = Boolean(uploadsInFlight || savingDay);
  byId("song-file").disabled = Boolean(uploadsInFlight || savingDay);
  byId("clear-music").disabled = Boolean(uploadsInFlight || savingDay);
}
function drawPhotos() {
  const photos = currentDraft.photos,
    img = byId("hero-photo");
  img.hidden = !photos.length;
  byId("upload-copy").hidden = !!photos.length;
  if (photos.length) img.src = photos[0];
  else img.removeAttribute("src");
  const strip = byId("thumbs");
  strip.replaceChildren();
  photos.forEach((src, i) => {
    const wrap = element("div", "thumb"),
      photo = element("img"),
      remove = element("button", "", "×");
    photo.src = src;
    photo.alt = "Снимок " + (i + 1);
    remove.type = "button";
    remove.setAttribute("aria-label", "Убрать снимок " + (i + 1));
    remove.onclick = () => {
      if (!savingDay) {
        currentDraft.photos.splice(i, 1);
        currentDraft.originalPhotos.splice(i, 1);
        drawPhotos();
      }
    };
    wrap.append(photo, remove);
    strip.append(wrap);
  });
  if (photos.length && photos.length < 4) {
    const add = element("label", "strip-add");
    add.htmlFor = "photos";
    add.title = "Добавить ещё фото";
    add.append(icon("plus"));
    strip.append(add);
  }
}
function drawMusic() {
  byId("music-fields").hidden = !currentDraft.musicOpen;
  byId("music-toggle").setAttribute(
    "aria-expanded",
    String(currentDraft.musicOpen),
  );
  byId("music-toggle").querySelector("span").textContent =
    currentDraft.audio || currentDraft.song || currentDraft.url
      ? "Музыка дня"
      : "Добавить музыку";
  byId("audio-name").textContent =
    currentDraft.audioName ||
    (currentDraft.audio ? "Аудиофайл прикреплён" : "Прикрепить аудиофайл");
}
function showComposer(date) {
  writeDate = date;
  currentDraft =
    dateDrafts.get(date) || freshDraft(records().find((e) => e.date === date));
  dateDrafts.set(date, currentDraft);
  const month = date.slice(0, 7);
  byId("write-title").textContent = "Запись дня";
  byId("editor-month").href = "#" + monthPath(date);
  byId("editor-month").textContent = monthLabel(month) + " · К снимкам";
  byId("date-title").textContent = formatDate(date);
  byId("caption-date").textContent = formatDate(date, {
    month: "long",
    day: "numeric",
  });
  byId("entry-date").max = today;
  byId("entry-date").min = "0001-01-01";
  byId("entry-date").value = date;
  byId("next-date").disabled = date >= today;
  byId("prev-date").disabled = date === "0001-01-01";
  byId("to-today").hidden = date === today;
  byId("thoughts").value = currentDraft.text;
  byId("director-enabled").checked = currentDraft.useAI;
  byId("song-name").value = currentDraft.song;
  byId("song-url").value = currentDraft.url;
  byId("entry-tone").value = currentDraft.tone;
  byId("energy").value = currentDraft.energy;
  byId("editor-status").textContent = "";
  drawPhotos();
  drawMusic();
  refreshChoices();
  writingBusy();
}
function clearMusic() {
  Object.assign(currentDraft, {
    song: "",
    url: "",
    energy: "",
    audio: null,
    audioName: "",
    musicOpen: false,
  });
  byId("song-name").value = "";
  byId("song-url").value = "";
  byId("energy").value = "";
  byId("song-file").value = "";
  drawMusic();
  refreshChoices();
  byId("music-toggle").focus();
}
function initComposer() {
  byId("director-enabled").addEventListener("change", (e) => {
    localStorage.setItem(
      "daytrace-local-model",
      e.target.checked ? "enabled" : "off",
    );
  });
  for (const [v, m] of Object.entries(palette))
    byId("entry-tone").add(new Option(m.name, v));
  for (const [v, m] of Object.entries(energyNames))
    byId("energy").add(new Option(m, v));
  skinChoice(
    byId("entry-tone"),
    Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, v.color])),
  );
  skinChoice(byId("energy"), {
    calm: "#91a094",
    warm: "#cbaa76",
    drive: "#bb8062",
    melancholy: "#8591a3",
  });
  byId("day-form").addEventListener("input", updateWritingFields);
  byId("day-form").addEventListener("change", updateWritingFields);
  byId("prev-date").onclick = () =>
    go("write/" + dateAt(ordinal(writeDate) - 1));
  byId("next-date").onclick = () =>
    go("write/" + dateAt(ordinal(writeDate) + 1));
  byId("to-today").onclick = () => go("write/" + today);
  byId("entry-date").onchange = (e) => {
    const date = e.target.value;
    if (validDay(date) && date <= today) go("write/" + date);
    else e.target.value = writeDate;
  };
  byId("music-toggle").onclick = () => {
    currentDraft.musicOpen = !currentDraft.musicOpen;
    drawMusic();
  };
  byId("clear-music").onclick = clearMusic;
  byId("photos").onchange = async (e) => {
    const files = Array.from(e.target.files || []),
      draft = currentDraft;
    e.target.value = "";
    if (!files.length) return;
    const msg = byId("editor-status");
    if (files.length + draft.photos.length > 4) {
      msg.textContent = "В одной записи помещается до четырёх фото.";
      return;
    }
    if (
      files.some(
        (f) =>
          !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
          f.size > 12 * 1024 * 1024,
      )
    ) {
      msg.textContent = "Выбери снимки JPG, PNG или WebP до 12 МБ каждый.";
      return;
    }
    uploadsInFlight++;
    writingBusy();
    msg.textContent = "Готовим снимки…";
    try {
      const ready = [];
      for (const f of files) ready.push(await compressPhoto(f));
      draft.photos.push(...ready);
      draft.originalPhotos.push(...files);
      if (draft === currentDraft) {
        drawPhotos();
        msg.textContent = "";
      }
    } catch {
      if (draft === currentDraft)
        msg.textContent = "Не удалось прочитать снимок. Попробуй другой файл.";
    } finally {
      uploadsInFlight--;
      writingBusy();
    }
  };
  byId("song-file").onchange = async (e) => {
    const file = e.target.files?.[0],
      draft = currentDraft;
    e.target.value = "";
    if (!file) return;
    const msg = byId("editor-status");
    if (
      file.size > 20 * 1024 * 1024 ||
      !(
        file.type.startsWith("audio/") ||
        /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(file.name)
      )
    ) {
      msg.textContent = "Выбери аудиофайл до 20 МБ.";
      return;
    }
    uploadsInFlight++;
    writingBusy();
    msg.textContent = "Читаем аудиофайл…";
    try {
      const data = await readFile(file);
      draft.audio = data;
      draft.audioName = file.name;
      if (currentDraft === draft) {
        drawMusic();
        msg.textContent = "";
      }
    } catch {
      if (currentDraft === draft)
        msg.textContent = "Не удалось прочитать аудиофайл.";
    } finally {
      uploadsInFlight--;
      writingBusy();
    }
  };
  byId("day-form").onsubmit = async (e) => {
    e.preventDefault();
    if (savingDay || uploadsInFlight) return;
    updateWritingFields();
    const d = currentDraft,
      date = writeDate,
      msg = byId("editor-status");
    if (!d.text.trim()) {
      msg.textContent = "Напиши несколько слов об этом дне.";
      byId("thoughts").focus();
      return;
    }
    if (!d.photos.length) {
      msg.textContent = "Добавь хотя бы один снимок.";
      byId("photos").focus();
      return;
    }
    if (d.url.trim() && !safeUrl(d.url.trim())) {
      msg.textContent =
        "Для ссылки на музыку нужен адрес с https:// или http://.";
      d.musicOpen = true;
      drawMusic();
      byId("song-url").focus();
      return;
    }
    savingDay = true;
    writingBusy();
    msg.textContent = d.useAI
      ? "ИИ подбирает оформление…"
      : "Подбираем палитру снимков…";
    try {
      const existed = records().some((e) => e.date === date);
      const snapshot = {
        ...d,
        photos: [...d.photos],
        originalPhotos: [...d.originalPhotos],
      };
      const ctl = new AbortController();
      byId("cancel-analysis").hidden = !snapshot.useAI;
      byId("cancel-analysis").onclick = () => ctl.abort();
      const director = await analyzeDraft(
        snapshot,
        snapshot.useAI,
        (text) => {
          if (currentDraft === d) msg.textContent = text;
        },
        ctl.signal,
      );
      director.requestedAI = snapshot.useAI;
      const entry = await storeDay(date, { ...snapshot, director });
      dateDrafts.delete(date);
      if (
        activeTrack?.date === date &&
        trackSource(activeTrack) !== trackSource(entry)
      )
        closePlayer();
      if (currentDraft === d && view === "writer") {
        currentDraft = null;
        filmDate = existed ? "" : date;
        if (existed) toast("Изменения сохранены.");
        go("read/" + date);
      } else toast("День сохранён.");
    } catch {
      msg.textContent =
        "Не удалось сохранить день. Проверь свободное место в браузере и попробуй ещё раз.";
    } finally {
      byId("cancel-analysis").hidden = true;
      savingDay = false;
      writingBusy();
    }
  };
}
const choiceWidgets = [];
function skinChoice(select, colors) {
  const wrap = select.parentElement,
    trigger = element("button", "choice-trigger"),
    list = element("span", "choice-list");
  const dot = element("i"),
    label = element("span"),
    chev = icon("right");
  trigger.type = "button";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", select.id + "-items");
  list.id = select.id + "-items";
  list.hidden = true;
  trigger.append(dot, label, chev);
  select.hidden = true;
  if (select.id === "entry-tone") byId("tone-dot").hidden = true;
  wrap.insertAdjacentElement("afterend", list);
  wrap.replaceWith(trigger);
  trigger.after(list);
  const group = element("span", "choice-wrap");
  trigger.before(group);
  group.append(select, trigger, list);
  function close() {
    list.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }
  for (const o of select.options) {
    const b = element("button"),
      swatch = element("i");
    swatch.style.backgroundColor = colors[o.value] || "transparent";
    b.type = "button";
    b.append(swatch, document.createTextNode(o.text));
    b.onclick = () => {
      select.value = o.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      close();
      trigger.focus();
      refreshChoices();
    };
    list.append(b);
  }
  function open() {
    choiceWidgets.forEach((w) => w.close());
    list.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    list.children[select.selectedIndex]?.focus();
  }
  trigger.onclick = () => (list.hidden ? open() : close());
  group.onkeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      trigger.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (list.hidden) open();
      else {
        const n = list.children.length,
          i = Array.from(list.children).indexOf(document.activeElement);
        list.children[(i + n + (e.key === "ArrowDown" ? 1 : -1)) % n].focus();
      }
    }
  };
  group.addEventListener("focusout", (e) => {
    if (!group.contains(e.relatedTarget)) close();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!group.contains(e.target)) close();
  });
  choiceWidgets.push({
    close,
    sync() {
      const o = select.selectedOptions[0] || select.options[0];
      label.textContent = o.text;
      dot.style.backgroundColor = colors[o.value] || "transparent";
      trigger.setAttribute(
        "aria-label",
        select.getAttribute("aria-label") + " — " + o.text,
      );
      Array.from(list.children).forEach((b, i) =>
        b.setAttribute("aria-pressed", String(i === select.selectedIndex)),
      );
    },
  });
}
function refreshChoices() {
  choiceWidgets.forEach((w) => w.sync());
}
