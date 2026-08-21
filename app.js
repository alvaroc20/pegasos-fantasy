"use strict";

const COLORS = ["#4cc38a", "#58a6ff", "#f778ba", "#d29922", "#a371f7",
                "#f85149", "#3fb950", "#79c0ff", "#ff9b72", "#56d4dd"];
const STORE_KEY = "pegasos:division";
const SORT_KEY = "pegasos:sort";
const eur = new Intl.NumberFormat("es-ES");

const state = {
  index: null, slug: null, data: null, hidden: new Set(),
  view: "classification", sort: { key: "position", dir: "asc" }, week: null,
};

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

function money(value) {
  if (typeof value !== "number") return "—";
  return eur.format(Math.round(value)) + " €";
}
function moneyShort(value) {
  if (typeof value !== "number") return "—";
  const millions = value / 1000000;
  if (Math.abs(millions) >= 1) {
    return `${millions.toFixed(1).replace(".", ",")}M`;
  }
  return `${Math.round(value / 1000)}K`;
}
function signedMoney(value) {
  if (typeof value !== "number") return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${eur.format(Math.abs(Math.round(value)))} €`;
}
// Escala de color de los puntos: amarillo poco, verde bien, azul mucho.
function pointsClass(value) {
  if (typeof value !== "number") return "";
  if (value < 0) return "p-red";
  if (value === 0) return "p-grey";
  if (value <= 4) return "p-amber";
  if (value <= 9) return "p-green";
  return "p-blue";
}
function pointsBadge(value, suffix) {
  const badge = el("span", `pts ${pointsClass(value)}`,
    suffix ? `${points(value)} ${suffix}` : points(value));
  return badge;
}
function points(value) {
  if (typeof value !== "number") return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
function dayLabel(iso) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
}
function ago(iso) {
  if (!iso) return "sin fecha";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return "sin fecha";
  if (minutes < 1) return "hace segundos";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}
function stored(key) {
  try { return localStorage.getItem(key); } catch (error) { return null; }
}
function store(key, value) {
  try { localStorage.setItem(key, value); } catch (error) { /* modo privado */ }
}
async function loadJson(path) {
  const response = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

/* ---------- clasificación ---------- */

const COLUMNS = [
  { key: "position", label: "#", short: "#", dir: "asc", cls: "pos" },
  { key: null, label: "Equipo", short: "Equipo" },
  { key: "week_points", label: "Jornada", short: "J", dir: "desc" },
  { key: "points", label: "Total", short: "Tot", dir: "desc" },
  { key: "value", label: "Valor", short: "Val", dir: "desc" },
  { key: "players", label: "Jug.", short: "Jug.", dir: "desc" },
];

function sortedRows(rows) {
  const { key, dir } = state.sort;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x == null && y == null) return (a.position || 0) - (b.position || 0);
    if (x == null) return 1;
    if (y == null) return -1;
    if (x === y) return (a.position || 0) - (b.position || 0);
    return (x - y) * sign;
  });
}

function renderClassification(data) {
  const host = $("classification");
  host.replaceChildren();
  const rows = data.classification || [];
  if (!rows.length) { host.append(el("p", "empty", "Sin clasificación disponible.")); return; }

  const card = el("div", "card");
  card.append(el("h2", null, data.league_name || data.name));

  const table = el("table", "standings");
  const head = el("thead");
  const headRow = el("tr");
  for (const column of COLUMNS) {
    const th = el("th", column.cls);
    if (!column.key) {
      th.textContent = column.label;
    } else {
      const button = el("button", "sort");
      button.append(el("span", "full", column.label));
      button.append(el("span", "short", column.short));
      const active = state.sort.key === column.key;
      if (active) {
        button.classList.add("on");
        button.append(el("span", "arrow", state.sort.dir === "asc" ? "▲" : "▼"));
      }
      button.addEventListener("click", () => {
        state.sort = active
          ? { key: column.key, dir: state.sort.dir === "asc" ? "desc" : "asc" }
          : { key: column.key, dir: column.dir };
        store(SORT_KEY, JSON.stringify(state.sort));
        renderClassification(data);
      });
      th.append(button);
    }
    headRow.append(th);
  }
  head.append(headRow);
  table.append(head);

  const body = el("tbody");
  for (const row of sortedRows(rows)) {
    const tr = el("tr");
    const hasSquad = (row.squad || []).length > 0;
    if (hasSquad) tr.className = "clickable";
    const pos = el("td", "pos");
    if (row.position <= 3) {
      tr.classList.add("podium", `pos-${row.position}`);
      pos.append(el("span", "medal", String(row.position)));
    } else if (row.relegation) {
      tr.classList.add("drop");
      pos.append(el("span", "dropmark", String(row.position)));
    } else {
      pos.textContent = String(row.position);
    }
    tr.append(pos);
    const name = el("td");
    if (hasSquad) name.append(el("span", "caret", "▸"), " ");
    name.append(el("span", "name", row.team));
    if (typeof row.previous_position === "number") {
      const delta = row.previous_position - row.position;
      const mark = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : "＝";
      name.append(" ", el("span", delta > 0 ? "up" : delta < 0 ? "down" : "same", mark));
    }
    tr.append(name);
    tr.append(el("td", null, points(row.week_points)));
    tr.append(el("td", "big", points(row.points)));
    tr.append(el("td", null, moneyShort(row.value)));
    tr.append(el("td", null, row.players == null ? "—" : String(row.players)));
    body.append(tr);

    if (!hasSquad) continue;
    const details = el("tr", "details");
    details.hidden = true;
    const cell = el("td");
    cell.colSpan = COLUMNS.length;
    cell.append(squadPanel(row));
    details.append(cell);
    body.append(details);

    tr.setAttribute("aria-expanded", "false");
    tr.addEventListener("click", () => toggleDetails(tr, details));
  }
  table.append(body);
  card.append(table);
  if (rows.some((row) => row.relegation)) {
    const legend = el("p", "legend-note");
    legend.append(el("span", "dropmark small", "↓"), " ",
                  el("span", null, "Los tres ultimos descienden de division"));
    card.append(legend);
  }
  host.append(card);

  const match = data.matchdays || {};
  if ((match.active || []).length) {
    const info = el("div", "card");
    info.append(el("h2", null, "Jornada"));
    info.append(el("p", null, `Abiertas: ${match.active.map((w) => "J" + w).join(", ")}`));
    for (const week of match.active) {
      const stats = (match.weeks || {})[String(week)];
      if (!stats) continue;
      info.append(el("p", "empty",
        `J${week}: ${stats.finished}/${stats.total} partidos jugados`));
    }
    if (match.next_week && match.next_week.starts_at) {
      info.append(el("p", null,
        `La J${match.next_week.week} empieza ${whenLabel(match.next_week.starts_at)}`));
    }
    host.append(info);
  }
  const brief = briefCard(data, rows);
  if (brief) host.append(brief);
}

function briefCard(data, rows) {
  const card = el("div", "card");
  let used = false;
  card.append(el("h2", null, "De un vistazo"));

  const active = (data.matchdays && data.matchdays.active) || [];
  const live = active.length ? Math.max(...active) : null;
  const paying = ((data.evolution && data.evolution.payers) || {})[String(live)] || [];
  if (paying.length) {
    const names = new Map(rows.map((row) => [row.team_id, row.team]));
    card.append(el("p", "slot", `Pagan la J${live}`));
    const chips = el("div", "chips");
    paying.forEach((id) => chips.append(el("span", "chip pay", names.get(id) || id)));
    card.append(chips);
    used = true;
  }

  const rule = el("p", "rulenote");
  rule.append(el("strong", null, "Desempate: "));
  rule.append(el("span", null,
    "si dos equipos acaban igualados a puntos, baja el que más veces haya pagado" +
    " al bote y sube el que menos. Si siguen empatados, baja quien tenga la peor" +
    " jornada y sube quien tenga la mejor. Ya está aplicado en el orden."));
  card.append(rule);
  used = true;

  const market = [...(data.market?.system || []), ...(data.market?.managers || [])]
    .filter((entry) => typeof entry.value_7d === "number");
  if (market.length) {
    const up = market.reduce((a, b) => (b.value_7d > a.value_7d ? b : a));
    const down = market.reduce((a, b) => (b.value_7d < a.value_7d ? b : a));
    card.append(el("p", "slot", "En el mercado, 7 días"));
    const rowsWrap = el("div", "days");
    for (const [entry, tone, arrow] of [[up, "up", "▲"], [down, "down", "▼"]]) {
      const line = el("div", "day");
      line.append(el("span", "when", entry.player));
      line.append(el("span", tone, `${arrow} ${signedMoney(entry.value_7d)}`));
      line.append(el("span", "meta", money(entry.value)));
      rowsWrap.append(line);
    }
    card.append(rowsWrap);
    used = true;
  }
  return used ? card : null;
}

function toggleDetails(trigger, details) {
  const open = details.hidden;
  details.hidden = !open;
  trigger.setAttribute("aria-expanded", String(open));
  const caret = trigger.querySelector(".caret");
  if (caret) caret.textContent = open ? "▾" : "▸";
}

const SLOT_NAMES = {
  goalkeeper: "Portero", defender: "Defensas",
  midfield: "Centro del campo", striker: "Delanteros",
};
const STATUS_NAMES = {
  ok: "", injured: "lesionado", doubtful: "duda",
  suspended: "sancionado", out_of_league: "fuera de la liga",
};
const POSITION_NAMES = { POR: "Porteros", DEF: "Defensas", MED: "Centro del campo",
                         DEL: "Delanteros", ENT: "Entrenadores" };

function playerLine(player, { showTotal = true } = {}) {
  const line = el("div", "player");
  const left = el("div");
  left.append(el("span", "chip", player.position), " ",
              el("span", "pname", player.player));
  const status = STATUS_NAMES[player.status];
  if (status) left.append(" ", el("span", "hurt", status));
  if (player.owned === false) left.append(" ", el("span", "sold", "vendido"));
  line.append(left);
  line.append(pointsBadge(player.points));
  const bits = [];
  if (player.value != null) bits.push(`valor ${money(player.value)}`);
  if (typeof player.average === "number") bits.push(`media ${points(player.average)}`);
  if (player.clause) bits.push(`cláusula ${money(player.clause)}`);
  if (player.slot && player.points == null) bits.push("no jugó");
  if (player.owned === false) bits.push("ya no está en la plantilla");
  if (bits.length) line.append(el("div", "meta", bits.join(" · ")));
  return line;
}

function squadPanel(row) {
  const panel = el("div", "squad");
  const squad = row.squad || [];
  if (!squad.length) {
    panel.append(el("p", "empty", "Sin plantilla guardada."));
    return panel;
  }
  panel.append(el("h3", null, `Plantilla actual · ${squad.length} jugadores · puntos totales`));
  let position = null;
  for (const player of squad) {
    if (player.position !== position) {
      position = player.position;
      panel.append(el("p", "slot", POSITION_NAMES[position] || position));
    }
    panel.append(playerLine(player));
  }
  return panel;
}

function lineupPanel(players, week) {
  const panel = el("div", "squad");
  if (!players || !players.length) {
    panel.append(el("p", "empty", `Sin alineación guardada de la J${week}.`));
    return panel;
  }
  const total = players.reduce((sum, p) => sum + (p.points || 0), 0);
  panel.append(el("h3", null, `Alineación de la J${week} · ${points(total)} pts`));
  let slot = null;
  for (const player of players) {
    if (player.slot !== slot) {
      slot = player.slot;
      panel.append(el("p", "slot", SLOT_NAMES[slot] || slot));
    }
    panel.append(playerLine(player, { showTotal: false }));
  }
  return panel;
}

/* ---------- evolución ---------- */

function chartSvg(weeks, series) {
  const W = 660, H = 300, PAD = { l: 38, r: 12, t: 14, b: 26 };
  const visible = series.filter((s) => !state.hidden.has(s.team_id));
  const values = visible.flatMap((s) => s.total.filter((v) => typeof v === "number"));
  const max = Math.max(10, ...values);
  const stepY = Math.max(1, Math.ceil(max / 4));
  const top = stepY * 4;
  const x = (i) => PAD.l + (weeks.length < 2 ? (W - PAD.l - PAD.r) / 2
    : (i * (W - PAD.l - PAD.r)) / (weeks.length - 1));
  const y = (v) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / top);

  const parts = [`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Puntos por jornada">`];
  for (let g = 0; g <= 4; g++) {
    const value = stepY * g;
    parts.push(`<line x1="${PAD.l}" y1="${y(value)}" x2="${W - PAD.r}" y2="${y(value)}" stroke="currentColor" stroke-opacity=".14"/>`);
    parts.push(`<text x="4" y="${y(value) + 4}" font-size="11" fill="currentColor" fill-opacity=".55">${value}</text>`);
  }
  weeks.forEach((week, i) => {
    parts.push(`<text x="${x(i)}" y="${H - 8}" font-size="11" text-anchor="middle" fill="currentColor" fill-opacity=".55">J${week}</text>`);
  });
  visible.forEach((serie) => {
    const index = series.indexOf(serie);
    const color = COLORS[index % COLORS.length];
    const pts = serie.total
      .map((value, i) => (typeof value === "number" ? [x(i), y(value)] : null))
      .filter(Boolean);
    const path = pts.map((p) => p.join(",")).join(" ");
    if (pts.length > 1) {
      parts.push(`<polyline fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" points="${path}" data-line="${index}"/>`);
    }
    pts.forEach(([cx, cy]) => parts.push(`<circle cx="${cx}" cy="${cy}" r="3.2" fill="${color}" data-line="${index}"/>`));
    if (pts.length) {
      // Transparent thick line: hovering a 2px stroke is otherwise painful.
      parts.push(`<polyline class="hit" fill="none" stroke="transparent" stroke-width="16" stroke-linejoin="round" points="${path}" data-serie="${index}"/>`);
    }
  });
  parts.push("</svg>");
  return parts.join("");
}

