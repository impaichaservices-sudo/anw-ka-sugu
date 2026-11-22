// Administration ANW KA SUGU : validation et vérification des boutiques, versements, commandes, réglages.
import {
  sb, state, html, setHTML, $, $$, fcfa, fdate, fdatetime, KINDS, SHOP_STATUS, ORDER_STATUS, PAYOUT, verifiedBadge,
  empty, loading, toast, run, must, go, query, requireLogin, waLink,
} from "./lib.js";

export async function admin(root) {
  if (!requireLogin()) return;
  if (!state.isAdmin) return setHTML(root, empty("Accès réservé à l'administrateur."));
  const tab = query().onglet || "boutiques";
  setHTML(root, html`<section class="wrap"><h1>Administration</h1>
    <div class="tabs">${[["boutiques", "Boutiques"], ["versements", "Argent & versements"], ["commandes", "Commandes"], ["reglages", "Réglages"]]
      .map(([k, l]) => html`<a class="${tab === k ? "on" : ""}" href="#/admin?onglet=${k}">${l}</a>`)}</div>
    <div id="tab">${loading()}</div></section>`);
  const el = $("#tab");
  if (tab === "versements") return payouts(el);
  if (tab === "commandes") return allOrders(el);
  if (tab === "reglages") return settings(el);
  return shopsAdmin(el);
}

async function shopsAdmin(el) {
  const filter = query().statut || "pending";
  let rq = sb.from("shops").select("*, shop_private(*)").order("created_at", { ascending: false }).limit(200);
  if (filter !== "toutes") rq = rq.eq("status", filter);
  const { data, error } = await rq;
  if (error) return setHTML(el, empty(error.message));
  setHTML(el, html`<div class="chips">${[["pending", "En attente"], ["approved", "Validées"], ["rejected", "Refusées"], ["suspended", "Suspendues"], ["toutes", "Toutes"]]
    .map(([k, l]) => html`<a class="chip ${filter === k ? "on" : ""}" href="#/admin?onglet=boutiques&statut=${k}">${l}</a>`)}</div>
    ${data.length ? data.map((s) => { const p = s.shop_private || {}; return html`<div class="panel">
      <div class="row"><h3>${s.name} ${verifiedBadge(s)}</h3><span class="st st-${s.status}">${SHOP_STATUS[s.status]}</span></div>
      <div class="muted">${KINDS[s.kind]} · ${s.city} · ${s.address} · inscrite le ${fdate(s.created_at)}</div>
      <p>Responsable : <b>${p.manager_name || "—"}</b> · ${p.manager_phone ? html`<a href="tel:${p.manager_phone}">${p.manager_phone}</a>` : "—"}
        ${s.whatsapp ? html` · <a target="_blank" rel="noopener" href="${waLink(s.whatsapp)}">WhatsApp</a>` : ""}</p>
      ${p.business_info ? html`<p class="pre">${p.business_info}</p>` : ""}
      ${s.description ? html`<p class="pre muted">${s.description}</p>` : ""}
      <div class="docs">${(p.documents || []).map((d, i) => html`<button class="btn outline small" data-doc="${d}">📄 Document ${i + 1}</button>`)}</div>
      <div class="actions">
        ${s.status !== "approved" ? html`<button class="btn" data-id="${s.id}" data-set="approved">Valider</button>` : ""}
        ${s.status === "pending" ? html`<button class="btn outline" data-id="${s.id}" data-set="rejected">Refuser</button>` : ""}
        ${s.status === "approved" ? html`<button class="btn outline" data-id="${s.id}" data-set="suspended">Suspendre</button>` : ""}
        <button class="btn ${s.verified ? "outline" : "gold"}" data-id="${s.id}" data-verif="${s.verified ? "0" : "1"}">${s.verified ? "Retirer le badge vérifié" : "✔ Marquer vérifié"}</button>
        <a class="btn outline" href="#/boutique/${s.id}">Voir</a>
      </div></div>`; }) : empty("Aucune boutique dans cette liste.")}`);
  $$("[data-set]", el).forEach((b) => { b.onclick = () => {
    const status = b.dataset.set; let reason = null;
    if (status !== "approved") { reason = prompt(status === "rejected" ? "Motif du refus (visible par le vendeur) :" : "Motif de la suspension :"); if (reason === null) return; }
    run(b, async () => { must(await sb.from("shops").update({ status, rejection_reason: reason || null }).eq("id", b.dataset.id)); toast("Fait ✔"); shopsAdmin(el); });
  }; });
  $$("[data-verif]", el).forEach((b) => { b.onclick = () => run(b, async () => { must(await sb.from("shops").update({ verified: b.dataset.verif === "1" }).eq("id", b.dataset.id)); toast("Fait ✔"); shopsAdmin(el); }); });
  $$("[data-doc]", el).forEach((b) => { b.onclick = () => run(b, async () => {
    const { signedUrl } = must(await sb.storage.from("documents").createSignedUrl(b.dataset.doc, 300));
    window.open(signedUrl, "_blank", "noopener");
  }); });
}

