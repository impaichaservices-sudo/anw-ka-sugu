// Pages clients : accueil, catalogue / catégories / recherche, produit, boutiques, panier, commande.
import {
  sb, state, html, ic, setHTML, $, $$, fcfa, CATEGORIES, catLabel, KINDS, CITIES, productCard, verifiedBadge, stars,
  empty, loading, tiersOf, minQty, unitPrice, isWholesale, fromPrice, getCart, saveCart, addToCart, toast, run, must,
  go, query, fdate, errMsg, photo, PRODUCT_COLS, waLink,
} from "./lib.js";

const PAGE = 20;
const catChips = (active) => html`<nav class="cats" aria-label="Catégories">${CATEGORIES.map(([k, l]) => html`
  <a class="cat ${active === k ? "on" : ""}" href="#/catalogue?cat=${k}"><span class="cico">${ic(k, 22)}</span><span>${l}</span></a>`)}</nav>`;
const searchBox = (q = "", id = "sf") => html`<form class="searchbar" id="${id}" role="search">
  ${ic("search", 20)}<input name="q" value="${q}" placeholder="Que recherchez-vous ? Riz, téléphone, chaussures, huile…" aria-label="Que recherchez-vous ?" enterkeyhint="search">
  <button class="btn sm">Chercher</button></form>`;
const bindSearch = (form) => { form.onsubmit = (e) => { e.preventDefault(); const v = e.target.q.value.trim(); go(v ? `/catalogue?q=${encodeURIComponent(v)}` : "/catalogue"); }; };

// ---------- Requête produits (toutes boutiques) ----------
function productQuery(f, from) {
  let rq = sb.from("products").select(f.type === "gros" ? PRODUCT_COLS.replace("price_tiers(", "price_tiers!inner(") : PRODUCT_COLS)
    .eq("published", true).eq("shops.status", "approved");
  const q = (f.q || "").replace(/[,()*%_\\]/g, " ").trim();
  if (q) rq = rq.or(`name.ilike.*${q}*,description.ilike.*${q}*`);
  if (f.cat) rq = rq.eq("category", f.cat);
  if (f.ville) rq = rq.eq("city", f.ville);
  if (f.boutique) rq = rq.eq("shop_id", f.boutique);
  if (f.type === "detail") rq = rq.not("retail_price", "is", null);
  if (f.min) rq = rq.gte("min_price", Number(f.min));
  if (f.max) rq = rq.lte("min_price", Number(f.max));
  const sort = f.tri || (q ? "prix" : "");
  rq = sort === "prix" ? rq.order("min_price", { ascending: true, nullsFirst: false })
    : sort === "prix-desc" ? rq.order("min_price", { ascending: false, nullsFirst: false })
    : rq.order("created_at", { ascending: false });
  return rq.range(from, from + PAGE - 1);
}

/** Grille de produits avec « Voir plus » (chargement progressif). */
async function productGrid(el, f, emptyMsg) {
  let from = 0;
  const grid = document.createElement("div"); grid.className = "pgrid";
  const more = document.createElement("button"); more.className = "btn outline more"; more.textContent = "Voir plus de produits"; more.hidden = true;
  el.replaceChildren(grid, more);
  setHTML(grid, loading());
  const load = async () => {
    const { data, error } = await productQuery(f, from);
    if (!grid.isConnected) return;
    if (from === 0) grid.innerHTML = "";
    if (error) { setHTML(grid, empty(errMsg(error))); return; }
    if (!data.length && from === 0) { setHTML(grid, emptyMsg); return; }
    grid.insertAdjacentHTML("beforeend", html`${data.map(productCard)}`.s);
    from += data.length; more.hidden = data.length < PAGE;
  };
  more.onclick = () => run(more, load);
  await load();
}

// ---------- Accueil ----------
export async function home(root) {
  setHTML(root, html`<section class="wrap home">
    ${searchBox()}
    ${catChips()}
    <div class="sec-head"><h2>Produits du marché</h2><a href="#/catalogue">Tout voir</a></div>
    <div id="prods"></div>
  </section>`);
  bindSearch($("#sf"));
  await productGrid($("#prods"), {}, empty("Les premiers produits arrivent bientôt."));
}

