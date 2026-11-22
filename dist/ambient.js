"use strict";
/* Background music for the whole diary. Browsers allow sound only after the first click or key press. */
(() => {
  const KEY = "daytrace-ambient";
  const audio = new Audio("assets/ambient.mp3");
  audio.loop = true;
  audio.volume = 0.3;
  audio.preload = "auto";
  let wanted = true;
  try {
    wanted = localStorage.getItem(KEY) !== "off";
  } catch {}
  let suspended = false;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ambient-toggle";
  function paint() {
    const on = wanted && !audio.paused;
    button.textContent = "♪";
    button.classList.toggle("is-off", !on);
    button.title = on ? "Выключить фоновую музыку" : "Включить фоновую музыку";
    button.setAttribute("aria-label", button.title);
  }
  async function start() {
    if (!wanted || suspended || !audio.paused) return paint();
    try {
      await audio.play();
    } catch {}
    paint();
  }
  function stop() {
    audio.pause();
    paint();
  }
  button.onclick = () => {
    wanted = audio.paused;
    try {
      localStorage.setItem(KEY, wanted ? "on" : "off");
    } catch {}
    suspended = false;
    wanted ? start() : stop();
  };
  document.body.append(button);
  fetch("assets/ambient.mp3", { method: "HEAD" }).then((response) => {
    if (!response.ok) {
      wanted = false;
      button.remove();
      stop();
    }
  }).catch(() => {});
  paint();
  start();
  for (const type of ["pointerdown", "keydown", "touchstart"])
    addEventListener(type, start, { once: false, passive: true });
  audio.addEventListener("play", paint);
  audio.addEventListener("pause", paint);
  // The diary's own track and embedded players take over from the background music.
  if (typeof sound !== "undefined") {
    sound.addEventListener("play", () => {
      suspended = true;
      audio.pause();
    });
    for (const type of ["pause", "ended"])
      sound.addEventListener(type, () => {
        suspended = false;
        start();
      });
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest?.(".music-embed button")) return;
    setTimeout(() => {
      suspended = Boolean(document.querySelector(".music-embed iframe"));
      suspended ? audio.pause() : start();
    }, 0);
  });
})();
