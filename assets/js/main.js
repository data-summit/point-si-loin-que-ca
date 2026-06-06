/* ══════════════════════════════════════════════════════════════
   NAVIGATION SPA
══════════════════════════════════════════════════════════════ */
const DATASET_CONFIG = {
  infrastructures: {
    file:  'data/picks_top.json',
    label: 'Top métropolitain — toute infra',
    infraLabel: 'de toute infrastructure',
  },
  batiments: {
    file:  'data/picks_top_buildings.json',
    label: 'Top 30 — bâtiments uniquement',
    infraLabel: 'de tout bâtiment',
  },
};

let currentDataset = 'top';

function showPage(id, dataset) {
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === 'page-' + id));
  document.querySelectorAll('#nav-links a[data-page]').forEach(a => {
    const isActive = a.dataset.page === id &&
      (!a.dataset.dataset || a.dataset.dataset === (dataset || currentDataset));
    a.closest('li')?.classList.toggle('active', isActive);
  });
  document.body.style.overflow = id === 'carte' ? 'hidden' : 'auto';

  if (id === 'carte') {
    const ds = dataset || 'top';
    if (!window._mapReady) {
      initMap(ds);
    } else if (ds !== currentDataset) {
      loadDataset(ds);
    }
  }

  if (window.goatcounter && window.goatcounter.count) {
  window.goatcounter.count({
    path: '/point-si-loin-que-ca/' + id + (dataset ? '/' + dataset : ''),
    title: id
});
  }
  
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#nav-links a[data-page]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const ds = a.dataset.dataset || null;
      showPage(a.dataset.page, ds);
      const hash = a.dataset.page + (ds ? '/' + ds : '');
      history.pushState({}, '', '#' + hash);
    });
  });
  window.addEventListener('popstate', routeFromHash);
  routeFromHash();
});

function routeFromHash() {
  const raw = location.hash.replace('#', '') || 'accueil';
  const [page, ds] = raw.split('/');
  showPage(page, ds || null);
}

function toggleSidebar() {
  const layout = document.getElementById('map-layout');
  const btn    = document.getElementById('sidebar-toggle');
  const hidden = layout.classList.toggle('sidebar-hidden');
  if (btn) btn.textContent = hidden ? '▶' : '◀';
  // Invalidate map size so tiles fill the new width
  if (map) setTimeout(() => map.invalidateSize(), 200);
}

/* ══════════════════════════════════════════════════════════════
   CARTE LEAFLET
══════════════════════════════════════════════════════════════ */
const TILE_LIGHT = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR_OSM   = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const INFRA_COLORS = ["#f472b6", "#fb923c", "#facc15", "#34d399", "#818cf8",
    "#38bdf8", "#a3e635", "#e879f9", "#f97316", "#2dd4bf"];
const ZONE_COLORS  = [
  "#ffd700","#c0c0c0","#cd7f32","#60a5fa","#4ade80",
  "#f87171","#a78bfa","#fb923c","#34d399","#f472b6",
  "#facc15","#818cf8","#38bdf8","#86efac","#fca5a5",
  "#fcd34d","#6ee7b7","#c4b5fd","#7dd3fc","#fda4af",
  "#d9f99d","#fbcfe8","#bfdbfe","#a7f3d0","#fed7aa",
  "#e9d5ff","#99f6e4","#fef08a","#bae6fd","#f5d0fe",
];

let map, tileLayer, mainMarkers = [], activeLayers = [];

async function initMap(dataset) {
  window._mapReady = true;
  currentDataset = dataset || 'top';

  map = L.map('map', { zoomControl: true });
  tileLayer = L.tileLayer(TILE_LIGHT, {
    maxZoom: 19,
    attribution: ATTR_OSM,
  }).addTo(map);
  // Dézoomer sur la France métropolitaine par défaut
  await loadDataset(currentDataset);
}


async function loadDataset(dataset) {
  currentDataset = dataset;
  const cfg = DATASET_CONFIG[dataset];

  // Clear existing markers and layers
  activeLayers.forEach(l => map.removeLayer(l));
  activeLayers = [];
  mainMarkers.forEach(({ marker, labelMarker }) => {
    map.removeLayer(marker);
    map.removeLayer(labelMarker);
  });
  mainMarkers = [];
  document.getElementById('zone-list').innerHTML = '';
  document.getElementById('info-panel').classList.remove('visible');
  document.getElementById('best-dist').textContent = '';
  document.getElementById('sidebar-title').textContent = cfg.label;

  // Close any open popup
  map.closePopup();

  const res   = await fetch(cfg.file);
  const picks = await res.json();
  picks.sort((a, b) => b.dist_km - a.dist_km);

  if (picks.length) {
    document.getElementById('best-dist').textContent =
      `Meilleur : ${picks[0].dist_km.toFixed(3)} km`;
}

  const zoneList = document.getElementById('zone-list');

  picks.forEach((pick, i) => {
    const color = ZONE_COLORS[i % ZONE_COLORS.length];

    const item = document.createElement('div');
    item.className = 'zone-item' + (i === 0 ? ' active' : '');
    item.innerHTML = `
      <div class="zone-num" style="border-color:${color};color:${color}">${i+1}</div>
      <div class="zone-info">
        <div class="zone-dist">${pick.dist_km.toFixed(3)} km</div>
        <div class="zone-coord">${pick.lat.toFixed(5)}, ${pick.lon.toFixed(5)}</div>
      </div>
    `;
    item.addEventListener('click', () => selectZone(i));
    zoneList.appendChild(item);

    const marker = L.circleMarker([pick.lat, pick.lon], {
      radius: i === 0 ? 13 : 9,
      color: 'rgba(0,0,0,0.3)', weight: i === 0 ? 2 : 1,
      fillColor: color, fillOpacity: 0.92,
      zIndexOffset: 1000 - i,
    }).addTo(map);

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        background:${color};color:#fff;border-radius:50%;
        width:${i===0?22:16}px;height:${i===0?22:16}px;
        display:flex;align-items:center;justify-content:center;
        font-family:Arial,sans-serif;
        font-size:${i===0?11:9}px;font-weight:bold;
        border:2px solid rgba(255,255,255,0.8);
        box-shadow:0 2px 8px rgba(0,0,0,0.35);">${i+1}</div>`,
      iconSize:   [i===0?22:16, i===0?22:16],
      iconAnchor: [i===0?11:8,  i===0?11:8],
    });
    const labelMarker = L.marker([pick.lat, pick.lon], { icon, interactive: false }).addTo(map);

    marker.on('click', () => selectZone(i));
    marker.bindTooltip(`Zone ${i+1} — ${pick.dist_km.toFixed(3)} km`, { direction: 'top' });
    mainMarkers.push({ marker, labelMarker, pick, color });
  });

  if (picks.length) {
    map.setView([46.5, 2.5], 5);  // France entière, aucun point sélectionné
  }
}

