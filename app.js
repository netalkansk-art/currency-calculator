const API_ROOT = "https://www.cbr-xml-daily.ru";
const DEFAULT_CODES = ["USD", "EUR", "CNY", "KZT"];
const FLAGS = { USD: "🇺🇸", EUR: "🇪🇺", CNY: "🇨🇳", KZT: "🇰🇿", GBP: "🇬🇧", CHF: "🇨🇭", JPY: "🇯🇵", TRY: "🇹🇷", AED: "🇦🇪", AMD: "🇦🇲", BYN: "🇧🇾", GEL: "🇬🇪", INR: "🇮🇳", KRW: "🇰🇷" };

const state = { data: null, selected: new Set(DEFAULT_CODES), requestedDate: null };
const els = {
  date: document.querySelector("#rate-date"),
  cards: document.querySelector("#rate-cards"),
  options: document.querySelector("#currency-options"),
  effectiveDate: document.querySelector("#effective-date"),
  amount: document.querySelector("#amount"),
  from: document.querySelector("#from-currency"),
  to: document.querySelector("#to-currency"),
  swap: document.querySelector("#swap"),
  result: document.querySelector("#result"),
  note: document.querySelector("#calculation-note"),
  status: document.querySelector("#status")
};

function localIsoDate(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function apiUrl(dateString) {
  const [year, month, day] = dateString.split("-");
  return `${API_ROOT}/archive/${year}/${month}/${day}/daily_json.js`;
}

function formatNumber(value, digits = 4) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);
}

function parseAmount(value) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}

function showStatus(message = "") {
  els.status.hidden = !message;
  els.status.textContent = message;
}

function previousDate(dateString, daysBack) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() - daysBack);
  return localIsoDate(date);
}

async function fetchRates(dateString) {
  showStatus("");
  els.cards.innerHTML = '<div class="muted">Загружаем курсы...</div>';
  els.date.disabled = true;
  state.requestedDate = dateString;
  try {
    let response;
    for (let daysBack = 0; daysBack <= 10; daysBack += 1) {
      response = await fetch(apiUrl(previousDate(dateString, daysBack)));
      if (response.ok) break;
      if (response.status !== 404) throw new Error(`HTTP ${response.status}`);
    }
    if (!response?.ok) throw new Error("Курс не найден за последние 10 дней");
    state.data = await response.json();
    renderAll();
  } catch (error) {
    state.data = null;
    els.cards.innerHTML = "";
    els.result.textContent = "-";
    els.note.textContent = "";
    showStatus("Не удалось загрузить курсы на выбранную дату. Проверьте подключение к интернету или выберите предыдущий рабочий день.");
    console.error(error);
  } finally {
    els.date.disabled = false;
  }
}

function currencies() {
  if (!state.data) return [];
  return [
    { CharCode: "RUB", Name: "Российский рубль", Nominal: 1, Value: 1 },
    ...Object.values(state.data.Valute)
  ];
}

function renderOptions() {
  els.options.innerHTML = currencies()
    .filter(item => item.CharCode !== "RUB")
    .map(item => `<label class="check-option"><input type="checkbox" value="${item.CharCode}" ${state.selected.has(item.CharCode) ? "checked" : ""}><span>${item.CharCode}</span></label>`)
    .join("");
}

function renderCards() {
  const lookup = state.data.Valute;
  els.cards.innerHTML = [...state.selected]
    .filter(code => lookup[code])
    .map(code => {
      const item = lookup[code];
      return `<article class="rate-card">
        <div class="rate-card-top"><span class="currency-code">${item.CharCode}</span><span class="currency-flag">${FLAGS[code] || "◉"}</span></div>
        <p class="currency-name">${item.Name}</p>
        <div class="rate-value">${formatNumber(item.Value, 4)} ₽ <span class="rate-unit">за ${item.Nominal} ${item.CharCode}</span></div>
      </article>`;
    }).join("");
}

function renderSelects() {
  const currentFrom = els.from.value || "KZT";
  const currentTo = els.to.value || "RUB";
  const options = currencies().map(item => `<option value="${item.CharCode}">${item.CharCode} - ${item.Name}</option>`).join("");
  els.from.innerHTML = options;
  els.to.innerHTML = options;
  els.from.value = currencies().some(x => x.CharCode === currentFrom) ? currentFrom : "USD";
  els.to.value = currencies().some(x => x.CharCode === currentTo) ? currentTo : "RUB";
}

function rateInRubles(code) {
  if (code === "RUB") return 1;
  const item = state.data.Valute[code];
  return item.Value / item.Nominal;
}

function calculate() {
  if (!state.data) return;
  const amount = parseAmount(els.amount.value);
  if (!Number.isFinite(amount)) {
    els.result.textContent = "Введите сумму";
    els.note.textContent = "";
    return;
  }
  const from = els.from.value;
  const to = els.to.value;
  const result = amount * rateInRubles(from) / rateInRubles(to);
  els.result.textContent = `${formatNumber(result, 4)} ${to}`;
  els.note.textContent = `${formatNumber(amount, 4)} ${from} = ${formatNumber(result, 4)} ${to}`;
}

function renderAll() {
  const effective = new Date(state.data.Date);
  const requested = new Date(`${state.requestedDate}T12:00:00`);
  const dateText = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(effective);
  const differs = effective.toDateString() !== requested.toDateString();
  els.effectiveDate.textContent = `${differs ? "На выбранную дату действует курс от" : "Курс установлен на"} ${dateText}`;
  renderOptions();
  renderCards();
  renderSelects();
  calculate();
}

els.date.addEventListener("change", () => fetchRates(els.date.value));
els.options.addEventListener("change", event => {
  if (!event.target.matches("input[type=checkbox]")) return;
  event.target.checked ? state.selected.add(event.target.value) : state.selected.delete(event.target.value);
  renderCards();
});
els.amount.addEventListener("input", calculate);
els.from.addEventListener("change", calculate);
els.to.addEventListener("change", calculate);
els.swap.addEventListener("click", () => {
  [els.from.value, els.to.value] = [els.to.value, els.from.value];
  calculate();
});

els.date.max = localIsoDate();
els.date.value = localIsoDate();
fetchRates(els.date.value);
