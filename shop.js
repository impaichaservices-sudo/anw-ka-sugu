// Pages publiques : accueil, catalogue, produit, boutiques, panier.
import {
  sb, state, html, setHTML, $, $$, fcfa, CATEGORIES, catLabel, catIcon, KINDS, CITIES, productCard, verifiedBadge,
  stars, empty, loading, tiersOf, minQty, unitPrice, isWholesale, getCart, saveCart, addToCart, toast, run, must,
  go, query, waLink, fdate, errMsg,
} from "./lib.js";

const PRODUCT_SELECT = "*, shops!inner(id,name,city,verified,kind,status), price_tiers(min_qty,unit_price)";

export async function home(root) {
  setHTML(root, html`
    <section class="hero">
      <div class="hero-in">
        <img class="hero-logo" src="logo.png" alt="ANW KA SUGU — Marché en ligne" width="900" height="602">
        <h1 class="sr">ANW KA SUGU</h1>
        <span class="pill">« Anw ka sugu » : votre marché, en bambara</span>
        <p>Achetez au détail ou en gros, directement auprès de fabricants, grossistes et boutiques vérifiés. Prix en FCFA, paiement Orange Money / Moov Money ou à la livraison.</p>
        <form class="search big" id="hs"><input name="q" placeholder="Que cherchez-vous ? riz, ciment, bazin, téléphone…" aria-label="Rechercher"><button class="btn gold">Chercher</button></form>
        <div class="hero-cta"><a class="btn light" href="#/devis/nouveau">📝 Demander un devis</a><a class="btn outline-light" href="#/vendeur">🏪 Vendre sur ANW KA SUGU</a></div>
      </div>
    </section>
    <section class="wrap">
      <h2>Catégories</h2>
      <div class="cats">${CATEGORIES.map(([k, l, i]) => html`<a class="cat" href="#/catalogue?cat=${k}"><span>${i}</span>${l}</a>`)}</div>
      <div class="how">
        <div><b>1. Comparez</b><p>Prix au détail et prix de gros selon la quantité.</p></div>
        <div><b>2. Commandez ou demandez un devis</b><p>Les fournisseurs vous répondent avec leur meilleur prix.</p></div>
        <div><b>3. Payez en sécurité</b><p>Avec le mobile money, l'argent est gardé jusqu'à ce que vous confirmiez la réception.</p></div>
      </div>
      <div class="sec-head"><h2>Prix de gros</h2><a href="#/catalogue?type=gros">Tout voir →</a></div>
      <div class="grid" id="gros">${loading()}</div>
      <div class="sec-head"><h2>Nouveautés</h2><a href="#/catalogue">Tout voir →</a></div>
      <div class="grid" id="new">${loading()}</div>
      <div class="sec-head"><h2>Fournisseurs vérifiés</h2><a href="#/boutiques?verifie=1">Tout voir →</a></div>
      <div class="shops-row" id="vshops">${loading()}</div>
    </section>`);
  $("#hs").onsubmit = (e) => { e.preventDefault(); go(`/catalogue?q=${encodeURIComponent(e.target.q.value.trim())}`); };

  const [gros, recent, shops] = await Promise.all([
    sb.from("products").select(PRODUCT_SELECT.replace("price_tiers(", "price_tiers!inner(")).eq("published", true).order("created_at", { ascending: false }).limit(8),
    sb.from("products").select(PRODUCT_SELECT).eq("published", true).order("created_at", { ascending: false }).limit(12),
    sb.from("shops").select("*").eq("status", "approved").eq("verified", true).order("rating_avg", { ascending: false }).limit(8),
  ]);
  if (!root.isConnected) return;
  setHTML($("#gros"), gros.data?.length ? html`${gros.data.map(productCard)}` : empty("Les premiers prix de gros arrivent bientôt."));
  setHTML($("#new"), recent.data?.length ? html`${recent.data.map(productCard)}` : empty("Aucun produit pour l'instant.", html`<a class="btn" href="#/vendeur">Soyez le premier vendeur</a>`));
  setHTML($("#vshops"), shops.data?.length ? html`${shops.data.map(shopCard)}` : empty("Les fournisseurs vérifiés apparaîtront ici."));
}

