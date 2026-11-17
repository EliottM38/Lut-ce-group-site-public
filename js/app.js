
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

let vehicles = [];
let selectedCategory = "Tous";
let loadingFleet = false;

const $ = id => document.getElementById(id);

const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const statusClass = status => ({
  "Disponible": "status-disponible",
  "En prépa loc": "status-prepa",
  "Aux ateliers": "status-ateliers",
  "En location": "status-location"
}[String(status ?? "").trim()] || "");


/* NAVIGATION */

function setupNavigation() {
  const button = $("menuButton");
  const nav = $("mobileNav");

  if (!button || !nav) return;

  function closeMenu() {
    nav.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Ouvrir le menu");
    button.textContent = "☰";
  }

  function openMenu() {
    nav.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "Fermer le menu");
    button.textContent = "✕";
  }

  button.setAttribute("type", "button");
  button.setAttribute("aria-controls", "mobileNav");
  button.setAttribute("aria-expanded", "false");

  button.addEventListener("click", () => {
    if (nav.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });

  document.addEventListener("click", event => {
    if (
      nav.classList.contains("open") &&
      !nav.contains(event.target) &&
      !button.contains(event.target)
    ) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 800) closeMenu();
  });

  const currentPage = location.pathname.split("/").pop() || "index.html";

  nav.querySelectorAll("a").forEach(link => {
    const destination = link.getAttribute("href");

    if (destination === currentPage) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    } else {
      link.classList.remove("active");
      link.removeAttribute("aria-current");
    }
  });
}


/* ACCORDEONS */

function setupAccordions() {
  document.querySelectorAll(".rule-question").forEach(button => {
    button.addEventListener("click", () => {
      const item = button.closest(".rule-item");
      if (!item) return;

      const opened = item.classList.toggle("open");
      button.setAttribute("aria-expanded", String(opened));
    });
  });
}