async function payouts(el) {
  const { data } = await sb.from("sub_orders").select("*, shops(name, whatsapp, shop_private(manager_name, manager_phone)), orders(reference, customer_name, phone, paid_amount, total)")
    .in("payout_status", ["held", "to_release", "to_refund"]).order("updated_at", { ascending: true }).limit(300);
  const { data: over } = await sb.from("orders").select("id, reference, customer_name, phone, paid_amount, total").eq("payment_status", "paid").limit(500);
  const overpaid = (over || []).filter((o) => o.paid_amount > o.total);
  const rows = data || [];
  const group = (k) => rows.filter((s) => s.payout_status === k);
  const net = (s) => s.total - s.commission_amount;
  const line = (s) => html`<div class="panel">
    <div class="row"><b>${s.orders?.reference} · ${s.shops?.name}</b><span class="st">${ORDER_STATUS[s.status]}</span></div>
    <div class="row"><span>Total payé pour cette boutique</span><b>${fcfa(s.total)}</b></div>
    ${s.payout_status === "to_refund" ? html`<p>Rembourser <b>${fcfa(s.total)}</b> au client ${s.orders?.customer_name} (<a href="tel:${s.orders?.phone}">${s.orders?.phone}</a>)</p>
      <button class="btn" data-sub="${s.id}" data-p="refunded">Marquer remboursé</button>`
    : html`<p>Verser <b>${fcfa(net(s))}</b> au vendeur (commission ${fcfa(s.commission_amount)} gardée) — ${s.shops?.shop_private?.manager_name || ""} ${s.shops?.shop_private?.manager_phone || s.shops?.whatsapp || ""}</p>
      <div class="actions"><button class="btn" data-sub="${s.id}" data-p="released">Marquer versé</button>
      ${s.payout_status === "held" ? html`<button class="btn outline" data-sub="${s.id}" data-p="refunded">Rembourser le client</button>` : ""}</div>`}
  </div>`;
  setHTML(el, html`<div class="stats">
      <div class="stat"><small>Argent gardé (en attente de réception)</small><b>${fcfa(group("held").reduce((a, s) => a + s.total, 0))}</b></div>
      <div class="stat good"><small>À verser aux vendeurs</small><b>${fcfa(group("to_release").reduce((a, s) => a + net(s), 0))}</b></div>
      <div class="stat warn"><small>À rembourser aux clients</small><b>${fcfa(group("to_refund").reduce((a, s) => a + s.total, 0))}</b></div>
    </div>
    <h2>À rembourser</h2>${group("to_refund").length ? group("to_refund").map(line) : empty("Rien à rembourser.")}
    ${overpaid.length ? html`<h2>Trop-perçus (client annulé pendant le paiement)</h2>${overpaid.map((o) => html`<div class="panel"><b>${o.reference}</b> — ${o.customer_name} (${o.phone}) a payé ${fcfa(o.paid_amount)} pour un total de ${fcfa(o.total)} : rembourser <b>${fcfa(o.paid_amount - o.total)}</b>.</div>`)}` : ""}
    <h2>À verser aux vendeurs (réception confirmée)</h2>${group("to_release").length ? group("to_release").map(line) : empty("Rien à verser.")}
    <h2>Argent gardé</h2>${group("held").length ? group("held").map(line) : empty("Aucun paiement en attente.")}`);
  $$("[data-sub]", el).forEach((b) => { b.onclick = () => {
    if (!confirm(b.dataset.p === "released" ? "Confirmez-vous avoir versé l'argent au vendeur ?" : "Confirmez-vous avoir remboursé le client ?")) return;
    run(b, async () => { must(await sb.rpc("admin_set_payout", { _sub: b.dataset.sub, _payout: b.dataset.p })); toast("Enregistré ✔"); payouts(el); });
  }; });
}

