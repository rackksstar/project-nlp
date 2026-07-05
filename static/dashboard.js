const FALLBACK_DATA = {
  source: "Data contoh",
  generatedAt: "-",
  total: 6,
  counts: { positif: 3, netral: 2, negatif: 1 },
  percentages: { positif: 50, netral: 33.33, negatif: 16.67 },
  averageConfidence: 92.45,
  trend: [
    { name: "1-2", positif: 1, netral: 1, negatif: 0 },
    { name: "3-4", positif: 1, netral: 0, negatif: 1 },
    { name: "5-6", positif: 1, netral: 1, negatif: 0 },
  ],
  topTerms: {
    positif: [{ term: "siswa", count: 3 }, { term: "terbantu", count: 2 }],
    netral: [{ term: "pembagian", count: 2 }, { term: "sekolah", count: 2 }],
    negatif: [{ term: "porsi", count: 1 }, { term: "dingin", count: 1 }],
  },
  samples: [
    { label: "positif", text: "Program MBG membantu siswa lebih fokus belajar.", confidence: 94.8 },
    { label: "netral", text: "Pembagian MBG dilakukan setiap pagi.", confidence: 91.2 },
    { label: "negatif", text: "Beberapa porsi MBG diterima dalam kondisi kurang hangat.", confidence: 88.5 },
  ],
};

loadDashboard();

async function loadDashboard() {
  let summary = FALLBACK_DATA;

  try {
    const response = await fetch("./dashboard-data.json", { cache: "no-store" });
    if (response.ok) {
      summary = await response.json();
    }
  } catch (error) {
    console.warn("Dashboard memakai data fallback:", error);
  }

  renderDashboard(summary);
}

function renderDashboard(summary) {
  const counts = normalizeCounts(summary.counts);
  const total = Number(summary.total || counts.positif + counts.netral + counts.negatif);
  const percentages = {
    positif: getPercent(summary, "positif", counts, total),
    netral: getPercent(summary, "netral", counts, total),
    negatif: getPercent(summary, "negatif", counts, total),
  };

  renderMetrics(summary, counts, total, percentages);
  renderDonut(percentages);
  renderBars(counts);
  renderPie(counts, percentages);
  renderTimeline(summary.trend || []);
  renderTerms(summary.topTerms || {});
  renderInsights(summary, counts, total);
  renderComments(summary.samples || []);
}

function normalizeCounts(counts = {}) {
  return {
    positif: Number(counts.positif || 0),
    netral: Number(counts.netral || 0),
    negatif: Number(counts.negatif || 0),
  };
}

function getPercent(summary, label, counts, total) {
  if (summary.percentages && Number.isFinite(Number(summary.percentages[label]))) {
    return Number(summary.percentages[label]);
  }
  return total ? Number(((counts[label] / total) * 100).toFixed(2)) : 0;
}

function renderMetrics(summary, counts, total, percentages) {
  setText("#positiveCount", formatNumber(counts.positif));
  setText("#neutralCount", formatNumber(counts.netral));
  setText("#negativeCount", formatNumber(counts.negatif));
  setText("#totalCount", formatNumber(total));
  setText("#positivePercent", `${formatPercent(percentages.positif)} dari dataset`);
  setText("#neutralPercent", `${formatPercent(percentages.netral)} dari dataset`);
  setText("#negativePercent", `${formatPercent(percentages.negatif)} dari dataset`);
  setText("#dataSource", `CSV: ${formatDate(summary.generatedAt)}`);
}

function renderDonut(percentages) {
  const positiveStop = percentages.positif;
  const neutralStop = positiveStop + percentages.netral;
  document.querySelector("#donutChart").style.background = buildConicGradient(positiveStop, neutralStop);
  setText("#legendPositive", formatPercent(percentages.positif));
  setText("#legendNeutral", formatPercent(percentages.netral));
  setText("#legendNegative", formatPercent(percentages.negatif));
}

function renderBars(counts) {
  const max = Math.max(counts.positif, counts.netral, counts.negatif, 1);
  setBar("#positiveBar", counts.positif, max);
  setBar("#neutralBar", counts.netral, max);
  setBar("#negativeBar", counts.negatif, max);
  setText("#positiveBarValue", formatNumber(counts.positif));
  setText("#neutralBarValue", formatNumber(counts.netral));
  setText("#negativeBarValue", formatNumber(counts.negatif));
}

