"use strict";
const emotionNames = {
  joy: "Радость",
  sadness: "Грусть",
  anger: "Злость",
  energy: "Энергия",
  calm: "Спокойствие",
  nostalgia: "Ностальгия",
  tenderness: "Нежность",
  inspiration: "Вдохновение",
  anxiety: "Тревога",
  loneliness: "Одиночество",
  pride: "Гордость",
  gratitude: "Благодарность",
  boredom: "Скука",
  curiosity: "Любопытство",
  hope: "Надежда",
};
const atmosphereNames = {
  ...emotionNames,
  warm: "Тепло",
  melancholic: "Меланхолия",
  energetic: "Энергия",
  quiet: "Тишина",
};
const layoutNames = {
  postcard: "открытка",
  letter: "письмо",
  contact: "контактный отпечаток",
};
const letteringNames = {
  lyrical: "курсив",
  reflective: "книжная антиква",
  brisk: "прямое плотное начертание",
};
const fallbackNotes = {
  keywords: "Настроение определено по словам записи.",
  busy: "Модель занята другой записью.",
  disabled: "Выбраны правила дневника.",
  offline: "Модель недоступна на этом устройстве.",
  unsupported: "Браузер не поддерживает локальную модель.",
  cancelled: "Выбрано быстрое оформление.",
  invalid_output: "Ответ модели не прошёл проверку.",
};
async function directorRequest(
  kind,
  input,
  enabled,
  validate,
  offline,
  progress = () => {},
  signal = new AbortController().signal,
) {
  // Lightweight keyword director: instant, no model download.
  if (enabled) {
    progress("Читаем запись…");
    await new Promise((r) => setTimeout(r, 350 + Math.random() * 350));
    signal.throwIfAborted?.();
    progress("Подбираем палитру и значки…");
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
    return { source: "local", reason: "keywords", generated: offline() };
  }
  const reason = "disabled";
  return { source: "local", reason, generated: offline() };
}
async function inspectPrint(src) {
  const image = await loadImage(src),
    canvas = document.createElement("canvas");
  const ratio = Math.min(1, 320 / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const thumb = canvas.toDataURL("image/jpeg", 0.68);
  canvas.width = canvas.height = 24;
  ctx.drawImage(image, 0, 0, 24, 24);
  const pixels = ctx.getImageData(0, 0, 24, 24).data,
    bins = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b] = pixels.subarray(i, i + 3);
    const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    const bin = bins.get(key) || [0, 0, 0, 0];
    bin[0]++;
    bin[1] += r;
    bin[2] += g;
    bin[3] += b;
    bins.set(key, bin);
  }
  const best = [...bins.values()].sort((a, b) => b[0] - a[0])[0];
  return {
    thumb,
    color:
      "#" +
      best
        .slice(1)
        .map((n) =>
          Math.round(n / best[0])
            .toString(16)
            .padStart(2, "0"),
        )
        .join(""),
  };
}
async function analyzeDraft(draft, enabled, progress, signal) {
  const pictures = await Promise.all(draft.photos.map(inspectPrint));
  const music = {
    kind: draft.audio
      ? "file"
      : draft.url
        ? "link"
        : draft.song
          ? "metadata"
          : "none",
    title: draft.song.slice(0, 160),
    filename: draft.audioName.slice(0, 255),
    energy: draft.energy,
  };
  const evidence = {
    colors: pictures.map((i) => i.color),
    music,
    photoCount: pictures.length,
  };
  const input = {
    text: draft.text,
    tone: draft.tone,
    music,
    colors: evidence.colors,
    images: pictures.map((i) => i.thumb),
  };
  const response = await directorRequest(
    "memory",
    input,
    enabled,
    MemoryContract.validMemory,
    () => MemoryContract.localMemory(input),
    progress,
    signal,
  );
  return {
    version: 1,
    ...response,
    evidence,
    analyzedAt: new Date().toISOString(),
    overrides: {},
  };
}
function blendHex(a, b) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * 0.75 +
            parseInt(b.slice(i, i + 2), 16) * 0.25,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function directedStyle(director) {
  const base = director.generated,
    over = director.overrides || {},
    colors = director.evidence.colors;
  const style =
    over.atmosphere && over.atmosphere !== base.atmosphere
      ? MemoryContract.styles[over.atmosphere]
      : base;
  return {
    ...base,
    layoutVariant: style.layoutVariant,
    narrationTone: style.narrationTone,
    animationIntensity: style.animationIntensity,
    ...over,
    colorPalette:
      over.colorPalette ||
      style.colorPalette.map((c, i) =>
        colors.length ? blendHex(c, colors[i % colors.length]) : c,
      ),
  };
}
function sourceCaption(d) {
  return d.source === "ai"
    ? "Оформление по записи и снимкам"
    : "Оформление по правилам дневника · " +
        (fallbackNotes[d.reason] || fallbackNotes.offline);
}
function monthInputs(entries) {
  return entries
    .map((e) => ({
      date: e.date,
      text: e.text,
      title: e.title || "",
      tone: e.tone || "",
      atmosphere: e.director ? directedStyle(e.director).atmosphere : "",
      mood: e.mood || 5,
      manualMood: Boolean(e.manualMood),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function reportSignature(days) {
  // Identical report inputs yield the same key across reloads and browser sessions.
  let h = 2166136261,
    h2 = 5381;
  const text = "v2" + JSON.stringify(days);
  for (let i = 0; i < text.length; i++) {
    const n = text.charCodeAt(i);
    h = Math.imul(h ^ n, 16777619);
    h2 = Math.imul(h2, 33) ^ n;
  }
  return text.length + "-" + (h >>> 0) + "-" + (h2 >>> 0);
}
const monthDescriptions = [
  "Январь — тихая белая страница: время замедляется, и маленькие радости видны особенно ясно.",
  "Февраль — месяц между зимой и ожиданием весны: светлеет раньше, и растут надежды.",
  "Март — первые капели и лёгкое чувство, что всё начинается заново.",
  "Апрель — переменчивая погода и свежие мысли: дни то дождливые, то солнечные.",
  "Май — зелень, длинные вечера и ощущение, что впереди целое лето.",
  "Июнь — яркий свет, открытые окна и дни, которые не хочется заканчивать.",
  "Июль — разгар лета: тепло, движение, поездки и тёплые ночи.",
  "Август — медленное золото и прощание с летом, полное тёплых воспоминаний.",
  "Сентябрь — новый ритм, свежие тетради и первые жёлтые листья.",
  "Октябрь — тёплые шарфы, дожди и уютные вечера в ожидании зимы.",
  "Ноябрь — тихий месяц серого неба и домашнего тепла, когда хочется подвести итоги.",
  "Декабрь — месяц, полный волшебства: огни, снег и итоги года ♡",
];
function monthDescription(ym) {
  return monthDescriptions[Number(ym.slice(5, 7)) - 1] || "";
}
// How pleasant each emotion feels on the 0-100 scale of the month report.
const emotionScore = {
  joy: 90, gratitude: 92, pride: 92, inspiration: 88, tenderness: 86,
  hope: 80, energy: 76, curiosity: 74, calm: 68, nostalgia: 58,
  boredom: 40, anxiety: 28, loneliness: 24, sadness: 20, anger: 16,
  warm: 82, energetic: 76, quiet: 62, melancholic: 30,
};
function localMonth(days) {
  const counts = {};
  const scores = days.map((d) => {
    const text = d.text.toLowerCase();
    const severe = /избил|избили|напад|насил|угрожа|травм|больниц|кров|побил|побили|смерт|умер|ограб|авари/.test(text);
    const difficult = /страш|ужас|тревог|паник|одинок|рыдал|плак|ненавиж|сломал|плохо|больно|устал/.test(text);
    const positive = /счаст|радост|любл|смех|смея|побед|праздник|обня|прекрасн|благодар/.test(text);
    const mood = ((d.mood - 1) * 100) / 9,
      emotion = emotionScore[d.atmosphere];
    if (d.atmosphere) counts[d.atmosphere] = (counts[d.atmosphere] || 0) + 1;
    // Emotion of the day sets the base; the user's own rating pulls it toward their view.
    let score =
      emotion === undefined
        ? mood
        : d.manualMood
          ? 0.35 * emotion + 0.65 * mood
          : 0.8 * emotion + 0.2 * mood;
    if (positive && !difficult) score = Math.max(score, 74);
    if (difficult) score = Math.min(score, 26);
    if (severe) score = Math.min(score, 4);
    score = Math.round(Math.max(0, Math.min(100, score)));
    const name = atmosphereNames[d.atmosphere];
    return {
      date: d.date,
      score,
      reason:
        (severe
          ? "В тексте описано тяжёлое событие"
          : d.manualMood
            ? "Личная оценка " + d.mood + "/10"
            : "Оценка по записи") +
        (!severe && name ? " · эмоция: " + name.toLowerCase() : "") +
        ".",
    };
  });
  const { average } = MemoryContract.ranked(scores);
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const lead =
    average >= 85
      ? "Месяц получился ярким и светлым."
      : average >= 70
        ? "В записях месяца больше тёплых оттенков."
        : average >= 50
          ? "По записям месяц получился смешанным."
          : average >= 35
            ? "В месяце хватало непростых дней."
            : "Месяц был тяжёлым, но ты всё записал.";
  return {
    days: scores,
    summary:
      lead +
      (top ? " Чаще всего встречалась эмоция «" + atmosphereNames[top[0]].toLowerCase() + "»." : ""),
  };
}
// The month is "best" if its average tops every other saved report.
function isBestMonth(ym, average) {
  const others = Object.entries(state.monthReports || {})
    .filter(([key, r]) => key !== ym && r?.generated?.days?.length)
    .map(([, r]) => MemoryContract.ranked(r.generated.days).average);
  return others.length ? average > Math.max(...others) : average >= 60;
}
const bestMonthTexts = [
  (n, m) => n + ", это твой лучший месяц! 🎉 " + m + " стал самым светлым в дневнике, и я правда рад за тебя. Горжусь тем, как ты проживаешь свои дни и сохраняешь их здесь. Так держать!",
  (n, m) => "Ура, " + n + "! 🥳 " + m + " оказался лучшим месяцем из всех, что ты записал. Я искренне радуюсь вместе с тобой и горжусь тобой: каждая запись — твоя маленькая победа.",
  (n, m) => n + ", вот это месяц! ✨ Среди всех страниц дневника " + m + " победил по настроению. Я очень рад и горд за тебя. Пусть дальше будет ещё больше таких дней.",
];
function bestMonthText(ym) {
  const name = state.profile?.name?.trim() || "друг",
    month = monthLabel(ym).split(" ")[0].toLowerCase(),
    i = Number(ym.slice(5, 7)) % bestMonthTexts.length;
  return bestMonthTexts[i](name, month.charAt(0).toUpperCase() + month.slice(1));
}
function currentReport(ym, entries) {
  const report = state.monthReports?.[ym];
  if (!report) return null;
  const days = monthInputs(entries);
  return days.length &&
    report.signature === reportSignature(days) &&
    MemoryContract.validMonth(
      report.generated,
      days.map((d) => d.date),
    )
    ? report
    : null;
}
