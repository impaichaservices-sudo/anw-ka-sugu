// Espace vendeur : boutique, produits (photos réelles, prix de gros), commandes, messages, gains.
import {
  sb, state, loadSession, html, ic, setHTML, $, $$, fcfa, fdatetime, CATEGORIES, catLabel, KINDS, CITIES,
  ORDER_STATUS, PAYOUT, SHOP_STATUS, verifiedBadge, empty, loading, toast, run, must, go, query, requireLogin,
  uploadImage, uploadDocument, tiersOf, photo, statusBadge, fphone,
} from "./lib.js";
import { conversationList } from "./account.js";

export async function seller(root) {
  if (!requireLogin()) return;
  await loadSession();
  if (!state.shop) return shopForm(root, null);
  const s = state.shop; const tab = query().onglet || "commandes";
  setHTML(root, html`<section class="wrap">
    <div class="shophead"><span class="slogo">${s.logo_url ? html`<img src="${s.logo_url}" alt="">` : ic("store", 24)}</span>
      <div class="grow"><h1>${s.name}</h1>${verifiedBadge(s)}<div class="muted small">${KINDS[s.kind]} · ${s.city} · <a href="#/boutique/${s.id}">Voir ma page</a></div></div></div>
    ${s.status !== "approved" ? html`<div class="note warn">Statut : <b>${SHOP_STATUS[s.status]}</b>.
      ${s.status === "pending" ? " L'équipe ANW KA SUGU vérifie votre boutique. Vous pourrez publier vos produits dès la validation." : ""}
      ${s.rejection_reason ? html`<br>Motif : ${s.rejection_reason}` : ""}</div>` : ""}
    <nav class="tabs">${[["commandes", "Commandes"], ["produits", "Produits"], ["messages", "Messages"], ["gains", "Gains"], ["boutique", "Ma boutique"]]
      .map(([k, l]) => html`<a class="${tab === k ? "on" : ""}" href="#/vendeur?onglet=${k}">${l}</a>`)}<a href="#/devis?onglet=ouvertes">Devis</a></nav>
    <div id="tab">${loading()}</div></section>`);
  const el = $("#tab");
  if (tab === "produits") return products(el);
  if (tab === "messages") return conversationList(el, "boutique");
  if (tab === "gains") return earnings(el);
  if (tab === "boutique") return shopForm(el, s);
  return sellerOrders(el);
}

// ---------- Création / modification de la boutique ----------
async function shopForm(root, s) {
  const priv = s ? (await sb.from("shop_private").select("*").eq("shop_id", s.id).maybeSingle()).data || {} : {};
  setHTML(root, html`<section class="${s ? "" : "wrap narrow"}">
    ${s ? "" : html`<a class="back" href="#/devenir-vendeur">${ic("back", 18)} Retour</a><h1>Inscription vendeur</h1>`}
    <form class="panel" id="f">
      <h3>Ma boutique</h3>
      <label>Nom de la boutique<input name="name" required minlength="2" maxlength="80" value="${s?.name || ""}"></label>
      <div class="two"><label>Type<select name="kind">${Object.entries(KINDS).map(([k, l]) => html`<option value="${k}" ${s?.kind === k ? "selected" : ""}>${l}</option>`)}</select></label>
      <label>Ville<select name="city">${CITIES.map((c) => html`<option ${s?.city === c ? "selected" : ""}>${c}</option>`)}</select></label></div>
      <label>Adresse / marché<input name="address" value="${s?.address || ""}" placeholder="Ex : Grand marché, allée 4"></label>
      <div class="two"><label>WhatsApp<input name="whatsapp" type="tel" inputmode="tel" value="${s?.whatsapp || ""}" placeholder="70 00 00 00"></label>
      <label>Frais de livraison (FCFA)<input name="delivery_fee" type="number" min="0" inputmode="numeric" value="${s?.delivery_fee ?? 0}"></label></div>
      <label>Description courte<textarea name="description" rows="3" maxlength="2000" placeholder="Ce que vous vendez, vos conditions…">${s?.description || ""}</textarea></label>
      <fieldset><legend>Catégories</legend><div class="chips">${CATEGORIES.map(([k, l]) => html`<label class="chip"><input type="checkbox" name="categories" value="${k}" ${s?.categories?.includes(k) ? "checked" : ""}> ${l}</label>`)}</div></fieldset>
      <label>Logo ou photo de la boutique<input type="file" name="logo" accept="image/*"></label>
      <h3>Vérification <small class="muted">(privé)</small></h3>
      <div class="two"><label>Nom du responsable<input name="manager_name" value="${priv.manager_name || state.profile?.full_name || ""}" required></label>
      <label>Téléphone du responsable<input name="manager_phone" type="tel" value="${priv.manager_phone || state.profile?.phone || ""}" required></label></div>
      <label>Registre de commerce / NIF (facultatif)<textarea name="business_info" rows="2">${priv.business_info || ""}</textarea></label>
      <label>Documents : pièce d'identité, RCCM… (photos ou PDF)<input type="file" name="docs" accept="image/*,application/pdf" multiple></label>
      ${priv.documents?.length ? html`<p class="muted small">${priv.documents.length} document(s) déjà envoyé(s).</p>` : ""}
      <button class="btn big" id="go">${s ? "Enregistrer" : "Créer ma boutique"}</button>
    </form></section>`);
  $("#f").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    run($("#go"), async () => {
      const logo = fd.get("logo");
      const row = { name: fd.get("name").trim(), kind: fd.get("kind"), city: fd.get("city"), address: fd.get("address").trim(),
        whatsapp: fd.get("whatsapp").trim(), delivery_fee: Number(fd.get("delivery_fee") || 0), description: fd.get("description").trim(), categories: fd.getAll("categories") };
      if (logo?.size) row.logo_url = await uploadImage(logo, { square: true });
      const shop = s ? must(await sb.from("shops").update(row).eq("id", s.id).select().single())
        : must(await sb.from("shops").insert({ ...row, owner_id: state.user.id }).select().single());
      const docs = [...(priv.documents || [])];
      for (const f of fd.getAll("docs")) if (f?.size) docs.push(await uploadDocument(f));
      must(await sb.from("shop_private").upsert({ shop_id: shop.id, manager_name: fd.get("manager_name").trim(), manager_phone: fd.get("manager_phone").trim(), business_info: fd.get("business_info").trim(), documents: docs }));
      await loadSession();
      toast(s ? "Boutique mise à jour" : "Boutique créée. Elle sera visible après validation.");
      go(`/vendeur?onglet=${s ? "boutique" : "produits"}&t=${Date.now()}`);
    });
  };
}

