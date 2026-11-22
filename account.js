// Compte client : connexion, profil, commandes, paiement, messages.
import {
  sb, state, loadSession, html, setHTML, $, $$, fcfa, fdate, fdatetime, CITIES, ORDER_STATUS, PAYOUT, verifiedBadge,
  empty, loading, toast, run, must, go, query, requireLogin, errMsg, stars,
} from "./lib.js";

export async function login(root) {
  if (state.user) return go(query().retour || "/compte");
  let mode = "in";
  const draw = () => {
    setHTML(root, html`<section class="wrap narrow auth">
      <img src="icon-192.png" alt="" class="auth-logo" width="96" height="96">
      <h1>${mode === "in" ? "Connexion" : mode === "up" ? "Créer un compte" : "Mot de passe oublié"}</h1>
      <form class="panel" id="f">
        ${mode === "up" ? html`<label>Nom complet<input name="full_name" required autocomplete="name"></label>
          <label>Téléphone<input name="phone" type="tel" required placeholder="70 00 00 00" autocomplete="tel"></label>` : ""}
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        ${mode !== "reset" ? html`<label>Mot de passe<input name="password" type="password" minlength="6" required autocomplete="${mode === "up" ? "new-password" : "current-password"}"></label>` : ""}
        <button class="btn big" id="go">${mode === "in" ? "Se connecter" : mode === "up" ? "Créer mon compte" : "Recevoir le lien"}</button>
      </form>
      <p class="center">${mode === "in" ? html`Pas de compte ? <a href="#" data-m="up">Inscrivez-vous</a> · <a href="#" data-m="reset">Mot de passe oublié</a>`
        : html`Déjà inscrit ? <a href="#" data-m="in">Connectez-vous</a>`}</p></section>`);
    $$("[data-m]", root).forEach((a) => { a.onclick = (e) => { e.preventDefault(); mode = a.dataset.m; draw(); }; });
    $("#f").onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      run($("#go"), async () => {
        if (mode === "reset") {
          must(await sb.auth.resetPasswordForEmail(f.email, { redirectTo: `${location.origin}${location.pathname}#/compte?nouveau-mdp=1` }));
          return toast("Lien envoyé. Regardez vos emails.");
        }
        if (mode === "up") {
          const d = must(await sb.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.full_name, phone: f.phone }, emailRedirectTo: `${location.origin}${location.pathname}` } }));
          if (!d.session) { toast("Compte créé. Confirmez votre email puis connectez-vous."); mode = "in"; return draw(); }
        } else {
          must(await sb.auth.signInWithPassword({ email: f.email, password: f.password }));
        }
        await loadSession(); document.dispatchEvent(new CustomEvent("auth"));
        toast("Bienvenue !"); go(query().retour || "/");
      });
    };
  };
  draw();
}

export async function account(root) {
  if (!requireLogin()) return;
  const p = state.profile || {};
  const resetPwd = query()["nouveau-mdp"];
  setHTML(root, html`<section class="wrap narrow">
    <h1>Mon compte</h1>
    <div class="menu-list">
      <a href="#/commandes">📦 Mes commandes</a>
      <a href="#/devis?onglet=mes">📝 Mes demandes de devis</a>
      <a href="#/messages">💬 Messages</a>
      <a href="#/vendeur">🏪 ${state.shop ? "Mon espace vendeur" : "Devenir vendeur / fournisseur"}</a>
      ${state.isAdmin ? html`<a href="#/admin">🛡️ Administration</a>` : ""}
    </div>
    ${resetPwd ? html`<form class="panel" id="pw"><h3>Nouveau mot de passe</h3><label>Mot de passe<input name="password" type="password" minlength="6" required></label><button class="btn">Enregistrer</button></form>` : ""}
    <form class="panel" id="f"><h3>Mes informations</h3>
      <label>Nom complet<input name="full_name" value="${p.full_name || ""}"></label>
      <label>Téléphone<input name="phone" type="tel" value="${p.phone || ""}"></label>
      <div class="two"><label>Ville<select name="city">${CITIES.map((c) => html`<option ${p.city === c ? "selected" : ""}>${c}</option>`)}</select></label>
      <label>Adresse<input name="address" value="${p.address || ""}"></label></div>
      <p class="muted">Email : ${state.user.email}</p>
      <button class="btn" id="save">Enregistrer</button>
    </form>
    <button class="btn outline" id="out">Se déconnecter</button></section>`);
  $("#f").onsubmit = (e) => {
    e.preventDefault();
    run($("#save"), async () => {
      must(await sb.from("profiles").update(Object.fromEntries(new FormData(e.target))).eq("id", state.user.id));
      await loadSession(); toast("Enregistré ✔");
    });
  };
  if ($("#pw")) $("#pw").onsubmit = (e) => { e.preventDefault(); run(e.submitter, async () => { must(await sb.auth.updateUser({ password: e.target.password.value })); toast("Mot de passe changé ✔"); go("/compte"); }); };
  $("#out").onclick = async () => { await sb.auth.signOut(); await loadSession(); document.dispatchEvent(new CustomEvent("auth")); go("/"); };
}

