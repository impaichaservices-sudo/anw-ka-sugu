// Outils communs : connexion Supabase, gabarits HTML sûrs, prix, panier, images.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const state = { user: null, profile: null, isAdmin: false, shop: null };

export async function loadSession() {
  const { data: { session } } = await sb.auth.getSession();
  state.user = session?.user ?? null;
  if (!state.user) { Object.assign(state, { profile: null, isAdmin: false, shop: null }); return; }
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
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function setHTML(el, tpl) { el.innerHTML = tpl instanceof Raw ? tpl.s : esc(tpl); }

// ---------- Format ----------
export const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/\s/g, " ")} FCFA`;
export const fdate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
export const fdatetime = (d) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const CATEGORIES = [
  ["alimentation", "Alimentation", "🌾"], ["telephones", "Téléphones & électronique", "📱"],
  ["mode", "Mode & tissus", "👗"], ["chaussures", "Chaussures", "👟"], ["beaute", "Beauté & santé", "🧴"],
  ["maison", "Maison & cuisine", "🏠"], ["electromenager", "Électroménager", "🔌"],
  ["construction", "Construction & quincaillerie", "🧱"], ["agriculture", "Agriculture & élevage", "🚜"],
  ["auto", "Auto & moto", "🏍️"], ["autres", "Autres", "📦"],
];
export const catLabel = (k) => (CATEGORIES.find((c) => c[0] === k) || CATEGORIES.at(-1))[1];
export const catIcon = (k) => (CATEGORIES.find((c) => c[0] === k) || CATEGORIES.at(-1))[2];
export const KINDS = { fabricant: "Fabricant", grossiste: "Grossiste", detaillant: "Détaillant" };
export const CITIES = ["Bamako", "Kati", "Koulikoro", "Ségou", "Sikasso", "Kayes", "Mopti", "Koutiala", "San", "Gao", "Tombouctou", "Kidal", "Bougouni", "Kita", "Nioro du Sahel", "Autre"];
export const ORDER_STATUS = { new: "Nouvelle", confirmed: "Confirmée", shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée" };
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
  const all = [p.retail_price, ...tiersOf(p).map((t) => t.unit_price)].filter(Boolean);
  return all.length ? Math.min(...all) : null;
}
export const isWholesale = (p) => tiersOf(p).length > 0;

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
  t.className = `toast ${kind}`; t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3500);
}
export function errMsg(e) {
  const m = e?.message || e?.error_description || String(e || "Erreur");
  if (/Invalid login credentials/i.test(m)) return "Email ou mot de passe incorrect.";
  if (/User already registered/i.test(m)) return "Un compte existe déjà avec cet email.";
  if (/Email not confirmed/i.test(m)) return "Confirmez d'abord votre email (lien reçu par email).";
  if (/row-level security|permission denied/i.test(m)) return "Action non autorisée.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Pas de connexion internet. Réessayez.";
  return m;
}
export async function run(btn, fn) {
  const label = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "Patientez…"; }
  try { return await fn(); } catch (e) { toast(errMsg(e), "err"); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
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

// ---------- Images : réduites sur le téléphone avant envoi (économise les données) ----------
export async function compressImage(file, max = 1200) {
  if (!file.type.startsWith("image/")) throw new Error("Choisissez une image.");
  const img = await createImageBitmap(file);
  const r = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.82));
}
export async function uploadImage(file) {
  const blob = await compressImage(file);
  const path = `${state.user.id}/${crypto.randomUUID()}.jpg`;
  must(await sb.storage.from("catalogue").upload(path, blob, { contentType: "image/jpeg" }));
  return sb.storage.from("catalogue").getPublicUrl(path).data.publicUrl;
}
export async function uploadDocument(file) {
  if (file.size > 8 * 1024 * 1024) throw new Error("Fichier trop lourd (8 Mo maximum).");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${state.user.id}/${crypto.randomUUID()}.${ext}`;
  must(await sb.storage.from("documents").upload(path, file, { contentType: file.type || undefined }));
  return path;
}

// ---------- Petits composants ----------
export const verifiedBadge = (shop) => shop?.verified ? html`<span class="badge verified" title="Fournisseur vérifié par ANW KA SUGU">✔ Vérifié</span>` : "";
export const stars = (n) => html`<span class="stars" aria-label="${n} sur 5">${"★".repeat(Math.round(n))}${"☆".repeat(5 - Math.round(n))}</span>`;
export const empty = (msg, cta = "") => html`<div class="empty"><p>${msg}</p>${cta}</div>`;
export const loading = () => html`<div class="loading"><span class="spinner"></span> Chargement…</div>`;
export const waLink = (num, text = "") => `https://wa.me/${String(num).replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export function productCard(p) {
  const img = p.images?.[0];
  const price = fromPrice(p);
  return html`<a class="card product" href="#/produit/${p.id}">
    <div class="thumb">${img ? html`<img src="${img}" alt="" loading="lazy">` : html`<span class="ph">${catIcon(p.category)}</span>`}
      ${isWholesale(p) ? html`<span class="tag gros">Gros</span>` : ""}</div>
    <div class="body">
      <div class="name">${p.name}</div>
      <div class="price">${price ? html`${p.retail_price && !isWholesale(p) ? "" : "dès "}<b>${fcfa(price)}</b><small> / ${p.unit}</small>` : "Prix sur demande"}</div>
      ${!p.retail_price && isWholesale(p) ? html`<div class="moq">Min. ${minQty(p)} ${p.unit}</div>` : ""}
      ${p.shops ? html`<div class="shopline">${p.shops.name} ${verifiedBadge(p.shops)}</div>` : ""}
    </div></a>`;
}
