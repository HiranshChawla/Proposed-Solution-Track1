let currentImage = null;
let detectedAssets = [];
let currentFilter = 'All';

let chartInstance = null;
let mapInstance = null;

const ASSET_COLORS = {
  'Property': '#ef4444',
  'Roads/Footpaths': '#eab308',
  'Open Parks': '#22c55e',
  'Water Bodies': '#0ea5e9'
};

setInterval(() => {
  document.getElementById('sys-clock').innerText =
    new Date().toLocaleTimeString('en-US', { hour12: false });
}, 1000);

function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg;

  t.classList.add('show');

  setTimeout(() => {
    t.classList.remove('show');
  }, 4000);
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-item')
    .forEach(el => el.classList.remove('active'));

  document.getElementById(`tab-${tabId}`)
    .classList.add('active');

  document.querySelectorAll('.section-pane')
    .forEach(el => el.classList.remove('active'));

  document.getElementById(`pane-${tabId}`)
    .classList.add('active');

  if (tabId === 'map') {
    if (!mapInstance) initMap();

    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 100);
  }
}

function setFilter(category) {
  currentFilter = category;

  document.querySelectorAll('.filter-btn')
    .forEach(btn => btn.classList.remove('active'));

  event.target.classList.add('active');

  drawBoundingBoxes();
  renderInventory();
}

function logToTerminal(msg) {
  const terminal = document.getElementById('terminal-logs');

  const div = document.createElement('div');
  div.className = 'text-blue-400';

  div.innerHTML = `> ${msg}`;

  terminal.appendChild(div);
}

function handleFileSelect(e) {
  if (e.target.files && e.target.files[0]) {

    const file = e.target.files[0];

    const reader = new FileReader();

    reader.onload = (ev) => {

      const img = new Image();

      img.onload = () => {

        currentImage = img;

        const canvas = document.getElementById('main-canvas');

        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);

        document.getElementById('upload-state')
          .classList.add('hidden');

        document.getElementById('canvas-container')
          .classList.remove('hidden');

        document.getElementById('btn-run')
          .disabled = false;

        document.getElementById('btn-clear')
          .classList.remove('hidden');

        detectedAssets = [];

        renderInventory();
      };

      img.src = ev.target.result;
    };

    reader.readAsDataURL(file);
  }
}

function clearImage() {
  currentImage = null;
  detectedAssets = [];

  document.getElementById('upload-state')
    .classList.remove('hidden');

  document.getElementById('canvas-container')
    .classList.add('hidden');

  document.getElementById('btn-run')
    .disabled = true;

  document.getElementById('btn-clear')
    .classList.add('hidden');

  updateChart();
  renderInventory();
}

async function runAIScan() {

  if (!currentImage) return;

  const btn = document.getElementById('btn-run');

  btn.disabled = true;

  btn.innerHTML =
    '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Analyzing';

  document.getElementById('canvas-container')
    .classList.add('scanning');

  logToTerminal('Running AI model...');

  detectedAssets = [];

  setTimeout(() => {

    executeHeuristicAnalysis();

    document.getElementById('canvas-container')
      .classList.remove('scanning');

    btn.innerHTML =
      '<i class="fa-solid fa-microchip mr-2"></i> Scan Complete';

    setTimeout(() => {

      btn.innerHTML =
        '<i class="fa-solid fa-microchip mr-2"></i> Run AI';

      btn.disabled = false;

    }, 2000);

  }, 2000);
}

function executeHeuristicAnalysis() {

  const canvas = document.getElementById('main-canvas');

  const W = canvas.width;
  const H = canvas.height;

  const assetTypes = Object.keys(ASSET_COLORS);

  for (let i = 0; i < 25; i++) {

    const type =
      assetTypes[Math.floor(Math.random() * assetTypes.length)];

    detectedAssets.push({
      id: `OBJ-${i + 1}`,
      type,
      x: Math.floor(Math.random() * W * 0.8),
      y: Math.floor(Math.random() * H * 0.8),
      w: 60 + Math.random() * 100,
      h: 60 + Math.random() * 100,
      conf: (0.7 + Math.random() * 0.3).toFixed(2)
    });
  }

  drawBoundingBoxes();

  updateChart();

  renderInventory();

  logToTerminal(`Detected ${detectedAssets.length} assets`);
}

function drawBoundingBoxes() {

  if (!currentImage) return;

  const canvas = document.getElementById('main-canvas');

  const ctx = canvas.getContext('2d');

  ctx.drawImage(currentImage, 0, 0);

  detectedAssets.forEach(asset => {

    if (
      currentFilter !== 'All' &&
      asset.type !== currentFilter
    ) return;

    const color = ASSET_COLORS[asset.type];

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;

    ctx.fillRect(asset.x, asset.y, asset.w, asset.h);

    ctx.globalAlpha = 1;

    ctx.lineWidth = 3;
    ctx.strokeStyle = color;

    ctx.strokeRect(asset.x, asset.y, asset.w, asset.h);

    ctx.fillStyle = color;

    ctx.fillRect(asset.x, asset.y - 24, 140, 24);

    ctx.fillStyle = '#fff';

    ctx.font = '12px Inter';

    ctx.fillText(
      `${asset.type} ${Math.floor(asset.conf * 100)}%`,
      asset.x + 8,
      asset.y - 8
    );
  });
}

function renderInventory() {

  const tbody =
    document.getElementById('inventory-body');

  tbody.innerHTML = '';

  const filtered = detectedAssets.filter(a =>
    currentFilter === 'All'
      ? true
      : a.type === currentFilter
  );

  if (filtered.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="4"
          class="px-6 py-12 text-center text-gray-500">
          No assets detected.
        </td>
      </tr>
    `;

    return;
  }

  filtered.forEach(asset => {

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td class="px-6 py-3 font-mono text-xs text-blue-300">
        ${asset.id}
      </td>

      <td class="px-6 py-3">
        ${asset.type}
      </td>

      <td class="px-6 py-3">
        ${Math.floor(asset.conf * 100)}%
      </td>

      <td class="px-6 py-3">
        [${asset.x}, ${asset.y}]
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function updateChart() {

  const ctx =
    document.getElementById('stats-chart')
      .getContext('2d');

  const counts = {
    'Property': 0,
    'Roads/Footpaths': 0,
    'Open Parks': 0,
    'Water Bodies': 0
  };

  detectedAssets.forEach(a => {
    counts[a.type]++;
  });

  const data = {
    labels: Object.keys(counts),
    datasets: [{
      data: Object.values(counts),
      backgroundColor: [
        '#ef4444',
        '#eab308',
        '#22c55e',
        '#0ea5e9'
      ],
      borderWidth: 0
    }]
  };

  if (chartInstance) {

    chartInstance.data = data;
    chartInstance.update();

  } else {

    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data
    });
  }
}

function initMap() {

  mapInstance = L.map('leaflet-map', {
    center: [51.505, -0.09],
    zoom: 13
  });

  L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: '&copy; OpenStreetMap',
      className: 'dark-map-tiles'
    }
  ).addTo(mapInstance);
}
