"use strict";
const sound = byId("sound");
let activeTrack = null,
  hoverStarted = false,
  loadingTrack = false,
  playbackRequest = 0;
function trackSource(e) {
  if (e.audio) return e.audio;
  const url = safeUrl(e.songUrl);
  return url &&
    /\.(mp3|m4a|aac|flac|wav|oga|ogg|opus|mp4|webm)$/i.test(
      new URL(url).pathname,
    )
    ? url
    : "";
}
function trackClock(s) {
  return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
}
function syncPlayer() {
  const playing = !!activeTrack && !sound.paused && !sound.ended;
  byId("play-dock").hidden = true;
  if (activeTrack) {
    byId("dock-title").textContent = musicCaption(activeTrack);
    byId("dock-play").textContent = playing ? "Ⅱ" : "▶";
    byId("dock-play").setAttribute(
      "aria-label",
      playing ? "Пауза" : "Воспроизвести",
    );
    byId("seek").disabled = !(
      sound.duration > 0 && Number.isFinite(sound.duration)
    );
    byId("seek").value = byId("seek").disabled
      ? 0
      : Math.round((1000 * sound.currentTime) / sound.duration);
    byId("play-time").textContent = trackClock(sound.currentTime || 0);
  }
  document.querySelectorAll("button.track-player").forEach((b) => {
    const on = playing && b.dataset.date === activeTrack?.date;
    b.classList.toggle("is-playing", on);
    b.querySelector(".play-key").textContent = on ? "Ⅱ" : "▶";
    b.setAttribute(
      "aria-label",
      (on ? "Пауза — " : "Воспроизвести — ") +
        b.querySelector(".track-label").textContent,
    );
  });
  document.querySelectorAll("button.mini-disc").forEach((disc) => {
    const on = playing && disc.dataset.date === activeTrack?.date;
    disc.classList.toggle("is-playing", on);
    disc.setAttribute("aria-label", on ? "Пауза музыки дня" : "Воспроизвести музыку дня");
  });
}
function closePlayer() {
  playbackRequest++;
  loadingTrack = false;
  activeTrack = null;
  sound.pause();
  sound.removeAttribute("src");
  sound.load();
  syncPlayer();
}
async function startTrack(entry, fromHover = false) {
  const source = trackSource(entry);
  if (!source || (fromHover && (loadingTrack || !sound.paused))) return;
  const same =
    activeTrack?.date === entry.date && trackSource(activeTrack) === source;
  if (same && !fromHover && (!sound.paused || loadingTrack)) {
    playbackRequest++;
    loadingTrack = false;
    sound.pause();
    syncPlayer();
    return;
  }
  const ticket = ++playbackRequest;
  loadingTrack = true;
  hoverStarted = fromHover;
  if (!same) {
    sound.pause();
    activeTrack = entry;
    sound.src = source;
  }
  if (sound.ended) sound.currentTime = 0;
  try {
    await sound.play();
  } catch (error) {
    if (ticket !== playbackRequest) return;
    if (error.name === "NotAllowedError" && fromHover) {
      closePlayer();
      return;
    }
    if (error.name !== "AbortError")
      toast(
        error.name === "NotAllowedError"
          ? "Нажми ▶, чтобы включить звук."
          : "Не удалось воспроизвести аудио.",
      );
  } finally {
    if (ticket === playbackRequest) {
      loadingTrack = false;
      syncPlayer();
    }
  }
}
// A track that started by hovering stops when the pointer leaves the photo.
function stopHoverTrack(entry) {
  if (!hoverStarted || activeTrack?.date !== entry.date) return;
  hoverStarted = false;
  playbackRequest++;
  loadingTrack = false;
  sound.pause();
  syncPlayer();
}
function bindPhotoAudio(node, entry) {
  if (!trackSource(entry)) return;
  node.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") stopHoverTrack(entry);
  });
  node.addEventListener("pointerenter", (event) => {
    if (
      event.pointerType === "mouse" &&
      matchMedia("(hover: hover)").matches &&
      setting("daytrace-hover", "on") === "on"
    )
      startTrack(entry, true);
  });
}
function trackControl(entry) {
  const label = musicCaption(entry);
  if (!label) return null;
  const source = trackSource(entry),
    url = safeUrl(entry.songUrl);
  const control = element(
    source ? "button" : url ? "a" : "span",
    "track-player",
  );
  if (source) {
    control.type = "button";
    control.dataset.date = entry.date;
    control.onclick = () => startTrack(entry);
    control.setAttribute("aria-label", "Воспроизвести — " + label);
  } else if (url) {
    control.href = url;
    control.target = "_blank";
    control.rel = "noopener noreferrer";
    control.setAttribute("aria-label", "Открыть трек — " + label);
  }
  control.append(
    element("span", "play-key", source ? "▶" : url ? "↗" : "♫"),
    element("span", "track-label", label),
  );
  if (source) {
    const bars = element("span", "bars");
    bars.setAttribute("aria-hidden", "true");
    [5, 10, 14, 7, 18, 22, 10, 16, 7, 4].forEach((h, i) => {
      const b = element("i");
      b.style.setProperty("--bar", h + "px");
      b.style.setProperty("--delay", i * -0.09 + "s");
      bars.append(b);
    });
    control.append(bars);
  }
  return control;
}
[
  "timeupdate",
  "durationchange",
  "loadedmetadata",
  "play",
  "pause",
  "ended",
  "emptied",
  "error",
].forEach((type) => sound.addEventListener(type, syncPlayer));
byId("dock-play").onclick = () => {
  if (activeTrack) startTrack(activeTrack);
};
byId("dock-close").onclick = closePlayer;
byId("seek").oninput = (e) => {
  if (Number.isFinite(sound.duration))
    sound.currentTime = (sound.duration * Number(e.target.value)) / 1000;
};