async function allOrders(el) {
  const { data } = await sb.from("orders").select("*, sub_orders(id, status, total, payout_status, shops(name))").order("created_at", { ascending: false }).limit(100);
  const rows = data || [];
  const sum = rows.filter((o) => o.sub_orders.some((s) => s.status === "delivered")).reduce((a, o) => a + o.sub_orders.filter((s) => s.status === "delivered").reduce((b, s) => b + s.total, 0), 0);
  setHTML(el, html`<div class="stats"><div class="stat"><small>Commandes (100 dernières)</small><b>${rows.length}</b></div>
    <div class="stat good"><small>Montant livré</small><b>${fcfa(sum)}</b></div></div>
    ${rows.length ? rows.map((o) => html`<details class="panel"><summary><b>${o.reference}</b> · ${fdatetime(o.created_at)} · ${o.customer_name} · <b>${fcfa(o.total)}</b> ${o.payment_status === "paid" ? "· 💰 payée" : ""}</summary>
      ${o.sub_orders.map((s) => html`<div class="row"><span>${s.shops?.name} — ${ORDER_STATUS[s.status]}</span><span>${fcfa(s.total)} · ${PAYOUT[s.payout_status]}</span></div>
        <div class="actions">${["confirmed", "shipped", "delivered", "cancelled"].filter((x) => x !== s.status).map((x) => html`<button class="btn outline small" data-sub="${s.id}" data-st="${x}">${ORDER_STATUS[x]}</button>`)}</div>`)}
    </details>`) : empty("Aucune commande.")}`);
  $$("[data-st]", el).forEach((b) => { b.onclick = () => { if (confirm(`Forcer le statut « ${ORDER_STATUS[b.dataset.st]} » ?`)) run(b, async () => { must(await sb.rpc("set_sub_order_status", { _sub: b.dataset.sub, _status: b.dataset.st })); toast("Fait ✔"); allOrders(el); }); }; });
}

async function settings(el) {
  const { data: s } = await sb.from("settings").select("*").maybeSingle();
  setHTML(el, html`<form class="panel" id="f"><h3>Réglages de la plateforme</h3>
    <label>Commission sur les ventes (%)<input name="rate" type="number" min="0" max="49" step="0.5" value="${Number(s?.commission_rate || 0) * 100}"></label>
    <label>Téléphone de l'assistance<input name="support_phone" value="${s?.support_phone || ""}"></label>
    <p class="muted">La nouvelle commission s'applique aux prochaines commandes.</p>
    <button class="btn" id="go">Enregistrer</button></form>
    <div class="panel"><h3>Ajouter un administrateur</h3><p class="muted">Dans Supabase > SQL Editor :</p>
    <pre>insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'email@exemple.com';</pre></div>`);
  $("#f").onsubmit = (e) => { e.preventDefault(); run($("#go"), async () => {
    must(await sb.from("settings").update({ commission_rate: Number(e.target.rate.value) / 100, support_phone: e.target.support_phone.value.trim() }).eq("id", true));
    toast("Enregistré ✔");
  }); };
}
