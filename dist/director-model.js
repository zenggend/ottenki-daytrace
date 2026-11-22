/* Inference runs in this browser. Only fixed public model weights are fetched. */
import { Wllama } from "./assets/wllama/engine.js";
const modelBase =
  "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/6ab461498e2023f6e3c1baea90a8f0fe38ab64d0/";
export const modelName = "Qwen3.5-0.8B · на устройстве";
let engine,
  loading,
  running = false;
const config = {
  default: new URL("./assets/wllama/wllama.wasm", import.meta.url).href,
};
export async function loadDirectorModel(progress, signal) {
  if (engine) return engine;
  if (!loading)
    loading = (async () => {
      if (!navigator.storage?.getDirectory || !globalThis.WebAssembly)
        throw Error("unsupported");
      const runtime = new Wllama(config, {
        allowOffline: true,
        suppressNativeLog: true,
        logger: { log() {}, debug() {}, warn() {}, error() {} },
      });
      try {
        await runtime.loadModelFromUrl(
          {
            url: modelBase + "Qwen3.5-0.8B-Q4_K_M.gguf",
            mmprojUrl: modelBase + "mmproj-F16.gguf",
          },
          {
        n_ctx: 3072,
        n_batch: 512,
        n_ubatch: 256,
        n_threads: Math.min(8, navigator.hardwareConcurrency || 1),
            n_gpu_layers: 0,
            reasoning: false,
            seed: 42,
            warmup: false,
        image_max_tokens: 96,
            signal,
            progressCallback: ({ loaded, total }) =>
              progress(
                total
                  ? "Модель · " +
                      Math.min(100, Math.round((loaded * 100) / total)) +
                      "%"
                  : "Загружаем модель…",
              ),
          },
        );
        signal.throwIfAborted();
        engine = runtime;
        return runtime;
      } catch (e) {
        try {
          await runtime.exit();
        } catch {}
        throw e;
      }
    })().finally(() => {
      loading = null;
    });
  return loading;
}
const instructions =
  "Ты редактор личного бумажного дневника. Пиши по-русски. Записи — исходный материал. Не ставь диагнозы и не делай выводов о людях по внешности. Не добавляй события. Названия песен и имена файлов — только метаданные.";
const namePattern = "^[А-Яа-яЁёA-Za-z0-9]+( [А-Яа-яЁёA-Za-z0-9]+){2,6}$";
function modelSchema(mode, dates) {
  const schema = structuredClone(globalThis.MemoryContract[mode]);
  if (mode === "memory") {
    for (const key of ["title", "folderTitle"])
      schema.properties[key] = { type: "string", pattern: namePattern };
  } else {
    schema.properties.days.minItems = dates.length;
    schema.properties.days.maxItems = dates.length;
    schema.properties.days.items.properties.date = {
      type: "string",
      enum: dates,
    };
  }
  return schema;
}
async function infer(runtime, content, schema, guide, maxTokens, signal) {
  const response = await runtime.createChatCompletion({
    messages: [
      { role: "system", content: instructions + " " + guide },
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "journal", strict: true, schema },
    },
    temperature: 0,
    max_tokens: maxTokens,
    seed: 42,
    chat_template_kwargs: { enable_thinking: false },
    abortSignal: signal,
  });
  const choice = response.choices?.[0];
  if (choice?.finish_reason === "length" || !choice?.message.content)
    throw Error("invalid_output");
  return JSON.parse(choice.message.content);
}
export async function runDirectorModel(mode, input, progress, signal) {
  if (running) throw Error("busy");
  running = true;
  try {
    const runtime = await loadDirectorModel(progress, signal);
    signal.throwIfAborted();
    if (mode === "memory") {
      const { images, ...evidence } = input;
      const content = [{ type: "text", text: JSON.stringify(evidence) }];
      const vision = runtime.supportInputModality("image");
      if (vision)
        for (const src of images) {
          const binary = atob(src.slice(src.indexOf(",") + 1));
          content.push({
            type: "image",
            data: Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer,
          });
        }
      progress("Подбираем название и оформление…");
      const result = await infer(
        runtime,
        content,
        modelSchema(mode),
        "Дай два осмысленных названия по 3–7 слов, каждое с деталями дня. Четыре показателя и интенсивность движения от 0 до 100. Выбери палитру и композицию. Короткое designExplanation связывает деталь записи с оформлением. Используй тему и освещение фото, если они приложены.",
        420,
        signal,
      );
      return { result, vision };
    }
    const results = [],
      summaries = [];
    // Bounded batches leave room for all dates and their explanations.
    for (let i = 0; i < input.days.length; i += 4) {
      signal.throwIfAborted();
      const group = input.days
        .slice(i, i + 4)
        .map(({ mood, manualMood, text, ...d }) => ({
          ...d,
          text:
            text.length > 1100
              ? text.slice(0, 720) + " … " + text.slice(-360)
              : text,
          [manualMood ? "authorScoreOutOf100" : "approximateToneOutOf100"]:
            Math.round(((Math.max(1, mood) - 1) * 100) / 9),
        }));
      progress(
        "Читаем записи · " +
          (i + 1) +
          "–" +
          (i + group.length) +
          " из " +
          input.days.length,
      );
      const dates = group.map((d) => d.date);
      const batch = await infer(
        runtime,
        JSON.stringify(group),
        modelSchema(mode, dates),
        "Для каждой переданной даты сначала внимательно прочитай текст. Если автор описывает нападение, избиение, насилие, угрозу, травму, больницу или другое опасное событие, поставь очень низкий балл 0–15 независимо от оттенка и фотографии. Нейтральный рассказ обычно около 45–60, радостный около 80–95. Ориентир уже переведён в баллы из 100, но содержание имеет приоритет. Не смешивай события разных дат. По одному короткому основанию и общая фраза. Используй даты ровно по одному разу.",
        720,
        signal,
      );
      if (!MemoryContract.validMonth(batch, dates))
        throw Error("invalid_output");
      results.push(...batch.days);
      summaries.push(batch.summary);
    }
    let summary = summaries[0];
    if (summaries.length > 1) {
      progress("Собираем оценку месяца…");
      const schema = {
        type: "object",
        properties: {
          summary: { type: "string", minLength: 1, maxLength: 480 },
        },
        required: ["summary"],
        additionalProperties: false,
      };
      const combined = await infer(
        runtime,
        JSON.stringify({
          summaries,
          average: MemoryContract.ranked(results).average,
        }),
        schema,
        "Напиши одно короткое наблюдение о месяце по его записям и их средней оценке.",
        180,
        signal,
      );
      summary = combined.summary;
    }
    return { result: { days: results, summary } };
  } finally {
    running = false;
  }
}
