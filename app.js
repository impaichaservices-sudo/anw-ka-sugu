// Point d'entrée : navigation entre les pages et en-tête.
import { sb, state, loadSession, html, setHTML, $, cartCount, empty, go } from "./lib.js";
import { SUPABASE_URL } from "./config.js";
import { home, catalogue, product, shops, shop, cart } from "./shop.js";
import { login, account, orders, order, messages, thread } from "./account.js";
import { rfqList, rfqNew, rfqDetail } from "./rfq.js";
import { seller, productForm } from "./seller.js";
import { admin } from "./admin.js";

const routes = [
  [/^\/$/, home], [/^\/catalogue$/, catalogue], [/^\/produit\/([\w-]+)$/, product],
  [/^\/boutiques$/, shops], [/^\/boutique\/([\w-]+)$/, shop], [/^\/panier$/, cart],
  [/^\/connexion$/, login], [/^\/compte$/, account], [/^\/commandes$/, orders], [/^\/commande\/([\w-]+)$/, order],
  [/^\/messages$/, messages], [/^\/messages\/([\w-]+)$/, thread],
  [/^\/devis$/, rfqList], [/^\/devis\/nouveau$/, rfqNew], [/^\/devis\/([\w-]+)$/, rfqDetail],
  [/^\/vendeur$/, seller], [/^\/vendeur\/produit\/([\w-]+)$/, productForm], [/^\/admin$/, admin],
];

function header() {
  const n = cartCount();
  setHTML($("#top"), html`<div class="bar">
    <a class="brand" href="#/" aria-label="ANW KA SUGU, accueil"><img src="icon-192.png" alt="" width="40" height="40"><span>ANW KA <em>SUGU</em></span></a>
    <form class="search" id="ts"><input name="q" placeholder="Rechercher un produit…" aria-label="Rechercher"></form>
    <nav class="links">
      <a href="#/catalogue">Catalogue</a><a href="#/boutiques">Fournisseurs</a><a href="#/devis">Devis</a>
      ${state.shop ? html`<a href="#/vendeur">Ma boutique</a>` : html`<a href="#/vendeur">Vendre</a>`}
      ${state.isAdmin ? html`<a href="#/admin">Admin</a>` : ""}
      <a href="#/messages" aria-label="Messages">💬</a>
      <a href="${state.user ? "#/compte" : "#/connexion"}">${state.user ? "Mon compte" : "Connexion"}</a>
      <a class="cartlink" href="#/panier" aria-label="Panier">🛒${n ? html`<span class="count">${n}</span>` : ""}</a>
    </nav></div>`);
  $("#ts").onsubmit = (e) => { e.preventDefault(); go(`/catalogue?q=${encodeURIComponent(e.target.q.value.trim())}`); };
  setHTML($("#bottom"), html`
    <a href="#/"><span>🏠</span>Accueil</a><a href="#/catalogue"><span>🔎</span>Catalogue</a><a href="#/devis"><span>📝</span>Devis</a>
    <a href="#/panier"><span>🛒${n ? html`<i>${n}</i>` : ""}</span>Panier</a>
    <a href="${state.user ? "#/compte" : "#/connexion"}"><span>👤</span>Compte</a>`);
  const cur = location.hash.split("?")[0] || "#/";
  document.querySelectorAll("#bottom a, .links a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === cur));
}

async function router() {
  const path = (location.hash.slice(1) || "/").split("?")[0];
  const main = $("#main");
  const view = document.createElement("div"); view.className = "view";
  main.replaceChildren(view);
  header();
  window.scrollTo(0, 0);
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      try { await fn(view, ...m.slice(1)); } catch (e) { console.error(e); setHTML(view, empty(`Une erreur est survenue : ${e.message}`)); }
      return;
    }
  }
  setHTML(view, empty("Page introuvable.", html`<a class="btn" href="#/">Accueil</a>`));
}

async function start() {
  if (SUPABASE_URL.includes("VOTRE-PROJET")) {
    setHTML($("#main"), html`<section class="wrap narrow"><div class="panel"><h1>Configuration requise</h1>
      <p>Ouvrez <b>config.js</b> et collez l'adresse et la clé publique (anon) de votre projet Supabase. Voir le GUIDE.</p></div></section>`);
    return;
  }
  await loadSession();
  sb.auth.onAuthStateChange(async (ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "USER_UPDATED") { await loadSession(); header(); } });
  document.addEventListener("cart", header);
  document.addEventListener("auth", header);
  window.addEventListener("hashchange", router);
  router();
}

// Installation sur le téléphone (PWA)
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
let deferred = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); deferred = e;
  const b = $("#install"); b.hidden = false;
  b.onclick = async () => { b.hidden = true; deferred.prompt(); await deferred.userChoice; deferred = null; };
});
window.addEventListener("offline", () => document.body.classList.add("offline"));
window.addEventListener("online", () => document.body.classList.remove("offline"));

start();
