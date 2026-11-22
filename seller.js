// Espace vendeur / fournisseur : boutique, produits avec prix de gros, commandes, gains.
import {
  sb, state, loadSession, html, setHTML, $, $$, fcfa, fdate, fdatetime, CATEGORIES, catLabel, catIcon, KINDS, CITIES,
  ORDER_STATUS, PAYOUT, SHOP_STATUS, verifiedBadge, empty, loading, toast, run, must, go, query, requireLogin,
  uploadImage, uploadDocument, tiersOf, fromPrice,
} from "./lib.js";

export async function seller(root) {
  if (!requireLogin()) return;
  await loadSession();
  if (!state.shop) return shopForm(root, null);
  const s = state.shop; const tab = query().onglet || "commandes";
  setHTML(root, html`<section class="wrap">
    <div class="shop-head"><div class="logo">${s.logo_url ? html`<img src="${s.logo_url}" alt="">` : s.name[0]}</div>
      <div><h1>${s.name} ${verifiedBadge(s)}</h1><div class="muted">${KINDS[s.kind]} · ${s.city} · <a href="#/boutique/${s.id}">voir ma page publique</a></div></div></div>
    ${s.status !== "approved" ? html`<div class="alert ${s.status}">Statut : <b>${SHOP_STATUS[s.status]}</b>.
      ${s.status === "pending" ? " L'équipe ANW KA SUGU vérifie votre boutique. Vous pourrez ajouter vos produits dès la validation." : ""}
      ${s.rejection_reason ? html`<br>Motif : ${s.rejection_reason}` : ""}</div>` : ""}
    ${s.status === "approved" && !s.verified ? html`<p class="note">Obtenez le badge <b>✔ Vérifié</b> : ajoutez vos documents (carte d'identité, registre de commerce) dans l'onglet « Ma boutique ». Les acheteurs font davantage confiance aux fournisseurs vérifiés.</p>` : ""}
    <div class="tabs">${[["commandes", "Commandes"], ["produits", "Produits"], ["gains", "Gains"], ["boutique", "Ma boutique"]]
      .map(([k, l]) => html`<a class="${tab === k ? "on" : ""}" href="#/vendeur?onglet=${k}">${l}</a>`)}<a href="#/devis?onglet=ouvertes">Devis acheteurs</a></div>
    <div id="tab">${loading()}</div></section>`);
  const el = $("#tab");
  if (tab === "produits") return products(el);
  if (tab === "gains") return earnings(el);
  if (tab === "boutique") return shopForm(el, s);
  return sellerOrders(el);
}

// ---------- Création / modification de la boutique ----------
async function shopForm(root, s) {
  const priv = s ? (await sb.from("shop_private").select("*").eq("shop_id", s.id).maybeSingle()).data || {} : {};
  setHTML(root, html`<section class="${s ? "" : "wrap narrow"}">
    ${s ? "" : html`<h1>Ouvrir ma boutique</h1><p class="muted">Fabricant, grossiste ou boutique : vendez au détail et en gros à tout le Mali. L'inscription est gratuite. ANW KA SUGU prend une petite commission uniquement sur les ventes livrées.</p>`}
    <form class="panel" id="f">
      <h3>Boutique</h3>
      <label>Nom de la boutique<input name="name" required minlength="2" maxlength="80" value="${s?.name || ""}"></label>
      <div class="two"><label>Type<select name="kind">${Object.entries(KINDS).map(([k, l]) => html`<option value="${k}" ${s?.kind === k ? "selected" : ""}>${l}</option>`)}</select></label>
      <label>Ville<select name="city">${CITIES.map((c) => html`<option ${s?.city === c ? "selected" : ""}>${c}</option>`)}</select></label></div>
      <label>Adresse / marché<input name="address" value="${s?.address || ""}" placeholder="Ex : Grand marché de Bamako, allée 4"></label>
      <div class="two"><label>WhatsApp (avec indicatif)<input name="whatsapp" type="tel" value="${s?.whatsapp || ""}" placeholder="223 70 00 00 00"></label>
      <label>Frais de livraison (FCFA, 0 = à convenir)<input name="delivery_fee" type="number" min="0" value="${s?.delivery_fee ?? 0}"></label></div>
      <label>Présentation<textarea name="description" rows="4" maxlength="2000" placeholder="Ce que vous vendez, depuis quand, vos conditions…">${s?.description || ""}</textarea></label>
      <fieldset><legend>Catégories</legend><div class="chips">${CATEGORIES.map(([k, l]) => html`<label class="chip"><input type="checkbox" name="categories" value="${k}" ${s?.categories?.includes(k) ? "checked" : ""}> ${l}</label>`)}</div></fieldset>
      <label>Logo<input type="file" name="logo" accept="image/*"></label>
      <h3>Vérification (privé : visible seulement par vous et l'administrateur)</h3>
      <div class="two"><label>Nom du responsable<input name="manager_name" value="${priv.manager_name || ""}" required></label>
      <label>Téléphone du responsable<input name="manager_phone" type="tel" value="${priv.manager_phone || ""}" required></label></div>
      <label>Registre de commerce / NIF / autres infos<textarea name="business_info" rows="2">${priv.business_info || ""}</textarea></label>
      <label>Documents (carte d'identité, RCCM… photos ou PDF)<input type="file" name="docs" accept="image/*,application/pdf" multiple></label>
      ${priv.documents?.length ? html`<p class="muted">${priv.documents.length} document(s) déjà envoyé(s).</p>` : ""}
      <button class="btn big" id="go">${s ? "Enregistrer" : "Envoyer ma demande"}</button>
    </form></section>`);
  $("#f").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    run($("#go"), async () => {
      const logo = fd.get("logo");
      const row = {
        name: fd.get("name").trim(), kind: fd.get("kind"), city: fd.get("city"), address: fd.get("address").trim(),
        whatsapp: fd.get("whatsapp").trim(), delivery_fee: Number(fd.get("delivery_fee") || 0), description: fd.get("description").trim(),
        categories: fd.getAll("categories"),
      };
      if (logo?.size) row.logo_url = await uploadImage(logo);
      const shop = s ? must(await sb.from("shops").update(row).eq("id", s.id).select().single())
        : must(await sb.from("shops").insert({ ...row, owner_id: state.user.id }).select().single());
      const docs = [...(priv.documents || [])];
      for (const f of fd.getAll("docs")) if (f?.size) docs.push(await uploadDocument(f));
      must(await sb.from("shop_private").upsert({ shop_id: shop.id, manager_name: fd.get("manager_name").trim(), manager_phone: fd.get("manager_phone").trim(), business_info: fd.get("business_info").trim(), documents: docs }));
      await loadSession();
      toast(s ? "Boutique mise à jour ✔" : "Demande envoyée ✔ Nous vous répondons rapidement.");
      go(`/vendeur?onglet=${s ? "boutique" : "commandes"}&t=${Date.now()}`);
    });
  };
}

// ---------- Produits ----------
async function products(el) {
  const { data } = await sb.from("products").select("*, price_tiers(min_qty,unit_price)").eq("shop_id", state.shop.id).order("created_at", { ascending: false });
  setHTML(el, html`<div class="sec-head"><h2>Mes produits (${data?.length || 0})</h2>${state.shop.status === "approved" ? html`<a class="btn" href="#/vendeur/produit/nouveau">+ Ajouter un produit</a>` : ""}</div>
    ${data?.length ? html`<div class="table">${data.map((p) => html`<a class="trow" href="#/vendeur/produit/${p.id}">
      <span class="lthumb">${p.images?.[0] ? html`<img src="${p.images[0]}" alt="">` : catIcon(p.category)}</span>
      <span class="grow"><b>${p.name}</b><br><small class="muted">${p.retail_price ? `Détail ${fcfa(p.retail_price)}` : "Gros uniquement"}${tiersOf(p).length ? ` · ${tiersOf(p).length} prix de gros dès ${fcfa(Math.min(...tiersOf(p).map((t) => t.unit_price)))}` : ""}</small></span>
      <span class="${p.stock ? "" : "err"}">Stock : ${p.stock}</span>
      <span>${p.published ? "🟢 En ligne" : "⚪ Masqué"}</span></a>`)}</div>`
    : empty(state.shop.status === "approved" ? "Ajoutez votre premier produit." : "Vous pourrez ajouter des produits après la validation de votre boutique.")}`);
}

export async function productForm(root, id) {
  if (!requireLogin()) return;
  await loadSession();
  if (state.shop?.status !== "approved") return go("/vendeur");
  let p = { name: "", category: state.shop.categories?.[0] || "autres", unit: "pièce", description: "", images: [], retail_price: null, stock: 0, published: true, price_tiers: [] };
  if (id !== "nouveau") {
    const { data } = await sb.from("products").select("*, price_tiers(min_qty,unit_price)").eq("id", id).eq("shop_id", state.shop.id).maybeSingle();
    if (!data) return setHTML(root, empty("Produit introuvable."));
    p = data;
  }
  let images = [...(p.images || [])];
  let tiers = tiersOf(p).map((t) => ({ ...t }));
  const draw = () => {
    setHTML(root, html`<section class="wrap narrow"><a href="#/vendeur?onglet=produits" class="muted">← Mes produits</a>
      <h1>${id === "nouveau" ? "Nouveau produit" : "Modifier le produit"}</h1>
      <form class="panel" id="f">
        <label>Nom du produit<input name="name" required minlength="2" maxlength="120" value="${p.name}"></label>
        <div class="two"><label>Catégorie<select name="category">${CATEGORIES.map(([k, l]) => html`<option value="${k}" ${p.category === k ? "selected" : ""}>${l}</option>`)}</select></label>
        <label>Unité de vente<input name="unit" required value="${p.unit}" placeholder="pièce, sac, carton, kg…" list="units"></label></div>
        <datalist id="units"><option>pièce</option><option>sac</option><option>carton</option><option>kg</option><option>tonne</option><option>litre</option><option>bidon</option><option>paquet</option><option>mètre</option><option>douzaine</option></datalist>
        <h3>Photos (6 maximum)</h3>
        <div class="imgs">${images.map((u, i) => html`<div class="im"><img src="${u}" alt=""><button type="button" class="icon" data-rm="${i}" aria-label="Retirer">✕</button></div>`)}
          ${images.length < 6 ? html`<label class="im add">＋<input type="file" accept="image/*" multiple id="up" hidden></label>` : ""}</div>
        <h3>Prix</h3>
        <label>Prix au détail (à l'unité) — laissez vide si vous vendez seulement en gros<input name="retail_price" type="number" min="1" value="${p.retail_price ?? ""}" inputmode="numeric" placeholder="FCFA"></label>
        <p class="muted">Prix de gros : plus le client achète, moins il paie par unité.</p>
        <div id="tiers">${tiers.map((t, i) => html`<div class="tier"><label>À partir de<input type="number" min="1" data-t="${i}" data-k="min_qty" value="${t.min_qty}"></label>
          <label>Prix par unité<input type="number" min="1" data-t="${i}" data-k="unit_price" value="${t.unit_price}"></label><button type="button" class="icon" data-tdel="${i}" aria-label="Retirer">✕</button></div>`)}</div>
        <button type="button" class="btn outline" id="addt">+ Ajouter un prix de gros</button>
        <div class="two"><label>Stock disponible<input name="stock" type="number" min="0" required value="${p.stock}" inputmode="numeric"></label>
        <label class="check"><input type="checkbox" name="published" ${p.published ? "checked" : ""}> Visible dans le catalogue</label></div>
        <label>Description<textarea name="description" rows="5" maxlength="5000">${p.description}</textarea></label>
        <button class="btn big" id="go">Enregistrer</button>
        ${id !== "nouveau" ? html`<button type="button" class="btn danger" id="del">Supprimer ce produit</button>` : ""}
      </form></section>`);
    const f = $("#f");
    const keep = () => { p = { ...p, name: f.name.value, category: f.category.value, unit: f.unit.value, retail_price: f.retail_price.value ? Number(f.retail_price.value) : null, stock: Number(f.stock.value || 0), published: f.published.checked, description: f.description.value }; };
    $$("[data-t]", root).forEach((inp) => { inp.oninput = () => { tiers[inp.dataset.t][inp.dataset.k] = Number(inp.value); }; });
    $$("[data-tdel]", root).forEach((b) => { b.onclick = () => { keep(); tiers.splice(Number(b.dataset.tdel), 1); draw(); }; });
    $("#addt").onclick = () => { keep(); const last = tiers.at(-1); tiers.push({ min_qty: last ? last.min_qty * 2 : 10, unit_price: last?.unit_price || p.retail_price || 0 }); draw(); };
    $$("[data-rm]", root).forEach((b) => { b.onclick = () => { keep(); images.splice(Number(b.dataset.rm), 1); draw(); }; });
    $("#up")?.addEventListener("change", async (e) => {
      keep(); const files = [...e.target.files].slice(0, 6 - images.length);
      toast("Envoi des photos…");
      try { for (const file of files) images.push(await uploadImage(file)); } catch (err) { toast(err.message, "err"); }
      draw();
    });
    $("#del")?.addEventListener("click", (e) => { if (confirm("Supprimer définitivement ce produit ?")) run(e.target, async () => { must(await sb.from("products").delete().eq("id", id)); toast("Produit supprimé"); go("/vendeur?onglet=produits"); }); });
    f.onsubmit = (e) => {
      e.preventDefault(); keep();
      const clean = tiers.filter((t) => t.min_qty > 0 && t.unit_price > 0).sort((a, b) => a.min_qty - b.min_qty);
      if (new Set(clean.map((t) => t.min_qty)).size !== clean.length) return toast("Deux prix de gros ont la même quantité.", "err");
      if (!p.retail_price && !clean.length) return toast("Indiquez un prix au détail ou au moins un prix de gros.", "err");
      run($("#go"), async () => {
        const row = { name: p.name.trim(), category: p.category, unit: p.unit.trim() || "pièce", retail_price: p.retail_price, stock: p.stock, published: p.published, description: p.description.trim(), images, updated_at: new Date().toISOString() };
        const saved = id === "nouveau" ? must(await sb.from("products").insert({ ...row, shop_id: state.shop.id }).select().single())
          : must(await sb.from("products").update(row).eq("id", id).select().single());
        must(await sb.from("price_tiers").delete().eq("product_id", saved.id));
        if (clean.length) must(await sb.from("price_tiers").insert(clean.map((t) => ({ product_id: saved.id, min_qty: t.min_qty, unit_price: t.unit_price }))));
        toast("Produit enregistré ✔"); go("/vendeur?onglet=produits");
      });
    };
  };
  draw();
}

// ---------- Commandes reçues ----------
const NEXT = { new: [["confirmed", "Confirmer"], ["cancelled", "Refuser"]], confirmed: [["shipped", "Marquer expédiée"], ["delivered", "Marquer livrée / retirée"], ["cancelled", "Annuler"]], shipped: [["delivered", "Marquer livrée"]] };

async function sellerOrders(el) {
  const { data } = await sb.from("sub_orders").select("*, orders(reference, customer_name, phone, city, address, delivery_mode, payment_method, payment_status, created_at, source), order_items(*)")
    .eq("shop_id", state.shop.id).order("created_at", { ascending: false }).limit(200);
  const active = (data || []).filter((s) => !["delivered", "cancelled"].includes(s.status));
  const done = (data || []).filter((s) => ["delivered", "cancelled"].includes(s.status));
  const card = (s) => html`<div class="panel">
    <div class="row"><b>${s.orders.reference}</b><span class="st st-${s.status}">${ORDER_STATUS[s.status]}</span></div>
    <div class="muted">${fdatetime(s.created_at)} · ${s.orders.customer_name} · <a href="tel:${s.orders.phone}">${s.orders.phone}</a></div>
    <div class="muted">${s.orders.delivery_mode === "delivery" ? `🚚 Livraison : ${s.orders.city}, ${s.orders.address}` : "🏪 Retrait en boutique"}${s.orders.source === "quote" ? " · 📝 devis" : ""}</div>
    ${s.order_items.map((i) => html`<div class="row"><span>${i.quantity} ${i.unit} × ${i.name}</span><b>${fcfa(i.unit_price * i.quantity)}</b></div>`)}
    <div class="row total"><span>Total client${s.delivery_fee ? " (livraison incluse)" : ""}</span><b>${fcfa(s.total)}</b></div>
    <div class="muted">${s.payout_status !== "none" ? `💰 Payé par mobile money — ${PAYOUT[s.payout_status]}` : "💵 Paiement à la livraison : encaissez le client"} · commission ${fcfa(s.commission_amount)}</div>
    ${NEXT[s.status] ? html`<div class="actions">${NEXT[s.status].map(([st, l]) => html`<button class="btn ${st === "cancelled" ? "outline" : ""}" data-sub="${s.id}" data-st="${st}">${l}</button>`)}</div>` : ""}
  </div>`;
  setHTML(el, html`<h2>À traiter (${active.length})</h2>${active.length ? active.map(card) : empty("Aucune commande en cours.")}
    ${done.length ? html`<h2>Terminées</h2>${done.slice(0, 30).map(card)}` : ""}`);
  $$("[data-sub]", el).forEach((b) => {
    b.onclick = () => {
      if (b.dataset.st === "cancelled" && !confirm("Annuler cette commande ? Le stock sera remis.")) return;
      run(b, async () => { must(await sb.rpc("set_sub_order_status", { _sub: b.dataset.sub, _status: b.dataset.st })); toast("Statut mis à jour ✔"); sellerOrders(el); });
    };
  });
}

// ---------- Gains ----------
async function earnings(el) {
  const { data } = await sb.from("sub_orders").select("status, products_total, delivery_fee, total, commission_amount, payout_status").eq("shop_id", state.shop.id);
  const rows = data || [];
  const net = (s) => s.total - s.commission_amount;
  const sum = (arr, f) => arr.reduce((a, s) => a + f(s), 0);
  const delivered = rows.filter((s) => s.status === "delivered");
  const held = rows.filter((s) => s.payout_status === "held" && s.status !== "cancelled");
  const toRelease = rows.filter((s) => s.payout_status === "to_release");
  const released = rows.filter((s) => s.payout_status === "released");
  const cashDue = delivered.filter((s) => s.payout_status === "none");
  setHTML(el, html`<div class="stats">
      <div class="stat"><small>Ventes livrées</small><b>${fcfa(sum(delivered, (s) => s.total))}</b><small>${delivered.length} commande(s)</small></div>
      <div class="stat"><small>Argent gardé (en attente de réception)</small><b>${fcfa(sum(held, net))}</b></div>
      <div class="stat good"><small>À recevoir d'ANW KA SUGU</small><b>${fcfa(sum(toRelease, net))}</b></div>
      <div class="stat"><small>Déjà versé</small><b>${fcfa(sum(released, net))}</b></div>
      <div class="stat warn"><small>Commission due sur ventes en espèces</small><b>${fcfa(sum(cashDue, (s) => s.commission_amount))}</b></div>
    </div>
    <p class="muted">Paiement mobile : ANW KA SUGU garde l'argent et vous le verse (moins la commission) dès que le client confirme la réception. Paiement en espèces : vous encaissez directement et réglez ensuite la commission à ANW KA SUGU.</p>`);
}
