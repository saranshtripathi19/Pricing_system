/* =====================================================
   NOON STRATEGIC PRICING OPTIMIZER — APP ENGINE
   All algorithmic logic, state, charts, interactions
   ===================================================== */

'use strict';

// =====================================================
// 1. DATA STORE — Dummy data for all SKUs & signals
// =====================================================

const STATE = {
  currentScreen: 'dashboard',
  categoryStrategies: { electronics: null, fmcg: null, home: null },
  draggingChip: null,
  openSkuIndex: null,
  benchmarkChart: null,
  pulseChart: null,
  strategyDonut: null,
  labValues: { aggr: 50, margin: 50, inv: 30 },
  alertsRead: new Set(),
  overrideValues: {},
  pendingAction: null, // Used for confirmation modal
};

// Base KPI values (before lab sliders)
const BASE_KPIS = {
  gmv: 82.4,
  margin: 12.4,
  winrate: 74,
  gmvTarget: 100,
};

// Strategy profile definitions with projections & algorithms
const STRATEGIES = {
  aggressive: {
    name: 'Aggressive Growth',
    algo: 'k-NN Algorithm',
    icon: '🚀',
    volChange: '+15%',
    marginChange: '−2.5%',
    marginDelta: -2.5,
    volDelta: 15,
    algoDesc: 'k-NN finds lowest reputable competitor → match −1 AED',
    chipClass: 'chip-aggressive',
    tagClass: 'has-strategy',
    color: '#EF4444',
  },
  profit: {
    name: 'Profit Harvest',
    algo: 'Log-Log Regression',
    icon: '📈',
    volChange: '−5%',
    marginChange: '+3.8%',
    marginDelta: 3.8,
    volDelta: -5,
    algoDesc: 'Log-Log finds price point where (P−Cost)×Volume is highest',
    chipClass: 'chip-profit',
    tagClass: 'has-strategy',
    color: '#22C55E',
  },
  flush: {
    name: 'Inventory Flush',
    algo: 'PID Controller',
    icon: '🌊',
    volChange: '+28%',
    marginChange: '−4.1%',
    marginDelta: -4.1,
    volDelta: 28,
    algoDesc: 'PID drops price 2% every 12h when Days-of-Cover > 30',
    chipClass: 'chip-flush',
    tagClass: 'has-strategy',
    color: '#6366F1',
  },
  defensive: {
    name: 'Market Defensive',
    algo: 'Buy Box Match',
    icon: '🛡️',
    volChange: '+2%',
    marginChange: '0%',
    marginDelta: 0,
    volDelta: 2,
    algoDesc: 'Mirrors Buy Box price exactly. Price = BuyBox_Price',
    chipClass: 'chip-defensive',
    tagClass: 'has-strategy',
    color: '#F59E0B',
  },
};

// SKU Dataset with full AI signal weights
const SKU_DATA = [
  { id: 'N12345678A', product: 'Apple iPhone 15 Pro Max 256GB', cat: 'Electronics', ourPrice: 4299, amz: 4250, comp: 4119, aiPrice: 4119, margin: '2.9%', mClass: 'bad', strat: 'aggressive', status: 'active', inventory: 145 },
  { id: 'N98765432B', product: 'Samsung Galaxy S24 Ultra 512GB', cat: 'Electronics', ourPrice: 3899, amz: 3899, comp: 3950, aiPrice: 3899, margin: '14.2%', mClass: 'good', strat: 'defensive', status: 'active', inventory: 312 },
  { id: 'N45678912C', product: 'Sony Alpha a7 IV Mirrorless Camera', cat: 'Electronics', ourPrice: 8499, amz: 8550, comp: 8600, aiPrice: 8499, margin: '18.5%', mClass: 'good', strat: 'none', status: 'pending', inventory: 42 },
  { id: 'F11223344D', product: 'Nivea Soft Moisturizing Cream 200ml', cat: 'FMCG', ourPrice: 15.5, amz: 14.0, comp: 14.5, aiPrice: 15.0, margin: '35.0%', mClass: 'good', strat: 'profit', status: 'active', inventory: 1200 },
  { id: 'F55667788E', product: 'Ariel Automatic Powder Laundry Detergent 4.5kg', cat: 'FMCG', ourPrice: 65, amz: 62, comp: 60, aiPrice: 66, margin: '12.1%', mClass: 'ok', strat: 'profit', status: 'active', inventory: 850 },
  { id: 'H99887766F', product: 'Dyson V15 Detect Absolute Vacuum', cat: 'Home', ourPrice: 2499, amz: 2550, comp: 2450, aiPrice: 2399, margin: '9.2%', mClass: 'bad', strat: 'flush', status: 'active', inventory: 230 },
  { id: 'H33445566G', product: 'Philips Essential Airfryer 4.1L', cat: 'Home', ourPrice: 299, amz: 299, comp: 310, aiPrice: 299, margin: '22.4%', mClass: 'good', strat: 'defensive', status: 'active', inventory: 560 },
  { id: 'N55555555X', product: 'Sony PlayStation 5 Console', cat: 'Electronics', ourPrice: 1899, amz: 1850, comp: 1845, aiPrice: 1850, margin: '4.5%', mClass: 'bad', strat: 'none', status: 'frozen', inventory: 98 },
];

