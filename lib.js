// Outils communs : Supabase, gabarits HTML sûrs, prix, panier, images, téléphone.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, PHONE_LOGIN_DOMAIN } from "./config.js";
import { icon } from "./icons.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const state = { user: null, profile: null, isAdmin: false, shop: null, unread: 0 };

export async function loadSession() {
  const { data: { session } } = await sb.auth.getSession();
  state.user = session?.user ?? null;
  if (!state.user) { Object.assign(state, { profile: null, isAdmin: false, shop: null, unread: 0 }); return; }
  const [p, r, s] = await Promise.all([
    sb.from("profiles").select("*").eq("id", state.user.id).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", state.user.id),
    sb.from("shops").select("*").eq("owner_id", state.user.id).maybeSingle(),
  ]);
  state.profile = p.data;
  state.isAdmin = (r.data || []).some((x) => x.role === "admin");
  state.shop = s.data;
}

// ---------- Gabarits HTML : tout texte inséré est échappé (protection XSS) ----------
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const renderVal = (v) => v == null || v === false ? "" : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(renderVal).join("") : esc(v);
export function html(strings, ...vals) {
  let out = "";
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += renderVal(vals[i]); });
  return new Raw(out);
}
export const ic = (name, size, cls) => raw(icon(name, size, cls));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function setHTML(el, tpl) { if (el) el.innerHTML = tpl instanceof Raw ? tpl.s : esc(tpl); }

// ---------- Format ----------
export const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/\s/g, " ")} FCFA`;
export const fdate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
export const fdatetime = (d) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const CATEGORIES = [
  ["alimentation", "Alimentation"], ["telephones", "Téléphones & électronique"], ["mode", "Mode & tissus"],
  ["chaussures", "Chaussures"], ["beaute", "Beauté & santé"], ["maison", "Maison & cuisine"],
  ["electromenager", "Électroménager"], ["construction", "Construction & quincaillerie"],
  ["agriculture", "Agriculture & élevage"], ["auto", "Auto & moto"], ["autres", "Autres"],
];
export const catLabel = (k) => (CATEGORIES.find((c) => c[0] === k) || CATEGORIES.at(-1))[1];
export const KINDS = { fabricant: "Fabricant", grossiste: "Grossiste", detaillant: "Détaillant" };
export const CITIES = ["Bamako", "Kati", "Koulikoro", "Ségou", "Sikasso", "Kayes", "Mopti", "Koutiala", "San", "Gao", "Tombouctou", "Kidal", "Bougouni", "Kita", "Nioro du Sahel", "Djidian", "Autre"];
export const ORDER_STATUS = {
  new: "Commande reçue", confirmed: "Confirmée", preparing: "En préparation", shipped: "En livraison",
  delivered: "Livrée", completed: "Terminée", cancelled: "Annulée",
};
export const ORDER_STEPS = ["new", "confirmed", "preparing", "shipped", "delivered", "completed"];
export const SHOP_STATUS = { pending: "En attente de validation", approved: "Validée", rejected: "Refusée", suspended: "Suspendue" };
export const PAYOUT = {
  none: "Paiement à la livraison", held: "Argent gardé par ANW KA SUGU", to_release: "À verser au vendeur",
  released: "Versé au vendeur", to_refund: "À rembourser au client", refunded: "Remboursé",
};

// ---------- Prix selon la quantité ----------
export function tiersOf(p) { return [...(p.price_tiers || [])].sort((a, b) => a.min_qty - b.min_qty); }
export function minQty(p) { return p.retail_price ? 1 : (tiersOf(p)[0]?.min_qty ?? 1); }
export function unitPrice(p, qty) {
  const t = tiersOf(p).filter((x) => x.min_qty <= qty).at(-1);
  return t ? t.unit_price : (p.retail_price ?? null);
}
export function fromPrice(p) {
  if (p.min_price) return p.min_price;
  const all = [p.retail_price, ...tiersOf(p).map((t) => t.unit_price)].filter(Boolean);
  return all.length ? Math.min(...all) : null;
}
export const isWholesale = (p) => tiersOf(p).length > 0;

// ---------- Téléphone (Mali) : le numéro sert d'identifiant ----------
/** « +223 70 12 34 56 » → « 70123456 » ; null si invalide. */
export function normalizePhone(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.startsWith("00223")) d = d.slice(5); else if (d.startsWith("223") && d.length === 11) d = d.slice(3);
  return /^[2-9]\d{7}$/.test(d) ? d : null;
}
export const phoneLogin = (num) => `223${num}@${PHONE_LOGIN_DOMAIN || "tel.anwkasugu.app"}`;
export const fphone = (v) => { const d = normalizePhone(v); return d ? d.replace(/(\d{2})(?=\d)/g, "$1 ") : v || ""; };

// ---------- Panier (stocké sur le téléphone) ----------
const CART_KEY = "anw_panier";
export function getCart() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch { return {}; } }
export function saveCart(c) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch { /* stockage indisponible */ }
  document.dispatchEvent(new CustomEvent("cart"));
}
export function addToCart(id, qty) { const c = getCart(); c[id] = (c[id] || 0) + qty; saveCart(c); }
export const cartCount = () => Object.keys(getCart()).length;

// ---------- Messages ----------
export function toast(msg, kind = "ok") {
  const t = document.createElement("div");
  t.className = `toast ${kind}`; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3500);
}
export function errMsg(e) {
  const m = e?.message || e?.error_description || String(e || "Erreur");
  if (/Invalid login credentials/i.test(m)) return "Numéro (ou email) ou mot de passe incorrect.";
  if (/User already registered|already been registered/i.test(m)) return "Un compte existe déjà avec ce numéro.";
  if (/Email not confirmed/i.test(m)) return "Compte pas encore confirmé.";
  if (/signups.*disabled/i.test(m)) return "Les inscriptions sont fermées pour le moment.";
  if (/email.*invalid|invalid.*email/i.test(m)) return "Inscription par numéro impossible : vérifiez PHONE_LOGIN_DOMAIN dans config.js (voir le guide).";
  if (/row-level security|permission denied/i.test(m)) return "Action non autorisée.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Pas de connexion internet. Réessayez.";
  return m;
}
export async function run(btn, fn) {
  const label = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.textContent = "Patientez…"; }
  try { return await fn(); } catch (e) { toast(errMsg(e), "err"); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
}
export const must = ({ data, error }) => { if (error) throw error; return data; };

// ---------- Navigation ----------
export const go = (path) => { location.hash = `#${path}`; };
export function requireLogin() {
  if (state.user) return true;
  go(`/connexion?retour=${encodeURIComponent(location.hash.slice(1) || "/")}`);
  return false;
}
export function query() {
  const h = location.hash.slice(1); const i = h.indexOf("?");
  return Object.fromEntries(new URLSearchParams(i >= 0 ? h.slice(i + 1) : ""));
}