function attachChartTips(host, tip, evolution) {
  const svg = host.querySelector("svg");
  if (!svg) return;
  const show = (serie, event) => {
    const box = host.getBoundingClientRect();
    const last = serie.total.filter((value) => typeof value === "number").pop();
    tip.replaceChildren();
    tip.append(el("strong", null, serie.team));
    tip.append(el("span", null, ` · ${points(last)} pts`));
    tip.hidden = false;
    const left = Math.min(Math.max(event.clientX - box.left, 8), box.width - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(event.clientY - box.top - 34, 0)}px`;
  };
  const highlight = (index) => {
    svg.querySelectorAll("[data-line]").forEach((node) => {
      const on = index === null || Number(node.dataset.line) === index;
      node.style.opacity = on ? "1" : "0.18";
    });
  };
  for (const line of svg.querySelectorAll("polyline.hit")) {
    const serie = evolution.teams[Number(line.dataset.serie)];
    if (!serie) continue;
    const enter = (event) => { show(serie, event); highlight(Number(line.dataset.serie)); };
    line.addEventListener("mousemove", enter);
    line.addEventListener("touchstart", (event) => {
      if (event.touches[0]) enter(event.touches[0]);
    }, { passive: true });
    line.addEventListener("mouseleave", () => { tip.hidden = true; highlight(null); });
  }
  svg.addEventListener("mouseleave", () => { tip.hidden = true; highlight(null); });
}

function renderEvolution(data) {
  const host = $("evolution");
  host.replaceChildren();
  const evolution = data.evolution || { weeks: [], teams: [] };
  const card = el("div", "card");
  card.append(el("h2", null, "Puntos acumulados por jornada"));
  if (!evolution.weeks.length) {
    card.append(el("p", "empty",
      "Todavía no hay histórico. Se guarda una foto cada vez que se publica."));
    host.append(card);
    return;
  }
  const chart = el("div", "chart-wrap");
  chart.innerHTML = chartSvg(evolution.weeks, evolution.teams);
  const tip = el("div", "tip");
  tip.hidden = true;
  chart.append(tip);
  attachChartTips(chart, tip, evolution);
  card.append(chart);

  const legend = el("div", "legend");
  evolution.teams.forEach((serie, i) => {
    const button = el("button");
    const active = !state.hidden.has(serie.team_id);
    button.setAttribute("aria-pressed", String(active));
    const dot = el("i");
    dot.style.background = COLORS[i % COLORS.length];
    button.append(dot, el("span", null, `${serie.team} · ${points(serie.last_total)}`));
    button.addEventListener("click", () => {
      if (state.hidden.has(serie.team_id)) state.hidden.delete(serie.team_id);
      else state.hidden.add(serie.team_id);
      renderEvolution(data);
    });
    legend.append(button);
  });
  card.append(legend);
  host.append(card);

  const available = data.lineup_weeks || [];
  const chosen = state.week && evolution.weeks.includes(state.week)
    ? state.week
    : evolution.weeks[evolution.weeks.length - 1];

  const payers = new Set(((evolution.payers || {})[String(chosen)]) || []);
  const settled = (data.euro && data.euro.settled || []).some((s) => s.week === chosen);
  const live = (data.matchdays && data.matchdays.active || []).includes(chosen) &&
    chosen === Math.max(...(data.matchdays.active || [chosen]));

  const weekCard = el("div", "card");
  const header = el("div", "week-head");
  header.append(el("h2", null, `Puntos de la J${chosen}`));
  if (evolution.weeks.length > 1) {
    const picker = el("div", "chips");
    for (const week of evolution.weeks) {
      const button = el("button", "chip pick", `J${week}`);
      button.setAttribute("aria-pressed", String(week === chosen));
      if (week === chosen) button.classList.add("on");
      button.addEventListener("click", () => {
        state.week = week;
        renderEvolution(data);
      });
      picker.append(button);
    }
    header.append(picker);
  }
  weekCard.append(header);
  if (payers.size) {
    const progress = weekProgress(data, chosen);
    const played = progress ? ` (${progress.finished}/${progress.total} partidos)` : "";
    const note = settled
      ? `Jornada liquidada: ${payers.size} pagaron 1 € cada uno.`
      : progress && !progress.complete
        ? `Corte provisional: pagarían ${payers.size}${played}. Puede cambiar.`
        : `${payers.size} pagan${played}, pendiente de que LALIGA la cierre.`;
    weekCard.append(el("p", "empty", note));
  }

  const table = el("table");
  table.innerHTML = "<thead><tr><th>#</th><th>Equipo</th><th>Jornada</th></tr></thead>";
  const body = el("tbody");
  const index = evolution.weeks.indexOf(chosen);
  const ranked = evolution.teams
    .map((serie) => ({ team: serie.team, team_id: serie.team_id,
                       value: serie.week[index] }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  ranked.forEach((row, position) => {
    const tr = el("tr");
    const hasLineup = available.includes(chosen);
    if (hasLineup) tr.className = "clickable";
    tr.append(el("td", "pos", String(position + 1)));
    const name = el("td");
    if (hasLineup) name.append(el("span", "caret", "▸"), " ");
    name.append(el("span", "name", row.team));
    if (payers.has(row.team_id)) {
      name.append(" ", el("span", "topay", "A pagar"));
      tr.classList.add("paying");
    }
    tr.append(name);
    const value = el("td");
    value.append(pointsBadge(row.value));
    tr.append(value);
    body.append(tr);

    if (!hasLineup) return;
    const details = el("tr", "details");
    details.hidden = true;
    const cell = el("td");
    cell.colSpan = 3;
    cell.append(el("p", "empty", "Cargando alineación…"));
    details.append(cell);
    body.append(details);
    tr.setAttribute("aria-expanded", "false");
    let loaded = false;
    tr.addEventListener("click", async () => {
      toggleDetails(tr, details);
      if (loaded || details.hidden) return;
      loaded = true;
      const lineup = await loadLineup(chosen);
      cell.replaceChildren(
        lineupPanel(lineup && lineup.teams ? lineup.teams[row.team_id] : null, chosen)
      );
    });
  });
  table.append(body);
  weekCard.append(table);
  host.append(weekCard);
}

const lineupCache = new Map();

async function loadLineup(week) {
  const key = `${state.slug}:${week}`;
  if (lineupCache.has(key)) return lineupCache.get(key);
  try {
    const payload = await loadJson(`data/${state.slug}/lineup-${week}.json`);
    lineupCache.set(key, payload);
    return payload;
  } catch (error) {
    return null;
  }
}

/* ---------- mercado ---------- */

function valueTrend(entry) {
  const delta = entry.value_7d;
  if (typeof delta !== "number") return null;
  const line = el("div", "trend");
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "＝";
  const cls = delta > 0 ? "up" : delta < 0 ? "down" : "same";
  line.append(el("span", cls, `${arrow} ${signedMoney(delta)}`));
  const base = typeof entry.value === "number" ? entry.value - delta : null;
  if (base) {
    const pct = (delta / Math.abs(base)) * 100;
    line.append(el("span", "meta", ` ${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)
      .replace(".", ",")}% en 7 días`));
  } else {
    line.append(el("span", "meta", " en 7 días"));
  }
  return line;
}

function marketRow(entry) {
  const wrap = el("div", "market-item");
  const hasExtras = typeof entry.value_7d === "number" ||
    (entry.value_series || []).length > 0 || (entry.last_points || []).length > 0;
  const row = el("div", hasExtras ? "row clickable" : "row");
  const left = el("div");
  if (hasExtras) left.append(el("span", "caret", "▸"), " ");
  left.append(el("span", "name", entry.player), " ", el("span", "chip", entry.position));
  row.append(left);
  row.append(el("div", "amount", money(entry.price)));
  const bits = [`valor ${money(entry.value)}`];
  if (entry.source === "system") bits.push(`${entry.bids ?? 0} pujas`);
  else {
    bits.push(`vende ${entry.seller}`);
    bits.push(`cláusula ${money(entry.clause)}`);
    bits.push(`${entry.offers ?? 0} ofertas`);
  }
  if (entry.closes) bits.push(`cierra ${new Date(entry.closes).toLocaleString("es-ES",
    { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`);
  row.append(el("div", "meta", bits.join(" · ")));
  wrap.append(row);

  if (!hasExtras) return wrap;
  const details = el("div", "market-details");
  details.hidden = true;
  const trend = valueTrend(entry);
  if (trend) details.append(trend);
  const series = entry.value_series || [];
  if (series.length) {
    details.append(el("p", "slot", `Últimos ${series.length} días`));
    const days = el("div", "days");
    for (const day of [...series].reverse()) {
      const row = el("div", "day");
      row.append(el("span", "when", dayLabel(day.date)));
      const cls = day.delta > 0 ? "up" : day.delta < 0 ? "down" : "same";
      const arrow = day.delta > 0 ? "▲" : day.delta < 0 ? "▼" : "＝";
      row.append(el("span", cls, `${arrow} ${signedMoney(day.delta)}`));
      row.append(el("span", "meta", money(day.value)));
      days.append(row);
    }
    details.append(days);
  }

  const recent = entry.last_points || [];
  if (recent.length) {
    details.append(el("p", "slot", "Últimas jornadas"));
    const chips = el("div", "chips");
    recent.forEach((item) => {
      const chip = el("span", "chip", `J${item.week} `);
      chip.append(pointsBadge(item.points, "pts"));
      if (item.ideal) chip.append(" ⭐");
      chips.append(chip);
    });
    details.append(chips);
  }
  wrap.append(details);
  row.setAttribute("aria-expanded", "false");
  row.addEventListener("click", () => toggleDetails(row, details));
  return wrap;
}

function renderMarket(data) {
  const host = $("market");
  host.replaceChildren();
  const market = data.market || { system: [], managers: [] };
  const groups = [
    ["Del sistema", market.system || []],
    ["De managers", market.managers || []],
  ];
  for (const [title, entries] of groups) {
    const card = el("div", "card");
    card.append(el("h2", null, `${title} (${entries.length})`));
    if (!entries.length) card.append(el("p", "empty", "Nada a la venta ahora."));
    else {
      const rows = el("div", "rows");
      entries.forEach((entry) => rows.append(marketRow(entry)));
      card.append(rows);
    }
    host.append(card);
  }
}

/* ---------- historial ---------- */

const TAG_CLASS = { market_signing: "buy", system_sale: "sale", buyout: "clause" };

function renderActivity(data) {
  const host = $("activity");
  host.replaceChildren();
  const events = data.activity || [];
  const card = el("div", "card");
  card.append(el("h2", null, `Historial de mercado (${events.length})`));
  if (!events.length) {
    card.append(el("p", "empty", "Sin movimientos registrados todavía."));
    host.append(card);
    return;
  }
  const rows = el("div", "rows");
  for (const event of events) {
    const row = el("div", "row");
    const left = el("div");
    left.append(el("span", `tag ${TAG_CLASS[event.kind] || ""}`, event.title));
    left.append(el("span", "name", event.player));
    row.append(left);
    row.append(el("div", "amount", money(event.amount)));
    let detail;
    if (event.kind === "market_signing") detail = `${event.user1} ficha del sistema`;
    else if (event.kind === "system_sale") detail = `${event.user1} vende al sistema`;
    else if (event.kind === "buyout") detail = `${event.user1} clausula a ${event.user2 || "otro manager"}`;
    else detail = event.user1 || "";
    row.append(el("div", "meta", `${event.date} · ${detail}`));
    rows.append(row);
  }
  card.append(rows);
  host.append(card);
}

/* ---------- euro ---------- */

function renderEuro(data) {
  const host = $("euro");
  host.replaceChildren();
  const euro = data.euro || {};
  const card = el("div", "card");
  card.append(el("h2", null, "Bote acumulado"));
  const pot = el("div", "pot");
  pot.append(el("strong", null, `${euro.pot ?? 0} €`));
  pot.append(el("span", "empty", `${(euro.settled || []).length} jornadas contabilizadas`));
  card.append(pot);
  if ((euro.settled || []).length) {
    const chips = el("div", "chips");
    euro.settled.forEach((item) => chips.append(el("span", "chip",
      `J${item.week} · corte ${points(item.cutoff)} · ${item.payers} pagan`)));
    card.append(chips);
  }
  host.append(card);

  const balances = euro.balances || [];
  if (balances.length) {
    const table = el("table");
    table.innerHTML = "<thead><tr><th>#</th><th>Equipo</th><th>Debe</th></tr></thead>";
    const body = el("tbody");
    balances.forEach((row, i) => {
      const weeks = row.weeks || [];
      const tr = el("tr");
      if (weeks.length) tr.className = "clickable";
      tr.append(el("td", "pos", String(i + 1)));
      const name = el("td");
      if (weeks.length) name.append(el("span", "caret", "▸"), " ");
      name.append(el("span", "name", row.team));
      tr.append(name);
      tr.append(el("td", "big", `${row.amount} €`));
      body.append(tr);

      if (!weeks.length) return;
      const details = el("tr", "details");
      details.hidden = true;
      const cell = el("td");
      cell.colSpan = 3;
      const panel = el("div", "squad");
      panel.append(el("h3", null, `Jornadas pagadas (${weeks.length})`));
      for (const week of weeks) {
        const line = el("div", "player");
        line.append(el("span", null, `Jornada ${week.week}`));
        line.append(el("div", "amount", `${week.amount} €`));
        line.append(el("div", "meta", `${points(week.points)} pts esa jornada`));
        panel.append(line);
      }
      cell.append(panel);
      details.append(cell);
      body.append(details);
      tr.setAttribute("aria-expanded", "false");
      tr.addEventListener("click", () => toggleDetails(tr, details));
    });
    table.append(body);
    const wrap = el("div", "card");
    wrap.append(el("h2", null, "Acumulado por equipo"));
    wrap.append(table);
    host.append(wrap);
  }

  for (const item of euro.pending || []) {
    const progress = weekProgress(data, item.week);
    const card = el("div", "card");
    card.append(el("h2", null, progress && !progress.complete
      ? `J${item.week} sin terminar`
      : `J${item.week} jugada, pendiente de cerrar`));
    const detail = progress
      ? progress.complete
        ? `Los ${progress.total} partidos están jugados; LALIGA todavía no la ha` +
          ` cerrado, así que no se suma al bote.`
        : `Van ${progress.finished} de ${progress.total} partidos, así que el corte` +
          ` puede cambiar.`
      : "LALIGA la mantiene abierta, así que todavía no se suma al bote.";
    card.append(el("p", null, `Corte: ${points(item.cutoff)} pts. ${detail} Pagarán:`));
    const chips = el("div", "chips");
    (item.payers || []).forEach((payer) => chips.append(el("span", "chip pay",
      `${payer.team} · ${points(payer.points)} pts`)));
    card.append(chips);
    host.append(card);
  }

  const provisional = euro.provisional;
  if (provisional) {
    const card2 = el("div", "card");
    card2.append(el("h2", null, `J${provisional.week} en juego ahora`));
    card2.append(el("p", null,
      `Corte provisional: ${points(provisional.cutoff)} pts. No se suma hasta que cierre.`));
    const chips = el("div", "chips");
    (provisional.payers || []).forEach((payer) => chips.append(el("span", "chip pay",
      `${payer.team} · ${points(payer.points)} pts`)));
    card2.append(chips);
    host.append(card2);
  }
}

/* ---------- navegación ---------- */

const VIEWS = ["classification", "evolution", "market", "activity", "euro"];

function showView(view, { updateHash = true } = {}) {
  state.view = view;
  if (updateHash && location.hash.slice(1) !== view) {
    history.replaceState(null, "", `#${view}`);
  }
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.view === view));
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.hidden = section.id !== view;
  });
}