// ---------- Catalogue, catégorie, recherche ----------
export async function catalogue(root) {
  const f = query();
  const nbFilters = ["ville", "boutique", "type", "min", "max"].filter((k) => f[k]).length;
  const title = f.q ? `Résultats pour « ${f.q} »` : f.cat ? catLabel(f.cat) : "Catalogue";
  setHTML(root, html`<section class="wrap">
    ${searchBox(f.q || "")}
    ${catChips(f.cat)}
    <div class="sec-head"><h1>${f.cat && !f.q ? html`<span class="cico sm">${ic(f.cat, 20)}</span>` : ""}${title}</h1></div>
    <div class="toolbar">
      <button class="btn outline sm" id="fbtn">${ic("filter", 18)} Filtres${nbFilters ? ` (${nbFilters})` : ""}</button>
      <select id="tri" aria-label="Trier">
        <option value="">${f.q ? "Prix croissant" : "Plus récents"}</option>
        <option value="recent" ${f.tri === "recent" ? "selected" : ""}>Plus récents</option>
        <option value="prix" ${f.tri === "prix" ? "selected" : ""}>Prix croissant</option>
        <option value="prix-desc" ${f.tri === "prix-desc" ? "selected" : ""}>Prix décroissant</option>
      </select>
    </div>
    <form class="filters ${nbFilters ? "" : "hidden"}" id="ff">
      <div class="two"><label>Ville<select name="ville"><option value="">Toutes</option>${CITIES.map((c) => html`<option ${f.ville === c ? "selected" : ""}>${c}</option>`)}</select></label>
      <label>Boutique<select name="boutique" id="fshop"><option value="">Toutes</option></select></label></div>
      <div class="two"><label>Prix min (FCFA)<input name="min" type="number" min="0" inputmode="numeric" value="${f.min || ""}"></label>
      <label>Prix max (FCFA)<input name="max" type="number" min="0" inputmode="numeric" value="${f.max || ""}"></label></div>
      <div class="seg">${[["", "Tout"], ["detail", "Détail"], ["gros", "Gros"]].map(([v, l]) => html`<label><input type="radio" name="type" value="${v}" ${(f.type || "") === v ? "checked" : ""}><span>${l}</span></label>`)}</div>
      <div class="actions"><button class="btn">Appliquer</button><a class="btn outline" href="#/catalogue${f.cat ? `?cat=${f.cat}` : ""}">Effacer</a></div>
    </form>
    <div id="prods"></div></section>`);
  bindSearch($("#sf"));
  $("#fbtn").onclick = () => $("#ff").classList.toggle("hidden");
  const apply = (extra = {}) => {
    const p = new URLSearchParams([...new FormData($("#ff"))].filter(([, v]) => v));
    ["q", "cat"].forEach((k) => f[k] && p.set(k, f[k]));
    const tri = extra.tri ?? f.tri; if (tri) p.set("tri", tri);
    go(`/catalogue?${p}`);
  };
  $("#ff").onsubmit = (e) => { e.preventDefault(); apply(); };
  $("#tri").onchange = (e) => apply({ tri: e.target.value });
  sb.from("shops").select("id,name").eq("status", "approved").order("name").limit(300).then(({ data }) => {
    const sel = $("#fshop"); if (!sel || !data) return;
    sel.insertAdjacentHTML("beforeend", html`${data.map((s) => html`<option value="${s.id}" ${f.boutique === s.id ? "selected" : ""}>${s.name}</option>`)}`.s);
  });
  await productGrid($("#prods"), { ...f, tri: f.tri === "recent" ? "" : f.tri || (f.q ? "prix" : "") },
    empty(f.q ? "Aucun produit trouvé. Publiez une demande de devis : les fournisseurs vous proposeront leurs prix." : "Aucun produit dans cette sélection pour le moment.",
      html`<a class="btn" href="#/devis/nouveau">Demander un devis</a>`));
}

