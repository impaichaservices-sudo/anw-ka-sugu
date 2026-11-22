// Demandes de devis : l'acheteur publie un besoin, les fournisseurs proposent leur prix.
import {
  sb, state, html, setHTML, $, $$, fcfa, fdate, CATEGORIES, catLabel, catIcon, CITIES, verifiedBadge, stars,
  empty, loading, toast, run, must, go, query, requireLogin,
} from "./lib.js";

const RFQ_STATUS = { open: "Ouverte", closed: "Fermée", awarded: "Attribuée" };

export async function rfqList(root) {
  const tab = query().onglet || (state.shop?.status === "approved" ? "ouvertes" : "mes");
  setHTML(root, html`<section class="wrap narrow">
    <div class="sec-head"><h1>Demandes de devis</h1><a class="btn" href="#/devis/nouveau">+ Nouvelle demande</a></div>
    <p class="muted">Vous cherchez une grande quantité ? Décrivez votre besoin : les fournisseurs vous envoient leurs prix, vous choisissez la meilleure offre.</p>
    <div class="tabs"><a class="${tab === "ouvertes" ? "on" : ""}" href="#/devis?onglet=ouvertes">Demandes ouvertes</a><a class="${tab === "mes" ? "on" : ""}" href="#/devis?onglet=mes">Mes demandes</a></div>
    <div id="res">${loading()}</div></section>`);
  if (tab === "mes" && !state.user) return setHTML($("#res"), empty("Connectez-vous pour voir vos demandes.", html`<a class="btn" href="#/connexion?retour=/devis">Se connecter</a>`));
  if (tab === "ouvertes" && !state.user) return setHTML($("#res"), empty("Connectez-vous pour voir les demandes des acheteurs.", html`<a class="btn" href="#/connexion?retour=/devis">Se connecter</a>`));
  let rq = sb.from("rfqs").select("*, quotes(id, shop_id)").order("created_at", { ascending: false }).limit(100);
  rq = tab === "mes" ? rq.eq("buyer_id", state.user.id) : rq.eq("status", "open").neq("buyer_id", state.user.id);
  const { data } = await rq;
  if (!root.isConnected) return;
  setHTML($("#res"), data?.length ? html`${data.map((r) => html`<a class="panel rfq" href="#/devis/${r.id}">
    <div class="row"><b>${catIcon(r.category)} ${r.title}</b><span class="st st-${r.status}">${RFQ_STATUS[r.status]}</span></div>
    <div class="muted">${r.quantity} ${r.unit}${r.target_price ? ` · prix visé ${fcfa(r.target_price)} / ${r.unit}` : ""} · ${r.city} · ${fdate(r.created_at)}</div>
    <div class="muted">${tab === "mes" ? `${r.quotes.length} offre(s) reçue(s)` : state.shop && r.quotes.some((x) => x.shop_id === state.shop.id) ? "✔ vous avez répondu" : "Répondez avec votre prix"}</div></a>`)}`
    : empty(tab === "mes" ? "Vous n'avez pas encore publié de demande." : "Aucune demande ouverte pour le moment."));
}

export async function rfqNew(root) {
  if (!requireLogin()) return;
  setHTML(root, html`<section class="wrap narrow"><h1>Demander un devis</h1>
    <form class="panel" id="f">
      <label>Que recherchez-vous ?<input name="title" required minlength="3" maxlength="140" placeholder="Ex : 200 sacs de ciment CPA 42.5"></label>
      <div class="two"><label>Quantité<input name="quantity" type="number" min="1" required inputmode="numeric"></label>
      <label>Unité<input name="unit" value="pièce" required placeholder="sac, carton, tonne…"></label></div>
      <div class="two"><label>Catégorie<select name="category">${CATEGORIES.map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select></label>
      <label>Ville de livraison<select name="city">${CITIES.map((c) => html`<option ${state.profile?.city === c ? "selected" : ""}>${c}</option>`)}</select></label></div>
      <div class="two"><label>Prix visé par unité (facultatif)<input name="target_price" type="number" min="1" inputmode="numeric" placeholder="FCFA"></label>
      <label>Pour quand ? (facultatif)<input name="needed_by" type="date"></label></div>
      <label>Détails (qualité, marque, conditions…)<textarea name="description" maxlength="3000" rows="4"></textarea></label>
      <button class="btn big" id="go">Publier la demande</button>
    </form></section>`);
  $("#f").onsubmit = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    run($("#go"), async () => {
      const r = must(await sb.from("rfqs").insert({
        title: f.title.trim(), quantity: Number(f.quantity), unit: f.unit.trim(), category: f.category, city: f.city,
        target_price: f.target_price ? Number(f.target_price) : null, needed_by: f.needed_by || null, description: f.description.trim(),
      }).select().single());
      toast("Demande publiée ✔ Les fournisseurs vont vous répondre."); go(`/devis/${r.id}`);
    });
  };
}

