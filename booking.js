/* Бриз – «Узнать, свободен ли пост»: несколько услуг, день, время (круглосуточно), контакты, живой текст обращения (30.10.2026).
   Даты и время – по Ижевску (Europe/Samara, UTC+4), прошедшие не выбрать. Это вопрос, а не бронь: ничего не отправляется само –
   Telegram: текст копируется и открывается чат @Briz_izh (с карточки на Картах); или копируем обращение; или звонок. */
(() => {
  const form = document.querySelector("[data-b-booking]");
  if (!form) return;

  const TG = "https://t.me/Briz_izh";       // Telegram с карточки на Яндекс.Картах
  const TZ = "Europe/Samara";
  const SLOTS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0") + ":00");   // мойка работает 24 часа
  const DAYS = 7, LEAD_MIN = 15;            // неделя вперёд; ближайший час – не раньше чем через 15 минут
  const KEY = "briz-obrashchenie";

  const $ = (s, r = form) => r.querySelector(s);
  const $$ = (s, r = form) => [...r.querySelectorAll(s)];
  const daysBox = $("[data-b-days]"), timesBox = $("[data-b-times]"), timesNote = $("[data-b-times-note]"), spanEl = $("[data-b-span]");
  const textEl = $("[data-b-text]"), errEl = $("[data-b-error]"), noteEl = $("[data-b-note]");
  const rub = (n) => Math.round(n).toLocaleString("ru-RU").replace(/\s/g, " ") + " ₽";

  // ---- «сейчас» в Ижевске, независимо от часового пояса посетителя
  const izhNow = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, min: (+p.hour % 24) * 60 + +p.minute };
  };
  const wd = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const wdFull = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const mon = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const monShort = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const durText = (m) => m < 60 ? m + " мин" : m % 60 ? Math.floor(m / 60) + " ч " + (m % 60) + " мин" : Math.floor(m / 60) === 1 ? "60 минут" : Math.floor(m / 60) + " ч";

  // ---- черновик: если посетитель перезагрузил страницу, введённое не теряется
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; } };
  const save = (st) => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} };
  const draft = load();

  // ---- дни: сегодня недоступно, только если до полуночи не осталось ни одного часа
  let today = izhNow();
  const dayDate = (i) => { const d = new Date(Date.UTC(today.y, today.m - 1, today.d)); d.setUTCDate(d.getUTCDate() + i); return d; };
  const buildDays = (keep) => {
    today = izhNow();
    daysBox.innerHTML = "";
    for (let i = 0; i < DAYS; i++) {
      const d = dayDate(i), iso = d.toISOString().slice(0, 10);
      const full = (i === 0 ? "сегодня, " : i === 1 ? "завтра, " : "") + d.getUTCDate() + " " + mon[d.getUTCMonth()] + ", " + wdFull[d.getUTCDay()];
      const top = i === 0 ? "сегодня" : i === 1 ? "завтра" : wd[d.getUTCDay()];
      const off = i === 0 && today.min + LEAD_MIN > toMin(SLOTS[SLOTS.length - 1]);
      daysBox.insertAdjacentHTML("beforeend",
        `<label class="b-day"><input type="radio" name="day" value="${iso}" data-i="${i}" data-full="${full}"${off ? " disabled" : ""}><span><small>${top}</small><b>${d.getUTCDate()}</b><em>${monShort[d.getUTCMonth()]}</em></span></label>`);
    }
    const pick = keep && daysBox.querySelector(`input[value="${keep}"]:not(:disabled)`) || daysBox.querySelector("input:not(:disabled)");
    if (pick) pick.checked = true;
  };

  // ---- время для выбранного дня; выбранное сохраняется, если оно ещё не прошло
  const buildTimes = (keep) => {
    const day = daysBox.querySelector("input:checked");
    const isToday = day && day.dataset.i === "0";
    const now = izhNow().min;
    timesBox.innerHTML = "";
    SLOTS.forEach((t) => {
      const past = isToday && toMin(t) < now + LEAD_MIN;
      const night = toMin(t) < 360 || toMin(t) >= 1320;
      timesBox.insertAdjacentHTML("beforeend", `<label class="b-time${night ? " is-night" : ""}"><input type="radio" name="time" value="${t}"${past ? " disabled" : ""}><span>${t}</span></label>`);
    });
    timesNote.hidden = true;
    if (keep) {
      const inp = timesBox.querySelector(`input[value="${keep}"]`);
      if (inp && !inp.disabled) inp.checked = true;
      else if (inp) { timesNote.textContent = `Сегодня ${keep} уже прошло – выберите другое время или другой день.`; timesNote.hidden = false; }
    }
  };

  // ---- услуги, ориентир по сумме и времени
  const services = () => $$("input[name=svc]:checked").map((i) => ({ name: i.value, price: +i.dataset.price, min: +i.dataset.min }));
  const totals = (list) => ({ price: list.reduce((a, s) => a + s.price, 0), min: list.reduce((a, s) => a + s.min, 0) });
  const renderSum = (list) => {
    const t = totals(list);
    $("[data-b-count]").textContent = list.length;
    $("[data-b-total]").textContent = list.length ? "от " + rub(t.price) : "выберите услугу";
    $("[data-b-dur]").textContent = list.length ? "~" + durText(t.min) : "–";
    $("[data-b-multi]").hidden = list.length < 2;
  };

  // интервал «с … до …» с учётом перехода через полночь
  const spanText = () => {
    const day = daysBox.querySelector("input:checked"), time = timesBox.querySelector("input:checked"), list = services();
    if (!day || !time || !list.length) return "";
    const start = toMin(time.value), end = start + totals(list).min;
    if (end < 1440) return `Ориентировочно с ${time.value} до ${hhmm(end)}.`;
    const next = dayDate(+day.dataset.i + 1);
    return `Ориентировочно с ${time.value} до ${hhmm(end)} – уже ${next.getUTCDate()} ${mon[next.getUTCMonth()]}.`;
  };

  // ---- текст обращения
  const val = (n) => (form.elements[n].value || "").trim();
  const buildText = () => {
    const list = services(), day = daysBox.querySelector("input:checked"), time = timesBox.querySelector("input:checked"), t = totals(list);
    const lines = ["Здравствуйте! Хочу уточнить, будет ли свободен пост на автомойке «Бриз».", "", "Услуги:"];
    if (list.length) list.forEach((s) => lines.push("– " + s.name + " – от " + rub(s.price)));
    else lines.push("– пока не выбрал(а)");
    if (list.length) lines.push("", "Ориентировочная стоимость: от " + rub(t.price) + ".", "Ориентировочная продолжительность: " + durText(t.min) + ".");
    lines.push("", "Желаемая дата: " + (day ? day.dataset.full : "не выбрана"), "Желаемое время: " + (time ? time.value : "не выбрано"));
    if (val("name")) lines.push("Имя: " + val("name"));
    if (val("phone")) lines.push("Телефон: " + val("phone"));
    if (val("car")) lines.push("Автомобиль: " + val("car"));
    if (val("comment")) lines.push("Комментарий: " + val("comment"));
    lines.push("", "Подскажите, будет ли свободен подходящий пост и какие тарифы действуют?");
    return lines.join("\n");
  };

  const phoneOk = () => !val("phone") || val("phone").replace(/\D/g, "").length >= 10;
  const markSteps = () => {
    const done = { svc: services().length > 0, day: !!daysBox.querySelector("input:checked"), time: !!timesBox.querySelector("input:checked"), contacts: !!(val("name") || val("phone")) && phoneOk() };
    $$("[data-b-step]").forEach((f) => f.classList.toggle("is-done", !!done[f.dataset.bStep]));
  };

  const update = () => {
    const list = services();
    renderSum(list);
    spanEl.textContent = spanText();
    textEl.textContent = buildText();
    markSteps();
    save({ svc: list.map((s) => s.name), day: daysBox.querySelector("input:checked")?.value, time: timesBox.querySelector("input:checked")?.value,
      name: val("name"), phone: val("phone"), car: val("car"), comment: val("comment") });
    if (!errEl.hidden) check(false);
  };

  // ---- проверка: для вопроса о посте нужны услуга, день и время; телефон – только если введён, то полностью
  const check = (focus = true) => {
    const miss = []; let first = null;
    const need = (ok, label, el) => { if (!ok) { miss.push(label); first = first || el; } };
    need(services().length > 0, "услугу", $("input[name=svc]"));
    need(!!daysBox.querySelector("input:checked"), "день", daysBox.querySelector("input:not(:disabled)"));
    need(!!timesBox.querySelector("input:checked"), "время", timesBox.querySelector("input:not(:disabled)"));
    need(phoneOk(), "телефон полностью (10 цифр)", form.elements.phone);
    form.elements.phone.closest(".b-field").classList.toggle("is-bad", !phoneOk());
    if (miss.length) {
      errEl.textContent = "Чтобы отправить вопрос, укажите: " + miss.join(", ") + ".";
      errEl.hidden = false;
      if (focus && first) first.focus({ preventScroll: false });
      return false;
    }
    errEl.hidden = true;
    return true;
  };

  const say = (t) => { noteEl.textContent = t; noteEl.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => (noteEl.hidden = true), 8000); };
  const copy = async (t) => {
    try { await navigator.clipboard.writeText(t); return true; }
    catch (_) {
      const ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok;
    }
  };

  form.addEventListener("click", async (e) => {
    const send = e.target.closest("[data-b-send]"), cp = e.target.closest("[data-b-copy]");
    if (!send && !cp) return;
    e.preventDefault();
    if (!check()) return;
    const text = buildText();
    const ok = await copy(text);
    if (cp) { say(ok ? "Обращение скопировано – вставьте его в Telegram, WhatsApp или SMS." : "Не получилось скопировать – откройте «Текст обращения» и выделите его вручную."); if (!ok) $(".b-preview").open = true; return; }
    window.open(TG, "_blank", "noopener");
    say(ok ? "Обращение скопировано. Вставьте его в открывшийся чат «Бриза» в Telegram и отправьте – администратор ответит там." : "Откройте чат в Telegram и вставьте текст из блока «Текст обращения».");
    if (!ok) $(".b-preview").open = true;
  });

  // ---- события: смена услуг не трогает день, время и контакты
  daysBox.addEventListener("change", () => { const t = timesBox.querySelector("input:checked")?.value; buildTimes(t); update(); });
  form.addEventListener("change", (e) => { if (!e.target.closest("[data-b-days]")) update(); });
  form.addEventListener("input", (e) => { if (e.target.matches("input[type=text], input[type=tel]")) update(); });

  // ---- кнопки «Спросить про пост» по странице: прокрутка к форме и фокус на первом шаге
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-b-go]"); if (!go) return;
    e.preventDefault();
    document.getElementById("widget").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    setTimeout(() => $("input[name=svc]").focus({ preventScroll: true }), 450);
  });

  // ---- старт: черновик или значения по умолчанию
  if (draft) {
    if (Array.isArray(draft.svc)) $$("input[name=svc]").forEach((i) => (i.checked = draft.svc.includes(i.value)));
    ["name", "phone", "car", "comment"].forEach((n) => { if (draft[n]) form.elements[n].value = draft[n]; });
    if (draft.car || draft.comment) $(".b-more").open = true;
  }
  buildDays(draft && draft.day);
  buildTimes(draft && draft.time);
  update();

  // страница открыта долго: раз в минуту закрываем прошедшие часы; после полуночи сдвигаем даты, выбор не сбрасываем без нужды
  setInterval(() => {
    const now = izhNow();
    const dayChanged = now.d !== today.d, onToday = daysBox.querySelector("input:checked")?.dataset.i === "0";
    if (!dayChanged && !onToday) return;
    const d = daysBox.querySelector("input:checked")?.value, t = timesBox.querySelector("input:checked")?.value;
    buildDays(d); buildTimes(t); update();
  }, 60000);
})();