// ---------- Page produit ----------
export async function product(root, id) {
  setHTML(root, loading());
  const { data: p } = await sb.from("products").select("*, shops(*), price_tiers(min_qty,unit_price)").eq("id", id).maybeSingle();
  if (!p) return setHTML(root, empty("Produit introuvable.", html`<a class="btn" href="#/catalogue">Retour au catalogue</a>`));
  const tiers = tiersOf(p); const min = minQty(p); const s = p.shops || {}; const imgs = p.images || [];
  let fav = false;
  if (state.user) fav = !!(await sb.from("favorites").select("product_id").eq("product_id", id).maybeSingle()).data;
  setHTML(root, html`<section class="wrap product">
    <div class="gallery">
      <div class="slides" id="slides">${imgs.length ? imgs.map((u, i) => html`<img src="${u}" alt="${p.name} — photo ${i + 1}" loading="${i ? "lazy" : "eager"}">`) : photo(null)}</div>
      ${imgs.length > 1 ? html`<div class="dots">${imgs.map((u, i) => html`<button class="dot ${i ? "" : "on"}" data-i="${i}" aria-label="Photo ${i + 1}"><img src="${u.replace(/\.jpg$/, "_t.jpg")}" data-full="${u}" alt=""></button>`)}</div>` : ""}
      <div class="gtools"><button class="round ${fav ? "on" : ""}" id="fav" aria-label="Ajouter aux favoris">${ic("heart", 20)}</button><button class="round" id="share" aria-label="Partager">${ic("share", 20)}</button></div>
    </div>
    <div class="pinfo">
      <a class="muted small" href="#/catalogue?cat=${p.category}">${catLabel(p.category)}</a>
      <h1>${p.name}</h1>
      <div class="bigprice">${p.retail_price ? html`${fcfa(p.retail_price)} <small>/ ${p.unit}</small>` : tiers.length ? html`<small>dès </small>${fcfa(fromPrice(p))} <small>/ ${p.unit}</small>` : "Prix sur demande"}</div>
      ${tiers.length ? html`<table class="tiers"><caption>Prix de gros</caption><tbody>
        ${tiers.map((t, i) => html`<tr><td>${t.min_qty}${tiers[i + 1] ? ` à ${tiers[i + 1].min_qty - 1}` : " et plus"} ${p.unit}</td><td>${fcfa(t.unit_price)} / ${p.unit}</td></tr>`)}</tbody></table>` : ""}
      <ul class="facts">
        ${!p.retail_price && tiers.length ? html`<li>${ic("package", 16)} Quantité minimale : <b>${min} ${p.unit}</b></li>` : ""}
        <li class="${p.stock ? "ok" : "err"}">${ic(p.stock ? "check" : "x", 16)} ${p.stock ? `Disponible : ${p.stock} ${p.unit}` : "Rupture de stock"}</li>
        <li>${ic("pin", 16)} ${p.city || s.city}</li>
      </ul>
      <a class="shopline" href="#/boutique/${s.id}"><span class="slogo">${s.logo_url ? html`<img src="${s.logo_url}" alt="">` : ic("store", 20)}</span>
        <span class="grow"><b>${s.name}</b> ${verifiedBadge(s)}<br><small class="muted">${KINDS[s.kind] || ""} · ${s.city}${s.rating_count ? html` · ${stars(s.rating_avg)}` : ""}</small></span>${ic("chevron", 18)}</a>
      ${p.stock > 0 ? html`<div class="buybox">
        <div class="qtyrow"><span>Quantité</span><div class="stepper"><button type="button" data-d="-1" aria-label="Moins">−</button><input id="qty" type="number" inputmode="numeric" min="${min}" max="${p.stock}" value="${min}" aria-label="Quantité"><button type="button" data-d="1" aria-label="Plus">+</button></div></div>
        <div class="live" id="live"></div>
        <button class="btn big" id="now">Commander maintenant</button>
        <button class="btn big outline" id="add">${ic("cart", 18)} Ajouter au panier</button>
      </div>` : ""}
      <button class="btn big ghost" id="ask">${ic("message", 18)} Poser une question au vendeur</button>
      ${p.description ? html`<h3>Description</h3><p class="pre">${p.description}</p>` : ""}
    </div>
    <div class="similar" id="sim"></div>
  </section>`);

  const slides = $("#slides");
  $$(".dot", root).forEach((d) => { d.onclick = () => slides.scrollTo({ left: slides.clientWidth * Number(d.dataset.i), behavior: "smooth" }); });
  slides.onscroll = () => { const i = Math.round(slides.scrollLeft / slides.clientWidth); $$(".dot", root).forEach((d) => d.classList.toggle("on", Number(d.dataset.i) === i)); };
  const qty = $("#qty");
  const n = () => Math.max(0, parseInt(qty.value, 10) || 0);
  const live = () => {
    const u = unitPrice(p, n());
    setHTML($("#live"), n() < min ? html`<span class="err">Minimum ${min} ${p.unit}</span>` : n() > p.stock ? html`<span class="err">Seulement ${p.stock} en stock</span>`
      : u ? html`${n()} × ${fcfa(u)} = <b>${fcfa(u * n())}</b>${tiers.length && u < (p.retail_price || Infinity) ? html` <span class="saving">prix de gros</span>` : ""}` : "");
  };
  const valid = () => { if (n() < min) { toast(`Minimum ${min} ${p.unit}`, "err"); return false; } if (n() > p.stock) { toast(`Seulement ${p.stock} en stock`, "err"); return false; } return true; };
  if (qty) {
    qty.oninput = live; live();
    $$(".stepper button", root).forEach((b) => { b.onclick = () => { qty.value = Math.min(p.stock, Math.max(min, n() + Number(b.dataset.d))); live(); }; });
    $("#add").onclick = () => { if (valid()) { addToCart(p.id, n()); toast("Ajouté au panier"); } };
    $("#now").onclick = () => { if (valid()) go(`/commander?p=${p.id}&q=${n()}`); };
  }
  $("#ask").onclick = () => contactShop(s.id, p.id);
  $("#fav").onclick = async (e) => {
    if (!state.user) return go(`/connexion?retour=${encodeURIComponent(`/produit/${id}`)}`);
    const b = e.currentTarget; const on = b.classList.toggle("on");
    const r = on ? await sb.from("favorites").insert({ product_id: id }) : await sb.from("favorites").delete().eq("product_id", id).eq("user_id", state.user.id);
    if (r.error) { b.classList.toggle("on"); toast(errMsg(r.error), "err"); } else toast(on ? "Ajouté aux favoris" : "Retiré des favoris");
  };
  $("#share").onclick = async () => {
    try { if (navigator.share) await navigator.share({ title: p.name, url: location.href }); else { await navigator.clipboard.writeText(location.href); toast("Lien copié"); } } catch { /* annulé */ }
  };
  // Comparer : mêmes produits chez d'autres boutiques
  const word = p.name.split(/\s+/).find((w) => w.length > 2)?.replace(/[,()*%_\\]/g, "");
  if (word) {
    const { data } = await sb.from("products").select(PRODUCT_COLS).eq("published", true).eq("category", p.category)
      .ilike("name", `%${word}%`).neq("id", p.id).order("min_price", { ascending: true }).limit(8);
    if (data?.length && root.isConnected) setHTML($("#sim"), html`<h2>Comparer avec d'autres boutiques</h2><div class="pgrid">${data.map(productCard)}</div>`);
  }
}