/* Links to music services cannot be played by <audio>, so they open in the service's own embedded player. */
function embedFor(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, ""),
    parts = u.pathname.split("/").filter(Boolean);
  if (host === "youtu.be" && parts[0])
    return { src: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(parts[0]) + "?autoplay=1&rel=0", height: 210, name: "YouTube" };
  if (/^(music\.)?youtube\.com$/.test(host)) {
    const id = u.searchParams.get("v") || (/^(shorts|embed|live)$/.test(parts[0]) ? parts[1] : "");
    if (id)
      return { src: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0", height: 210, name: "YouTube" };
  }
  if (host === "open.spotify.com") {
    const i = parts.findIndex((x) => /^(track|album|playlist|episode|artist)$/.test(x));
    if (i >= 0 && parts[i + 1])
      return { src: "https://open.spotify.com/embed/" + parts[i] + "/" + encodeURIComponent(parts[i + 1]) + "?utm_source=generator", height: 152, name: "Spotify" };
  }
  if (host === "soundcloud.com" && parts.length >= 2)
    return { src: "https://w.soundcloud.com/player/?auto_play=true&url=" + encodeURIComponent(u.origin + u.pathname), height: 166, name: "SoundCloud" };
  if (/^music\.yandex\.(ru|com|kz|by)$/.test(host)) {
    const t = parts.indexOf("track"), a = parts.indexOf("album");
    if (t >= 0 && parts[t + 1] && a >= 0 && parts[a + 1])
      return { src: "https://music.yandex.ru/iframe/track/" + encodeURIComponent(parts[t + 1]) + "/" + encodeURIComponent(parts[a + 1]), height: 120, name: "Яндекс Музыка" };
    if (a >= 0 && parts[a + 1])
      return { src: "https://music.yandex.ru/iframe/album/" + encodeURIComponent(parts[a + 1]), height: 240, name: "Яндекс Музыка" };
  }
  if (host === "music.apple.com")
    return { src: "https://embed.music.apple.com" + u.pathname + u.search, height: 175, name: "Apple Music" };
  return null;
}
function linkPlayer(entry) {
  const url = safeUrl(entry.songUrl);
  if (!url || trackSource(entry)) return null;
  const box = element("div", "music-embed"),
    embed = embedFor(url);
  if (!embed) {
    const a = element("a", "track-player", "");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.append(element("span", "play-key", "↗"), element("span", "track-label", (entry.song || "Открыть трек") + " · в новой вкладке"));
    box.append(a);
    return box;
  }
  const button = element("button", "track-player");
  button.type = "button";
  button.append(element("span", "play-key", "▶"), element("span", "track-label", (entry.song || "Трек дня") + " · " + embed.name));
  let frame = null;
  button.onclick = () => {
    if (frame) {
      frame.remove();
      frame = null;
      button.querySelector(".play-key").textContent = "▶";
      return;
    }
    closePlayer();
    frame = element("iframe", "embed-frame");
    frame.src = embed.src;
    frame.height = embed.height;
    frame.allow = "autoplay; encrypted-media; fullscreen; clipboard-write";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.title = "Трек дня · " + embed.name;
    box.append(frame);
    button.querySelector(".play-key").textContent = "Ⅱ";
  };
  box.append(button);
  return box;
}