// ALERTS_DATA Mock recovery
const ALERTS_DATA = [
  {
    id: 'circuit-1',
    type: 'circuit',
    badge: 'Circuit Breaker 🔴',
    badgeClass: 'badge-circuit',
    title: 'SKU N12345678A: Price War Detected',
    body: 'Competitor has dropped price 4 times in the last 60 minutes. AI circuit breaker activated to protect margin floor.',
    time: '2 min ago',
    primaryAction: 'Review SKU',
    secondaryAction: 'Release Freeze',
    screen: 'sku',
  },
  {
    id: 'elasticity-1',
    type: 'elasticity',
    badge: 'Elasticity Insight 💡',
    badgeClass: 'badge-elasticity',
    title: 'FMCG Category: Zero Volume Drop Detected',
    body: 'Analysis of the last 5 price increases shows 0% drop in order volume. Move to "Profit Harvest" strategy to capture margin.',
    time: '14 min ago',
    primaryAction: 'Apply Profit Harvest',
    secondaryAction: 'View Analysis',
    screen: 'canvas',
  },
  {
    id: 'floor-1',
    type: 'floor',
    badge: 'Floor Breach ⚠️',
    badgeClass: 'badge-warning',
    title: 'Home Category: Clearance Margin Warning',
    body: 'Clearance inventory rules are pushing pricing below 5% gross margin. Manual sign-off required to continue.',
    time: '45 min ago',
    primaryAction: 'Approve Threshold',
    secondaryAction: 'View Analysis',
    screen: 'dashboard',
  }
];

// =====================================================
// 2. CHART DATA GENERATORS
// =====================================================

function getPulseData(filter) {
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

  if (filter === 'electronics') {
    return {
      labels: hours,
      prices: hours.map((_, i) => 4200 + Math.sin(i * 0.5) * 120 + (Math.random() * 80 - 40)),
      volumes: hours.map((_, i) => 85 + Math.sin(i * 0.4) * 30 + (Math.random() * 20)),
    };
  } else if (filter === 'fmcg') {
    return {
      labels: hours,
      prices: hours.map((_, i) => 65 + Math.cos(i * 0.3) * 5 + (Math.random() * 4 - 2)),
      volumes: hours.map((_, i) => 820 + Math.sin(i * 0.5) * 200 + (Math.random() * 100)),
    };
  } else if (filter === 'home') {
    return {
      labels: hours,
      prices: hours.map((_, i) => 450 + Math.sin(i * 0.4) * 40 + (Math.random() * 25)),
      volumes: hours.map((_, i) => 140 + Math.cos(i * 0.35) * 50 + (Math.random() * 30)),
    };
  } else if (filter === 'sku-N12345678A') {
    return {
      labels: hours,
      prices: hours.map((_, i) => 4299 + Math.sin(i * 0.8) * 10 - (i > 12 ? 30 : 0) + (Math.random() * 5)),
      volumes: hours.map((_, i) => 25 + Math.cos(i * 0.5) * 5 + (i > 12 ? 15 : 0) + (Math.random() * 3)),
    };
  }
  
  // Default/Global
  return {
    labels: hours,
  };
}

function getBenchmarkData(sku) {
  const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
  return {
    labels: days,
    ours: [sku.ourPrice - 50, sku.ourPrice - 30, sku.ourPrice - 10, sku.ourPrice, sku.ourPrice, sku.ourPrice, sku.ourPrice],
    amazon: [sku.amz + 20, sku.amz + 10, sku.amz, sku.amz, sku.amz, sku.amz, sku.amz],
    comp: [sku.comp + 10, sku.comp + 5, sku.comp, sku.comp, sku.comp, sku.comp, sku.comp],
  };
}

// =====================================================
// 3. CHART INITIALIZATION
// =====================================================

window.updatePulseChart = function() {
  const scope = document.getElementById('pulse-scope').value;
  initPulseChart(scope);
}

function initPulseChart(filter = 'electronics') {
  const ctx = document.getElementById('pulseChart').getContext('2d');
  const data = getPulseData(filter);

  if (STATE.pulseChart) {
    STATE.pulseChart.data.labels = data.labels;
    STATE.pulseChart.data.datasets[0].data = data.prices;
    STATE.pulseChart.data.datasets[1].data = data.volumes;
    STATE.pulseChart.update('active');
    return;
  }

  STATE.pulseChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Avg. Price (AED)',
          data: data.prices,
          borderColor: '#D4B800',
          backgroundColor: 'rgba(255,224,0,0.06)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.4,
          yAxisID: 'y',
        },
        {
          label: 'Order Volume',
          data: data.volumes,
          borderColor: '#6366F1',
          backgroundColor: 'rgba(99,102,241,0.06)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0A0B0D',
          titleColor: 'rgba(255,255,255,0.7)',
          bodyColor: 'white',
          borderColor: 'rgba(255,224,0,0.3)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (item) => {
              if (item.datasetIndex === 0) return ` Price: AED ${item.raw.toFixed(0)}`;
              return ` Volume: ${item.raw.toFixed(0)} orders`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#9BA3B2',
            font: { size: 10, family: 'Inter' },
            maxTicksLimit: 8,
          },
          border: { display: false },
        },
        y: {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { color: '#9BA3B2', font: { size: 10, family: 'Inter' }, maxTicksLimit: 5 },
          border: { display: false },
        },
        y1: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: { color: '#6366F1', font: { size: 10, family: 'Inter' }, maxTicksLimit: 5 },
          border: { display: false },
        },
      },
    },
  });
}

function initStrategyDonut() {
  const ctx = document.getElementById('strategyDonut').getContext('2d');

  const labels = ['Aggressive Growth', 'Profit Harvest', 'Inventory Flush', 'Market Defensive', 'No Strategy'];
  const values = [312, 487, 145, 198, 106];
  const colors = ['#EF4444', '#22C55E', '#6366F1', '#F59E0B', '#E8EAF0'];

  STATE.strategyDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0A0B0D',
          bodyColor: 'white',
          padding: 8,
          callbacks: {
            label: (item) => ` ${item.label}: ${item.raw} SKUs`,
          },
        },
      },
    },
  });

  const legend = document.getElementById('donut-legend');
  labels.forEach((label, i) => {
    const pct = ((values[i] / values.reduce((a, b) => a + b, 0)) * 100).toFixed(0);
    legend.innerHTML += `
      <div class="donut-legend-item">
        <div class="donut-legend-left">
          <div class="donut-legend-dot" style="background:${colors[i]}"></div>
          <span>${label}</span>
        </div>
        <span class="donut-legend-pct">${pct}%</span>
      </div>`;
  });
}

