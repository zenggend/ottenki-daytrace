/* Shared by the browser, the local server and the deployed Worker. */
(() => {
  const integer = { type: "integer", minimum: 0, maximum: 100 };
  const str = (maxLength) => ({ type: "string", minLength: 1, maxLength });
  const pick = (...values) => ({ type: "string", enum: values });
  const object = (properties) => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  });
  const color = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
  const memory = object({
    title: str(120),
    folderTitle: str(120),
    warmth: integer,
    energy: integer,
    nostalgia: integer,
    tension: integer,
    atmosphere: pick("warm", "melancholic", "energetic", "quiet", "joy", "sadness", "anger", "energy", "calm", "nostalgia", "tenderness", "inspiration", "anxiety", "loneliness", "pride", "gratitude", "boredom", "curiosity", "hope"),
    colorPalette: { type: "array", minItems: 3, maxItems: 3, items: color },
    layoutVariant: pick("letter", "postcard", "contact"),
    animationIntensity: integer,
    narrationTone: pick("lyrical", "reflective", "brisk"),
    designExplanation: str(420),
  });
  const month = object({
    days: {
      type: "array",
      minItems: 1,
      maxItems: 31,
      items: object({
        date: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
        score: integer,
        reason: str(220),
      }),
    },
    summary: str(480),
  });
  function conforms(value, s) {
    if (s.type === "object")
      return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === s.required.length &&
        s.required.every(
          (k) => Object.hasOwn(value, k) && conforms(value[k], s.properties[k]),
        )
      );
    if (s.type === "array")
      return (
        Array.isArray(value) &&
        value.length >= s.minItems &&
        value.length <= s.maxItems &&
        value.every((v) => conforms(v, s.items))
      );
    if (s.type === "integer")
      return (
        Number.isInteger(value) && value >= s.minimum && value <= s.maximum
      );
    return (
      typeof value === "string" &&
      Boolean(value.trim()) &&
      (!s.maxLength || value.length <= s.maxLength) &&
      (!s.enum || s.enum.includes(value)) &&
      (!s.pattern || new RegExp(s.pattern).test(value))
    );
  }
  function validMemory(v) {
    return (
      conforms(v, memory) &&
      [v.title, v.folderTitle].every((t) => {
        const n = (t.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu) || [])
          .length;
        return n >= 3 && n <= 7;
      })
    );
  }
  function validMonth(v, dates) {
    return (
      conforms(v, month) &&
      v.days.length === dates.length &&
      new Set(v.days.map((d) => d.date)).size === dates.length &&
      v.days.every((d) => dates.includes(d.date))
    );
  }
  const styles = {
    warm: {
      title: "Тепло за одним столом",
      folderTitle: "Маленькие поводы для тепла",
      colorPalette: ["#bc8657", "#ead1a3", "#826445"],
      layoutVariant: "postcard",
      narrationTone: "lyrical",
      warmth: 84,
      energy: 44,
      nostalgia: 48,
      tension: 14,
      animationIntensity: 35,
    },
    melancholic: {
      title: "Пока за окном дождь",
      folderTitle: "Письма из тихого вечера",
      colorPalette: ["#687c8e", "#ced4d8", "#746e86"],
      layoutVariant: "letter",
      narrationTone: "reflective",
      warmth: 32,
      energy: 24,
      nostalgia: 78,
      tension: 42,
      animationIntensity: 18,
    },
    energetic: {
      title: "В ритме этого дня",
      folderTitle: "Снимки на полном ходу",
      colorPalette: ["#c36746", "#ecc98f", "#51594b"],
      layoutVariant: "contact",
      narrationTone: "brisk",
      warmth: 67,
      energy: 90,
      nostalgia: 20,
      tension: 36,
      animationIntensity: 82,
    },
    quiet: {
      title: "Пауза посреди обычного дня",
      folderTitle: "Страницы в спокойном ритме",
      colorPalette: ["#859173", "#ded6ba", "#737866"],
      layoutVariant: "letter",
      narrationTone: "reflective",
      warmth: 51,
      energy: 32,
      nostalgia: 40,
      tension: 20,
      animationIntensity: 24,
    },
  };
  /* Emotion presets: palette, layout and ready-made texts are fixed in advance. */
  const emotions = {
    joy: {
      name: "Радость",
      colorPalette: ["#d9a233", "#f6e2a6", "#9a6a2c"],
      layoutVariant: "postcard",
      narrationTone: "lyrical",
      warmth: 90, energy: 66, nostalgia: 30, tension: 8, animationIntensity: 55,
      titles: ["Солнце в каждом кадре", "День, который удался", "Светлый день без спешки"],
      folders: ["Тёплые моменты хорошего дня", "Улыбки и яркие мелочи", "Пока всё получалось"],
      notes: [
        "Радостные слова записи дали тёплую охру, мягкие углы открытки и лёгкое появление снимка.",
        "День светлый, поэтому палитра золотая, а рамка похожа на праздничную открытку.",
        "Много позитивных слов: выбраны солнечные цвета и неспешный курсив, чтобы сохранить улыбку дня.",
      ],
    },
    sadness: {
      name: "Грусть",
      colorPalette: ["#6c819a", "#cdd5de", "#6f6a86"],
      layoutVariant: "letter",
      narrationTone: "reflective",
      warmth: 24, energy: 18, nostalgia: 70, tension: 46, animationIntensity: 14,
      titles: ["Тихий серый день", "Когда всё шло не так", "Дождь за окном дня"],
      folders: ["Письма из трудного вечера", "Сдержанные тона тяжёлого дня", "Страницы про усталость"],
      notes: [
        "В записи есть тяжёлые слова, поэтому оформление получило холодную сине-серую палитру и много воздуха.",
        "Грустный день оформлен как письмо: приглушённые цвета, строгая антиква и медленное движение.",
        "Палитра выбрана тихой и прохладной, чтобы день не казался ярче, чем он был.",
      ],
    },
    anger: {
      name: "Злость",
      colorPalette: ["#b9462f", "#efc7b4", "#4b3a36"],
      layoutVariant: "contact",
      narrationTone: "brisk",
      warmth: 40, energy: 78, nostalgia: 8, tension: 92, animationIntensity: 72,
      titles: ["День на пределе нервов", "Резкие слова и острые углы", "Когда внутри всё кипит"],
      folders: ["Красные заметки напряжённого дня", "Острые углы одного дня", "Споры и тяжёлые разговоры"],
      notes: [
        "Напряжение дня передано кирпично-красным цветом, плотным шрифтом и контактной сеткой.",
        "Резкий ритм и тёмные чернила выбраны для дня, в котором было много раздражения.",
        "Острые формы и красный акцент показывают, что внутри день был не спокойным.",
      ],
    },
    energy: {
      name: "Энергия",
      colorPalette: ["#d9663a", "#f4d08e", "#3f5a4f"],
      layoutVariant: "contact",
      narrationTone: "brisk",
      warmth: 62, energy: 95, nostalgia: 12, tension: 34, animationIntensity: 88,
      titles: ["День на полной скорости", "Ритм, который не остановить", "Много движения и огня"],
      folders: ["Снимки на высокой скорости", "Быстрый ритм живого дня", "Заряд на весь день"],
      notes: [
        "Быстрый день получил яркий оранжевый акцент, плотную сетку и короткое проявление снимка.",
        "Энергия записи передана контрастом цветов и динамичной композицией контактного листа.",
        "Много движения в тексте, поэтому анимация короткая, а палитра насыщенная.",
      ],
    },
    calm: {
      name: "Спокойствие",
      colorPalette: ["#7f9a80", "#e1e0c6", "#5e7567"],
      layoutVariant: "letter",
      narrationTone: "reflective",
      warmth: 52, energy: 20, nostalgia: 38, tension: 10, animationIntensity: 20,
      titles: ["Тихая пауза посреди недели", "Медленный зелёный вечер", "День без лишней суеты"],
      folders: ["Страницы в спокойном ритме", "Тишина и неспешный чай", "Мягкий день у воды"],
      notes: [
        "Спокойный день оформлен приглушённой зелёной палитрой и медленным проявлением снимка.",
        "Много воздуха, мягкие тона и книжный шрифт передают неторопливое настроение записи.",
        "Тихие цвета выбраны, чтобы страница ощущалась как пауза.",
      ],
    },
    nostalgia: {
      name: "Ностальгия",
      colorPalette: ["#a8794e", "#ead9bf", "#6d5a6e"],
      layoutVariant: "postcard",
      narrationTone: "lyrical",
      warmth: 58, energy: 26, nostalgia: 95, tension: 22, animationIntensity: 26,
      titles: ["Тот самый старый день", "Воспоминание цвета старой плёнки", "Письмо из прошлого лета"],
      folders: ["Выцветшие кадры прошлого", "Старые фото и тёплая память", "Страницы из детства"],
      notes: [
        "Выцветшая бумага и коричневые чернила передают воспоминание, как на старой плёнке.",
        "Запись похожа на возврат в прошлое, поэтому выбраны сепия, курсив и мягкая открытка.",
        "Тёплая приглушённая палитра создаёт ощущение давно прожитого дня.",
      ],
    },
    tenderness: {
      name: "Нежность",
      colorPalette: ["#d98a9a", "#f6dde0", "#8d5a66"],
      layoutVariant: "postcard",
      narrationTone: "lyrical",
      warmth: 88, energy: 30, nostalgia: 40, tension: 6, animationIntensity: 28,
      titles: ["Мягкий день рядом с любимыми", "Тихая нежность в мелочах"],
      folders: ["Тёплые объятия и добрые слова", "Мягкие касания одного дня"],
      notes: ["Нежные слова записи дали розовую пудровую палитру и мягкую открытку.", "Много тепла и заботы, поэтому цвета пастельные, а движение медленное."],
    },
    inspiration: {
      name: "Вдохновение",
      colorPalette: ["#c98f2d", "#f3e3b8", "#3e4f6b"],
      layoutVariant: "contact",
      narrationTone: "lyrical",
      warmth: 60, energy: 72, nostalgia: 18, tension: 28, animationIntensity: 64,
      titles: ["День, полный новых идей", "Искра, с которой всё началось"],
      folders: ["Идеи, наброски и первые шаги", "Творческий порыв одного дня"],
      notes: ["Идеи и творчество в записи дали золотой акцент на тёмно-синем и живую сетку.", "Вдохновение передано контрастом золота и ночного синего и быстрым проявлением."],
    },
    anxiety: {
      name: "Тревога",
      colorPalette: ["#7a6f9b", "#dcd7e6", "#3d3a4f"],
      layoutVariant: "contact",
      narrationTone: "brisk",
      warmth: 26, energy: 62, nostalgia: 10, tension: 88, animationIntensity: 70,
      titles: ["Неспокойный день на нервах", "Мысли, которые не отпускали"],
      folders: ["Тревожные заметки перед важным", "Дрожащие линии неспокойного дня"],
      notes: ["Тревожные слова записи дали холодный фиолетовый и резкий ритм кадров.", "Напряжение выражено сжатой сеткой, тёмными чернилами и быстрым движением."],
    },
    loneliness: {
      name: "Одиночество",
      colorPalette: ["#5f7482", "#d3d9dc", "#4a4f5c"],
      layoutVariant: "letter",
      narrationTone: "reflective",
      warmth: 18, energy: 12, nostalgia: 44, tension: 54, animationIntensity: 10,
      titles: ["Тишина в пустой комнате", "День наедине с собой"],
      folders: ["Письма самому себе вечером", "Много воздуха и мало голосов"],
      notes: ["Одиночество в записи передано холодным серо-голубым и большими пустыми полями.", "Пустое пространство вокруг снимка подчёркивает, что день прошёл в одиночестве."],
    },
    pride: {
      name: "Гордость",
      colorPalette: ["#b58a2a", "#f1e6c4", "#6b2f2f"],
      layoutVariant: "postcard",
      narrationTone: "lyrical",
      warmth: 72, energy: 60, nostalgia: 24, tension: 16, animationIntensity: 46,
      titles: ["День, которым можно гордиться", "Результат, ради которого старались"],
      folders: ["Маленькие победы большого труда", "Золото и бордо хорошего дня"],
      notes: ["Достижение в записи отмечено золотом и бордовыми чернилами, как грамота.", "Праздничная открытка и тёплое золото подчёркивают гордость за результат."],
    },
    gratitude: {
      name: "Благодарность",
      colorPalette: ["#c27b4f", "#f5e1c8", "#6d7a54"],
      layoutVariant: "postcard",
      narrationTone: "lyrical",
      warmth: 84, energy: 34, nostalgia: 36, tension: 8, animationIntensity: 30,
      titles: ["Спасибо этому доброму дню", "Тёплые слова и добрые люди"],
      folders: ["Благодарные заметки в конце дня", "Подарки, помощь и тепло"],
      notes: ["Благодарные слова дали тёплый терракотовый и мягкий зелёный, как осенний подарок.", "Спокойная открытка с земляными цветами передаёт признательность."],
    },
    boredom: {
      name: "Скука",
      colorPalette: ["#9a9585", "#e3dfd2", "#6a675e"],
      layoutVariant: "letter",
      narrationTone: "reflective",
      warmth: 30, energy: 10, nostalgia: 22, tension: 30, animationIntensity: 8,
      titles: ["Ленивый серый день без событий", "Время тянулось очень медленно"],
      folders: ["Часы без особых дел", "Однообразные кадры тихого дня"],
      notes: ["Приглушённая бежево-серая палитра и почти неподвижная анимация передают скуку.", "Однообразие дня выражено блёклыми цветами и строгим письмом."],
    },
    curiosity: {
      name: "Любопытство",
      colorPalette: ["#4f8a8b", "#e0efe9", "#b5653a"],
      layoutVariant: "contact",
      narrationTone: "brisk",
      warmth: 52, energy: 68, nostalgia: 14, tension: 20, animationIntensity: 66,
      titles: ["День открытий и вопросов", "Узнавал новое и удивлялся"],
      folders: ["Находки и интересные детали", "Бирюзовые заметки любопытного дня"],
      notes: ["Интерес к новому передан бирюзой с рыжим акцентом и подвижной контактной сеткой.", "Свежие цвета и быстрое проявление снимка соответствуют желанию узнавать."],
    },
    hope: {
      name: "Надежда",
      colorPalette: ["#8fae7e", "#f3efc9", "#d09a54"],
      layoutVariant: "postcard",
      narrationTone: "lyrical",
      warmth: 70, energy: 46, nostalgia: 24, tension: 18, animationIntensity: 36,
      titles: ["Всё будет хорошо впереди", "Рассвет после долгого ожидания"],
      folders: ["Планы и светлые ожидания", "Первые лучи хорошего начала"],
      notes: ["Слова о будущем дали светлую зелёную палитру с тёплым рассветным акцентом.", "Мягкая открытка и тёплый жёлтый обещают, что дальше будет лучше."],
    },
  };
  // Legacy keys keep already saved entries readable.
  const legacy = { warm: "joy", melancholic: "sadness", energetic: "energy", quiet: "calm" };
  for (const [k, { name, titles, folders, notes, ...v }] of Object.entries(emotions))
    styles[k] = { ...v, title: titles[0], folderTitle: folders[0] };
  const rx = (src) => new RegExp(src, "gu");
  const L = "(?<![\\p{L}])";
  const words = {
    sadness: {
      strong: rx(L + "(?:плох|тяжел|тяжк|груст|печал|тоск|скуча|устал|устав|слёз|слез|плак|дожд|обид|больн|боль|разочаров|провал|ужасн|кошмар|пусто|нет сил|не получил|не вышло|не смог|не успел|не хочу)"),
      weak: rx(L + "(?:не|без|нет|ни)(?![\\p{L}])"),
    },
    joy: {
      strong: rx(L + "(?:ура|получил|рад(?:а|ы|о|ост|овал|уюсь|уемся|ует)|счастл|супер|отличн|здорово|прекрасн|весел|смех|смея|круто|клас(?:с|н)|люблю|любим|побед|празд|удач|кайф|восторг|вкусн|уют|тепл|тёпл)"),
      weak: rx(L + "да(?![\\p{L}])"),
    },
    anger: { strong: rx(L + "(?:злю|зол|злост|бесит|бесил|раздраж|ненавиж|ругал|поссор|скандал|орал|крича|возмущ|достал|конфликт)") },
    energy: { strong: rx(L + "(?:бег|бежал|танц|концерт|драйв|гонк|старт|финиш|спорт|трениров|скорост|быстр|адреналин|тусов|вечеринк|энерг|матч)") },
    calm: { strong: rx(L + "(?:тих|спокой|чай|какао|книг|чита|медитац|неспеш|покой|прогулк|закат|озер|пруд|отдых)") },
    tenderness: { strong: rx(L + "(?:нежн|обним|обнял|поцел|любимый|любимая|девушк|парень|мило|ласк|забот)") },
    inspiration: { strong: rx(L + "(?:вдохнов|идея|идеи|придума|творч|рисова|проект|создал|запуст|сочинил)") },
    anxiety: { strong: rx(L + "(?:тревог|волнов|страшн|боюсь|экзамен|дедлайн|паник|нервнич|переживал|не сплю)") },
    loneliness: { strong: rx(L + "(?:одинок|никого|никто|в одиночеств|сам с собой)") },
    pride: { strong: rx(L + "(?:горжусь|гордост|достиг|сдал|награ|диплом|олимпиад|результат)") },
    gratitude: { strong: rx(L + "(?:спасибо|благодар|признател|помог|подарил|подарок)") },
    boredom: { strong: rx(L + "(?:скучн|скучно|делать нечего|однообраз|рутин|тянул|ничего не делал)") },
    curiosity: { strong: rx(L + "(?:интересн|узнал|выяснил|любопытн|исследов|изучал|открыл|нового)") },
    hope: { strong: rx(L + "(?:надеж|верю|мечта|мечтаю|будет лучше|скоро|планирую|впереди)") },
    nostalgia: { strong: rx(L + "(?:вспомин|детств|раньше|старый|старых|старой|ностальг|школ|бабушк|дедуш|фотоальбом|прошл)") },
  };
  const manualTone = { warm: "joy", blue: "sadness", energy: "energy", quiet: "calm", dream: "nostalgia", anger: "anger" };
  const musicTone = { warm: "joy", drive: "energy", melancholy: "sadness", calm: "calm" };
  const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
  function detectEmotion(text) {
    const t = text.toLowerCase().replace(/ё/g, "е").replace(/не\s+получил/g, "не_получил");
    const votes = {};
    for (const [emotion, sets] of Object.entries(words)) {
      const source = emotion === "joy" ? t : text.toLowerCase();
      const strong = (source.match(sets.strong) || []).length;
      const weak = sets.weak ? (source.match(sets.weak) || []).length : 0;
      votes[emotion] = strong + weak * 0.5;
    }
    return votes;
  }
  function localMemory(p) {
    const votes = detectEmotion(p.text || "");
    const music = musicTone[p.music?.energy];
    if (music) votes[music] += 1;
    const manual = manualTone[p.tone];
    let emotion = manual,
      source = manual ? "Выбранный оттенок дня" : "";
    if (!emotion) {
      const order = ["sadness", "joy", ...Object.keys(words).filter((k) => k !== "sadness" && k !== "joy")];
      const best = order.reduce((a, b) => (votes[b] > votes[a] ? b : a));
      if (votes[best] > 0) {
        emotion = best;
        source = "Слова записи" + (music ? " и характер музыки" : "");
      } else {
        // No keywords: any of the neutral moods with equal chance.
        emotion = pickOne(Object.keys(emotions).filter((k) => !["joy", "sadness", "energy"].includes(k)));
        source = "Нейтральная запись: настроение выбрано случайно";
      }
    }
    const preset = emotions[emotion];
    return {
      ...styles[emotion],
      atmosphere: emotion,
      title: pickOne(preset.titles),
      folderTitle: pickOne(preset.folders),
      designExplanation: source + ". " + pickOne(preset.notes),
    };
  }
  function ranked(days) {
    const sorted = [...days].sort(
      (a, b) => b.score - a.score || a.date.localeCompare(b.date),
    );
    const average =
      Math.round((10 * days.reduce((s, d) => s + d.score, 0)) / days.length) /
      10;
    return { sorted, average, best: sorted[0].date };
  }
  globalThis.MemoryContract = {
    memory,
    month,
    validMemory,
    validMonth,
    localMemory,
    ranked,
    styles,
    emotions,
    legacy,
  };
})();