export async function contactShop(shopId, productId = null) {
  if (!state.user) return go(`/connexion?retour=${encodeURIComponent(location.hash.slice(1))}`);
  const { data, error } = await sb.rpc("open_conversation", { _shop: shopId, _product: productId });
  if (error) return toast(errMsg(error), "err");
  go(`/messages/${data}`);
}

// ---------- Boutiques ----------
const shopCard = (s) => html`<a class="shopcard" href="#/boutique/${s.id}">
  <span class="slogo">${s.logo_url ? html`<img src="${s.logo_url}" alt="" loading="lazy">` : ic("store", 22)}</span>
  <span class="grow"><b>${s.name}</b> ${verifiedBadge(s)}<br><small class="muted">${KINDS[s.kind]} · ${s.city}</small>
  ${s.rating_count ? html`<br>${stars(s.rating_avg)} <small>(${s.rating_count})</small>` : ""}</span>${ic("chevron", 18)}</a>`;

export async function shops(root) {
  const q = query();
  setHTML(root, html`<section class="wrap narrow"><h1>Boutiques</h1>
    <form class="searchbar" id="f">${ic("search", 20)}<input name="q" value="${q.q || ""}" placeholder="Nom de la boutique"><button class="btn sm">Chercher</button></form>
    <div class="list" id="res">${loading()}</div></section>`);
  $("#f").onsubmit = (e) => { e.preventDefault(); go(`/boutiques?q=${encodeURIComponent(e.target.q.value.trim())}`); };
  let rq = sb.from("shops").select("*").eq("status", "approved");
  if (q.q) rq = rq.ilike("name", `%${q.q.replace(/[%_]/g, "")}%`);
  const { data } = await rq.order("verified", { ascending: false }).order("rating_avg", { ascending: false }).limit(60);
  if (!root.isConnected) return;
  setHTML($("#res"), data?.length ? html`${data.map(shopCard)}` : empty("Aucune boutique trouvée."));
}

