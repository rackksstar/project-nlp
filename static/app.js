const input = document.querySelector("#commentInput");
const analyzeButton = document.querySelector("#analyzeButton");
const errorText = document.querySelector("#errorText");
const resultBox = document.querySelector("#resultBox");
const singleResult = document.querySelector("#singleResult");
const statusMeta = document.querySelector("#statusMeta");
const timeMeta = document.querySelector("#timeMeta");
const historyList = document.querySelector("#historyList");
const API_BASE_URL = (window.MBG_API_BASE_URL || "").replace(/\/$/, "");

const history = [];

analyzeButton.addEventListener("click", analyze);
input.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    analyze();
  }
});

async function analyze() {
  const text = input.value.trim();
  errorText.textContent = "";

  if (!text) {
    errorText.textContent = "Masukkan komentar MBG terlebih dahulu.";
    input.focus();
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Prediksi gagal diproses.");
    }

    renderResult(data);
    renderSingleResult(data);
    addHistory(data);
    statusMeta.textContent = "Selesai";
    timeMeta.textContent = data.time;
  } catch (error) {
    errorText.textContent = error.message;
    statusMeta.textContent = "Gagal";
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  analyzeButton.disabled = isLoading;
  analyzeButton.textContent = isLoading ? "Menganalisis..." : "Analisis Sekarang";
  statusMeta.textContent = isLoading ? "Memproses" : statusMeta.textContent;
}

function renderResult(data) {
  resultBox.className = "result-box has-result";
  resultBox.innerHTML = `
    <div>
      <div class="result-title">
        <span class="history-label ${data.label}">${data.labelTitle}</span>
        <strong>${data.confidence.toFixed(2)}%</strong>
      </div>
      <p>${escapeHtml(data.description)}</p>
      <p><strong>Komentar:</strong> ${escapeHtml(data.text)}</p>
    </div>
  `;
}

function renderSingleResult(data) {
  singleResult.innerHTML = `
    <p class="eyebrow">HASIL ANALISIS</p>
    <div class="prediction-card prediction-card--${data.label}">
      <span class="prediction-card__label">${data.labelTitle}</span>
      <strong class="prediction-card__score">${data.confidence.toFixed(2)}%</strong>
      <p>${escapeHtml(data.description)}</p>
    </div>
  `;
}

function addHistory(data) {
  history.unshift(data);
  history.splice(3);
  savePrediction(data);

  historyList.innerHTML = history
    .map(
      (item) => `
      <div class="history-item">
        <div class="history-item__top">
          <span class="history-label ${item.label}">${item.labelTitle}</span>
          <strong>${item.confidence.toFixed(2)}%</strong>
        </div>
        <p>${escapeHtml(shorten(item.text, 88))}</p>
        <time>${item.time}</time>
      </div>
    `,
    )
    .join("");
}

function shorten(text, length) {
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function savePrediction(data) {
  const key = "mbgSentimentPredictions";
  const saved = JSON.parse(localStorage.getItem(key) || "[]");
  saved.unshift({
    label: data.label,
    labelTitle: data.labelTitle,
    confidence: data.confidence,
    text: data.text,
    time: data.time,
    date: new Date().toISOString(),
  });
  localStorage.setItem(key, JSON.stringify(saved.slice(0, 100)));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}