function marketCloses(data) {
  const all = [...(data.market?.system || []), ...(data.market?.managers || [])];
  const times = all
    .map((entry) => (entry.closes ? new Date(entry.closes).getTime() : NaN))
    .filter((time) => Number.isFinite(time) && time > Date.now());
  return times.length ? Math.min(...times) : null;
}

function whenLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const hours = (date.getTime() - Date.now()) / 3600000;
  if (hours < 0) return "ya en juego";
  if (hours < 24) return `en ${untilLabel(date.getTime())}`;
  return date.toLocaleString("es-ES",
    { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function untilLabel(time) {
  const minutes = Math.round((time - Date.now()) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  return `${Math.round(hours / 24)} días`;
}

function weekProgress(data, week) {
  const stats = ((data.matchdays && data.matchdays.weeks) || {})[String(week)];
  if (!stats || typeof stats.total !== "number") return null;
  return { ...stats, complete: stats.finished >= stats.total };
}

function renderSummary(data) {
  const host = $("summary");
  host.replaceChildren();
  const chips = [];
  const pot = data.euro && data.euro.pot;
  if (typeof pot === "number") {
    chips.push(["Bote", `${pot} €`, "accent"]);
  }
  const active = (data.matchdays && data.matchdays.active) || [];
  if (active.length) {
    chips.push(["En juego", `J${Math.max(...active)}`, ""]);
  }
  const next = data.matchdays && data.matchdays.next_week;
  if (next && next.starts_at) {
    chips.push([`J${next.week} empieza`, whenLabel(next.starts_at), "warn"]);
  } else {
    const closes = marketCloses(data);
    if (closes) chips.push(["Mercado cierra en", untilLabel(closes), "warn"]);
  }
  for (const [label, value, tone] of chips) {
    const chip = el("div", `stat ${tone}`);
    chip.append(el("span", "stat-label", label));
    chip.append(el("strong", null, value));
    host.append(chip);
  }
}

function renderAll() {
  const data = state.data;
  renderClassification(data);
  renderEvolution(data);
  renderMarket(data);
  renderActivity(data);
  renderEuro(data);
  renderSummary(data);
  const stamp = data.refreshed_at || data.built_at;
  $("updated").textContent =
    `${data.league_name || data.name} · datos de ${ago(stamp)}`;
}

function renderDivisions() {
  const host = $("divisions");
  host.replaceChildren();
  for (const division of state.index.divisions) {
    const button = el("button", null, division.name);
    button.setAttribute("aria-selected", String(division.slug === state.slug));
    button.addEventListener("click", () => selectDivision(division.slug));
    host.append(button);
  }
}

function showNotice(text) {
  const notice = $("notice");
  notice.textContent = text || "";
  notice.hidden = !text;
}

async function selectDivision(slug) {
  const entry = state.index.divisions.find((item) => item.slug === slug);
  state.slug = slug;
  state.hidden = new Set();
  state.week = null;
  store(STORE_KEY, slug);
  renderDivisions();
  if (entry && entry.status === "error") {
    showNotice(`${entry.name}: todavía no hay datos guardados. ${entry.error || ""}`);
    document.querySelectorAll(".view").forEach((section) => section.replaceChildren());
    $("updated").textContent = "Sin datos";
    return;
  }
  try {
    state.data = await loadJson(`data/${slug}.json`);
  } catch (error) {
    showNotice(`No se pudieron cargar los datos de ${slug}: ${error.message}`);
    return;
  }
  showNotice(state.data.refresh_ok === false
    ? `Datos de ${ago(state.data.refreshed_at)}: la última actualización falló` +
      ` (${state.data.refresh_error || "error desconocido"}).`
    : "");
  renderAll();
  showView(state.view);
}

async function start() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => showView(tab.dataset.view));
  });
  const requested = location.hash.slice(1);
  if (VIEWS.includes(requested)) state.view = requested;
  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1);
    if (VIEWS.includes(view) && view !== state.view) {
      showView(view, { updateHash: false });
    }
  });
  try {
    state.index = await loadJson("data/index.json");
  } catch (error) {
    showNotice(`No se pudo cargar el índice: ${error.message}`);
    return;
  }
  const divisions = state.index.divisions || [];
  if (!divisions.length) { showNotice("No hay divisiones configuradas."); return; }
  const savedSort = stored(SORT_KEY);
  if (savedSort) {
    try {
      const parsed = JSON.parse(savedSort);
      if (COLUMNS.some((column) => column.key === parsed.key)) state.sort = parsed;
    } catch (error) { /* preferencia ilegible */ }
  }
  const saved = stored(STORE_KEY);
  const initial = divisions.some((item) => item.slug === saved) ? saved : divisions[0].slug;
  await selectDivision(initial);
}

start();