function selectZone(i) {
  activeLayers.forEach(l => map.removeLayer(l));
  activeLayers = [];

  document.querySelectorAll('.zone-item').forEach((el, j) =>
    el.classList.toggle('active', j === i));
  document.querySelectorAll('.zone-item')[i]?.scrollIntoView({ block: 'nearest' });

  const pick  = mainMarkers[i].pick;
  const color = mainMarkers[i].color;
  const cfg   = DATASET_CONFIG[currentDataset];

  map.setView([pick.lat, pick.lon], 13, { animate: true });

  const isolCircle = L.circle([pick.lat, pick.lon], {
    radius: pick.dist_km * 1000,
    color, weight: 1.5,
    fillColor: color, fillOpacity: 0.06,
    dashArray: '8 5',
  }).addTo(map);
  activeLayers.push(isolCircle);

  const lines = [], circles = [], markers = [];

  (pick.infras || []).slice(0, 10).forEach((inf, k) => {
    const col = INFRA_COLORS[k % INFRA_COLORS.length];

    lines.push(L.polyline([[pick.lat, pick.lon],[inf.lat, inf.lon]], {
      color: col, weight: 1.5, dashArray: '5 4', opacity: 0.85,
    }));

    circles.push(L.circle([inf.lat, inf.lon], {
      radius: inf.dist_km * 1000,
      color: col, weight: 1,
      fillColor: col, fillOpacity: 0.04, dashArray: '4 4',
    }));

    const infMarker = L.circleMarker([inf.lat, inf.lon], {
      radius: k === 0 ? 8 : 6,
      color: 'rgba(0,0,0,0.3)', weight: 1.5,
      fillColor: col, fillOpacity: 0.95,
    });
    infMarker.bindTooltip(
      `Tag : ${inf.osm_tag} - Type : ${inf.osm_val} — ${inf.dist_km.toFixed(3)} km`,
      { direction: 'top' }
    );
    markers.push(infMarker);
  });

  [...lines, ...circles, ...markers].forEach(l => {
    l.addTo(map);
    activeLayers.push(l);
  });

  const infraHtml = (pick.infras || []).slice(0, 10).map((inf, k) => `
    <div class="popup-infra-row">
      <div class="popup-dot" style="background:${INFRA_COLORS[k % INFRA_COLORS.length]}"></div>
      <span class="popup-inf-name">${inf.osm_tag}: ${inf.osm_val}</span>
      <span class="popup-inf-dist" style="color:${INFRA_COLORS[k % INFRA_COLORS.length]}">${inf.dist_km.toFixed(3)} km</span>
      <span class="popup-inf-coord">${inf.lat.toFixed(5)}, ${inf.lon.toFixed(5)}</span>
    </div>
  `).join('');

  mainMarkers[i].marker.bindPopup(`
    <div class="popup-title">Zone ${i+1} — rang ${pick.rank_in_zone}</div>
    <div class="popup-dist" style="color:${color}">${pick.dist_km.toFixed(3)} km ${cfg.infraLabel}</div>
    <div class="popup-coords">${pick.lat.toFixed(6)}, ${pick.lon.toFixed(6)}</div>
    ${infraHtml}
  `).openOn(map);

  document.getElementById('info-panel').classList.add('visible');
  document.getElementById('info-zone-title').textContent = `Zone ${i+1} — ${pick.dist_km.toFixed(3)} km`;
  document.getElementById('infra-rows').innerHTML =
    (pick.infras || []).slice(0, 10).map((inf, k) => `
      <div class="infra-row">
        <div class="infra-dot" style="background:${INFRA_COLORS[k % INFRA_COLORS.length]}"></div>
        <span class="infra-name">${inf.osm_tag}: ${inf.osm_val}</span>
        <span class="infra-dist" style="color:${INFRA_COLORS[k % INFRA_COLORS.length]}">${inf.dist_km.toFixed(3)} km</span>
        <span class="infra-coord">${inf.lat.toFixed(5)}, ${inf.lon.toFixed(5)}</span>
      </div>
    `).join('');

  const osmUrl = `https://www.openstreetmap.org/?mlat=${pick.lat.toFixed(6)}&mlon=${pick.lon.toFixed(6)}#map=14/${pick.lat.toFixed(6)}/${pick.lon.toFixed(6)}`;
  document.getElementById('osm-link').href = osmUrl;
}