/* LECTURE CSV */

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;

      row.push(cell);

      if (row.some(value => value.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);

  if (row.some(value => value.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}


/* CONVERSION DES DONNEES */

function convertRows(rows, category) {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map(normalize);

  function findColumn(...names) {
    for (const name of names) {
      const index = headers.indexOf(normalize(name));
      if (index !== -1) return index;
    }
    return -1;
  }

  const columns = {
    number: findColumn("Numéro de Parc Réparation prévue", "Numéro de Parc"),
    brand: findColumn("Marque"),
    model: findColumn("Modèle"),
    fuel: findColumn("Motorisation"),
    year: findColumn("M.E.S"),
    status: findColumn("Statut"),
    returnDate: findColumn("Date de retour DATE MAXIMUM ATTEINTE", "Date de retour"),
    engine: findColumn("État Moteur"),
    interior: findColumn("État Intérieur"),
    seats: findColumn("Places"),
    ventilation: findColumn("Ventilation"),
    doors: findColumn("Portes"),
    factory: findColumn("OPTIONS D'USINE"),
    saeiv: findColumn("OPTIONS SAEIV"),
    workshop: findColumn("OPTIONS ATELIER")
  };

  function getValue(row, key) {
    const index = columns[key];
    return index >= 0 ? String(row[index] ?? "").trim() : "";
  }

  return rows.slice(1).map(row => ({
    category,
    number: getValue(row, "number"),
    brand: getValue(row, "brand"),
    model: getValue(row, "model"),
    fuel: getValue(row, "fuel"),
    year: getValue(row, "year"),
    status: getValue(row, "status"),
    returnDate: getValue(row, "returnDate"),
    engine: getValue(row, "engine"),
    interior: getValue(row, "interior"),
    seats: getValue(row, "seats"),
    ventilation: getValue(row, "ventilation"),
    doors: getValue(row, "doors"),
    factory: getValue(row, "factory"),
    saeiv: getValue(row, "saeiv"),
    workshop: getValue(row, "workshop")
  })).filter(vehicle => vehicle.number || vehicle.model);
}


/* CHARGEMENT DU PARC */

async function loadFleet() {
  if (loadingFleet) return false;

  const grid = $("vehicleGrid");
  const count = $("fleetCount");
  const updated = $("fleetUpdated");

  const configured = Object.entries(SHEET.tabs)
    .filter(([, gid]) => String(gid).trim() !== "");

  if (!configured.length) {
    if (count) count.textContent = "Catalogue en attente de connexion";

    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <strong>Catalogue temporairement indisponible</strong>
          Les identifiants des onglets Google Sheets ne sont pas encore configurés.
        </div>
      `;
    }

    return false;
  }

  loadingFleet = true;
  if (count) count.textContent = "Chargement du catalogue…";

  const results = await Promise.allSettled(
    configured.map(async ([category, gid]) => {
      const url =
        `https://docs.google.com/spreadsheets/d/e/${SHEET.publishedId}/pub?output=csv&gid=${encodeURIComponent(gid)}`;

      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Erreur de chargement : ${category}`);
      }

      const text = await response.text();

      if (text.trim().startsWith("<")) {
        throw new Error(`Réponse CSV invalide pour ${category}`);
      }

      return convertRows(parseCSV(text), category);
    })
  );

  const imported = [];
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      imported.push(...result.value);
    } else {
      errors.push(configured[index][0]);
      console.error(result.reason);
    }
  });

  if (imported.length > 0) {
    vehicles = imported;
  }

  loadingFleet = false;

  if (vehicles.length > 0) {
    renderFleet();

    if (updated) {
      updated.textContent =
        "Données actualisées : " +
        new Date().toLocaleTimeString("fr-FR");
    }

    if (errors.length && count) {
      count.textContent += ` · ${errors.length} onglet(s) en erreur`;
    }

    return true;
  }

  if (count) count.textContent = "Impossible de charger le catalogue";

  if (grid) {
    grid.innerHTML = `
      <div class="empty-state">
        <strong>Aucun véhicule disponible</strong>
        Vérifie la publication du tableau et les identifiants des onglets.
      </div>
    `;
  }

  loadingFleet = false;
  return false;
}


/* AFFICHAGE DU CATALOGUE */

function renderFleet() {
  const grid = $("vehicleGrid");
  if (!grid) return;

  const search = normalize($("fleetSearch")?.value || "");
  const status = $("fleetStatus")?.value || "";

  const filtered = vehicles.filter(vehicle => {
    const categoryMatch =
      selectedCategory === "Tous" ||
      vehicle.category === selectedCategory;

    const searchText = normalize([
      vehicle.number,
      vehicle.brand,
      vehicle.model,
      vehicle.fuel,
      vehicle.status
    ].join(" "));

    return categoryMatch &&
      searchText.includes(search) &&
      (!status || vehicle.status === status);
  });

  const count = $("fleetCount");
  if (count) count.textContent = `${filtered.length} véhicule(s)`;

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <strong>Aucun véhicule à afficher</strong>
        Modifie les filtres ou la recherche pour afficher d'autres véhicules.
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(vehicle => `
    <a class="vehicle-card"
       href="vehicule.html?id=${encodeURIComponent(vehicle.number)}">

      <div class="vehicle-photo"></div>

      <div class="vehicle-content">
        <span class="vehicle-number">
          ${safe(vehicle.number)} · ${safe(vehicle.category)}
        </span>

        <h3>${safe(vehicle.model || "Modèle non renseigné")}</h3>

        <div class="vehicle-brand">${safe(vehicle.brand)}</div>

        <div class="vehicle-bottom">
          <span class="status ${statusClass(vehicle.status)}">
            ${safe(vehicle.status || "Statut inconnu")}
          </span>
          <span>VOIR LA FICHE ↗</span>
        </div>
      </div>
    </a>
  `).join("");
}


/* FILTRES */

function setupFleet() {
  document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category || "Tous";

      document.querySelectorAll("[data-category]").forEach(item => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });

      renderFleet();
    });
  });

  $("fleetSearch")?.addEventListener("input", renderFleet);
  $("fleetStatus")?.addEventListener("change", renderFleet);

  loadFleet();

  window.setInterval(() => {
    loadFleet();
  }, 5 * 60 * 1000);
}


/* FICHE VEHICULE */

async function loadVehicleDetail() {
  const target = $("vehicleDetail");
  if (!target) return;

  const id = new URLSearchParams(location.search).get("id");

  if (!id) {
    target.innerHTML = `
      <div class="empty-state">
        <strong>Véhicule non spécifié</strong>
        Retourne au catalogue pour choisir un véhicule.
        <p><a href="parc.html" class="feature-link">RETOURNER AU PARC ↗</a></p>
      </div>
    `;
    return;
  }

  target.innerHTML = `
    <div class="empty-state">
      <strong>Chargement de la fiche…</strong>
      Récupération des informations du véhicule.
    </div>
  `;

  const success = await loadFleet();

  if (!success) {
    target.innerHTML = `
      <div class="empty-state">
        <strong>Catalogue indisponible</strong>
        Impossible de récupérer les informations du véhicule.
        <p><a href="parc.html" class="feature-link">RETOURNER AU PARC ↗</a></p>
      </div>
    `;
    return;
  }

  const vehicle = vehicles.find(item => item.number === id);

  if (!vehicle) {
    target.innerHTML = `
      <div class="empty-state">
        <strong>Fiche non disponible</strong>
        Ce véhicule n'a pas été trouvé dans les données connectées.
        <p><a href="parc.html" class="feature-link">RETOURNER AU PARC ↗</a></p>
      </div>
    `;
    return;
  }

  const fields = [
    ["Numéro de parc", vehicle.number],
    ["Catégorie", vehicle.category],
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
        <div class="eyebrow">
          ${safe(vehicle.category)} · ${safe(vehicle.number)}
        </div>

        <h1 class="detail-title">${safe(vehicle.model)}</h1>
        <div class="detail-brand">${safe(vehicle.brand)}</div>

        <p style="margin-top:20px">
          <span class="status ${statusClass(vehicle.status)}">
            ${safe(vehicle.status)}
          </span>
        </p>

        <div class="detail-table">
          ${fields.map(([label, value]) => `
            <div class="detail-cell">
              <span>${safe(label)}</span>
              <strong>${safe(value || "—")}</strong>
            </div>
          `).join("")}
        </div>

        <a href="locations.html" class="button button-dark">
          DEMANDER UNE LOCATION ↗
        </a>
      </div>
    </div>
  `;
}


/* INITIALISATION */

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupAccordions();

  if ($("vehicleGrid")) {
    setupFleet();
  }

  if ($("vehicleDetail")) {
    loadVehicleDetail();
  }
});