// ---------- Produits ----------
async function products(el) {
  const { data } = await sb.from("products").select("*, price_tiers(min_qty,unit_price)").eq("shop_id", state.shop.id).order("created_at", { ascending: false });
  const ok = state.shop.status === "approved";
  setHTML(el, html`<div class="sec-head"><h2>Mes produits (${data?.length || 0})</h2>${ok ? html`<a class="btn sm" href="#/vendeur/produit/nouveau">${ic("plus", 18)} Ajouter un produit</a>` : ""}</div>
    ${data?.length ? html`<div class="list">${data.map((p) => html`<div class="prow ${p.published ? "" : "off"}">
      <a class="lthumb" href="#/vendeur/produit/${p.id}">${photo(p.images?.[0])}</a>
      <a class="grow" href="#/vendeur/produit/${p.id}"><b>${p.name}</b><br><small class="muted">${p.retail_price ? `Détail ${fcfa(p.retail_price)}` : "Gros uniquement"}${tiersOf(p).length ? ` · gros dès ${fcfa(Math.min(...tiersOf(p).map((t) => t.unit_price)))}` : ""}</small>
        <br><small class="${p.stock ? "muted" : "err"}">Stock : ${p.stock} ${p.unit}${p.published ? "" : " · Masqué"}</small></a>
      <button class="icon" data-vis="${p.id}" data-on="${p.published ? 1 : 0}" aria-label="${p.published ? "Masquer" : "Afficher"}" title="${p.published ? "Masquer temporairement" : "Remettre en ligne"}">${ic(p.published ? "eye" : "eyeOff", 20)}</button>
      <a class="icon" href="#/vendeur/produit/${p.id}" aria-label="Modifier">${ic("edit", 20)}</a></div>`)}</div>`
    : empty(ok ? "Ajoutez votre premier produit avec une vraie photo." : "Vous pourrez ajouter des produits après la validation de votre boutique.")}`);
  $$("[data-vis]", el).forEach((b) => { b.onclick = () => run(b, async () => {
    must(await sb.from("products").update({ published: b.dataset.on !== "1" }).eq("id", b.dataset.vis));
    toast(b.dataset.on === "1" ? "Produit masqué" : "Produit en ligne"); products(el);
  }); });
}

