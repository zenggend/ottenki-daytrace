"use strict";

const moodNames = [
  "",
  "Очень тяжело",
  "Тяжело",
  "Непросто",
  "Скорее трудно",
  "По-разному",
  "Спокойно",
  "Скорее хорошо",
  "Хорошо",
  "Прекрасно",
  "Незабываемо",
];

const energyNames = {
  calm: "Спокойная",
  warm: "Тёплая",
  drive: "Энергичная",
  melancholy: "Меланхоличная",
};

function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("daymark-v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("journal");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function analyzeText(text) {
  const t = text.toLowerCase(),
    words = text.replace(/[«»"“”]/g, "").trim();
  const clause = words.split(/[.!?\n]/).find((part) => part.trim()) || words;
  const phrase = clause.trim().split(/\s+/).slice(0, 8).join(" ");
  const title =
    phrase.length > 65
      ? phrase.slice(0, 62).replace(/\s+\S*$/, "") + "…"
      : phrase;
  const positive = (
    t
      .replace(
        /не (?:был[оа]? )?(?:радост\w*|счаст\w*|хорош\w*|спокой\w*|получ\w*)/g,
        "",
      )
      .match(
        /радост|счаст|сме[яе]|прекрас|благодар|побед|справил|хорош|люб[ли]|спокой|горж|живым/g,
      ) || []
  ).length;
  const negative = (
    t.match(
      /устал|груст|тяж[её]л|раздраж|страш|боль|одинок|плохо|тревог|не получ/g,
    ) || []
  ).length;
  const score = Math.max(
    1,
    Math.min(10, Math.round(6 + positive * 1.1 - negative * 1.1)),
  );
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1) || "Запись дня",
    score,
    positive,
    negative,
  };
}

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
async function compressPhoto(file) {
  const src = await readFile(file),
    img = await loadImage(src),
    ratio = Math.min(1, 1800 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * ratio);
  c.height = Math.round(img.height * ratio);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.86);
}
async function photoInfo(src) {
  const image = await loadImage(src),
    c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  ctx.drawImage(image, 0, 0, 32, 32);
  const p = ctx.getImageData(0, 0, 32, 32).data;
  let r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < p.length; i += 4) {
    r += p[i];
    g += p[i + 1];
    b += p[i + 2];
  }
  r /= 1024;
  g /= 1024;
  b /= 1024;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let hue =
    delta === 0
      ? 0
      : max === r
        ? 60 * (((g - b) / delta) % 6)
        : max === g
          ? 60 * ((b - r) / delta + 2)
          : 60 * ((r - g) / delta + 4);
  return {
    light: (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255,
    hue: Math.round((hue + 360) % 360),
  };
}

function safeUrl(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

function downloadBlob(blob, name) {
  const u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}

// ZIP with stored entries: no external dependency and no request to an upload service.
const utf8 = new TextEncoder();
const crcTable = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zipBlob(files) {
  const chunks = [],
    central = [];
  let offset = 0;
  for (const [name, bytes] of files) {
    const n = utf8.encode(name),
      crc = crc32(bytes),
      header = new Uint8Array(30 + n.length),
      v = new DataView(header.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x800, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, bytes.length, true);
    v.setUint32(22, bytes.length, true);
    v.setUint16(26, n.length, true);
    header.set(n, 30);
    chunks.push(header, bytes);
    const ce = new Uint8Array(46 + n.length),
      cv = new DataView(ce.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, bytes.length, true);
    cv.setUint32(24, bytes.length, true);
    cv.setUint16(28, n.length, true);
    cv.setUint32(42, offset, true);
    ce.set(n, 46);
    central.push(ce);
    offset += header.length + bytes.length;
  }
  const size = central.reduce((a, b) => a + b.length, 0),
    end = new Uint8Array(22),
    ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, size, true);
  ev.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type: "application/zip" });
}
function musicCaption(e) {
  return e.song || e.audioName || (e.songUrl || e.audio ? "Трек дня" : "");
}
async function downloadFolder(e) {
  const folder = `${e.date} ${(e.director ? directedStyle(e.director).folderTitle : e.title).replace(/[<>:"/\\|?*]/g, "").slice(0, 65)}`,
    files = [];
  const add = (name, bytes) => files.push([folder + "/" + name, bytes]);
  const caption = musicCaption(e);
  const music = caption
    ? "\nМузыка: " + caption + (e.songUrl ? "\n" + e.songUrl : "")
    : "";

  add(
    "Постер дня.png",
    new Uint8Array(await (await posterBlob(e)).arrayBuffer()),
  );
  add(
    "Запись.txt",
    utf8.encode(
      `${e.title}\n${formatDate(e.date, { day: "numeric", month: "long", year: "numeric" })}\n\n${e.text}\n\nНастроение: ${e.mood}/10${music}\n\nОформление: ${energyRule(e)}\n`,
    ),
  );
  for (let i = 0; i < e.photos.length; i++) {
    const original = e.originalPhotos?.[i];
    if (original instanceof Blob) {
      const ext =
        { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
          original.type
        ] || "jpg";
      add(
        "Фото " + (i + 1) + "." + ext,
        new Uint8Array(await original.arrayBuffer()),
      );
      continue;
    }
    const res = await fetch(e.photos[i]);
    if (!res.ok) throw Error("Photo missing");
    add(
      `Фото ${i + 1}.${e.photos[i].startsWith("data:image/png") ? "png" : e.photos[i].startsWith("data:image/webp") ? "webp" : "jpg"}`,
      new Uint8Array(await res.arrayBuffer()),
    );
  }
  if (e.audio) {
    const res = await fetch(e.audio);
    const type = e.audio.slice(5, e.audio.indexOf(";"));
    const ext =
      {
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/ogg": "ogg",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
      }[type] || "audio";
    add("Музыка." + ext, new Uint8Array(await res.arrayBuffer()));
  }
  const meta = {
    ...e,
    originalPhotos: (e.originalPhotos || []).map((f) =>
      f ? { name: f.name, type: f.type, size: f.size } : null,
    ),
    photos: e.photos.map((_, i) => `Фото ${i + 1}`),
    audio: e.audio ? "Прикреплён в папке" : null,
  };
  add("День.json", utf8.encode(JSON.stringify(meta, null, 2)));
  downloadBlob(zipBlob(files), folder + ".zip");
}