function renderPie(counts, percentages) {
  const positiveStop = percentages.positif;
  const neutralStop = positiveStop + percentages.netral;
  document.querySelector("#pieChart").style.background = buildConicGradient(positiveStop, neutralStop);
  setText("#piePositive", `${formatNumber(counts.positif)} komentar`);
  setText("#pieNeutral", `${formatNumber(counts.netral)} komentar`);
  setText("#pieNegative", `${formatNumber(counts.negatif)} komentar`);
}

function renderTimeline(trend) {
  const max = Math.max(
    ...trend.map((item) => Number(item.positif || 0) + Number(item.netral || 0) + Number(item.negatif || 0)),
    1,
  );
  document.querySelector("#timeline").innerHTML = trend
    .map((item) => {
      const total = Number(item.positif || 0) + Number(item.netral || 0) + Number(item.negatif || 0);
      return `
        <div class="segment-bar" style="--segment-height:${Math.max((total / max) * 100, 12)}%">
          <span>${item.name}</span>
          <div>
            <i class="segment-bar__positive" style="height:${heightPart(item.positif, total)}%"></i>
            <i class="segment-bar__neutral" style="height:${heightPart(item.netral, total)}%"></i>
            <i class="segment-bar__negative" style="height:${heightPart(item.negatif, total)}%"></i>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTerms(topTerms) {
  const labels = ["positif", "netral", "negatif"];
  document.querySelector("#termBoard").innerHTML = labels
    .map((label) => {
      const terms = topTerms[label] || [];
      const max = Math.max(...terms.map((item) => Number(item.count || 0)), 1);
      return `
        <div class="term-column">
          <span class="history-label ${label}">${labelTitle(label)}</span>
          ${terms
            .slice(0, 6)
            .map(
              (item) => `
                <div class="term-row">
                  <span>${escapeHtml(item.term)}</span>
                  <i style="width:${Math.max((Number(item.count) / max) * 100, 8)}%"></i>
                  <strong>${formatNumber(item.count)}</strong>
                </div>
              `,
            )
            .join("")}
        </div>
      `;
    })
    .join("");
}

function renderInsights(summary, counts, total) {
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const copy = {
    positif: "Sentimen publik paling banyak menunjukkan dukungan atau pengalaman baik terhadap MBG.",
    netral: "Komentar publik pada dataset paling banyak bersifat informatif dan deskriptif.",
    negatif: "Komentar negatif cukup menonjol, sehingga isu kualitas dan pelaksanaan MBG perlu diperhatikan.",
  };

  document.querySelector("#insightList").innerHTML = `
    <div class="insight-item">
      <span>Sentimen dominan</span>
      <strong class="history-label ${dominant}">${labelTitle(dominant)}</strong>
      <p>${copy[dominant]}</p>
    </div>
    <div class="insight-item">
      <span>Rata-rata confidence</span>
      <strong>${formatPercent(summary.averageConfidence || 0)}</strong>
      <p>Rata-rata keyakinan model dari ${formatNumber(total)} komentar pada dataset CSV.</p>
    </div>
  `;
}

function renderComments(samples) {
  document.querySelector("#dashboardComments").innerHTML = samples
    .slice(0, 6)
    .map(
      (item) => `
        <div class="dashboard-comment">
          <span class="history-label ${item.label}">${labelTitle(item.label)}</span>
          <p>${escapeHtml(shorten(item.text || item.cleanText || "", 140))}</p>
          <strong>${formatPercent(item.confidence || 0)}</strong>
        </div>
      `,
    )
    .join("");
}

function buildConicGradient(positiveStop, neutralStop) {
  return `
    conic-gradient(
      var(--positive) 0% ${positiveStop}%,
      var(--neutral) ${positiveStop}% ${neutralStop}%,
      var(--negative) ${neutralStop}% 100%
    )
  `;
}

function heightPart(value, total) {
  return total ? (Number(value || 0) / total) * 100 : 0;
}

function labelTitle(label) {
  return {
    positif: "Positif",
    netral: "Netral",
    negatif: "Negatif",
  }[label];
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}

function formatDate(value) {
  if (!value || value === "-") return "dataset";
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function setBar(selector, value, max) {
  document.querySelector(selector).style.width = `${Math.max((value / max) * 100, value ? 8 : 0)}%`;
}

function shorten(text, length) {
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
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