export async function productForm(root, id) {
  if (!requireLogin()) return;
  await loadSession();
  if (state.shop?.status !== "approved") return go("/vendeur");
  let p = { name: "", category: state.shop.categories?.[0] || "autres", unit: "pièce", description: "", images: [], retail_price: null, stock: 0, published: true, city: state.shop.city, price_tiers: [] };
  if (id !== "nouveau") {
    const { data } = await sb.from("products").select("*, price_tiers(min_qty,unit_price)").eq("id", id).eq("shop_id", state.shop.id).maybeSingle();
    if (!data) return setHTML(root, empty("Produit introuvable."));
    p = data;
  }
  let images = [...(p.images || [])];
  let tiers = tiersOf(p).map((t) => ({ ...t }));
  let busy = false;
  const draw = () => {
    setHTML(root, html`<section class="wrap narrow"><a class="back" href="#/vendeur?onglet=produits">${ic("back", 18)} Mes produits</a>
      <h1>${id === "nouveau" ? "Ajouter un produit" : "Modifier le produit"}</h1>
      <form id="f">
      <div class="panel">
        <h3>Photos réelles <small class="muted">(${images.length}/6)</small></h3>
        <div class="imgs">${images.map((u, i) => html`<div class="im">
          <img src="${u}" alt="Photo ${i + 1}">${i === 0 ? html`<span class="main">Principale</span>` : ""}
          <div class="imtools">
            ${i ? html`<button type="button" data-first="${i}" aria-label="Mettre en principale">${ic("star", 14)}</button>` : ""}
            <button type="button" data-crop="${i}" aria-label="Recadrer en carré">${ic("crop", 14)}</button>
            <label aria-label="Remplacer">${ic("replace", 14)}<input type="file" accept="image/*" data-rep="${i}" hidden></label>
            <button type="button" data-rm="${i}" aria-label="Supprimer">${ic("trash", 14)}</button>
          </div></div>`)}</div>
        ${images.length < 6 ? html`<div class="actions">
          <label class="btn outline sm">${ic("camera", 18)} Prendre une photo<input type="file" accept="image/*" capture="environment" id="cam" hidden></label>
          <label class="btn outline sm">${ic("image", 18)} Galerie<input type="file" accept="image/*" multiple id="gal" hidden></label></div>` : ""}
        ${busy ? html`<p class="muted small"><span class="spinner"></span> Envoi de la photo…</p>` : ""}
      </div>
      <div class="panel">
        <label>Nom du produit<input name="name" required minlength="2" maxlength="120" value="${p.name}" placeholder="Ex : Riz local 25 kg"></label>
        <div class="two"><label>Catégorie<select name="category">${CATEGORIES.map(([k, l]) => html`<option value="${k}" ${p.category === k ? "selected" : ""}>${l}</option>`)}</select></label>
        <label>Unité de vente<input name="unit" required value="${p.unit}" list="units" placeholder="pièce, sac, carton…"></label></div>
        <datalist id="units"><option>pièce</option><option>sac</option><option>carton</option><option>kg</option><option>tonne</option><option>litre</option><option>bidon</option><option>paquet</option><option>mètre</option><option>douzaine</option></datalist>
        <div class="two"><label>Prix au détail (FCFA)<input name="retail_price" type="number" min="1" inputmode="numeric" value="${p.retail_price ?? ""}" placeholder="Vide = gros seulement"></label>
        <label>Quantité disponible<input name="stock" type="number" min="0" required inputmode="numeric" value="${p.stock}"></label></div>
      </div>
      <div class="panel">
        <h3>Prix de gros <small class="muted">(facultatif)</small></h3>
        <div id="tiers">${tiers.map((t, i) => html`<div class="tier"><label>À partir de (quantité)<input type="number" min="1" inputmode="numeric" data-t="${i}" data-k="min_qty" value="${t.min_qty}"></label>
          <label>Prix par ${p.unit} (FCFA)<input type="number" min="1" inputmode="numeric" data-t="${i}" data-k="unit_price" value="${t.unit_price}"></label><button type="button" class="icon" data-tdel="${i}" aria-label="Retirer">${ic("x", 18)}</button></div>`)}</div>
        <button type="button" class="btn ghost sm" id="addt">${ic("plus", 16)} Ajouter un prix de gros</button>
        <p class="muted small">La première quantité est la <b>quantité minimale pour le gros</b>. Sans prix au détail, c'est aussi le minimum de commande.</p>
      </div>
      <div class="panel">
        <label>Localisation du produit<select name="city">${CITIES.map((c) => html`<option ${(p.city || state.shop.city) === c ? "selected" : ""}>${c}</option>`)}</select></label>
        <label>Description<textarea name="description" rows="4" maxlength="5000" placeholder="Qualité, taille, couleur, conditions…">${p.description}</textarea></label>
        <label class="check"><input type="checkbox" name="published" ${p.published ? "checked" : ""}> Publier (visible dans le catalogue)</label>
      </div>
      <button class="btn big" id="go">${id === "nouveau" ? "Publier le produit" : "Enregistrer"}</button>
      ${id !== "nouveau" ? html`<button type="button" class="btn ghost danger big" id="del">${ic("trash", 18)} Supprimer ce produit</button>` : ""}
      </form></section>`);
    const f = $("#f");
    const keep = () => { p = { ...p, name: f.name.value, category: f.category.value, unit: f.unit.value, retail_price: f.retail_price.value ? Number(f.retail_price.value) : null, stock: Number(f.stock.value || 0), published: f.published.checked, description: f.description.value, city: f.city.value }; };
    const withBusy = async (fn) => { keep(); busy = true; draw(); try { await fn(); } catch (err) { toast(err.message, "err"); } busy = false; draw(); };
    $$("[data-t]", root).forEach((inp) => { inp.oninput = () => { tiers[inp.dataset.t][inp.dataset.k] = Number(inp.value); }; });
    $$("[data-tdel]", root).forEach((b) => { b.onclick = () => { keep(); tiers.splice(Number(b.dataset.tdel), 1); draw(); }; });
    $("#addt").onclick = () => { keep(); const last = tiers.at(-1); tiers.push({ min_qty: last ? last.min_qty * 2 : 10, unit_price: last?.unit_price || p.retail_price || 0 }); draw(); };
    $$("[data-rm]", root).forEach((b) => { b.onclick = () => { keep(); images.splice(Number(b.dataset.rm), 1); draw(); }; });
    $$("[data-first]", root).forEach((b) => { b.onclick = () => { keep(); const [x] = images.splice(Number(b.dataset.first), 1); images.unshift(x); draw(); }; });
    $$("[data-crop]", root).forEach((b) => { b.onclick = () => withBusy(async () => { images[Number(b.dataset.crop)] = await uploadImage(images[Number(b.dataset.crop)], { square: true }); toast("Photo recadrée"); }); });
    $$("[data-rep]", root).forEach((inp) => { inp.onchange = () => inp.files[0] && withBusy(async () => { images[Number(inp.dataset.rep)] = await uploadImage(inp.files[0]); }); });
    const addFiles = (files) => withBusy(async () => { for (const file of [...files].slice(0, 6 - images.length)) images.push(await uploadImage(file)); });
    $("#cam")?.addEventListener("change", (e) => addFiles(e.target.files));
    $("#gal")?.addEventListener("change", (e) => addFiles(e.target.files));
    $("#del")?.addEventListener("click", (e) => { if (confirm("Supprimer définitivement ce produit ?")) run(e.currentTarget, async () => { must(await sb.from("products").delete().eq("id", id)); toast("Produit supprimé"); go("/vendeur?onglet=produits"); }); });
    f.onsubmit = (e) => {
      e.preventDefault(); keep();
      const clean = tiers.filter((t) => t.min_qty > 0 && t.unit_price > 0).sort((a, b) => a.min_qty - b.min_qty);
      if (new Set(clean.map((t) => t.min_qty)).size !== clean.length) return toast("Deux prix de gros ont la même quantité.", "err");
      if (!p.retail_price && !clean.length) return toast("Indiquez un prix au détail ou un prix de gros.", "err");
      if (p.published && !images.length) return toast("Ajoutez au moins une vraie photo du produit.", "err");
      run($("#go"), async () => {
        const row = { name: p.name.trim(), category: p.category, unit: p.unit.trim() || "pièce", retail_price: p.retail_price, stock: p.stock, published: p.published, description: p.description.trim(), images, city: p.city, updated_at: new Date().toISOString() };
        const saved = id === "nouveau" ? must(await sb.from("products").insert({ ...row, shop_id: state.shop.id }).select().single())
          : must(await sb.from("products").update(row).eq("id", id).select().single());
        must(await sb.from("price_tiers").delete().eq("product_id", saved.id));
        if (clean.length) must(await sb.from("price_tiers").insert(clean.map((t) => ({ product_id: saved.id, min_qty: t.min_qty, unit_price: t.unit_price }))));
        toast("Produit enregistré"); go("/vendeur?onglet=produits");
      });
    };
  };
  draw();
}