const byId = (id) => document.getElementById(id);

const dayMs = 86400000;
const localDate = new Date();
const today =
  localDate.getFullYear() +
  "-" +
  String(localDate.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(localDate.getDate()).padStart(2, "0");
const ordinal = (date) => Date.parse(date + "T00:00:00Z") / dayMs;
const dateAt = (day) => new Date(day * dayMs).toISOString().slice(0, 10);
const formatDate = (
  date,
  options = { day: "numeric", month: "long", year: "numeric" },
) =>
  new Intl.DateTimeFormat("ru", { ...options, timeZone: "UTC" }).format(
    new Date(ordinal(date) * dayMs),
  );

const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const cityGroups = {
  алматы: "Алматы",
  алмата: "Алматы",
  almaty: "Алматы",
  астана: "Астана",
  astana: "Астана",
  шымкент: "Шымкент",
  shymkent: "Шымкент",
};

let db, state, countries, kz, names;

function emptyState() {
  return { profile: null, entries: [], reflections: {}, demo: false };
}
function readState() {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("journal")
      .objectStore("journal")
      .get("state");
    request.onsuccess = () => resolve(request.result || emptyState());
    request.onerror = () => reject(request.error);
  });
}
function changeState(edit) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("journal", "readwrite"),
      store = tx.objectStore("journal"),
      read = store.get("state");
    let next;
    read.onsuccess = () => {
      next = edit(read.result || emptyState());
      store.put(next, "state");
    };
    tx.oncomplete = () => {
      state = next;
      resolve();
    };
    tx.onabort = () => reject(tx.error);
  });
}
function countryName(code) {
  const display = names?.of(code);
  return display && display !== code ? display : countries[code].name;
}
function estimate(p) {
  const cityKey = p.city
    .toLowerCase()
    .replace(/^г\.\s*/, "")
    .trim();
  const local = kz.regions.find((r) => r.name === "г. " + cityGroups[cityKey]);
  const row =
    p.country === "KZ" ? local || kz.regions[0] : countries[p.country];
  const life = row[p.sex],
    birth = ordinal(p.birthday),
    lived = Math.max(0, ordinal(today) - birth);
  const total = Math.round(life * 365.2425);
  return {
    life,
    birth,
    lived,
    future: Math.max(0, total - lived - 1),
    total,
    region: p.country === "KZ" ? row.name : countryName(p.country),
  };
}
function validProfile(p) {
  return (
    p &&
    p.name &&
    p.city &&
    countries[p.country] &&
    ["all", "male", "female"].includes(p.sex) &&
    Number.isFinite(ordinal(p.birthday)) &&
    p.birthday <= today
  );
}

const palette = {
  quiet: { name: "Тишина", color: "#a5b48c" },
  warm: { name: "Тепло", color: "#e5b251" },
  dream: { name: "Мечты", color: "#b3a0c4" },
  energy: { name: "Энергия", color: "#d78c70" },
  blue: { name: "Грусть", color: "#89a0b1" },
  anger: { name: "Злость", color: "#c2674f" },
};

