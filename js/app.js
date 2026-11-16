
const SHEET = {
  publishedId: "2PACX-1vROu3RCHzL0ghXoz3KjdrsetZRBv_Purve375qpNmYrPw3dYCeUIClozbvsG6uKtVp9CtiYVcCghUpo",
  tabs: {
    "Mini": "",
    "Midi": "",
    "Standards": "",
    "Articulés": "",
    "BHNS": "",
    "Cars & LE": ""
  }
};

const categories = Object.keys(SHEET.tabs);
let vehicles = [];
let selectedCategory = "Tous";

const $ = id => document.getElementById(id);

const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[char]));

const statusClass = status => ({
  "Disponible":"status-disponible",
  "En prépa loc":"status-prepa",
  "Aux ateliers":"status-ateliers",
  "En location":"status-location"
}[status] || "");

function setupNavigation() {
  const button = $("menuButton");
  const nav = $("mobileNav");
  if (!button || !nav) return;
  button.addEventListener("click", () => nav.classList.toggle("open"));
  nav.querySelectorAll("a").forEach(link =>
    link.addEventListener("click", () => nav.classList.remove("open"))
  );
}

function setupAccordions() {
  document.querySelectorAll(".rule-question").forEach(button => {
    button.addEventListener("click", () => {
      button.closest(".rule-item").classList.toggle("open");
    });
  });
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && quoted && text[i + 1] === '"') {
      cell += '"'; i++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell); cell = "";
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = []; cell = "";
    } else {
      cell += c;
    }
  }

  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function convertRows(rows, category) {
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalize);
  const index = (...names) => {
    for (const name of names) {
      const found = headers.indexOf(normalize(name));
      if (found !== -1) return found;
    }
    return -1;
  };

  const cols = {
    number: index("Numéro de Parc Réparation prévue", "Numéro de Parc"),
    brand: index("Marque"),
    model: index("Modèle"),
    fuel: index("Motorisation"),
    year: index("M.E.S"),
    status: index("Statut"),
    returnDate: index("Date de retour DATE MAXIMUM ATTEINTE", "Date de retour"),
    engine: index("État Moteur"),
    interior: index("État Intérieur"),
    seats: index("Places"),
    ventilation: index("Ventilation"),
    doors: index("Portes"),
    factory: index("OPTIONS D'USINE"),
    saeiv: index("OPTIONS SAEIV"),
    workshop: index("OPTIONS ATELIER")
  };

  const get = (row, key) => cols[key] >= 0 ? (row[cols[key]] || "").trim() : "";

  return rows.slice(1).map(row => ({
    category,
    number: get(row, "number"),
    brand: get(row, "brand"),
    model: get(row, "model"),
    fuel: get(row, "fuel"),
    year: get(row, "year"),
    status: get(row, "status"),
    returnDate: get(row, "returnDate"),
    engine: get(row, "engine"),
    interior: get(row, "interior"),
    seats: get(row, "seats"),
    ventilation: get(row, "ventilation"),
    doors: get(row, "doors"),
    factory: get(row, "factory"),
    saeiv: get(row, "saeiv"),
    workshop: get(row, "workshop")
  })).filter(vehicle => vehicle.number || vehicle.model);
}