// ---------- Commandes reçues ----------
const NEXT = {
  new: [["confirmed", "Confirmer"], ["cancelled", "Refuser"]],
  confirmed: [["preparing", "En préparation"], ["shipped", "En livraison"], ["delivered", "Livrée / retirée"], ["cancelled", "Annuler"]],
  preparing: [["shipped", "En livraison"], ["delivered", "Livrée / retirée"], ["cancelled", "Annuler"]],
  shipped: [["delivered", "Livrée"]],
};
async function sellerOrders(el) {
  const { data } = await sb.from("sub_orders").select("*, orders(reference, customer_name, phone, city, address, delivery_mode, payment_method, payment_status, note, created_at, source), order_items(*)")
    .eq("shop_id", state.shop.id).order("created_at", { ascending: false }).limit(200);
  const active = (data || []).filter((s) => !["delivered", "completed", "cancelled"].includes(s.status));
  const done = (data || []).filter((s) => ["delivered", "completed", "cancelled"].includes(s.status));
  const card = (s) => html`<div class="panel">
    <div class="row"><b>N° ${s.orders.reference}</b>${statusBadge(s.status)}</div>
    <div class="muted small">${fdatetime(s.created_at)} · ${s.orders.customer_name} · <a href="tel:${s.orders.phone}">${fphone(s.orders.phone)}</a></div>
    <div class="muted small">${s.orders.delivery_mode === "delivery" ? html`${ic("truck", 14)} ${s.orders.city}, ${s.orders.address}` : html`${ic("store", 14)} Retrait en boutique`}</div>
    ${s.orders.note ? html`<div class="note small">Précisions : ${s.orders.note}</div>` : ""}
    ${s.order_items.map((i) => html`<div class="row small"><span>${i.quantity} ${i.unit} × ${i.name}</span><b>${fcfa(i.unit_price * i.quantity)}</b></div>`)}
    <div class="row total"><span>Total client</span><b>${fcfa(s.total)}</b></div>
    <div class="muted small">${s.payout_status !== "none" ? `Payé par mobile money · ${PAYOUT[s.payout_status]}` : "Paiement à la livraison : encaissez le client"} · commission ${fcfa(s.commission_amount)}</div>
    ${NEXT[s.status] ? html`<div class="actions">${NEXT[s.status].map(([st, l]) => html`<button class="btn sm ${st === "cancelled" ? "ghost" : ""}" data-sub="${s.id}" data-st="${st}">${l}</button>`)}</div>` : ""}
  </div>`;
  setHTML(el, html`<h2>À traiter (${active.length})</h2>${active.length ? active.map(card) : empty("Aucune commande en cours.")}
    ${done.length ? html`<h2>Terminées</h2>${done.slice(0, 30).map(card)}` : ""}`);
  $$("[data-sub]", el).forEach((b) => { b.onclick = () => {
    if (b.dataset.st === "cancelled" && !confirm("Annuler cette commande ? Le stock sera remis.")) return;
    run(b, async () => { must(await sb.rpc("set_sub_order_status", { _sub: b.dataset.sub, _status: b.dataset.st })); toast(`Statut : ${ORDER_STATUS[b.dataset.st]}`); sellerOrders(el); });
  }; });
}

