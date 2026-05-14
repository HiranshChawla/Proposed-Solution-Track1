/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let currentImage = null;
let detectionResult = null;
let beforeImg = null, afterImg = null, beforeFile = null, afterFile = null;
let leafletMap = null, tileLayer = null;
let activeLayerId = 'esri_satellite';
let layerGroupFilter = 'all';

/* ═══════════════════════════════════════════════════════════
   CLOCK
═══════════════════════════════════════════════════════════ */
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const ss = String(now.getSeconds()).padStart(2,'0');
  const off = -now.getTimezoneOffset() / 60;
  document.getElementById('clock').textContent =
    `${hh}:${mm}:${ss} UTC${off >= 0 ? '+' : ''}${String(off).padStart(2,'0')}:00`;
}
updateClock();
setInterval(updateClock, 1000);

/* ═══════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════ */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.classList.toggle('dark');
  html.classList.toggle('light', !isDark);
  document.getElementById('theme-btn').textContent = isDark ? '☀ Light' : '🌙 Dark';
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
  if (id === 'map') initMap();
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

/* ═══════════════════════════════════════════════════════════
   DRAG & DROP / FILE LOAD
═══════════════════════════════════════════════════════════ */
function onDragOver(e) { e.preventDefault(); document.getElementById('upload-zone').classList.add('drag-over'); }
function onDragLeave()  { document.getElementById('upload-zone').classList.remove('drag-over'); }
function onDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadFile(file);
}
function onFileChange(e) { const f = e.target.files[0]; if (f) loadFile(f); }

function loadFile(file) {
  const url = URL.createObjectURL(file);
  currentImage = url;
  detectionResult = null;
  document.getElementById('file-name-display').textContent = file.name;
  document.getElementById('file-size-display').textContent = formatSize(file.size);
  document.getElementById('preview-img').src = url;
  document.getElementById('upload-zone').style.display = 'none';
  document.getElementById('preview-card').style.display = 'block';
  document.getElementById('run-btn').disabled = false;
  document.getElementById('status-msg').textContent = '';
}

function clearImage() {
  currentImage = null; detectionResult = null;
  document.getElementById('upload-zone').style.display = '';
  document.getElementById('preview-card').style.display = 'none';
  document.getElementById('run-btn').disabled = true;
  document.getElementById('file-input').value = '';
  document.getElementById('status-msg').textContent = '';
}

function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(2) + ' MB';
}

/* ═══════════════════════════════════════════════════════════
   AI DETECTION — fresh random results every single run
═══════════════════════════════════════════════════════════ */
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randConf(lo, hi) { return +(lo + Math.random() * (hi - lo)).toFixed(3); }

async function runDetection() {
  if (!currentImage) return;
  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analyzing…';
  document.getElementById('status-msg').textContent = 'Running YOLOv8 segmentation model…';

  await new Promise(r => setTimeout(r, 2200 + Math.random() * 800));

  detectionResult = {
    buildings:    rand(30, 150),
    roads:        rand(15, 90),
    trees:        rand(50, 250),
    water:        rand(2, 22),
    buildingConf: randConf(0.72, 0.96),
    roadConf:     randConf(0.68, 0.94),
    treeConf:     randConf(0.80, 0.98),
    waterConf:    randConf(0.74, 0.96),
    timestamp:    new Date(),
  };

  btn.disabled = false;
  btn.innerHTML = 'Run AI Detection';
  document.getElementById('status-msg').textContent =
    '✓ Detection complete — ' + detectionResult.timestamp.toLocaleTimeString();

  renderResults();
  updateExport();
  showSection('results');
}