function initBenchmarkChart(sku) {
  const ctx = document.getElementById('benchmarkChart').getContext('2d');
  const data = getBenchmarkData(sku);

  if (STATE.benchmarkChart) {
    STATE.benchmarkChart.destroy();
    STATE.benchmarkChart = null;
  }

  STATE.benchmarkChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Noon (Ours)',
          data: data.ours,
          borderColor: '#D4B800',
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#D4B800',
          tension: 0.3,
        },
        {
          label: 'Amazon',
          data: data.amazon,
          borderColor: '#F59E0B',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#F59E0B',
          tension: 0.3,
        },
        {
          label: 'Best Competitor',
          data: data.comp,
          borderColor: '#6366F1',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#6366F1',
          tension: 0.3,
          borderDash: [4, 3],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 12,
            font: { size: 11, family: 'Inter' },
            color: '#5C6270',
          },
        },
        tooltip: {
          backgroundColor: '#0A0B0D',
          bodyColor: 'white',
          padding: 8,
          callbacks: {
            label: (item) => ` ${item.dataset.label}: AED ${item.raw}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9BA3B2', font: { size: 10, family: 'Inter' } },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { color: '#9BA3B2', font: { size: 10, family: 'Inter' }, maxTicksLimit: 5 },
          border: { display: false },
        },
      },
    },
  });
}

// =====================================================
// 4. SCREEN NAVIGATION
// =====================================================

function navigateTo(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`screen-${screen}`).classList.add('active');
  document.getElementById(`nav-${screen}`).classList.add('active');
  STATE.currentScreen = screen;

  if (screen === 'dashboard') {
    setTimeout(() => {
      initPulseChart(document.getElementById('category-filter').value);
      if (!STATE.strategyDonut) initStrategyDonut();
    }, 50);
  }
}

// =====================================================
// 5. DASHBOARD LOGIC
// =====================================================

function updateDashboard() {
  const filter = document.getElementById('category-filter').value;
  initPulseChart(filter);

  const kpiData = {
    all: { gmv: '82.4M', margin: '12.4', marginClass: 'danger', winrate: '74', gmvProg: 82 },
    electronics: { gmv: '38.2M', margin: '8.2', marginClass: 'danger', winrate: '68', gmvProg: 65 },
    fmcg: { gmv: '28.6M', margin: '18.5', marginClass: '', winrate: '81', gmvProg: 71 },
    home: { gmv: '15.6M', margin: '21.1', marginClass: '', winrate: '72', gmvProg: 78 },
  };

  const d = kpiData[filter] || kpiData.all;
  document.getElementById('kpi-gmv-value').innerHTML = `${d.gmv} <span class="kpi-currency">AED</span>`;
  document.getElementById('kpi-margin-value').innerHTML = `${d.margin}<span class="kpi-unit">%</span>`;
  document.getElementById('kpi-margin-value').className = `kpi-value ${d.marginClass}`;
  document.getElementById('kpi-buybox-value').innerHTML = `${d.winrate}<span class="kpi-unit">%</span>`;
  document.getElementById('gmv-progress').style.width = `${d.gmvProg}%`;
  document.getElementById('margin-progress').style.width = `${(parseFloat(d.margin) / 15 * 100).toFixed(1)}%`;
  document.getElementById('buybox-progress').style.width = `${d.winrate}%`;
}

// =====================================================
// 6. STRATEGY LAB (SLIDER → KPI SYNC)
// =====================================================

function onLabSlider() {
  const aggr = parseInt(document.getElementById('slider-aggr').value);
  const margin = parseInt(document.getElementById('slider-margin').value);
  const inv = parseInt(document.getElementById('slider-inv').value);

  document.getElementById('aggr-display').textContent = `${aggr}%`;
  document.getElementById('margin-display').textContent = `${margin}%`;
  document.getElementById('inv-display').textContent = `${inv}%`;

  STATE.labValues = { aggr, margin, inv };

  const aggrFactor = (aggr - 50) / 50;
  const marginFactor = (margin - 50) / 50;
  const invFactor = inv / 100;

  const projGMV = BASE_KPIS.gmv * (1 + aggrFactor * 0.12 - invFactor * 0.03);
  const projMargin = BASE_KPIS.margin + (-aggrFactor * 2.5) + (marginFactor * 2.0) - (invFactor * 0.5);
  const projWinRate = BASE_KPIS.winrate + (aggrFactor * 8) - (marginFactor * 4) + (invFactor * 2);

  document.getElementById('lab-gmv').textContent = `AED ${Math.max(projGMV, 40).toFixed(1)}M`;
  document.getElementById('lab-margin').textContent = `${Math.max(projMargin, 4).toFixed(1)}%`;
  document.getElementById('lab-winrate').textContent = `${Math.max(Math.min(projWinRate, 99), 40).toFixed(0)}%`;

  syncLabToDashboard(projGMV, projMargin, projWinRate);
}

function syncLabToDashboard(gmv, margin, winrate) {
  const gmvEl = document.getElementById('kpi-gmv-value');
  const marginEl = document.getElementById('kpi-margin-value');
  const buyboxEl = document.getElementById('kpi-buybox-value');
  const gmvProg = document.getElementById('gmv-progress');
  const marginProg = document.getElementById('margin-progress');
  const buyboxProg = document.getElementById('buybox-progress');

  gmvEl.innerHTML = `${gmv.toFixed(1)}M <span class="kpi-currency">AED</span>`;
  marginEl.innerHTML = `${Math.max(margin, 4).toFixed(1)}<span class="kpi-unit">%</span>`;
  marginEl.className = `kpi-value ${margin < 12 ? 'danger' : ''}`;
  buyboxEl.innerHTML = `${Math.max(Math.min(winrate, 99), 40).toFixed(0)}<span class="kpi-unit">%</span>`;
  gmvProg.style.width = `${((gmv / BASE_KPIS.gmvTarget) * 100).toFixed(0)}%`;
  marginProg.style.width = `${((Math.max(margin, 4) / 15) * 100).toFixed(0)}%`;
  buyboxProg.style.width = `${Math.max(Math.min(winrate, 99), 40).toFixed(0)}%`;
}

// =====================================================
// 7. POLICY CANVAS — DRAG & DROP
// =====================================================

function onChipDragStart(event) {
  STATE.draggingChip = event.currentTarget.dataset.strategy;
  event.currentTarget.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', STATE.draggingChip);
}

function onChipDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  STATE.draggingChip = null;
}

function onCardDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}

function onCardDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

function onCardDrop(event, category) {
  event.preventDefault();
  const chipType = event.dataTransfer.getData('text/plain') || STATE.draggingChip;
  event.currentTarget.classList.remove('drag-over');

  if (!chipType || !STRATEGIES[chipType]) return;
  
  const strat = STRATEGIES[chipType];
  const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
  
  openConfirmationModal(
    `You are about to apply <strong>${strat.name}</strong> to the <strong>${formattedCategory}</strong> category.`,
    [
      { label: 'Category', value: formattedCategory },
      { label: 'Algorithm', value: strat.algo },
      { label: 'Est. Volume Impact', value: strat.volChange, positive: strat.volDelta > 0 },
      { label: 'Est. Margin Impact', value: strat.marginChange, positive: strat.marginDelta >= 0 },
    ],
    () => {
      applyStrategyToCategory(category, chipType);
      showToast(`${strat.icon} ${strat.name} applied to ${formattedCategory}`);
    }
  );
}

function openConfirmationModal(descHtml, impacts, onConfirm) {
  document.getElementById('confirm-modal-desc').innerHTML = descHtml;
  
  const impactsContainer = document.getElementById('confirm-modal-impacts');
  impactsContainer.innerHTML = impacts.map(imp => {
    let valClass = '';
    if (imp.positive === true) valClass = 'positive';
    if (imp.positive === false) valClass = 'negative';
    
    return `<div class="impact-item">
      <span class="impact-item-label">${imp.label}</span>
      <span class="impact-item-val ${valClass}">${imp.value}</span>
    </div>`;
  }).join('');
  
  STATE.pendingAction = onConfirm;
  
  document.getElementById('confirm-btn').onclick = () => {
    if (STATE.pendingAction) STATE.pendingAction();
    closeConfirmationModal();
  };
  
  document.getElementById('confirm-modal-overlay').classList.add('open');
  document.getElementById('confirm-modal').classList.add('open');
}

function closeConfirmationModal() {
  document.getElementById('confirm-modal-overlay').classList.remove('open');
  document.getElementById('confirm-modal').classList.remove('open');
  STATE.pendingAction = null;
}

function applyStrategyToCategory(category, strategyKey) {
  const strat = STRATEGIES[strategyKey];
  STATE.categoryStrategies[category] = strategyKey;

  const card = document.getElementById(`card-${category}`);
  if(card) {
    card.classList.add('applied');
    setTimeout(() => card.classList.remove('applied'), 700);
  }

  const tag = document.getElementById(`tag-${category}`);
  if(tag) {
    tag.textContent = strat.name;
    tag.className = `card-strategy-tag ${strat.tagClass}`;
  }

  const proj = document.getElementById(`proj-${category}`);
  if(proj) proj.classList.remove('hidden');

  const volEl = document.getElementById(`proj-vol-${category}`);
  const marginEl = document.getElementById(`proj-margin-${category}`);
  const algoEl = document.getElementById(`proj-algo-${category}`);

  if(volEl) {
    volEl.textContent = strat.volChange;
    volEl.className = `proj-value ${strat.volDelta > 0 ? 'positive' : 'negative'}`;
  }
  if(marginEl) {
    marginEl.textContent = strat.marginChange;
    marginEl.className = `proj-value ${strat.marginDelta >= 0 ? 'positive' : 'negative'}`;
  }
  if(algoEl) {
    algoEl.textContent = strat.algo.split('·')[0].trim();
  }
}

function applySimulationToCanvas() {
  openConfirmationModal(
    `You are about to promote the simulated parameters (Aggressiveness: <strong>${STATE.labValues.aggr}%</strong>) into active policies.`,
    [
      { label: 'Projected Output 1', value: document.getElementById('pval-1').textContent, positive: true },
      { label: 'Projected Output 2', value: document.getElementById('pval-2').textContent, positive: true },
      { label: 'Projected Output 3', value: document.getElementById('pval-3').textContent, positive: true },
    ],
    () => {
      const scope = document.getElementById('sim-scope').value;
      if (scope === 'portfolio') {
        const categories = ['electronics', 'fmcg', 'home'];
        const suggestions = ['aggressive', 'profit', 'flush'];
        categories.forEach((c, i) => applyStrategyToCategory(c, suggestions[i]));
      }
      navigateTo('canvas');
      showToast('✅ Simulation promoted to active policy successfully.');
    }
  );
}

function setCanvasMode(mode) {
  try {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    const tBtn = document.getElementById(`toggle-${mode}`);
    if (tBtn) tBtn.classList.add('active');
    
    document.querySelectorAll('.canvas-view').forEach(v => v.classList.remove('active'));
    const cView = document.getElementById(`canvas-view-${mode}`);
    if (cView) cView.classList.add('active');
    
    if (mode === 'sku') {
      renderCanvasSkus();
    }
  } catch (err) {
    console.error("Canvas toggle error:", err);
  }
}

function renderCanvasSkus() {
  const tbody = document.getElementById('canvas-sku-list');
  tbody.innerHTML = '';
  
  SKU_DATA.forEach((sku, idx) => {
    const tr = document.createElement('tr');
    const stratName = sku.strat === 'none' ? 'None' : STRATEGIES[sku.strat].name;
    const stratClass = `strat-${sku.strat}`;
    const formattedPrice = new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(sku.ourPrice);
    
    tr.innerHTML = `
      <td class="sku-id-col">${sku.id}</td>
      <td class="sku-product-col">${sku.product}</td>
      <td><span class="cat-badge cat-${sku.cat.toLowerCase()}">${sku.cat}</span></td>
      <td class="price-col">${formattedPrice}</td>
      <td><span class="strategy-tag-sm ${stratClass}" id="canvas-sku-tag-${sku.id}">${stratName}</span></td>
      <td>
        <div class="card-drop-zone" id="canvas-drop-${sku.id}"
             style="padding: 6px; font-size: 10px; min-width: 140px;"
             ondragover="onCardDragOver(event)" ondragleave="onCardDragLeave(event)" ondrop="onSkuDrop(event, '${sku.id}')">
          <span class="drop-hint">Drop strategy here</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.onSkuDrop = function(event, skuId) {
  event.preventDefault();
  const chipType = event.dataTransfer.getData('text/plain') || STATE.draggingChip;
  event.currentTarget.classList.remove('drag-over');

  if (!chipType || !STRATEGIES[chipType]) return;
  
  const strat = STRATEGIES[chipType];
  const sku = SKU_DATA.find(s => s.id === skuId);
  
  openConfirmationModal(
    `You are about to apply <strong>${strat.name}</strong> specifically to SKU <strong>${sku.product}</strong>.`,
    [
      { label: 'SKU ID', value: sku.id },
      { label: 'Current Price', value: sku.ourPrice + ' AED' },
      { label: 'Est. Price Delta', value: (strat.marginDelta > 0 ? '+' : '') + (strat.marginDelta * 30).toFixed(2) + ' AED', positive: strat.marginDelta > 0 },
      { label: 'Override Category Rules', value: 'Yes', positive: true },
    ],
    () => {
      const tag = document.getElementById(`canvas-sku-tag-${sku.id}`);
      tag.textContent = strat.name;
      tag.className = `strategy-tag-sm strat-${chipType}`;
      
      const dropZone = document.getElementById(`canvas-drop-${sku.id}`);
      dropZone.style.borderColor = 'var(--success)';
      dropZone.style.background = 'rgba(34,197,94,0.1)';
      dropZone.innerHTML = `<span style="color:var(--success); font-weight:700">Applied</span>`;
      
      sku.strat = chipType; 
      
      const cogs = sku.ourPrice * 0.7;
      let newPrice = sku.aiPrice;
      if (chipType === 'aggressive') {
         newPrice = sku.comp - 1;
      } else if (chipType === 'profit') {
         newPrice = sku.comp + (sku.ourPrice * 0.05); // Price premium
      } else if (chipType === 'flush') {
         newPrice = cogs * 1.01;
      } else if (chipType === 'defensive') {
         newPrice = sku.comp;
      }
      
      // Safety Circuit Breaker Limit (2% floor)
      const floor = cogs * 1.02;
      sku.aiPrice = Math.max(Math.floor(newPrice), Math.floor(floor));
      
      renderSKUTable(SKU_DATA);
      showToast(`${strat.icon} ${strat.name} applied to ${sku.product}`);
    }
  );
};

function onSimScopeChange() {
  const scope = document.getElementById('sim-scope').value;
  if(scope === 'portfolio' || scope === 'electronics' || scope === 'fmcg') {
    document.getElementById('plabel-1').textContent = 'Projected GMV';
    document.getElementById('pold-1').textContent = scope === 'portfolio' ? '82.4M' : '34.2M';
    
    document.getElementById('plabel-2').textContent = 'Projected Margin';
    document.getElementById('pold-2').textContent = '12.4%';
    
    document.getElementById('plabel-3').textContent = 'Projected Win Rate';
  } else {
    document.getElementById('plabel-1').textContent = 'Projected Price';
    document.getElementById('pold-1').textContent = '4,299 AED';
    
    document.getElementById('plabel-2').textContent = 'Projected Volume Lift';
    document.getElementById('pold-2').textContent = '42 units/day';
    
    document.getElementById('plabel-3').textContent = 'Gross Profit Impact';
  }
  onLabSlider();
}

window.onLabSlider = function() {
  const scope = document.getElementById('sim-scope').value;
  const aggr = parseInt(document.getElementById('slider-aggr').value);
  
  if (scope === 'N12345678A') {
    document.getElementById('aggr-display').textContent = aggr + '%';
    
    const basePrice = 4299;
    const cogs = 4000;
    const compPrice = 4250;
    const baseVol = 42;
    
    // Aggressiveness 0 -> Premium (4500 AED)
    // Aggressiveness 50 -> Match Competitor (4250 AED)
    // Aggressiveness 100 -> Cost Price (4000 AED)
    let targetPrice = 4500 - (aggr * 5); 
    document.getElementById('pval-1').textContent = targetPrice.toFixed(0) + ' AED';
    
    // Exponential profit curve (Volume dies above competitor price, rises below)
    let volLift;
    if (targetPrice >= compPrice) {
      volLift = baseVol * Math.exp(-0.015 * (targetPrice - compPrice));
    } else {
      volLift = baseVol + ((compPrice - targetPrice) * 0.45);
    }
    
    let liftDiff = volLift - baseVol;
    document.getElementById('pval-2').textContent = (liftDiff >= 0 ? '+' : '') + liftDiff.toFixed(1) + ' units/day';
    
    // Gross Profit peaks near 4250-4300, falls sharply at extrema
    let newGP = (targetPrice - cogs) * volLift;
    let oldGP = (basePrice - cogs) * baseVol;
    let gpImpact = newGP - oldGP;
    
    document.getElementById('pval-3').textContent = (gpImpact > 0 ? '+' : '') + gpImpact.toFixed(0) + ' AED Daily';
    document.getElementById('pval-3').className = `lab-proj-value ${gpImpact > 0 ? 'positive' : 'negative'}`;
  } else {
    window.originalLabSliderCalc(); 
  }
}

window.originalLabSliderCalc = function() {
  const aggr = parseInt(document.getElementById('slider-aggr').value);
  document.getElementById('aggr-display').textContent = aggr + '%';

  const baseGmv = 82.4;
  const baseMargin = 12.4;
  const baseWin = 74;

  // 1. GMV Quadratic Curve (Peaks optimally around 75% aggressiveness)
  // Excessive aggressiveness (100) drops GMV because price cuts outweigh capped volume max.
  // Low aggressiveness (0) drops GMV because volume collapses.
  // y = a(x - h)^2 + k, vertex at (75, 95.0)
  const a_gmv = -0.02016;
  let newGmv = (a_gmv * Math.pow(aggr - 75, 2)) + 95.0;
  
  // Guardrail: GMV cannot mathematically fall below zero. As price gets infinitely high, GMV floors to a minimum base demand.
  newGmv = Math.max(12.5, newGmv);

  // 2. Margin Curve (Monotonically decreases as aggressiveness drops price)
  // aggr=50 -> 12.4%, aggr=100 -> ~2%, aggr=0 -> ~22%
  let newMargin = baseMargin - ((aggr - 50) * 0.2);
  
  // 3. Buy Box Win Rate Curve (Diminishing returns approaching 100)
  let newWin;
  if (aggr >= 50) {
    newWin = baseWin + ((aggr - 50) * 0.48); // Caps realistically around 98%
  } else {
    // Parabolic drop-off as we price premium
    newWin = (0.0256 * Math.pow(aggr, 2)) + 10; // Floors around 10%
  }

  document.getElementById('pval-1').textContent = 'AED ' + newGmv.toFixed(1) + 'M';
  document.getElementById('pval-1').className = `lab-proj-value ${newGmv > baseGmv ? 'positive' : 'negative'}`;
  document.getElementById('pval-2').textContent = newMargin.toFixed(1) + '%';
  document.getElementById('pval-2').className = `lab-proj-value ${newMargin > baseMargin ? 'positive' : 'negative'}`;
  document.getElementById('pval-3').textContent = newWin.toFixed(0) + '%';
  document.getElementById('pval-3').className = `lab-proj-value ${newWin > 74 ? 'positive' : 'negative'}`;
}

function switchHubTab(tabName) {
  document.querySelectorAll('.hub-tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`.hub-tab[data-tab="${tabName}"]`).classList.add('active');
  
  document.querySelectorAll('.hub-view').forEach(v => {
    v.classList.remove('active-view');
    v.classList.add('hidden');
  });
  
  const view = document.getElementById(`hub-view-${tabName}`);
  view.classList.remove('hidden');
  view.classList.add('active-view');
  
  if(tabName === 'reports') renderReportsView();
  if(tabName === 'analysis') renderAnalysisView();
}

function renderReportsView() {
  const tbody = document.getElementById('reports-tbody');
  if(tbody.innerHTML.trim() !== '') return;
  
  const logs = [
    { time: '10:42 AM', id: 'N12345678A', action: 'AI Update', delta: '-15 AED', trigger: 'Circuit Breaker' },
    { time: '09:15 AM', id: 'H99887766F', action: 'Manual Override', delta: '+50 AED', trigger: 'User YK' },
    { time: '08:00 AM', id: 'F55667788E', action: 'AI Update', delta: '-2 AED', trigger: 'PID Flush' },
    { time: 'Yesterday', id: 'N98765432B', action: 'Policy Application', delta: 'N/A', trigger: 'User YK' }
  ];
  
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td style="color:var(--text-muted)">${l.time}</td>
      <td class="sku-id-col">${l.id}</td>
      <td style="font-weight:600">${l.action}</td>
      <td style="color:${l.delta.includes('-') ? 'var(--danger)' : 'var(--success)'}">${l.delta}</td>
      <td><span class="cat-badge badge-neutral">${l.trigger}</span></td>
    </tr>
  `).join('');
}

function renderAnalysisView() {
  const ctx = document.getElementById('analysisChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [
        { label: 'AI Driven Actions', data: [1200, 1400, 1150, 1500], backgroundColor: '#FFE000' },
        { label: 'Manual Overrides', data: [80, 65, 40, 25], backgroundColor: '#EF4444' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: 'white', boxWidth: 10 } } },
      scales: {
        x: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.6)' } },
        y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.6)' } }
      }
    }
  });
}

// =====================================================
// 8. SKU TABLE
// =====================================================

function renderSKUTable(skus) {
  const tbody = document.getElementById('sku-tbody');
  tbody.innerHTML = '';
  const fmt = (v) => `AED ${v.toLocaleString()}`;

  skus.forEach((s) => {
    const oCls = s.aiPrice < s.ourPrice ? 'better' : (s.aiPrice > s.ourPrice ? 'worse' : '');
    const row = document.createElement('tr');
    row.onclick = () => openDrawer(s);
    row.innerHTML = `
      <td class="sku-id-col">${s.id}</td>
      <td class="sku-product-col" title="${s.product}">${s.product}</td>
      <td><span class="cat-badge cat-${s.cat.toLowerCase()}">${s.cat}</span></td>
      <td class="price-col">${fmt(s.ourPrice)}</td>
      <td class="price-col">${fmt(s.amz)}</td>
      <td class="price-col">${fmt(s.comp)}</td>
      <td class="price-col ai-price">${fmt(s.aiPrice)}</td>
      <td class="margin-col ${s.mClass}">${s.margin}</td>
      <td style="font-weight: 600; color: var(--text-secondary);">${s.inventory} units</td>
      <td><span class="strategy-tag-sm strat-${s.strat}">${s.strat === 'none' ? 'None' : STRATEGIES[s.strat].name}</span></td>
      <td><span class="status-dot status-${s.status}">${s.status.charAt(0).toUpperCase() + s.status.slice(1)}</span></td>
      <td><button class="inspect-btn" onclick="event.stopPropagation(); openDrawer(SKU_DATA[${SKU_DATA.indexOf(s)}])">Inspect</button></td>
    `;
    tbody.appendChild(row);
  });
}

// =====================================================
// 9. SKU DRAWER
// =====================================================

function filterSKUs() {
  const search = document.getElementById('sku-search').value.toLowerCase();
  const catFilter = document.getElementById('sku-cat-filter').value;

  const filteredSKUs = SKU_DATA.filter(sku => {
    const matchSearch = !search ||
      sku.product.toLowerCase().includes(search) ||
      sku.id.toLowerCase().includes(search) ||
      sku.cat.toLowerCase().includes(search);
    const matchCat = catFilter === 'all' || sku.cat === catFilter || sku.cat.toLowerCase() === catFilter.toLowerCase();
    return matchSearch && matchCat;
  });

  renderSKUTable(filteredSKUs);
}

function openDrawer(sku) {
  STATE.openSkuIndex = SKU_DATA.findIndex(s => s.id === sku.id);
  
  const cogs = sku.ourPrice * 0.7;
  
  const drawerHeader = document.getElementById('drawer-sku-header');
  drawerHeader.innerHTML = `
    <h3 class="sku-drawer-title">${sku.product}</h3>
    <span class="sku-drawer-id" style="display:flex; justify-content:space-between; width:100%; margin-top:5px;">
      <span>ID: ${sku.id} | Category: ${sku.cat}</span>
      <span><strong>Live:</strong> AED ${sku.ourPrice.toLocaleString()} | <strong>COGS:</strong> AED ${cogs.toLocaleString()}</span>
    </span>
  `;const doc = Math.floor(sku.inventory / 15) + 1;
  document.getElementById('drawer-inv-text').textContent = `Available Units: ${sku.inventory} | Days of Cover: ${doc}`;
  
  const invBox = document.getElementById('drawer-inv-box');
  const invStatus = document.getElementById('drawer-inv-status');
  if (doc > 30) {
    invBox.style.borderLeftColor = 'var(--warning)';
    invStatus.textContent = 'High Stock Level';
    invStatus.style.color = 'var(--warning)';
  } else if (doc < 5) {
    invBox.style.borderLeftColor = 'var(--danger)';
    invStatus.textContent = 'Low Stock Alert';
    invStatus.style.color = 'var(--danger)';
  } else {
    invBox.style.borderLeftColor = 'var(--success)';
    invStatus.textContent = 'Stable';
    invStatus.style.color = 'var(--success)';
  }

  const signalsEl = document.getElementById('intel-signals');
  signalsEl.innerHTML = `
    <div class="intel-signal weight-high">
      <span class="intel-signal-icon">🏷️</span>
      <div class="intel-signal-body">
        <span class="intel-signal-title">Competitor Signal (Weight: 0.80)</span>
        <span class="intel-signal-text">Amazon dropped to ${sku.amz} AED. Best competitor at ${sku.comp} AED.</span>
        <span class="intel-signal-result">→ Action: ${sku.strat === 'profit' ? 'Maximize Margin (Profit Harvest curve)' : (sku.strat === 'flush' ? 'Aggressive Flush to Cost' : 'Match lowest competitor')} → AI Price = ${sku.aiPrice} AED</span>
      </div>
    </div>
    <div class="intel-signal weight-low">
      <span class="intel-signal-icon">📦</span>
      <div class="intel-signal-body">
        <span class="intel-signal-title">Inventory Signal (Weight: 0.20)</span>
        <span class="intel-signal-text">Stock level is ${doc} days.</span>
        <span class="intel-signal-result">→ Action: Standard margin rules apply.</span>
      </div>
    </div>
  `;

  const safety = document.getElementById('safety-check');
  const isSafe = sku.mClass !== 'bad';
  safety.className = `safety-check ${isSafe ? 'passed' : 'failed'}`;
  safety.innerHTML = `<span>${isSafe ? '✅' : '❌'}</span><span>Safety Check: Final Price is ${sku.margin} above Margin Floor.</span>`;

  const floor = Math.floor(cogs * 1.02);
  const ceiling = Math.floor(cogs * 2.2);
  const current = STATE.overrideValues[sku.id] || sku.aiPrice;

  const slider = document.getElementById('override-slider');
  slider.min = floor;
  slider.max = ceiling;
  slider.value = current;

  document.getElementById('override-min').textContent = `AED ${floor.toLocaleString()} (Floor)`;
  document.getElementById('override-max').textContent = `AED ${ceiling.toLocaleString()}`;
  document.getElementById('override-price-display').textContent = `AED ${parseInt(current).toLocaleString()}`;

  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('sku-drawer').classList.add('open');
  setTimeout(() => initBenchmarkChart(sku), 60);
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('sku-drawer').classList.remove('open');
  if (STATE.benchmarkChart) {
    STATE.benchmarkChart.destroy();
    STATE.benchmarkChart = null;
  }
}

function onOverrideSlider() {
  const val = document.getElementById('override-slider').value;
  document.getElementById('override-price-display').textContent = `AED ${parseInt(val).toLocaleString()}`;
}

function resetOverride() {
  const sku = SKU_DATA[STATE.openSkuIndex];
  if (!sku) return;
  
  delete STATE.overrideValues[sku.id];
  sku.strat = sku.originalStrat || sku.strat; // Revert visually
  sku.aiPrice = sku.originalAiPrice || sku.aiPrice; // Hard revert math
  
  const slider = document.getElementById('override-slider');
  slider.value = sku.aiPrice;
  document.getElementById('override-price-display').textContent = `AED ${sku.aiPrice.toLocaleString()}`;
  showToast('🔄 Price reset to algorithmic recommendation');
  
  renderSKUTable(SKU_DATA);
  renderCanvasSkus();
}

function saveOverride() {
  const sku = SKU_DATA[STATE.openSkuIndex];
  if (!sku) return;
  const newPrice = parseInt(document.getElementById('override-slider').value);
  
  // Persist values globally explicitly tracking manual overrides
  STATE.overrideValues[sku.id] = newPrice;
  sku.aiPrice = newPrice;
  sku.strat = 'none'; // Reverts visually to indicate manual control
  
  showToast(`✅ Manual price AED ${newPrice.toLocaleString()} saved for ${sku.product}`);
  closeDrawer();
  
  // Refresh canvas and SKU list tables globally
  renderSKUTable(SKU_DATA);
  renderCanvasSkus();
}

// =====================================================
// 10. ALERTS SCREEN
// =====================================================

function renderAlerts() {
  const feed = document.getElementById('alerts-feed');
  feed.innerHTML = '';

  ALERTS_DATA.forEach(alert => {
    const isRead = STATE.alertsRead.has(alert.id);
    const div = document.createElement('div');
    const secActionName = alert.secondaryAction === 'View Analysis' ? `showAnalysis('${alert.id}')` : `dismissAlert('${alert.id}')`;
    
    div.className = `alert-card ${alert.type} ${isRead ? 'read' : ''}`;
    div.id = `alert-${alert.id}`;
    div.innerHTML = `
      <div class="alert-card-header">
        <div class="alert-type-row">
          <span class="alert-type-badge ${alert.badgeClass}">${alert.badge}</span>
        </div>
        <span class="alert-time">${alert.time}</span>
      </div>
      <div class="alert-title">${alert.title}</div>
      <div class="alert-body">${alert.body}</div>
      <div class="alert-actions">
        <button class="alert-btn-primary" onclick="handleAlertAction('${alert.id}', '${alert.screen}')">${alert.primaryAction}</button>
        <button class="alert-btn-secondary" onclick="${secActionName}">${alert.secondaryAction}</button>
      </div>
    `;
    feed.appendChild(div);
  });
}

function handleAlertAction(alertId, screen) {
  dismissAlert(alertId);
  navigateTo(screen);
}

window.showAnalysis = function(alertId) {
  const alert = ALERTS_DATA.find(a => a.id === alertId);
  if (!alert) return;
  
  // Update styling
  document.getElementById('analysis-empty').style.display = 'none';
  document.getElementById('analysis-content').style.display = 'block';
  document.getElementById('alert-analysis-panel').style.display = 'block';
  
  // Inject details depending on alert
  if (alert.type === 'circuit') {
    document.getElementById('analysis-title').textContent = 'Circuit Breaker Analysis';
    document.getElementById('analysis-root-cause').innerHTML = `<strong>Insight:</strong> ${alert.body}<br><br>The algorithmic safety mechanisms blocked 14 automated downward price revisions to protect the blended category margin target (12.4%). Continued downward matching would violate current strategic directives.`;
    document.getElementById('analysis-skus').textContent = '14';
    document.getElementById('analysis-loss').textContent = 'AED 42,000 Risk';
    document.getElementById('analysis-loss').className = 'amet-val danger';
  } else if (alert.type === 'elasticity') {
    document.getElementById('analysis-title').textContent = 'Elasticity Opportunity';
    document.getElementById('analysis-root-cause').innerHTML = `<strong>Insight:</strong> ${alert.body}<br><br>Consumer price indifference detected. Historical regression matches "Profit Harvest" parameter perfectly.`;
    document.getElementById('analysis-skus').textContent = '891';
    document.getElementById('analysis-loss').textContent = '+AED 1.2M Lift';
    document.getElementById('analysis-loss').className = 'amet-val success';
  } else if (alert.type === 'floor') {
    document.getElementById('analysis-title').textContent = 'Margin Floor Breach';
    document.getElementById('analysis-root-cause').innerHTML = `<strong>Insight:</strong> ${alert.body}<br><br>The "Inventory Flush" strategy applied yesterday has successfully increased volume, but unit economics have breached the 5% minimum profitability threshold set for the Home category.`;
    document.getElementById('analysis-skus').textContent = '112';
    document.getElementById('analysis-loss').textContent = '-2.1% GMV Impact';
    document.getElementById('analysis-loss').className = 'amet-val warning';
  }
}

function dismissAlert(alertId) {
  STATE.alertsRead.add(alertId);
  const el = document.getElementById(`alert-${alertId}`);
  if (el) el.classList.add('read');
  const badge = document.getElementById('alert-badge');
  const unread = ALERTS_DATA.length - STATE.alertsRead.size;
  badge.textContent = unread > 0 ? unread : '';
  badge.style.display = unread > 0 ? 'flex' : 'none';
}

function markAllRead() {
  ALERTS_DATA.forEach(a => STATE.alertsRead.add(a.id));
  renderAlerts();
  document.getElementById('alert-badge').style.display = 'none';
  showToast('✓ All alerts marked as read');
}

// =====================================================
// 11. TIME & UTILITIES
// =====================================================

function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const el = document.getElementById('last-update-time');
  if (el) el.textContent = timeStr;
}

function showToast(message) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =====================================================
// 12. INIT
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  setInterval(updateTime, 1000);

  setTimeout(() => {
    initPulseChart();
    initStrategyDonut();
  }, 100);

  renderSKUTable(SKU_DATA);
  renderAlerts();

  document.querySelectorAll('.strategy-chip').forEach(chip => {
    chip.addEventListener('touchstart', (e) => {
      STATE.draggingChip = chip.dataset.strategy;
    }, { passive: true });
  });

  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('touchend', (e) => {
      if (STATE.draggingChip) {
        const match = card.id.match(/card-(\w+)/);
        if (match) applyStrategyToCategory(match[1], STATE.draggingChip);
        STATE.draggingChip = null;
      }
    });
  });

  console.info('[SPO] Universal Guardrail: Final_Price = MAX(Calculated_Price, COGS x 1.02)');
  SKU_DATA.forEach(sku => {
    // Preserve base state so we can reset overrides easily
    sku.originalStrat = sku.strat;
    
    const cogs = sku.ourPrice * 0.7;
    const floor = cogs * 1.02;
    const finalPrice = Math.max(sku.aiPrice, floor);
    if (finalPrice !== sku.aiPrice) {
      console.warn(`[SPO] Guardrail applied: ${sku.product} - floor ${floor} replaces ${sku.aiPrice}`);
    }
    sku.aiPrice = finalPrice;
    sku.originalAiPrice = sku.aiPrice;
  });
});