// ---------- Gains ----------
async function earnings(el) {
  const { data } = await sb.from("sub_orders").select("status, total, commission_amount, payout_status").eq("shop_id", state.shop.id);
  const rows = data || [];
  const net = (s) => s.total - s.commission_amount; const sum = (a, f) => a.reduce((x, s) => x + f(s), 0);
  const delivered = rows.filter((s) => ["delivered", "completed"].includes(s.status));
  const held = rows.filter((s) => s.payout_status === "held" && s.status !== "cancelled");
  setHTML(el, html`<div class="stats">
      <div class="stat"><small>Ventes livrées</small><b>${fcfa(sum(delivered, (s) => s.total))}</b><small>${delivered.length} commande(s)</small></div>
      <div class="stat"><small>Argent gardé (attente de réception)</small><b>${fcfa(sum(held, net))}</b></div>
      <div class="stat good"><small>À recevoir d'ANW KA SUGU</small><b>${fcfa(sum(rows.filter((s) => s.payout_status === "to_release"), net))}</b></div>
      <div class="stat"><small>Déjà versé</small><b>${fcfa(sum(rows.filter((s) => s.payout_status === "released"), net))}</b></div>
      <div class="stat warn"><small>Commission due (ventes en espèces)</small><b>${fcfa(sum(delivered.filter((s) => s.payout_status === "none"), (s) => s.commission_amount))}</b></div>
    </div>
    <p class="muted small">Paiement mobile : ANW KA SUGU vous verse l'argent (moins la commission) dès que le client confirme la réception. Paiement en espèces : vous encaissez directement et réglez ensuite la commission.</p>`);
}
export { catLabel };