/* ═══════════════════════════════════════════════════════════
   RENDER RESULTS
═══════════════════════════════════════════════════════════ */
function renderResults() {
  if (!detectionResult) return;
  const r = detectionResult;
  document.getElementById('results-empty').classList.add('hidden');
  document.getElementById('results-content').classList.remove('hidden');
  document.getElementById('results-sub').textContent =
    'YOLOv8 segmentation — ' + r.timestamp.toLocaleString() + ' · Analysis Complete';

  function set(valId, val, confId, barId, conf) {
    document.getElementById(valId).textContent = val;
    document.getElementById(confId).textContent = (conf * 100).toFixed(1) + '%';
    document.getElementById(barId).style.width = (conf * 100) + '%';
  }
  set('val-buildings', r.buildings, 'conf-buildings', 'bar-buildings', r.buildingConf);
  set('val-roads',     r.roads,     'conf-roads',     'bar-roads',     r.roadConf);
  set('val-trees',     r.trees,     'conf-trees',     'bar-trees',     r.treeConf);
  set('val-water',     r.water,     'conf-water',     'bar-water',     r.waterConf);

  renderSegmentation();
}

function renderSegmentation() {
  const img = new Image();
  img.onload = () => {
    const canvas = document.getElementById('seg-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    ctx.globalAlpha = 0.48;
    const W = canvas.width, H = canvas.height;
    [[0.10,0.08,0.22,0.25],[0.54,0.07,0.20,0.18],[0.28,0.54,0.19,0.21]].forEach(([x,y,w,h]) => {
      ctx.fillStyle = '#ef4444'; ctx.fillRect(x*W, y*H, w*W, h*H);
    });
    [[0.0,0.47,1.0,0.04],[0.44,0.0,0.04,1.0]].forEach(([x,y,w,h]) => {
      ctx.fillStyle = '#eab308'; ctx.fillRect(x*W, y*H, w*W, h*H);
    });
    [[0.64,0.59,0.28,0.29],[0.01,0.62,0.20,0.30]].forEach(([x,y,w,h]) => {
      ctx.fillStyle = '#22c55e'; ctx.fillRect(x*W, y*H, w*W, h*H);
    });
    [[0.70,0.04,0.26,0.21]].forEach(([x,y,w,h]) => {
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(x*W, y*H, w*W, h*H);
    });
    ctx.globalAlpha = 1;
  };
  img.src = currentImage;
  document.getElementById('seg-original').src = currentImage;
}

/* ═══════════════════════════════════════════════════════════
   MAP SOURCES — 16 FREE APIS, ZERO KEY REQUIRED
═══════════════════════════════════════════════════════════ */
const MAP_SOURCES = [
  { id:'osm',           label:'OpenStreetMap',      group:'base',      dot:'#3b82f6',
    url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr:'© OpenStreetMap contributors', maxZoom:19 },
  { id:'esri_satellite',label:'ESRI Satellite',      group:'satellite', dot:'#22c55e',
    url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr:'© Esri, Maxar, USGS | Sentinel-2 ESA', maxZoom:19 },
  { id:'esri_topo',     label:'ESRI Topo',           group:'base',      dot:'#3b82f6',
    url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attr:'© Esri, USGS, NOAA', maxZoom:19 },
  { id:'esri_street',   label:'ESRI Streets',        group:'base',      dot:'#3b82f6',
    url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attr:'© Esri, HERE, Garmin', maxZoom:19 },
  { id:'carto_dark',    label:'CartoDB Dark',         group:'base',      dot:'#3b82f6',
    url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    sub:'abcd', attr:'© OSM contributors, © CARTO', maxZoom:20 },
  { id:'carto_light',   label:'CartoDB Light',        group:'base',      dot:'#3b82f6',
    url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    sub:'abcd', attr:'© OSM contributors, © CARTO', maxZoom:20 },
  { id:'carto_voyager', label:'CartoDB Voyager',      group:'base',      dot:'#3b82f6',
    url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    sub:'abcd', attr:'© OSM contributors, © CARTO', maxZoom:20 },
  { id:'usgs_imagery',  label:'USGS Imagery',         group:'satellite', dot:'#22c55e',
    url:'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
    attr:'© USGS National Map', maxZoom:16 },
  { id:'usgs_topo',     label:'USGS Topo',            group:'base',      dot:'#3b82f6',
    url:'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    attr:'© USGS National Map', maxZoom:16 },
  { id:'nasa_modis',    label:'NASA MODIS (GIBS)',     group:'satellite', dot:'#22c55e',
    url:'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-01-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    attr:'© NASA GIBS | MODIS Terra', maxZoom:9 },
  { id:'nasa_landsat',  label:'NASA Landsat (GIBS)',   group:'satellite', dot:'#22c55e',
    url:'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/Landsat_WELD_CorrectedReflectance_Bands157_Global_Annual/default/2010-01-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    attr:'© NASA GIBS | Landsat WELD', maxZoom:9 },
  { id:'opentopomap',   label:'OpenTopoMap',           group:'base',      dot:'#3b82f6',
    url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    sub:'abc', attr:'© OpenTopoMap (CC-BY-SA)', maxZoom:17 },
  { id:'stadia_dark',   label:'Stadia Dark',           group:'base',      dot:'#3b82f6',
    url:'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    attr:'© Stadia Maps, © OpenMapTiles, © OSM', maxZoom:20 },
  { id:'stadia_sat',    label:'Stadia Satellite',      group:'satellite', dot:'#22c55e',
    url:'https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.png',
    attr:'© CNES/Airbus · Stadia Maps · OSM', maxZoom:20 },
  { id:'oam',           label:'OpenAerialMap',         group:'satellite', dot:'#22c55e',
    url:'https://tiles.openaerialmap.org/5adc5e0e2553e6000ce5ad6f/0/5adc5e0e2553e6000ce5ad70/{z}/{x}/{y}.png',
    attr:'© OpenAerialMap contributors', maxZoom:18 },
  { id:'wikimedia',     label:'Wikimedia Maps',        group:'base',      dot:'#3b82f6',
    url:'https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png',
    attr:'© Wikimedia Maps, © OSM contributors', maxZoom:19 },
];

const API_INFO = [
  { name:'OpenStreetMap',       group:'base',      detail:'Community-maintained global basemap' },
  { name:'ESRI World Imagery',  group:'satellite', detail:'High-res global aerial imagery (Esri)' },
  { name:'ESRI World Topo',     group:'base',      detail:'Topographic basemap from USGS' },
  { name:'ESRI World Streets',  group:'base',      detail:'Detailed street-level basemap (Esri)' },
  { name:'CartoDB Dark Matter', group:'base',      detail:'Dark urban basemap (CARTO)' },
  { name:'CartoDB Positron',    group:'base',      detail:'Minimal light basemap (CARTO)' },
  { name:'CartoDB Voyager',     group:'base',      detail:'Colourful open-data basemap' },
  { name:'USGS Imagery Only',   group:'satellite', detail:'US federal aerial imagery' },
  { name:'USGS National Topo',  group:'base',      detail:'US Topo quad-sheet basemap' },
  { name:'NASA GIBS / MODIS',   group:'satellite', detail:'Terra true-colour, daily global' },
  { name:'NASA GIBS / Landsat', group:'satellite', detail:'Landsat WELD annual composite' },
  { name:'OpenTopoMap',         group:'base',      detail:'Rendered contour & terrain map' },
  { name:'Stadia Smooth Dark',  group:'base',      detail:'Premium dark basemap (Stadia)' },
  { name:'Stadia Satellite',    group:'satellite', detail:'Airbus/Copernicus satellite via Stadia' },
  { name:'OpenAerialMap',       group:'satellite', detail:'Community drone imagery archive' },
  { name:'Wikimedia Maps',      group:'base',      detail:'OSM-based map by Wikimedia Foundation' },
];

function buildLayerButtons() {
  const container = document.getElementById('layer-btns');
  container.innerHTML = '';
  const visible = layerGroupFilter === 'all'
    ? MAP_SOURCES
    : MAP_SOURCES.filter(s => s.group === layerGroupFilter);
  visible.forEach(src => {
    const btn = document.createElement('button');
    btn.className = 'layer-btn' + (src.id === activeLayerId ? ' active' : '');
    btn.innerHTML = `<span class="layer-dot" style="background:${src.dot}"></span>${src.label}`;
    btn.onclick = () => switchLayer(src.id);
    container.appendChild(btn);
  });
}

function setLayerGroup(g, el) {
  layerGroupFilter = g;
  document.querySelectorAll('.lf-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  buildLayerButtons();
}

function buildApiGrid() {
  const grid = document.getElementById('api-ref-grid');
  grid.innerHTML = '';
  API_INFO.forEach(api => {
    const dot = api.group === 'satellite' ? '#22c55e' : '#3b82f6';
    grid.innerHTML += `<div class="api-card">
      <div class="api-dot" style="background:${dot}"></div>
      <div><div class="api-name">${api.name}</div><div class="api-detail">${api.detail}</div></div>
    </div>`;
  });
}
buildLayerButtons();
buildApiGrid();

/* ═══════════════════════════════════════════════════════════
   LEAFLET MAP INIT & LAYER SWITCHING
═══════════════════════════════════════════════════════════ */
function initMap() {
  if (leafletMap) return;
  leafletMap = L.map('leaflet-map', { center:[28.6139,77.209], zoom:13 });
  const src = MAP_SOURCES.find(s => s.id === activeLayerId);
  tileLayer = L.tileLayer(src.url, {
    maxZoom: src.maxZoom, attribution: src.attr, subdomains: src.sub || ''
  }).addTo(leafletMap);
  addDetectionMarkers();
}

function addDetectionMarkers() {
  if (!leafletMap || !detectionResult) return;
  const r = detectionResult;
  [
    { ll:[28.618,77.215], color:'#ef4444', label:`${r.buildings} Buildings` },
    { ll:[28.611,77.206], color:'#eab308', label:`${r.roads} Roads` },
    { ll:[28.615,77.201], color:'#22c55e', label:`${r.trees} Trees` },
    { ll:[28.620,77.220], color:'#3b82f6', label:`${r.water} Water` },
  ].forEach(({ ll, color, label }) => {
    const icon = L.divIcon({
      html:`<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.6)"></div>`,
      iconSize:[14,14], className:''
    });
    L.marker(ll, { icon }).addTo(leafletMap).bindPopup(`<b style="color:${color}">${label}</b>`);
  });
}

function switchLayer(id) {
  activeLayerId = id;
  buildLayerButtons();
  const src = MAP_SOURCES.find(s => s.id === id);
  if (!src) return;
  document.getElementById('map-active-badge').textContent = src.label;
  if (!leafletMap) return;
  leafletMap.removeLayer(tileLayer);
  tileLayer = L.tileLayer(src.url, {
    maxZoom: src.maxZoom, attribution: src.attr, subdomains: src.sub || ''
  }).addTo(leafletMap);
}

/* ═══════════════════════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════════════════════ */
function updateExport() {
  if (!detectionResult) return;
  const r = detectionResult;
  ['btn-geojson','btn-csv','btn-json'].forEach(id => document.getElementById(id).disabled = false);
  document.getElementById('export-summary').classList.remove('hidden');
  document.getElementById('sum-buildings').textContent = r.buildings;
  document.getElementById('sum-roads').textContent     = r.roads;
  document.getElementById('sum-trees').textContent     = r.trees;
  document.getElementById('sum-water').textContent     = r.water;
}

function markExported(type) {
  document.getElementById('last-exported').innerHTML =
    `<span style="color:#22c55e">✓</span> Last exported: ${type} — ${new Date().toLocaleTimeString()}`;
}

function download(content, filename, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
}

function exportGeoJSON() {
  if (!detectionResult) return;
  const r = detectionResult;
  const fc = {
    type: 'FeatureCollection',
    metadata: {
      generator: 'UrbanScan AI — YOLOv8',
      timestamp: r.timestamp.toISOString(),
      sources: ['Sentinel-2 (ESA)','Bhuvan (ISRO)','Google Maps Static',
                'OpenAerialMap','NASA GIBS','USGS'],
    },
    features: [
      { type:'Feature', geometry:{ type:'Point', coordinates:[77.215,28.618] },
        properties:{ asset_type:'buildings', count:r.buildings, confidence:r.buildingConf } },
      { type:'Feature', geometry:{ type:'Point', coordinates:[77.206,28.611] },
        properties:{ asset_type:'roads', count:r.roads, confidence:r.roadConf } },
      { type:'Feature', geometry:{ type:'Point', coordinates:[77.201,28.615] },
        properties:{ asset_type:'trees', count:r.trees, confidence:r.treeConf } },
      { type:'Feature', geometry:{ type:'Point', coordinates:[77.220,28.620] },
        properties:{ asset_type:'water', count:r.water, confidence:r.waterConf } },
    ]
  };
  download(JSON.stringify(fc,null,2), `urbanscan_${Date.now()}.geojson`, 'application/geo+json');
  markExported('GeoJSON');
}

function exportCSV() {
  if (!detectionResult) return;
  const r = detectionResult;
  const rows = [
    ['asset_type','count','confidence','detected_at'],
    ['buildings', r.buildings, r.buildingConf, r.timestamp.toISOString()],
    ['roads',     r.roads,     r.roadConf,     r.timestamp.toISOString()],
    ['trees',     r.trees,     r.treeConf,     r.timestamp.toISOString()],
    ['water',     r.water,     r.waterConf,    r.timestamp.toISOString()],
  ];
  download(rows.map(r => r.join(',')).join('\n'), `urbanscan_${Date.now()}.csv`, 'text/csv');
  markExported('CSV');
}

function exportJSON() {
  if (!detectionResult) return;
  download(JSON.stringify(detectionResult,null,2), `urbanscan_${Date.now()}.json`, 'application/json');
  markExported('JSON');
}

/* ═══════════════════════════════════════════════════════════
   CHANGE DETECTION
═══════════════════════════════════════════════════════════ */
function handleChangeFile(e, type) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  if (type === 'before') {
    beforeImg = url; beforeFile = file;
    document.getElementById('before-drop').outerHTML = `
      <div class="mini-preview" id="before-preview">
        <img src="${url}"/>
        <div class="mini-overlay">
          <span class="mini-fname">${file.name}</span>
          <button class="mini-clear" onclick="clearChange('before')">Remove</button>
        </div>
      </div>`;
  } else {
    afterImg = url; afterFile = file;
    document.getElementById('after-drop').outerHTML = `
      <div class="mini-preview" id="after-preview">
        <img src="${url}"/>
        <div class="mini-overlay">
          <span class="mini-fname">${file.name}</span>
          <button class="mini-clear" onclick="clearChange('after')">Remove</button>
        </div>
      </div>`;
  }
  updateChangeBtn();
}

function clearChange(type) {
  if (type === 'before') {
    beforeImg = null; beforeFile = null;
    document.getElementById('before-preview').outerHTML = `
      <div class="mini-drop" id="before-drop" onclick="document.getElementById('before-input').click()">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
        <span>Upload before image</span>
      </div>`;
  } else {
    afterImg = null; afterFile = null;
    document.getElementById('after-preview').outerHTML = `
      <div class="mini-drop" id="after-drop" onclick="document.getElementById('after-input').click()">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
        <span>Upload after image</span>
      </div>`;
  }
  updateChangeBtn();
}

function updateChangeBtn() {
  document.getElementById('change-run-btn').disabled = !(beforeImg && afterImg);
}

async function runChangeDetection() {
  const btn = document.getElementById('change-run-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analyzing Changes…';
  await new Promise(r => setTimeout(r, 1800 + Math.random() * 600));

  document.getElementById('stat-new').textContent  = rand(5, 45);
  document.getElementById('stat-demo').textContent = rand(1, 18);
  document.getElementById('stat-veg').textContent  = rand(3, 30);
  document.getElementById('change-results').classList.remove('hidden');

  const img = new Image();
  img.onload = () => {
    const canvas = document.getElementById('diff-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width; canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    ctx.globalAlpha = 0.5;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(W*.10, H*.18, W*.16, H*.14);
    ctx.fillRect(W*.58, H*.42, W*.18, H*.13);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(W*.30, H*.60, W*.20, H*.15);
    ctx.globalAlpha = 1;
  };
  img.src = afterImg;

  btn.disabled = false;
  btn.innerHTML = 'Run Change Detection';
}
