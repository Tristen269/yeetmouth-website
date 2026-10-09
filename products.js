// products.js
// Reads the published Google Sheet (CSV) and renders product cards.
// Security rules enforced here:
//   1. Only rows marked active = TRUE are shown.
//   2. affiliate_url must be https and on amzn.to or www.amazon.com.
//   3. All sheet text is inserted with textContent (never innerHTML).
//   4. Images load only from the local /images/ folder, with a strict filename check.

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQPB8gZjGAWBz1dwvkJt3HLa59JrQNeVriPd3ghcXL_lmh1zMlcG1D2dYnDCt8U1yepo--RX0m0siO8/pub?gid=1166172370&single=true&output=csv";

const ALLOWED_HOSTS = ["amzn.to", "www.amazon.com"];
const IMAGE_FOLDER = "/images/";
const IMAGE_NAME_PATTERN = /^[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/i;

// ---------- CSV parsing (handles quoted fields with commas) ----------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'; // escaped quote
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Turn rows into objects using the header row as keys
function rowsToObjects(rows) {
  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((cell) => cell.trim() !== ""))
    .map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (r[i] || "").trim();
      });
      return obj;
    });
}

// ---------- Validation ----------
function isSafeAffiliateUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.includes(url.hostname);
  } catch {
    return false; // not a valid URL at all
  }
}

function isSafeImageName(name) {
  return IMAGE_NAME_PATTERN.test(name);
}

// ---------- Rendering ----------
function buildCard(product) {
  const card = document.createElement("article");
  card.className = "item-card";

  const photo = document.createElement("div");
  photo.className = "item-photo";
  if (product.image_file && isSafeImageName(product.image_file)) {
    const img = document.createElement("img");
    img.src = IMAGE_FOLDER + product.image_file;
    img.alt = product.title;
    photo.appendChild(img);
  } else {
    photo.textContent = "Photo goes here";
  }

  const body = document.createElement("div");
  body.className = "item-body";

  const title = document.createElement("h3");
  title.textContent = product.title;

  const desc = document.createElement("p");
  desc.textContent = product.description;

  const link = document.createElement("a");
  link.href = product.affiliate_url;
  link.rel = "sponsored noopener";
  link.target = "_blank";
  link.textContent = "View on Amazon";

  body.append(title, desc, link);
  card.append(photo, body);
  return card;
}

function showMessage(container, message) {
  const p = document.createElement("p");
  p.textContent = message;
  container.replaceChildren(p);
}

// ---------- Main ----------
async function loadProducts() {
  const container = document.getElementById("product-list");
  if (!container) return;

  const categoryId = container.dataset.category;

  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error("Request failed: " + response.status);

    const products = rowsToObjects(parseCSV(await response.text()))
      .filter((p) => p.active.toUpperCase() === "TRUE")
      .filter((p) => p.category_id === categoryId)
      .filter((p) => {
        const ok = isSafeAffiliateUrl(p.affiliate_url);
        if (!ok) console.warn("Skipped product with unsafe link:", p.product_id);
        return ok;
      })
      .sort((a, b) => b.date_added.localeCompare(a.date_added)); // newest first

    if (products.length === 0) {
      showMessage(container, "No products yet. Check back soon!");
      return;
    }

    container.replaceChildren(...products.map(buildCard));
  } catch (err) {
    console.error(err);
    showMessage(container, "Couldn't load products right now.");
  }
}

loadProducts();