const statusBadge = (s) => html`<span class="st st-${s}">${ORDER_STATUS[s]}</span>`;

export async function orders(root) {
  if (!requireLogin()) return;
  setHTML(root, loading());
  const { data } = await sb.from("orders").select("*, sub_orders(status, shops(name))").eq("customer_id", state.user.id).order("created_at", { ascending: false });
  setHTML(root, html`<section class="wrap narrow"><h1>Mes commandes</h1>
    ${data?.length ? data.map((o) => html`<a class="panel order-row" href="#/commande/${o.id}">
      <div><b>${o.reference}</b> <small class="muted">${fdate(o.created_at)}</small>
      <div class="muted">${o.sub_orders.map((s) => s.shops?.name).join(", ")}</div></div>
      <div class="right"><b>${fcfa(o.total)}</b><div>${o.payment_status === "paid" ? html`<span class="st st-delivered">Payée</span>` : ""}
      ${[...new Set(o.sub_orders.map((s) => s.status))].map(statusBadge)}</div></div></a>`)
    : empty("Aucune commande pour l'instant.", html`<a class="btn" href="#/catalogue">Commencer mes achats</a>`)}</section>`);
}

let paymentEnabled = null;
async function paymentOn() {
  if (paymentEnabled !== null) return paymentEnabled;
  try { const { data } = await sb.functions.invoke("paiement", { method: "GET" }); paymentEnabled = !!data?.enabled; }
  catch { paymentEnabled = false; }
  return paymentEnabled;
}

