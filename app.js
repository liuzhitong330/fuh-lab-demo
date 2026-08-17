(function () {
  "use strict";

  const data = window.FUH_LAB_DEMO_DATA;
  if (!data) return;

  const names = Object.keys(data.targets);
  const input = document.getElementById("target-select");
  const form = document.getElementById("target-form");
  const datalist = document.getElementById("target-options");
  const suggestions = document.getElementById("suggestions");
  const evidence = document.getElementById("evidence-select");
  const doubling = document.getElementById("doubling-input");
  const doublingValue = document.getElementById("doubling-value");
  const svg = document.getElementById("hero-viz");
  const readout = document.getElementById("readout");
  const assayPlan = document.getElementById("assay-plan");
  const evidenceTable = document.getElementById("evidence-table");
  const comparison = document.getElementById("comparison");
  const themeReadout = document.getElementById("theme-readout");

  let current = data.defaultTarget;

  function el(tag, attrs, text) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function eligibleCells(target) {
    const ceiling = Number(doubling.value);
    return target.cells.filter((cell) => {
      const evidenceOkay = evidence.value === "rna" || cell.protein !== null;
      return cell.doubling <= ceiling && cell.rna !== null && evidenceOkay;
    });
  }

  function pickPair(target) {
    const cells = eligibleCells(target);
    if (cells.length < 2) return null;
    let best = null;
    for (let a = 0; a < cells.length; a += 1) {
      for (let b = a + 1; b < cells.length; b += 1) {
        const high = cells[a].rna >= cells[b].rna ? cells[a] : cells[b];
        const low = high === cells[a] ? cells[b] : cells[a];
        const rnaGap = high.rna - low.rna;
        let score = rnaGap / target.rnaRange;
        if (evidence.value === "matched") {
          const proteinGap = high.protein - low.protein;
          if (proteinGap <= 0) continue;
          score = (score + proteinGap / target.proteinRange) / 2;
        }
        if (!best || score > best.score) best = { high, low, rnaGap, score };
      }
    }
    return best;
  }

  function draw(target, pair) {
    svg.replaceChildren();
    const width = 600;
    const labelX = 4;
    const plotLeft = 142;
    const plotRight = 455;
    const proteinLeft = 495;
    const proteinRight = 578;
    const top = 54;
    const rowHeight = 47;
    const rnaMin = Math.min(-1.6, ...target.cells.map((cell) => cell.rna));
    const rnaMax = Math.max(1.6, ...target.cells.map((cell) => cell.rna));
    const proteinValues = target.cells.map((cell) => cell.protein).filter((value) => value !== null);
    const proteinMin = proteinValues.length ? Math.min(...proteinValues) : 0;
    const proteinMax = proteinValues.length ? Math.max(...proteinValues) : 1;
    const rnaX = (value) => plotLeft + ((value - rnaMin) / (rnaMax - rnaMin)) * (plotRight - plotLeft);
    const proteinX = (value) => proteinLeft + ((value - proteinMin) / Math.max(0.001, proteinMax - proteinMin)) * (proteinRight - proteinLeft);
    const zeroX = rnaX(0);

    svg.appendChild(el("text", { x: plotLeft, y: 18, class: "chart-head" }, "RNA · NCI‑60-wide z-score"));
    svg.appendChild(el("text", { x: proteinLeft, y: 18, class: "chart-head" }, "protein"));
    [-1, 0, 1].forEach((tick) => {
      const x = rnaX(tick);
      svg.appendChild(el("line", { x1: x, y1: 30, x2: x, y2: 385, class: tick === 0 ? "zero-line" : "grid-line" }));
      svg.appendChild(el("text", { x, y: 43, class: "tick-label", "text-anchor": "middle" }, tick > 0 ? `+${tick}` : tick));
    });

    target.cells.forEach((cell, index) => {
      const y = top + index * rowHeight;
      const isHigh = pair && pair.high.name === cell.name;
      const isLow = pair && pair.low.name === cell.name;
      const eligible = eligibleCells(target).includes(cell);
      svg.appendChild(el("line", { x1: 0, y1: y + 20, x2: width, y2: y + 20, class: "row-rule" }));
      svg.appendChild(el("text", { x: labelX, y: y + 2, class: "cell-name" }, cell.name));
      svg.appendChild(el("text", { x: labelX, y: y + 16, class: "cell-meta" }, `${cell.doubling} h · ${cell.source === "NA" ? "source n/a" : cell.source}`));
      const x = rnaX(cell.rna);
      svg.appendChild(el("rect", {
        x: Math.min(zeroX, x), y: y - 8, width: Math.max(2, Math.abs(x - zeroX)), height: 13,
        class: isHigh ? "rna-bar pair-high" : isLow ? "rna-bar pair-low" : eligible ? "rna-bar" : "rna-bar excluded"
      }));
      svg.appendChild(el("text", { x: x + (cell.rna >= 0 ? 5 : -5), y: y + 3, class: "value-label", "text-anchor": cell.rna >= 0 ? "start" : "end" }, cell.rna.toFixed(2)));
      if (cell.protein !== null) {
        svg.appendChild(el("circle", { cx: proteinX(cell.protein), cy: y - 1, r: 5, class: isHigh ? "protein-dot pair-high" : isLow ? "protein-dot pair-low" : eligible ? "protein-dot" : "protein-dot excluded" }));
      } else {
        svg.appendChild(el("text", { x: proteinLeft, y: y + 3, class: "missing-label" }, "not measured"));
      }
      if (isHigh || isLow) svg.appendChild(el("text", { x: 588, y: y + 3, class: isHigh ? "pair-tag high" : "pair-tag low", "text-anchor": "end" }, isHigh ? "HIGH" : "LOW"));
    });
  }

  function renderTable(target, pair) {
    const rows = target.cells.map((cell) => {
      const label = pair && pair.high.name === cell.name ? "High" : pair && pair.low.name === cell.name ? "Low" : "";
      return `<tr><th scope="row">${cell.name}${label ? ` <span>${label}</span>` : ""}</th><td>${cell.rna.toFixed(3)}</td><td>${cell.protein === null ? "—" : cell.protein.toFixed(3)}</td><td>${cell.doubling.toFixed(1)} h</td><td>${cell.priorTreatment}</td></tr>`;
    }).join("");
    evidenceTable.innerHTML = `<thead><tr><th>Cell line</th><th>RNA z</th><th>SWATH</th><th>Doubling</th><th>Prior treatment</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function render(name) {
    const target = data.targets[name];
    if (!target) {
      readout.textContent = `${name} is not in this analysis. Choose one of the suggested targets.`;
      return;
    }
    current = name;
    input.value = name;
    doublingValue.textContent = `${doubling.value} h`;
    const pair = pickPair(target);
    draw(target, pair);
    renderTable(target, pair);

    if (!pair) {
      const reason = target.proteinCoverage === 0 && evidence.value === "matched"
        ? `No SWATH measurement is available for ${target.gene} in these seven lines.`
        : "Fewer than two lines satisfy the current evidence and culture-time constraints.";
      readout.innerHTML = `<strong>Model warning — ${target.gene}:</strong> ${reason} Do not force a tumor-cell high/low pair. ${target.labLink}`;
      document.getElementById("metric-three").textContent = "No pair";
      document.getElementById("metric-three-label").textContent = "under current constraints";
    } else {
      const support = evidence.value === "matched" ? "concordant RNA and SWATH direction" : "RNA screening evidence";
      readout.innerHTML = `<strong>${target.gene} plan:</strong> compare ${pair.high.name} (high, ${pair.high.rna.toFixed(2)} z) with ${pair.low.name} (low, ${pair.low.rna.toFixed(2)} z). The ${pair.rnaGap.toFixed(2)}-z separation has ${support}; both lines pass the ${doubling.value}-hour ceiling.`;
      document.getElementById("metric-three").textContent = `${pair.rnaGap.toFixed(2)} z`;
      document.getElementById("metric-three-label").textContent = `${target.gene} high–low separation`;
    }
    assayPlan.innerHTML = `<p><span>First pass</span>${target.assay}</p><p><span>Controls</span>${target.controls}</p>`;
  }

  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    datalist.appendChild(option);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.textContent = data.targets[name].gene;
    chip.addEventListener("click", () => render(name));
    suggestions.appendChild(chip);
  });

  const themeEntries = Object.entries(data.themes);
  const maxOverlap = Math.max(...themeEntries.map(([, theme]) => theme.mutatedOverlapCount));
  function renderTheme(name) {
    const theme = data.themes[name];
    [...comparison.querySelectorAll("button")].forEach((button) => button.classList.toggle("active", button.dataset.theme === name));
    const genes = theme.mutatedOverlap.length ? theme.mutatedOverlap.map((gene) => `<code>${gene}</code>`).join(" ") : "No overlap";
    themeReadout.innerHTML = `<strong>${name}</strong><p>${theme.mutatedOverlapCount} of ${data.coverage.paperInputGenes} frequently mutated input genes occur among this theme’s ${theme.geneCount} listed genes.</p><div class="gene-list">${genes}</div>`;
  }
  themeEntries.forEach(([name, theme]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.theme = name;
    button.innerHTML = `<span>${name}</span><span class="comparison-track"><span class="comparison-fill" style="width:${(theme.mutatedOverlapCount / maxOverlap) * 100}%"></span></span><span>${theme.mutatedOverlapCount} genes</span>`;
    button.addEventListener("click", () => renderTheme(name));
    comparison.appendChild(button);
  });

  form.addEventListener("submit", (event) => { event.preventDefault(); render(input.value.trim()); });
  input.addEventListener("change", () => render(input.value.trim()));
  evidence.addEventListener("change", () => render(current));
  doubling.addEventListener("input", () => render(current));

  render(current);
  renderTheme(themeEntries[0][0]);
}());