const shopCard = (s) => html`<a class="card shop" href="#/boutique/${s.id}">
  <div class="logo">${s.logo_url ? html`<img src="${s.logo_url}" alt="">` : s.name.slice(0, 1).toUpperCase()}</div>
  <div><div class="name">${s.name} ${verifiedBadge(s)}</div>
  <div class="muted">${KINDS[s.kind]} · ${s.city}</div>
  ${s.rating_count ? html`<div>${stars(s.rating_avg)} <small>(${s.rating_count})</small></div>` : ""}</div></a>`;

export async function catalogue(root) {
  const q = query();
  setHTML(root, html`<section class="wrap">
    <h1>${q.cat ? html`${catIcon(q.cat)} ${catLabel(q.cat)}` : "Catalogue"}</h1>
    <form class="filters" id="f">
      <input name="q" value="${q.q || ""}" placeholder="Rechercher un produit" aria-label="Rechercher">
      <select name="cat"><option value="">Toutes catégories</option>${CATEGORIES.map(([k, l]) => html`<option value="${k}" ${q.cat === k ? "selected" : ""}>${l}</option>`)}</select>
      <select name="type"><option value="">Détail et gros</option><option value="detail" ${q.type === "detail" ? "selected" : ""}>Détail (à l'unité)</option><option value="gros" ${q.type === "gros" ? "selected" : ""}>Gros (prix par quantité)</option></select>
      <select name="ville"><option value="">Toutes les villes</option>${CITIES.map((c) => html`<option ${q.ville === c ? "selected" : ""}>${c}</option>`)}</select>
      <label class="check"><input type="checkbox" name="verifie" value="1" ${q.verifie ? "checked" : ""}> Fournisseurs vérifiés</label>
      <select name="tri"><option value="">Plus récents</option><option value="prix" ${q.tri === "prix" ? "selected" : ""}>Prix croissant</option></select>
      <button class="btn">Filtrer</button>
    </form>
    <div class="grid" id="res">${loading()}</div></section>`);
  $("#f").onsubmit = (e) => {
    e.preventDefault();
    const p = new URLSearchParams([...new FormData(e.target)].filter(([, v]) => v));
    go(`/catalogue?${p}`);
  };
  let rq = sb.from("products").select(q.type === "gros" ? PRODUCT_SELECT.replace("price_tiers(", "price_tiers!inner(") : PRODUCT_SELECT).eq("published", true);
  if (q.q) rq = rq.ilike("name", `%${q.q.replace(/[%_]/g, "")}%`);
  if (q.cat) rq = rq.eq("category", q.cat);
  if (q.type === "detail") rq = rq.not("retail_price", "is", null);
  if (q.ville) rq = rq.eq("shops.city", q.ville);
  if (q.verifie) rq = rq.eq("shops.verified", true);
  rq = q.tri === "prix" ? rq.order("retail_price", { ascending: true, nullsFirst: false }) : rq.order("created_at", { ascending: false });
  const { data, error } = await rq.limit(60);
  if (!root.isConnected) return;
  if (error) return setHTML($("#res"), empty(errMsg(error)));
  setHTML($("#res"), data.length ? html`${data.map(productCard)}` : empty("Aucun produit ne correspond. Publiez une demande de devis : les fournisseurs vous proposeront leurs prix.", html`<a class="btn" href="#/devis/nouveau">Demander un devis</a>`));
}