export async function rfqDetail(root, id) {
  if (!requireLogin()) return;
  setHTML(root, loading());
  const { data: r } = await sb.from("rfqs").select("*, quotes(*, shops(id, name, city, verified, rating_avg, rating_count, kind))").eq("id", id).maybeSingle();
  if (!r) return setHTML(root, empty("Demande introuvable."));
  const mine = r.buyer_id === state.user.id;
  const myQuote = state.shop && r.quotes.find((x) => x.shop_id === state.shop.id);
  const canQuote = !mine && r.status === "open" && state.shop?.status === "approved";
  const quotes = [...r.quotes].sort((a, b) => a.unit_price - b.unit_price);
  setHTML(root, html`<section class="wrap narrow">
    <a href="#/devis" class="muted">← Demandes de devis</a>
    <div class="panel"><div class="row"><h1>${r.title}</h1><span class="st st-${r.status}">${RFQ_STATUS[r.status]}</span></div>
      <p><b>${r.quantity} ${r.unit}</b> · ${catLabel(r.category)} · livraison à ${r.city}${r.needed_by ? ` · avant le ${fdate(r.needed_by)}` : ""}</p>
      ${r.target_price ? html`<p>Prix visé : <b>${fcfa(r.target_price)}</b> / ${r.unit}</p>` : ""}
      ${r.description ? html`<p class="pre">${r.description}</p>` : ""}
      <p class="muted">Publiée le ${fdate(r.created_at)}</p>
      ${mine && r.status === "open" ? html`<button class="btn outline" id="close">Fermer la demande</button>` : ""}</div>

    ${mine ? html`<h2>Offres reçues (${quotes.length})</h2>
      ${quotes.length ? quotes.map((q) => html`<div class="panel quote ${q.status}">
        <div class="row"><b><a href="#/boutique/${q.shops?.id}">${q.shops?.name}</a> ${verifiedBadge(q.shops)}</b>${q.status !== "pending" ? html`<span class="st st-${q.status === "accepted" ? "delivered" : "cancelled"}">${q.status === "accepted" ? "Acceptée" : "Non retenue"}</span>` : ""}</div>
        <div class="muted">${q.shops?.city}${q.shops?.rating_count ? html` · ${stars(q.shops.rating_avg)}` : ""}</div>
        <div class="row"><span>${q.quantity} ${r.unit} × ${fcfa(q.unit_price)}</span><b>${fcfa(q.quantity * q.unit_price)}</b></div>
        <div class="muted">Délai : ${q.delivery_days} jour(s)</div>
        ${q.message ? html`<p class="pre">${q.message}</p>` : ""}
        ${r.status === "open" ? html`<div class="actions"><button class="btn" data-accept="${q.id}">Accepter cette offre</button><button class="btn outline" data-msg="${q.shop_id}">💬 Discuter</button></div>` : ""}
      </div>`) : empty("Pas encore d'offre. Les fournisseurs sont prévenus quand ils ouvrent l'application.")}
      <form class="panel hidden" id="acc"><h3>Vos coordonnées pour la commande</h3>
        <div class="two"><label>Nom<input name="name" required value="${state.profile?.full_name || ""}"></label><label>Téléphone<input name="phone" required value="${state.profile?.phone || ""}"></label></div>
        <div class="two"><label>Ville<input name="city" value="${r.city}"></label><label>Mode<select name="delivery_mode"><option value="delivery">Livraison</option><option value="pickup">Retrait</option></select></label></div>
        <label>Adresse<input name="address" value="${state.profile?.address || ""}"></label>
        <label>Paiement<select name="payment_method"><option value="mobile_money">Orange Money / Moov Money (sécurisé)</option><option value="cash">À la livraison</option></select></label>
        <button class="btn big" id="confirm">Confirmer et créer la commande</button></form>`
    : html`
      ${myQuote ? html`<div class="panel"><h3>Votre offre</h3><p>${myQuote.quantity} ${r.unit} × ${fcfa(myQuote.unit_price)} = <b>${fcfa(myQuote.quantity * myQuote.unit_price)}</b> · ${myQuote.delivery_days} j</p>
        <p class="muted">Statut : ${myQuote.status === "pending" ? "en attente de l'acheteur" : myQuote.status === "accepted" ? "✔ acceptée — voir vos commandes" : "non retenue"}</p></div>` : ""}
      ${canQuote ? html`<form class="panel" id="q"><h3>${myQuote ? "Modifier mon offre" : "Proposer mon prix"}</h3>
        <div class="two"><label>Prix par ${r.unit} (FCFA)<input name="unit_price" type="number" min="1" required value="${myQuote?.unit_price || ""}" inputmode="numeric"></label>
        <label>Quantité proposée<input name="quantity" type="number" min="1" required value="${myQuote?.quantity || r.quantity}" inputmode="numeric"></label></div>
        <label>Délai de livraison (jours)<input name="delivery_days" type="number" min="0" max="365" value="${myQuote?.delivery_days ?? 3}"></label>
        <label>Message à l'acheteur<textarea name="message" maxlength="2000" rows="3">${myQuote?.message || ""}</textarea></label>
        <div class="live" id="qt"></div>
        <button class="btn big" id="send">${myQuote ? "Mettre à jour" : "Envoyer mon offre"}</button></form>`
      : !state.shop && !mine ? html`<p class="note">Vous êtes fournisseur ? <a href="#/vendeur">Ouvrez votre boutique</a> pour répondre aux demandes.</p>` : ""}`}
  </section>`);

  $("#close")?.addEventListener("click", (e) => { if (confirm("Fermer cette demande ?")) run(e.target, async () => { must(await sb.rpc("close_rfq", { _rfq: id })); rfqDetail(root, id); }); });
  let chosen = null;
  $$("[data-accept]", root).forEach((b) => { b.onclick = () => { chosen = b.dataset.accept; $("#acc").classList.remove("hidden"); $("#acc").scrollIntoView({ behavior: "smooth" }); }; });
  $$("[data-msg]", root).forEach((b) => { b.onclick = async () => { const { data, error } = await sb.rpc("open_conversation", { _shop: b.dataset.msg }); if (!error) go(`/messages/${data}`); }; });
  $("#acc")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const info = Object.fromEntries(new FormData(e.target));
    run($("#confirm"), async () => { const oid = must(await sb.rpc("accept_quote", { _quote: chosen, _info: info })); toast("Commande créée ✔"); go(`/commande/${oid}${info.payment_method === "mobile_money" ? "?payer=1" : ""}`); });
  });
  const qf = $("#q");
  if (qf) {
    const upd = () => setHTML($("#qt"), qf.unit_price.value && qf.quantity.value ? html`Total de l'offre : <b>${fcfa(qf.unit_price.value * qf.quantity.value)}</b>` : "");
    qf.oninput = upd; upd();
    qf.onsubmit = (e) => {
      e.preventDefault();
      const v = { unit_price: Number(qf.unit_price.value), quantity: Number(qf.quantity.value), delivery_days: Number(qf.delivery_days.value || 0), message: qf.message.value.trim() };
      run($("#send"), async () => {
        if (myQuote) must(await sb.from("quotes").update(v).eq("id", myQuote.id));
        else must(await sb.from("quotes").insert({ ...v, rfq_id: id, shop_id: state.shop.id }));
        toast("Offre envoyée ✔"); rfqDetail(root, id);
      });
    };
  }
}