// ---------- Photos : réduites sur le téléphone + miniature (chargement rapide) ----------
async function toBitmap(src) {
  if (src instanceof Blob) return await createImageBitmap(src);
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = src;
  await img.decode(); return img;
}
function draw(img, max, square) {
  const w = img.width, h = img.height;
  const side = Math.min(w, h);
  const sx = square ? (w - side) / 2 : 0, sy = square ? (h - side) / 2 : 0, sw = square ? side : w, sh = square ? side : h;
  const r = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement("canvas"); c.width = Math.round(sw * r); c.height = Math.round(sh * r);
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.8));
}
/** Envoie une photo (fichier ou adresse) : version 1200 px + miniature 400 px. square = recadrage carré. */
export async function uploadImage(src, { square = false } = {}) {
  if (src instanceof Blob && !src.type.startsWith("image/")) throw new Error("Choisissez une photo.");
  const img = await toBitmap(src);
  const [full, thumb] = await Promise.all([draw(img, 1200, square), draw(img, 400, true)]);
  const base = `${state.user.id}/${crypto.randomUUID()}`;
  must(await sb.storage.from("catalogue").upload(`${base}.jpg`, full, { contentType: "image/jpeg", cacheControl: "31536000" }));
  await sb.storage.from("catalogue").upload(`${base}_t.jpg`, thumb, { contentType: "image/jpeg", cacheControl: "31536000" });
  return sb.storage.from("catalogue").getPublicUrl(`${base}.jpg`).data.publicUrl;
}
export const thumbUrl = (u) => (u && /\/catalogue\/.+\.jpg$/.test(u) && !u.endsWith("_t.jpg") ? u.replace(/\.jpg$/, "_t.jpg") : u);
export async function uploadDocument(file) {
  if (file.size > 8 * 1024 * 1024) throw new Error("Fichier trop lourd (8 Mo maximum).");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${state.user.id}/${crypto.randomUUID()}.${ext}`;
  must(await sb.storage.from("documents").upload(path, file, { contentType: file.type || undefined }));
  return path;
}

// ---------- Petits composants ----------
export const verifiedBadge = (shop) => shop?.verified ? html`<span class="verified" title="Fournisseur vérifié par ANW KA SUGU">${ic("verified", 15)}<span>Vérifié</span></span>` : "";
export const stars = (n) => { const k = Math.round(Number(n) || 0); return html`<span class="stars" aria-label="${k} sur 5">${[1, 2, 3, 4, 5].map((i) => ic("star", 14, i <= k ? "on" : "off"))}</span>`; };
export const empty = (msg, cta = "") => html`<div class="empty"><p>${msg}</p>${cta}</div>`;
export const loading = () => html`<div class="loading"><span class="spinner"></span> Chargement…</div>`;
export const waLink = (num, text = "") => { let d = String(num).replace(/\D/g, ""); if (d.length === 8) d = `223${d}`; return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`; };
export const photo = (url, alt = "", cls = "") => url
  ? html`<img class="${cls}" src="${thumbUrl(url)}" data-full="${url}" alt="${alt}" loading="lazy" decoding="async">`
  : html`<span class="nophoto ${cls}">${ic("image", 28)}<small>Pas de photo</small></span>`;
export const statusBadge = (s) => html`<span class="st st-${s}">${ORDER_STATUS[s] || s}</span>`;

export function productCard(p) {
  const price = fromPrice(p); const s = p.shops;
  return html`<a class="pcard" href="#/produit/${p.id}">
    <div class="pimg">${photo(p.images?.[0], p.name)}${isWholesale(p) ? html`<span class="tag">Gros</span>` : ""}</div>
    <div class="pbody">
      <div class="pname">${p.name}</div>
      <div class="pprice">${price ? html`${!p.retail_price || isWholesale(p) ? html`<small>dès </small>` : ""}${fcfa(price)}` : "Prix sur demande"}</div>
      ${!p.retail_price && isWholesale(p) ? html`<div class="pmoq">Min. ${minQty(p)} ${p.unit}</div>` : ""}
      ${s ? html`<div class="pshop"><span class="ell">${s.name}</span>${s.verified ? ic("verified", 13, "vbadge") : ""}</div>` : ""}
      ${p.city || s?.city ? html`<div class="pcity">${ic("pin", 12)}${p.city || s.city}</div>` : ""}
    </div></a>`;
}
export const PRODUCT_COLS = "id,name,images,retail_price,min_price,unit,city,category,stock,created_at,shop_id,price_tiers(min_qty,unit_price),shops!inner(id,name,city,verified,status)";