export async function product(root, id) {
  setHTML(root, loading());
  const { data: p } = await sb.from("products").select("*, shops(*), price_tiers(min_qty,unit_price)").eq("id", id).maybeSingle();
  if (!p) return setHTML(root, empty("Produit introuvable.", html`<a class="btn" href="#/catalogue">Retour au catalogue</a>`));
  const tiers = tiersOf(p); const min = minQty(p); const s = p.shops;
  setHTML(root, html`<section class="wrap product-page">
    <div class="gallery">
      <div class="main-img">${p.images?.[0] ? html`<img id="mainimg" src="${p.images[0]}" alt="${p.name}">` : html`<span class="ph big">${catIcon(p.category)}</span>`}</div>
      ${p.images?.length > 1 ? html`<div class="thumbs">${p.images.map((u) => html`<img src="${u}" alt="" data-src="${u}">`)}</div>` : ""}
    </div>
    <div class="info">
      <a class="muted" href="#/catalogue?cat=${p.category}">${catLabel(p.category)}</a>
      <h1>${p.name}</h1>
      <div class="price-box">
        ${p.retail_price ? html`<div class="row"><span>Prix à l'unité</span><b>${fcfa(p.retail_price)} / ${p.unit}</b></div>` : ""}
        ${tiers.length ? html`<table class="tiers"><thead><tr><th>Quantité</th><th>Prix par ${p.unit}</th></tr></thead><tbody>
          ${tiers.map((t, i) => html`<tr><td>${t.min_qty}${tiers[i + 1] ? ` – ${tiers[i + 1].min_qty - 1}` : " et +"} ${p.unit}</td><td><b>${fcfa(t.unit_price)}</b></td></tr>`)}
        </tbody></table>` : ""}
        ${!p.retail_price && tiers.length ? html`<div class="moq">Commande minimum : <b>${min} ${p.unit}</b></div>` : ""}
      </div>
      ${p.stock > 0 ? html`
        <div class="buy">
          <label>Quantité (${p.unit})<input type="number" id="qty" min="${min}" max="${p.stock}" value="${min}" inputmode="numeric"></label>
          <div class="live" id="live"></div>
          <button class="btn big" id="add">Ajouter au panier</button>
        </div>
        <p class="muted">${p.stock} ${p.unit} en stock</p>` : html`<p class="alert">Rupture de stock. Contactez le vendeur ou demandez un devis.</p>`}
      <div class="actions">
        <button class="btn outline" id="msg">💬 Contacter le vendeur</button>
        ${s?.whatsapp ? html`<a class="btn outline" target="_blank" rel="noopener" href="${waLink(s.whatsapp, `Bonjour, je suis intéressé(e) par « ${p.name} » vu sur ANW KA SUGU.`)}">WhatsApp</a>` : ""}
        <button class="btn outline" id="share">Partager</button>
      </div>
      ${p.description ? html`<h3>Description</h3><p class="pre">${p.description}</p>` : ""}
      ${s ? html`<a class="card shop mini" href="#/boutique/${s.id}"><div class="logo">${s.logo_url ? html`<img src="${s.logo_url}" alt="">` : s.name[0]}</div>
        <div><div class="name">${s.name} ${verifiedBadge(s)}</div><div class="muted">${KINDS[s.kind]} · ${s.city}${s.rating_count ? html` · ${stars(s.rating_avg)}` : ""}</div></div></a>` : ""}
    </div></section>`);

  $$(".thumbs img", root).forEach((im) => { im.onclick = () => { $("#mainimg").src = im.dataset.src; }; });
  const qty = $("#qty");
  const live = () => {
    const n = Math.max(0, parseInt(qty.value, 10) || 0); const u = unitPrice(p, n);
    setHTML($("#live"), n < min ? html`<span class="err">Minimum ${min} ${p.unit}</span>`
      : u ? html`${n} × ${fcfa(u)} = <b>${fcfa(u * n)}</b>${tiers.length && u < (p.retail_price || Infinity) ? html` <span class="saving">prix de gros</span>` : ""}` : "");
  };
  if (qty) {
    qty.oninput = live; live();
    $("#add").onclick = () => {
      const n = parseInt(qty.value, 10) || 0;
      if (n < min) return toast(`Minimum ${min} ${p.unit}`, "err");
      if (n > p.stock) return toast(`Seulement ${p.stock} en stock`, "err");
      addToCart(p.id, n); toast("Ajouté au panier ✔");
    };
  }
  $("#msg").onclick = () => contactShop(s.id);
  $("#share").onclick = async () => {
    const url = location.href;
    try { if (navigator.share) await navigator.share({ title: p.name, url }); else { await navigator.clipboard.writeText(url); toast("Lien copié"); } } catch { /* annulé */ }
  };
}

export async function contactShop(shopId) {
  if (!state.user) return go(`/connexion?retour=${encodeURIComponent(location.hash.slice(1))}`);
  const { data, error } = await sb.rpc("open_conversation", { _shop: shopId });
  if (error) return toast(errMsg(error), "err");
  go(`/messages/${data}`);
}

export async function shops(root) {
  const q = query();
  setHTML(root, html`<section class="wrap"><h1>Boutiques & fournisseurs</h1>
    <form class="filters" id="f"><input name="q" value="${q.q || ""}" placeholder="Nom de la boutique">
      <select name="kind"><option value="">Tous</option>${Object.entries(KINDS).map(([k, l]) => html`<option value="${k}" ${q.kind === k ? "selected" : ""}>${l}s</option>`)}</select>
      <label class="check"><input type="checkbox" name="verifie" value="1" ${q.verifie ? "checked" : ""}> Vérifiés seulement</label><button class="btn">Filtrer</button></form>
    <div class="shops-list" id="res">${loading()}</div></section>`);
  $("#f").onsubmit = (e) => { e.preventDefault(); go(`/boutiques?${new URLSearchParams([...new FormData(e.target)].filter(([, v]) => v))}`); };
  let rq = sb.from("shops").select("*").eq("status", "approved");
  if (q.q) rq = rq.ilike("name", `%${q.q.replace(/[%_]/g, "")}%`);
  if (q.kind) rq = rq.eq("kind", q.kind);
  if (q.verifie) rq = rq.eq("verified", true);
  const { data } = await rq.order("verified", { ascending: false }).order("rating_avg", { ascending: false }).limit(60);
  if (!root.isConnected) return;
  setHTML($("#res"), data?.length ? html`${data.map(shopCard)}` : empty("Aucune boutique trouvée."));
}

export async function shop(root, id) {
  setHTML(root, loading());
  const [{ data: s }, { data: prods }, { data: revs }] = await Promise.all([
    sb.from("shops").select("*").eq("id", id).maybeSingle(),
    sb.from("products").select("*, price_tiers(min_qty,unit_price)").eq("shop_id", id).eq("published", true).order("created_at", { ascending: false }),
    sb.from("reviews").select("*").eq("shop_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!s) return setHTML(root, empty("Boutique introuvable."));
  setHTML(root, html`<section class="wrap">
    <div class="shop-head">
      <div class="logo big">${s.logo_url ? html`<img src="${s.logo_url}" alt="">` : s.name[0]}</div>
      <div><h1>${s.name} ${verifiedBadge(s)}</h1>
        <div class="muted">${KINDS[s.kind]} · ${s.city}${s.address ? ` · ${s.address}` : ""} · depuis ${fdate(s.created_at)}</div>
        ${s.rating_count ? html`<div>${stars(s.rating_avg)} ${Number(s.rating_avg).toFixed(1)} (${s.rating_count} avis)</div>` : ""}
        ${s.delivery_fee ? html`<div class="muted">Livraison : ${fcfa(s.delivery_fee)}</div>` : html`<div class="muted">Livraison : à convenir / retrait</div>`}
        <div class="actions"><button class="btn" id="msg">💬 Écrire</button>
          ${s.whatsapp ? html`<a class="btn outline" target="_blank" rel="noopener" href="${waLink(s.whatsapp, "Bonjour, je vous contacte depuis ANW KA SUGU.")}">WhatsApp</a>` : ""}</div>
      </div></div>
    ${s.verified ? html`<p class="note">✔ Ce fournisseur a été vérifié par ANW KA SUGU (identité et documents de commerce contrôlés).</p>` : ""}
    ${s.description ? html`<p class="pre">${s.description}</p>` : ""}
    <h2>Produits (${prods?.length || 0})</h2>
    <div class="grid">${prods?.length ? prods.map((p) => productCard({ ...p, shops: null })) : empty("Aucun produit publié.")}</div>
    <h2>Avis clients</h2>
    ${revs?.length ? html`<div class="reviews">${revs.map((r) => html`<div class="review">${stars(r.rating)} <b>${r.author_name}</b> <small class="muted">${fdate(r.created_at)}</small>${r.comment ? html`<p>${r.comment}</p>` : ""}</div>`)}</div>` : empty("Pas encore d'avis.")}
  </section>`);
  $("#msg").onclick = () => contactShop(s.id);
}

export async function cart(root) {
  const c = getCart(); const ids = Object.keys(c);
  if (!ids.length) return setHTML(root, html`<section class="wrap">${empty("Votre panier est vide.", html`<a class="btn" href="#/catalogue">Voir le catalogue</a>`)}</section>`);
  setHTML(root, loading());
  const { data } = await sb.from("products").select("*, shops(id,name,delivery_fee,verified), price_tiers(min_qty,unit_price)").in("id", ids);
  const found = new Map((data || []).map((p) => [p.id, p]));
  ids.forEach((id) => { if (!found.has(id)) delete c[id]; }); saveCart(c);
  const groups = {};
  for (const [id, qty] of Object.entries(c)) { const p = found.get(id); (groups[p.shop_id] ||= { shop: p.shops, items: [] }).items.push({ p, qty }); }
  const pr = state.profile || {};
  setHTML(root, html`<section class="wrap narrow"><h1>Mon panier</h1>
    ${Object.values(groups).map((g) => html`<div class="panel"><h3>${g.shop?.name} ${verifiedBadge(g.shop)}</h3>
      ${g.items.map(({ p, qty }) => { const u = unitPrice(p, qty); return html`<div class="line">
        <div class="lthumb">${p.images?.[0] ? html`<img src="${p.images[0]}" alt="">` : catIcon(p.category)}</div>
        <div class="grow"><a href="#/produit/${p.id}">${p.name}</a>
          <div class="muted">${u ? html`${fcfa(u)} / ${p.unit}` : html`<span class="err">Minimum ${minQty(p)} ${p.unit}</span>`}${qty > p.stock ? html` · <span class="err">stock : ${p.stock}</span>` : ""}</div></div>
        <input class="qty" type="number" min="1" value="${qty}" data-id="${p.id}" aria-label="Quantité">
        <b class="ltotal">${u ? fcfa(u * qty) : "—"}</b>
        <button class="icon" data-del="${p.id}" aria-label="Retirer">✕</button></div>`; })}
    </div>`)}
    <form class="panel" id="order">
      <h3>Livraison et paiement</h3>
      <div class="two"><label>Nom complet<input name="name" required value="${pr.full_name || ""}"></label>
      <label>Téléphone<input name="phone" required type="tel" value="${pr.phone || ""}" placeholder="70 00 00 00"></label></div>
      <div class="two"><label>Ville<select name="city">${CITIES.map((x) => html`<option ${pr.city === x ? "selected" : ""}>${x}</option>`)}</select></label>
      <label>Mode<select name="delivery_mode"><option value="pickup">Retrait en boutique</option><option value="delivery">Livraison</option></select></label></div>
      <label>Adresse / quartier (pour la livraison)<input name="address" value="${pr.address || ""}" placeholder="Ex : Hamdallaye ACI, rue 300"></label>
      <fieldset class="pay"><legend>Paiement</legend>
        <label class="radio"><input type="radio" name="payment_method" value="mobile_money" checked> <span><b>Orange Money / Moov Money</b><br><small>Paiement sécurisé : l'argent est gardé par ANW KA SUGU et versé au vendeur seulement après votre confirmation de réception.</small></span></label>
        <label class="radio"><input type="radio" name="payment_method" value="cash"> <span><b>Paiement à la livraison / au retrait</b></span></label>
      </fieldset>
      <div class="totals" id="totals"></div>
      <button class="btn big" id="go">Valider la commande</button>
    </form></section>`);

  const totals = () => {
    const mode = $("#order").delivery_mode.value; let sum = 0; let fees = 0;
    for (const g of Object.values(groups)) {
      sum += g.items.reduce((a, { p, qty }) => a + (unitPrice(p, qty) || 0) * qty, 0);
      if (mode === "delivery") fees += g.shop?.delivery_fee || 0;
    }
    setHTML($("#totals"), html`<div class="row"><span>Produits</span><b>${fcfa(sum)}</b></div>
      ${mode === "delivery" ? html`<div class="row"><span>Livraison</span><b>${fees ? fcfa(fees) : "à convenir"}</b></div>` : ""}
      <div class="row total"><span>Total</span><b>${fcfa(sum + fees)}</b></div>`);
  };
  totals();
  $("#order").delivery_mode.onchange = totals;
  $$("input.qty", root).forEach((inp) => { inp.onchange = () => { const v = parseInt(inp.value, 10); if (v > 0) { c[inp.dataset.id] = v; saveCart(c); cart(root); } }; });
  $$("[data-del]", root).forEach((b) => { b.onclick = () => { delete c[b.dataset.del]; saveCart(c); cart(root); }; });
  $("#order").onsubmit = (e) => {
    e.preventDefault();
    if (!state.user) { toast("Connectez-vous pour commander", "err"); return go("/connexion?retour=/panier"); }
    const info = Object.fromEntries(new FormData(e.target));
    run($("#go"), async () => {
      const id = must(await sb.rpc("place_order", { _items: Object.entries(c).map(([product_id, quantity]) => ({ product_id, quantity })), _info: info }));
      saveCart({});
      sb.from("profiles").update({ full_name: info.name, phone: info.phone, city: info.city, address: info.address }).eq("id", state.user.id).then(() => {});
      toast("Commande envoyée ✔");
      go(`/commande/${id}${info.payment_method === "mobile_money" ? "?payer=1" : ""}`);
    });
  };
}