export async function order(root, id) {
  if (!requireLogin()) return;
  setHTML(root, loading());
  const q = query();
  if (q.tx) {
    try { const { data } = await sb.functions.invoke("paiement", { body: { action: "check", transaction_id: q.tx } });
      if (data?.status === "paid") toast("Paiement reçu ✔"); else if (data?.status === "failed") toast("Paiement refusé ou annulé", "err");
    } catch { /* la notification CinetPay fera la mise à jour */ }
  }
  const { data: o } = await sb.from("orders").select("*, sub_orders(*, shops(id,name,whatsapp,verified), order_items(*), reviews(id))").eq("id", id).maybeSingle();
  if (!o) return setHTML(root, empty("Commande introuvable."));
  const mine = o.customer_id === state.user.id;
  const canPay = mine && o.payment_status !== "paid" && o.total > 0 && await paymentOn();
  setHTML(root, html`<section class="wrap narrow receipt">
    <div class="receipt-head"><img src="logo.png" alt="ANW KA SUGU" class="print-only" width="180">
      <h1>Commande ${o.reference}</h1>
      <p class="muted">${fdatetime(o.created_at)} · ${o.delivery_mode === "delivery" ? `Livraison : ${o.city}, ${o.address}` : "Retrait en boutique"} · ${o.customer_name} (${o.phone})${o.source === "quote" ? " · Issue d'un devis" : ""}</p></div>
    <div class="panel pay-state ${o.payment_status === "paid" ? "ok" : ""}">
      ${o.payment_status === "paid" ? html`<b>✔ Payée par mobile money : ${fcfa(o.paid_amount)}</b><p class="muted">L'argent est gardé par ANW KA SUGU et versé à chaque vendeur quand vous confirmez la réception.</p>`
        : o.total > 0 ? html`<b>À payer : ${fcfa(o.total)}</b> ${o.payment_method === "cash" ? html`<p class="muted">Paiement prévu à la livraison / au retrait.</p>` : ""}` : html`<b>Commande annulée</b>`}
      ${canPay ? html`<button class="btn big gold" id="pay">Payer ${fcfa(o.total)} avec Orange Money / Moov Money</button>` : ""}
    </div>
    ${o.sub_orders.map((s) => html`<div class="panel">
      <div class="row"><h3>${s.shops?.name} ${verifiedBadge(s.shops)}</h3>${statusBadge(s.status)}</div>
      ${s.order_items.map((i) => html`<div class="row"><span>${i.quantity} ${i.unit} × ${i.name} <small class="muted">(${fcfa(i.unit_price)})</small></span><b>${fcfa(i.unit_price * i.quantity)}</b></div>`)}
      ${s.delivery_fee ? html`<div class="row"><span>Livraison</span><b>${fcfa(s.delivery_fee)}</b></div>` : ""}
      <div class="row total"><span>Sous-total</span><b>${fcfa(s.total)}</b></div>
      ${s.payout_status !== "none" ? html`<p class="muted">💰 ${PAYOUT[s.payout_status]}</p>` : ""}
      ${mine ? html`<div class="actions no-print">
        ${s.status === "new" ? html`<button class="btn outline" data-cancel="${s.id}">Annuler cette partie</button>` : ""}
        ${["shipped", "delivered"].includes(s.status) && !s.received_at ? html`<button class="btn" data-recv="${s.id}">✔ J'ai bien reçu</button>` : ""}
        ${s.status === "delivered" && !s.reviews?.length ? html`<button class="btn outline" data-review="${s.id}" data-shop="${s.shop_id}">⭐ Donner un avis</button>` : ""}
        <button class="btn outline" data-msg="${s.shop_id}">💬 Écrire au vendeur</button>
      </div>` : ""}
    </div>`)}
    <div class="panel"><div class="row total"><span>Total commande</span><b>${fcfa(o.total)}</b></div></div>
    <button class="btn outline no-print" onclick="window.print()">🖨️ Imprimer / enregistrer le reçu</button>
  </section>`);

  if ($("#pay")) $("#pay").onclick = (e) => run(e.target, async () => {
    const { data, error } = await sb.functions.invoke("paiement", { body: { action: "start", order_id: o.id } });
    if (error) { const b = await error.context?.json?.().catch(() => null); throw new Error(b?.error || error.message); }
    if (data?.error) throw new Error(data.error);
    location.href = data.url;
  });
  $$("[data-cancel]", root).forEach((b) => { b.onclick = () => { if (confirm("Annuler cette partie de la commande ?")) run(b, async () => { must(await sb.rpc("cancel_my_sub_order", { _sub: b.dataset.cancel })); toast("Annulée"); order(root, id); }); }; });
  $$("[data-recv]", root).forEach((b) => { b.onclick = () => { if (confirm("Confirmez-vous avoir reçu cette commande en bon état ?")) run(b, async () => { must(await sb.rpc("confirm_receipt", { _sub: b.dataset.recv })); toast("Merci ! Réception confirmée."); order(root, id); }); }; });
  $$("[data-msg]", root).forEach((b) => { b.onclick = async () => { const { data, error } = await sb.rpc("open_conversation", { _shop: b.dataset.msg }); if (error) return toast(errMsg(error), "err"); go(`/messages/${data}`); }; });
  $$("[data-review]", root).forEach((b) => { b.onclick = () => reviewForm(b, () => order(root, id)); });
  if (q.payer && canPay) $("#pay").scrollIntoView({ behavior: "smooth" });
}

function reviewForm(btn, done) {
  const box = document.createElement("form"); box.className = "review-form";
  setHTML(box, html`<div class="rate">${[5, 4, 3, 2, 1].map((n) => html`<input type="radio" name="rating" value="${n}" id="r${n}" ${n === 5 ? "checked" : ""}><label for="r${n}" title="${n}">★</label>`)}</div>
    <textarea name="comment" maxlength="1000" placeholder="Votre avis (facultatif)"></textarea><button class="btn">Publier l'avis</button>`);
  btn.replaceWith(box);
  box.onsubmit = (e) => {
    e.preventDefault();
    run(e.submitter, async () => {
      must(await sb.from("reviews").insert({ sub_order_id: btn.dataset.review, shop_id: btn.dataset.shop, rating: Number(box.rating.value), comment: box.comment.value.trim() }));
      toast("Merci pour votre avis ⭐"); done();
    });
  };
}