function toneOf(e) {
  if (Object.hasOwn(palette, e.tone)) return e.tone;
  if (e.mood <= 3) return "blue";
  if (/мечта|мечты|приснил|воображ|снилось/i.test(e.text)) return "dream";
  if (e.energy === "melancholy") return "blue";
  if (e.energy === "drive") return "energy";
  if (e.energy === "warm" || e.mood >= 8) return "warm";
  return "quiet";
}

function fitMood(text, energy, light) {
  const analysis = analyzeText(text),
    signal =
      { calm: 0, warm: 0.45, drive: 0.25, melancholy: -0.45 }[energy] || 0;
  return Math.max(
    1,
    Math.min(10, Math.round(analysis.score + signal + (light - 0.5) * 0.6)),
  );
}
async function storeDay(date, draft) {
  const info = await photoInfo(draft.photos[0]);
  const song = draft.song.trim(),
    songUrl = safeUrl(draft.url.trim()) || "";
  const energy = song || songUrl || draft.audio ? draft.energy : "";
  const entry = {
    date,
    text: draft.text,
    originalPhotos: draft.originalPhotos,
    originalMusic: {
      title: draft.song,
      url: draft.url,
      character: draft.energy,
      fileName: draft.audioName,
    },
    director: draft.director,
    updatedAt: new Date().toISOString(),
    title: analyzeText(draft.text).title,
    song,
    songUrl,
    energy,
    mood: draft.rating
      ? Number(draft.rating)
      : fitMood(draft.text, energy, info.light),
    manualMood: Boolean(draft.rating),
    photos: draft.photos.slice(),
    audio: draft.audio,
    audioName: draft.audioName,
    light: info.light,
    photoHue: info.hue,
    tone: draft.tone || "",
    demo: false,
  };
  await changeState((old) => {
    const previous = (old.entries || []).find((e) => e.date === date);
    entry.createdAt = previous?.createdAt || entry.updatedAt;
    entry.director.overrides = previous?.director?.overrides || {};
    entry.title = directedStyle(entry.director).title;
    return {
      ...old,
      entries: [...(old.entries || []).filter((e) => e.date !== date), entry],
    };
  });

  return entry;
}

function energyRule(e) {
  return (
    {
      calm: "Мягкий свет",
      warm: "Тёплый оттенок",
      drive: "Выразительный контраст",
      melancholy: "Приглушённый цвет",
    }[e.energy] || "Исходные цвета"
  );
}
function photoFilter(e) {
  return (
    {
      calm: "saturate(.83)",
      warm: "sepia(.12) saturate(1.08)",
      drive: "contrast(1.12) saturate(1.05)",
      melancholy: "saturate(.45) contrast(.95)",
    }[e.energy] || "none"
  );
}

async function posterBlob(e) {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext("2d"),
    img = await loadImage(e.photos[0]);
  ctx.fillStyle = "#f6ecd9";
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = "#354d3a";
  ctx.font = "48px Georgia";
  ctx.fillText("DAYTRACE", 58, 75);
  ctx.textAlign = "right";
  ctx.font = "27px Georgia";
  ctx.fillText(formatDate(e.date), 1022, 70);
  ctx.textAlign = "left";
  const scale = Math.max(964 / img.width, 778 / img.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(58, 118, 964, 778);
  ctx.clip();
  ctx.filter = photoFilter(e);
  ctx.drawImage(
    img,
    540 - (img.width * scale) / 2,
    507 - (img.height * scale) / 2,
    img.width * scale,
    img.height * scale,
  );
  ctx.restore();
  ctx.fillStyle = "#382e26";
  ctx.font = "61px Georgia";
  let line = "",
    y = 995;
  for (const word of e.title.split(/\s+/)) {
    if (line && ctx.measureText(line + " " + word).width > 960) {
      ctx.fillText(line, 58, y, 960);
      line = "";
      y += 70;
    }
    line += (line ? " " : "") + word;
  }
  ctx.fillText(line, 58, y, 960);
  ctx.fillStyle = palette[toneOf(e)].color;
  ctx.fillRect(58, 1217, 17, 17);
  ctx.fillStyle = "#354d3a";
  ctx.font = "28px Georgia";
  ctx.fillText(moodNames[e.mood] + " · " + e.mood + "/10", 91, 1235);
  const caption = musicCaption(e);
  if (caption) ctx.fillText("♫ " + caption, 58, 1294, 964);
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Canvas export failed"))),
      "image/png",
    ),
  );
}