export async function shop(root, id) {
  setHTML(root, loading());
  const [{ data: s }, { data: revs }] = await Promise.all([
    sb.from("shops").select("*").eq("id", id).maybeSingle(),
    sb.from("reviews").select("*").eq("shop_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!s) return setHTML(root, empty("Boutique introuvable."));
  setHTML(root, html`<section class="wrap">
    <div class="shophead">
      <span class="slogo big">${s.logo_url ? html`<img src="${s.logo_url}" alt="">` : ic("store", 32)}</span>
      <div><h1>${s.name}</h1>${verifiedBadge(s)}
        <div class="muted small">${KINDS[s.kind]} · ${ic("pin", 13)} ${s.city}${s.address ? `, ${s.address}` : ""}</div>
        ${s.rating_count ? html`<div class="small">${stars(s.rating_avg)} ${Number(s.rating_avg).toFixed(1)} (${s.rating_count} avis)</div>` : ""}
        <div class="muted small">${ic("truck", 13)} Livraison : ${s.delivery_fee ? fcfa(s.delivery_fee) : "à convenir ou retrait"}</div></div>
    </div>
    ${s.description ? html`<p class="pre clamp">${s.description}</p>` : ""}
    ${s.categories?.length ? html`<div class="chips">${s.categories.map((c) => html`<span class="chip">${ic(c, 14)} ${catLabel(c)}</span>`)}</div>` : ""}
    <div class="actions"><button class="btn" id="msg">${ic("message", 18)} Écrire à la boutique</button>
      ${s.whatsapp ? html`<a class="btn outline" target="_blank" rel="noopener" href="${waLink(s.whatsapp, "Bonjour, je vous contacte depuis ANW KA SUGU.")}">${ic("phone", 18)} WhatsApp</a>` : ""}</div>
    <h2>Produits</h2><div id="prods"></div>
    ${revs?.length ? html`<h2>Avis clients</h2><div class="reviews">${revs.map((r) => html`<div class="review">${stars(r.rating)} <b>${r.author_name}</b> <small class="muted">${fdate(r.created_at)}</small>${r.comment ? html`<p>${r.comment}</p>` : ""}</div>`)}</div>` : ""}
  </section>`);
  $("#msg").onclick = () => contactShop(s.id);
  await productGrid($("#prods"), { boutique: s.id }, empty("Aucun produit publié."));
}

// ---------- Panier ----------
async function loadItems(entries) {
  const ids = entries.map(([id]) => id);
  if (!ids.length) return [];
  const { data } = await sb.from("products").select("*, shops(id,name,delivery_fee,verified,city,owner_id), price_tiers(min_qty,unit_price)").in("id", ids);
  const m = new Map((data || []).map((p) => [p.id, p]));
  return entries.filter(([id]) => m.has(id)).map(([id, qty]) => ({ p: m.get(id), qty }));
}
const byShop = (items) => { const g = {}; items.forEach((it) => (g[it.p.shop_id] ||= { shop: it.p.shops, items: [] }).items.push(it)); return Object.values(g); };

export async function cart(root) {
  const c = getCart();
  if (!Object.keys(c).length) return setHTML(root, html`<section class="wrap narrow"><h1>Mon panier</h1>${empty("Votre panier est vide.", html`<a class="btn" href="#/catalogue">Découvrir les produits</a>`)}</section>`);
  setHTML(root, loading());
  const items = await loadItems(Object.entries(c));
  Object.keys(c).forEach((id) => { if (!items.some((it) => it.p.id === id)) delete c[id]; }); saveCart(c);
  const groups = byShop(items);
  let sum = 0; let fees = 0;
  setHTML(root, html`<section class="wrap narrow"><h1>Mon panier</h1>
    ${groups.map((g) => { fees += g.shop?.delivery_fee || 0; return html`<div class="panel">
      <div class="gshop">${ic("store", 16)} <b>${g.shop?.name}</b> ${verifiedBadge(g.shop)}</div>
      ${g.items.map(({ p, qty }) => { const u = unitPrice(p, qty); sum += (u || 0) * qty; return html`<div class="line">
        <a class="lthumb" href="#/produit/${p.id}">${photo(p.images?.[0])}</a>
        <div class="grow"><a href="#/produit/${p.id}" class="lname">${p.name}</a>
          <div class="muted small">${u ? `${fcfa(u)} / ${p.unit}` : html`<span class="err">Minimum ${minQty(p)} ${p.unit}</span>`}${qty > p.stock ? html` · <span class="err">stock : ${p.stock}</span>` : ""}</div>
          <div class="lfoot"><div class="stepper sm"><button data-id="${p.id}" data-d="-1" aria-label="Moins">−</button><span>${qty}</span><button data-id="${p.id}" data-d="1" aria-label="Plus">+</button></div>
          <b>${u ? fcfa(u * qty) : "—"}</b></div></div>
        <button class="icon" data-del="${p.id}" aria-label="Retirer">${ic("trash", 18)}</button></div>`; })}
    </div>`; })}
    <div class="panel totals">
      <div class="row"><span>Sous-total</span><b>${fcfa(sum)}</b></div>
      <div class="row"><span>Livraison <small class="muted">(0 si retrait en boutique)</small></span><b>${fees ? fcfa(fees) : "à convenir"}</b></div>
      <div class="row total"><span>Total avec livraison</span><b>${fcfa(sum + fees)}</b></div>
      <a class="btn big" href="#/commander">Passer la commande</a>
    </div></section>`);
  $$("[data-d]", root).forEach((b) => { b.onclick = () => { const it = items.find((x) => x.p.id === b.dataset.id); const v = Math.max(minQty(it.p), Math.min(it.p.stock, c[b.dataset.id] + Number(b.dataset.d))); c[b.dataset.id] = v; saveCart(c); cart(root); }; });
  $$("[data-del]", root).forEach((b) => { b.onclick = () => { delete c[b.dataset.del]; saveCart(c); cart(root); }; });
}

// ---------- Récapitulatif et confirmation de commande ----------
export async function checkout(root) {
  const q = query();
  const direct = q.p ? [[q.p, Math.max(1, parseInt(q.q, 10) || 1)]] : null;
  const entries = direct || Object.entries(getCart());
  if (!entries.length) return go("/panier");
  if (!state.user) { toast("Connectez-vous pour commander", "err"); return go(`/connexion?retour=${encodeURIComponent(location.hash.slice(1))}`); }
  setHTML(root, loading());
  const items = await loadItems(entries);
  if (!items.length) return setHTML(root, empty("Produit indisponible."));
  const groups = byShop(items); const pr = state.profile || {};
  setHTML(root, html`<section class="wrap narrow"><a class="back" href="${direct ? `#/produit/${q.p}` : "#/panier"}">${ic("back", 18)} Retour</a>
    <h1>Récapitulatif</h1>
    <form id="order">
    ${groups.map((g) => html`<div class="panel">
      <div class="gshop">${ic("store", 16)} <b>${g.shop?.name}</b></div>
      ${g.items.map(({ p, qty }) => { const u = unitPrice(p, qty); return html`<div class="line">
        <span class="lthumb">${photo(p.images?.[0])}</span>
        <div class="grow"><b class="lname">${p.name}</b><div class="muted small">${qty} ${p.unit} × ${u ? fcfa(u) : "—"}</div></div>
        <b>${u ? fcfa(u * qty) : html`<span class="err">Min. ${minQty(p)}</span>`}</b></div>`; })}
      <div class="row small muted fee" data-fee="${g.shop?.delivery_fee || 0}"></div>
    </div>`)}
    <div class="panel">
      <h3>Livraison</h3>
      <div class="seg wide">${[["delivery", "Livraison", "truck"], ["pickup", "Retrait", "store"]].map(([v, l, i], k) => html`<label><input type="radio" name="delivery_mode" value="${v}" ${k ? "" : "checked"}><span>${ic(i, 16)} ${l}</span></label>`)}</div>
      <div class="two"><label>Nom complet<input name="name" required value="${pr.full_name || ""}" autocomplete="name"></label>
      <label>Téléphone<input name="phone" required type="tel" inputmode="tel" value="${pr.phone || ""}" placeholder="70 00 00 00" autocomplete="tel"></label></div>
      <div class="two"><label>Ville<select name="city">${CITIES.map((x) => html`<option ${pr.city === x ? "selected" : ""}>${x}</option>`)}</select></label>
      <label id="addrl">Quartier / adresse<input name="address" value="${pr.address || ""}" placeholder="Ex : Hamdallaye ACI, rue 300"></label></div>
      <label>Précisions (couleur, taille, heure…)<input name="note" maxlength="500" placeholder="Facultatif"></label>
    </div>
    <div class="panel">
      <h3>Paiement</h3>
      <label class="radio"><input type="radio" name="payment_method" value="cash" checked><span><b>À la livraison / au retrait</b><br><small class="muted">Vous payez en recevant votre commande.</small></span></label>
      <label class="radio"><input type="radio" name="payment_method" value="mobile_money"><span><b>Orange Money / Moov Money</b><br><small class="muted">L'argent est gardé par ANW KA SUGU et versé au vendeur après votre confirmation de réception.</small></span></label>
    </div>
    <div class="panel totals" id="totals"></div>
    <button class="btn big" id="go">Confirmer la commande</button>
    </form></section>`);
  const f = $("#order");
  const refresh = () => {
    const del = f.delivery_mode.value === "delivery"; let sum = 0; let fees = 0;
    groups.forEach((g) => { sum += g.items.reduce((a, { p, qty }) => a + (unitPrice(p, qty) || 0) * qty, 0); if (del) fees += g.shop?.delivery_fee || 0; });
    $$(".fee", root).forEach((el) => setHTML(el, del ? html`<span>Livraison</span><span>${Number(el.dataset.fee) ? fcfa(el.dataset.fee) : "à convenir avec la boutique"}</span>` : html`<span>Retrait en boutique</span><span>0 FCFA</span>`));
    $("#addrl").classList.toggle("hidden", !del); f.address.required = del;
    setHTML($("#totals"), html`<div class="row"><span>Sous-total</span><b>${fcfa(sum)}</b></div><div class="row"><span>Livraison</span><b>${fcfa(fees)}</b></div><div class="row total"><span>Total</span><b>${fcfa(sum + fees)}</b></div>`);
  };
  refresh(); $$("input[name=delivery_mode]", f).forEach((r) => { r.onchange = refresh; });
  f.onsubmit = (e) => {
    e.preventDefault();
    const info = Object.fromEntries(new FormData(f));
    run($("#go"), async () => {
      const id = must(await sb.rpc("place_order", { _items: items.map(({ p, qty }) => ({ product_id: p.id, quantity: qty })), _info: info }));
      if (!direct) saveCart({});
      sb.from("profiles").update({ full_name: info.name, phone: info.phone, city: info.city, address: info.address || pr.address || "" }).eq("id", state.user.id).then(() => {});
      toast("Commande envoyée");
      go(`/commande/${id}${info.payment_method === "mobile_money" ? "?payer=1" : ""}`);
    });
  };
}