// ---------- Messages ----------
export async function messages(root) {
  if (!requireLogin()) return;
  setHTML(root, loading());
  const { data } = await sb.from("conversations").select("*, shops(name, owner_id)").order("last_message_at", { ascending: false });
  setHTML(root, html`<section class="wrap narrow"><h1>Messages</h1>
    ${data?.length ? data.map((c) => {
      const asShop = c.shops?.owner_id === state.user.id;
      const unread = new Date(c.last_message_at) > new Date(asShop ? c.shop_read_at : c.customer_read_at);
      return html`<a class="panel conv ${unread ? "unread" : ""}" href="#/messages/${c.id}">
        <b>${asShop ? `${c.customer_name || "Client"} → ${c.shops?.name}` : c.shops?.name}</b>
        <small class="muted">${fdatetime(c.last_message_at)}</small><div class="muted">${c.last_message || "…"}</div></a>`;
    }) : empty("Aucune conversation. Contactez un vendeur depuis la page d'un produit.")}</section>`);
}

let channel = null;
export async function thread(root, id) {
  if (!requireLogin()) return;
  const { data: c } = await sb.from("conversations").select("*, shops(id, name, owner_id)").eq("id", id).maybeSingle();
  if (!c) return setHTML(root, empty("Conversation introuvable."));
  const asShop = c.shops?.owner_id === state.user.id;
  setHTML(root, html`<section class="wrap narrow chat">
    <div class="chat-head"><a href="#/messages">←</a> <b>${asShop ? c.customer_name || "Client" : c.shops?.name}</b>
      ${!asShop ? html`<a class="muted" href="#/boutique/${c.shop_id}">voir la boutique</a>` : ""}</div>
    <div class="bubbles" id="b">${loading()}</div>
    <form class="send" id="f"><input name="body" maxlength="2000" required placeholder="Votre message…" autocomplete="off"><button class="btn">Envoyer</button></form></section>`);
  const box = $("#b");
  const add = (m) => { if (box.querySelector(`[data-id="${m.id}"]`)) return;
    box.insertAdjacentHTML("beforeend", html`<div class="bubble ${m.sender_id === state.user.id ? "me" : ""}" data-id="${m.id}">${m.body}<small>${fdatetime(m.created_at)}</small></div>`.s);
    box.scrollTop = box.scrollHeight; };
  const { data: msgs } = await sb.from("messages").select("*").eq("conversation_id", id).order("created_at").limit(300);
  box.innerHTML = ""; (msgs || []).forEach(add);
  if (!msgs?.length) setHTML(box, html`<p class="muted center">Écrivez votre premier message.</p>`);
  sb.rpc("mark_conversation_read", { _conv: id }).then(() => {});
  if (channel) sb.removeChannel(channel);
  channel = sb.channel(`conv-${id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
    (p) => { if (!root.isConnected) return; box.querySelector(".muted.center")?.remove(); add(p.new); sb.rpc("mark_conversation_read", { _conv: id }).then(() => {}); }).subscribe();
  $("#f").onsubmit = async (e) => {
    e.preventDefault(); const body = e.target.body.value.trim(); if (!body) return;
    e.target.body.value = "";
    const { data, error } = await sb.from("messages").insert({ conversation_id: id, body }).select().single();
    if (error) { toast(errMsg(error), "err"); e.target.body.value = body; return; }
    box.querySelector(".muted.center")?.remove(); add(data);
  };
}

export { stars };