async function loadFleet() {
  const configured = Object.entries(SHEET.tabs).filter(([, gid]) => gid);

  if (!configured.length) {
    const count = $("fleetCount");
    if (count) count.textContent = "Catalogue en attente de connexion";
    return;
  }

  try {
    const imported = await Promise.all(configured.map(async ([category, gid]) => {
      const url = `https://docs.google.com/spreadsheets/d/e/${SHEET.publishedId}/pub?output=csv&gid=${encodeURIComponent(gid)}`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Erreur onglet ${category}`);
      return convertRows(parseCSV(await response.text()), category);
    }));

    vehicles = imported.flat();
    renderFleet();
    const updated = $("fleetUpdated");
    if (updated) updated.textContent = "Données actualisées : " + new Date().toLocaleTimeString("fr-FR");
  } catch (error) {
    console.error(error);
    const count = $("fleetCount");
    if (count) count.textContent = "Impossible de charger le catalogue";
  }
}

function renderFleet() {
  const grid = $("vehicleGrid");
  if (!grid) return;

  const search = ($("fleetSearch")?.value || "").toLowerCase();
  const status = $("fleetStatus")?.value || "";

  const filtered = vehicles.filter(vehicle => {
    const categoryMatch = selectedCategory === "Tous" || vehicle.category === selectedCategory;
    const searchText = [vehicle.number, vehicle.brand, vehicle.model, vehicle.fuel].join(" ").toLowerCase();
    return categoryMatch && searchText.includes(search) && (!status || vehicle.status === status);
  });

  const count = $("fleetCount");
  if (count) count.textContent = `${filtered.length} véhicule(s)`;

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><strong>Aucun véhicule à afficher</strong>Vérifie les filtres ou la connexion aux données du parc.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(vehicle => `
    <a class="vehicle-card" href="vehicule.html?id=${encodeURIComponent(vehicle.number)}">
      <div class="vehicle-photo"></div>
      <div class="vehicle-content">
        <span class="vehicle-number">${safe(vehicle.number)} · ${safe(vehicle.category)}</span>
        <h3>${safe(vehicle.model)}</h3>
        <div class="vehicle-brand">${safe(vehicle.brand)}</div>
        <div class="vehicle-bottom">
          <span class="status ${statusClass(vehicle.status)}">${safe(vehicle.status)}</span>
          <span>VOIR LA FICHE ↗</span>
        </div>
      </div>
    </a>
  `).join("");
}

function setupFleet() {
  document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;
      document.querySelectorAll("[data-category]").forEach(item =>
        item.classList.toggle("active", item === button)
      );
      renderFleet();
    });
  });

  $("fleetSearch")?.addEventListener("input", renderFleet);
  $("fleetStatus")?.addEventListener("change", renderFleet);

  loadFleet();
  setInterval(loadFleet, 5 * 60 * 1000);
}

async function loadVehicleDetail() {
  const target = $("vehicleDetail");
  if (!target) return;

  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    target.innerHTML = `<div class="empty-state"><strong>Véhicule non spécifié</strong>Retourne au catalogue pour choisir un véhicule.</div>`;
    return;
  }

  await loadFleet();
  const vehicle = vehicles.find(item => item.number === id);

  if (!vehicle) {
    target.innerHTML = `<div class="empty-state"><strong>Fiche non disponible</strong>Ce véhicule n'a pas été trouvé dans les données actuellement connectées.</div>`;
    return;
  }

  const fields = [
    ["Numéro de parc", vehicle.number],
    ["Motorisation", vehicle.fuel],
    ["Mise en service", vehicle.year],
    ["Date de retour", vehicle.returnDate],
    ["État moteur", vehicle.engine],
    ["État intérieur", vehicle.interior],
    ["Places", vehicle.seats],
    ["Ventilation", vehicle.ventilation],
    ["Portes", vehicle.doors],
    ["Options d'usine", vehicle.factory],
    ["Options SAEIV", vehicle.saeiv],
    ["Options atelier", vehicle.workshop]
  ];

  target.innerHTML = `
    <div class="vehicle-detail">
      <div class="vehicle-detail-image"></div>
      <div>
        <div class="eyebrow">${safe(vehicle.category)} · ${safe(vehicle.number)}</div>
        <h1 class="detail-title">${safe(vehicle.model)}</h1>
        <div class="detail-brand">${safe(vehicle.brand)}</div>
        <p style="margin-top:20px"><span class="status ${statusClass(vehicle.status)}">${safe(vehicle.status)}</span></p>
        <div class="detail-table">
          ${fields.map(([label, value]) => `
            <div class="detail-cell">
              <span>${safe(label)}</span>
              <strong>${safe(value || "—")}</strong>
            </div>`).join("")}
        </div>
        <a href="location.html" class="button button-dark">DEMANDER UNE LOCATION ↗</a>
      </div>
    </div>
  `;
}

setupNavigation();
setupAccordions();
if ($("vehicleGrid")) setupFleet();
if ($("vehicleDetail")) loadVehicleDetail();
