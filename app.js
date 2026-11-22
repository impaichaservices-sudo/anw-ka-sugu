// Point d'entrée : navigation, en-tête compact, barre du bas, notifications.
import { sb, state, loadSession, html, ic, setHTML, $, $$, cartCount, empty, go, toast, ORDER_STATUS } from "./lib.js";
import { SUPABASE_URL } from "./config.js";
import { home, catalogue, product, shops, shop, cart, checkout } from "./shop.js";
import { login, account, infos, becomeSeller, orders, order, messages, thread, favorites, countUnread } from "./account.js";
import { rfqList, rfqNew, rfqDetail } from "./rfq.js";
import { seller, productForm } from "./seller.js";
import { admin } from "./admin.js";

const routes = [
  [/^\/$/, home], [/^\/catalogue$/, catalogue], [/^\/produit\/([\w-]+)$/, product],
  [/^\/boutiques$/, shops], [/^\/boutique\/([\w-]+)$/, shop], [/^\/panier$/, cart], [/^\/commander$/, checkout],
  [/^\/connexion$/, login], [/^\/compte$/, account], [/^\/compte\/infos$/, infos], [/^\/devenir-vendeur$/, becomeSeller],
  [/^\/commandes$/, orders], [/^\/commande\/([\w-]+)$/, order], [/^\/favoris$/, favorites],
  [/^\/messages$/, messages], [/^\/messages\/([\w-]+)$/, thread],
  [/^\/devis$/, rfqList], [/^\/devis\/nouveau$/, rfqNew], [/^\/devis\/([\w-]+)$/, rfqDetail],
  [/^\/vendeur$/, seller], [/^\/vendeur\/produit\/([\w-]+)$/, productForm], [/^\/admin$/, admin],
];

const badge = (n) => n ? html`<span class="count">${n > 9 ? "9+" : n}</span>` : "";
function header() {
  const n = cartCount(); const acc = state.user ? "#/compte" : "#/connexion";
  setHTML($("#top"), html`<div class="bar">
    <a class="brand" href="#/" aria-label="ANW KA SUGU, accueil"><img src="logo.png" alt="ANW KA SUGU" width="167" height="42"></a>
    <nav class="hicons" aria-label="Raccourcis">
      <a href="#/catalogue" aria-label="Rechercher">${ic("search", 23)}</a>
      <a href="#/panier" aria-label="Panier">${ic("cart", 23)}${badge(n)}</a>
      <a href="${acc}" aria-label="Mon compte">${ic("user", 23)}${badge(state.unread)}</a>
    </nav></div>`);
  const tabs = [["#/", "home", "Accueil"], ["#/catalogue", "grid", "Catalogue"], ["#/devis", "quote", "Devis"], ["#/panier", "cart", "Panier", n], [acc, "user", "Compte", state.unread]];
  setHTML($("#bottom"), html`${tabs.map(([h, i, l, k]) => html`<a href="${h}"><span class="bi">${ic(i, 22)}${badge(k)}</span>${l}</a>`)}`);
  const cur = `#${(location.hash.slice(1) || "/").split("?")[0]}`;
  const section = cur.startsWith("#/produit") || cur.startsWith("#/boutique") ? "#/catalogue"
    : /^#\/(compte|commande|messages|favoris|vendeur|admin|devenir|connexion)/.test(cur) ? acc : cur.startsWith("#/devis") ? "#/devis" : cur.startsWith("#/commander") ? "#/panier" : cur;
  $$("#bottom a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === section));
}

async function refreshUnread() { state.unread = await countUnread(); header(); }

async function router() {
  const path = (location.hash.slice(1) || "/").split("?")[0];
  const view = document.createElement("div"); view.className = "view";
  $("#main").replaceChildren(view);
  header(); window.scrollTo(0, 0);
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) { try { await fn(view, ...m.slice(1)); } catch (e) { console.error(e); setHTML(view, empty(`Une erreur est survenue : ${e.message}`)); } return; }
  }
  setHTML(view, empty("Page introuvable.", html`<a class="btn" href="#/">Accueil</a>`));
}

// ---------- Notifications en temps réel (messages, commandes) ----------
let live = null;
function listen() {
  if (live) { sb.removeChannel(live); live = null; }
  if (!state.user) return;
  live = sb.channel(`notif-${state.user.id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
      if (p.new.sender_id === state.user.id) return;
      if (!location.hash.includes(`/messages/${p.new.conversation_id}`)) toast("Nouveau message reçu");
      refreshUnread();
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "sub_orders" }, (p) => {
      if (state.shop && p.new.shop_id === state.shop.id) toast("Nouvelle commande reçue");
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sub_orders" }, (p) => {
      if (state.shop && p.new.shop_id === state.shop.id) return;
      if (p.old?.status && p.old.status === p.new.status) return;
      toast(`Votre commande : ${ORDER_STATUS[p.new.status] || p.new.status}`);
    })
    .subscribe();
}
document.addEventListener("unread", refreshUnread);

async function start() {
  if (SUPABASE_URL.includes("VOTRE-PROJET")) {
    setHTML($("#main"), html`<section class="wrap narrow"><div class="panel"><h1>Configuration requise</h1><p>Ouvrez <b>config.js</b> et collez l'adresse et la clé publique de votre projet Supabase.</p></div></section>`);
    return;
  }
  await loadSession();
  sb.auth.onAuthStateChange(async (ev) => { if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(ev)) { await loadSession(); listen(); refreshUnread(); } });
  document.addEventListener("cart", header);
  document.addEventListener("auth", () => { header(); refreshUnread(); });
  window.addEventListener("hashchange", router);
  router(); listen(); refreshUnread();
}

// Miniature absente : on affiche la photo d'origine
document.addEventListener("error", (e) => { const t = e.target; if (t.tagName === "IMG" && t.dataset.full && t.src !== t.dataset.full) t.src = t.dataset.full; }, true);

// Installation sur le téléphone (PWA), discrète et refermable
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  try { if (localStorage.getItem("anw_install_ferme")) return; } catch { /* ignoré */ }
  const bar = $("#install");
  setHTML(bar, html`<img src="icon-48.png" alt="" width="32" height="32"><span class="grow">Installer l'application ANW KA SUGU</span><button class="btn sm" id="inst">Installer</button><button class="icon" id="instx" aria-label="Fermer">${ic("x", 18)}</button>`);
  bar.hidden = false;
  $("#inst").onclick = async () => { bar.hidden = true; e.prompt(); await e.userChoice; };
  $("#instx").onclick = () => { bar.hidden = true; try { localStorage.setItem("anw_install_ferme", "1"); } catch { /* ignoré */ } };
});
window.addEventListener("offline", () => document.body.classList.add("offline"));
window.addEventListener("online", () => document.body.classList.remove("offline"));

start();
