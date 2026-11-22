// Compte : connexion par téléphone, profil, commandes et suivi, discussions, favoris, devenir vendeur.
import {
  sb, state, loadSession, html, ic, setHTML, $, $$, fcfa, fdate, fdatetime, CITIES, ORDER_STATUS, ORDER_STEPS, PAYOUT,
  verifiedBadge, empty, loading, toast, run, must, go, query, requireLogin, errMsg, normalizePhone, phoneLogin, fphone,
  photo, productCard, PRODUCT_COLS, statusBadge, unitPrice, minQty, fromPrice, tiersOf, waLink,
} from "./lib.js";
import { SUPPORT_WHATSAPP } from "./config.js";

// ---------- Connexion / inscription par numéro de téléphone ----------
export async function login(root) {
  if (state.user) return go(query().retour || "/compte");
  let mode = query().mode === "inscription" ? "up" : "in";
  const draw = () => {
    setHTML(root, html`<section class="wrap narrow auth">
      <h1>${mode === "in" ? "Connexion" : mode === "up" ? "Créer un compte" : "Mot de passe oublié"}</h1>
      ${mode === "reset" ? html`<div class="panel"><p>Pour votre sécurité, le mot de passe est réinitialisé par l'équipe ANW KA SUGU.</p>
        ${SUPPORT_WHATSAPP ? html`<a class="btn big" target="_blank" rel="noopener" href="${waLink(SUPPORT_WHATSAPP, "Bonjour, j'ai oublié mon mot de passe ANW KA SUGU. Mon numéro : ")}">${ic("phone", 18)} Contacter l'assistance sur WhatsApp</a>`
          : html`<p class="muted">Contactez l'assistance ANW KA SUGU en indiquant votre numéro de téléphone.</p>`}</div>`
      : html`<form class="panel" id="f">
        ${mode === "up" ? html`<label>Nom complet<input name="full_name" required autocomplete="name" placeholder="Ex : Awa Traoré"></label>` : ""}
        <label>Numéro de téléphone${mode === "in" ? html` <small class="muted">(ou email)</small>` : ""}
          <div class="phonefield"><span>+223</span><input name="phone" required ${mode === "up" ? html`type="tel" inputmode="tel"` : html`type="text" inputmode="tel"`} autocomplete="tel" placeholder="70 00 00 00"></div></label>
        <label>Mot de passe<input name="password" type="password" minlength="6" required autocomplete="${mode === "up" ? "new-password" : "current-password"}" placeholder="6 caractères minimum"></label>
        ${mode === "up" ? html`<p class="muted small">Aucun email n'est demandé : votre numéro est votre identifiant.</p>` : ""}
        <button class="btn big" id="go">${mode === "in" ? "Se connecter" : "Créer mon compte"}</button>
      </form>`}
      <p class="center">${mode === "in" ? html`Pas encore de compte ? <a href="#" data-m="up">Créer un compte</a><br><a href="#" data-m="reset" class="muted">Mot de passe oublié ?</a>`
        : html`Déjà inscrit ? <a href="#" data-m="in">Se connecter</a>`}</p></section>`);
    $$("[data-m]", root).forEach((a) => { a.onclick = (e) => { e.preventDefault(); mode = a.dataset.m; draw(); }; });
    const f = $("#f"); if (!f) return;
    f.onsubmit = (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f));
      run($("#go"), async () => {
        let login = v.phone.trim();
        const num = normalizePhone(login);
        if (mode === "up" || !login.includes("@")) {
          if (!num) throw new Error("Numéro malien invalide : 8 chiffres, ex. 70 12 34 56.");
          login = phoneLogin(num);
        }
        if (mode === "up") {
          const d = must(await sb.auth.signUp({ email: login, password: v.password, options: { data: { full_name: v.full_name.trim(), phone: num } } }));
          if (!d.session) throw new Error("Compte créé, mais Supabase demande une confirmation : désactivez « Confirm email » (voir le guide).");
        } else {
          must(await sb.auth.signInWithPassword({ email: login, password: v.password }));
        }
        await loadSession(); document.dispatchEvent(new CustomEvent("auth"));
        toast(mode === "up" ? "Bienvenue sur ANW KA SUGU" : "Connexion réussie"); go(query().retour || "/");
      });
    };
  };
  draw();
}

// ---------- Profil ----------
export async function account(root) {
  if (!requireLogin()) return;
  const p = state.profile || {};
  const item = (href, icn, label, extra = "") => html`<a href="${href}">${ic(icn, 20)}<span class="grow">${label}</span>${extra}${ic("chevron", 18, "muted")}</a>`;
  setHTML(root, html`<section class="wrap narrow">
    <div class="me"><span class="avatar">${ic("user", 26)}</span><div><b>${p.full_name || "Mon compte"}</b><br><small class="muted">${fphone(p.phone) || state.user.email}</small></div></div>
    <nav class="menu">
      ${item("#/commandes", "package", "Mes commandes")}
      ${item("#/messages", "message", "Mes discussions", state.unread ? html`<span class="count">${state.unread}</span>` : "")}
      ${item("#/devis?onglet=mes", "quote", "Mes devis")}
      ${item("#/favoris", "heart", "Mes favoris")}
      ${item("#/compte/infos", "user", "Mes informations")}
    </nav>
    <nav class="menu">
      ${state.shop ? item("#/vendeur", "store", "Ma boutique", html`<small class="muted">${state.shop.name}</small>`) : item("#/devenir-vendeur", "store", "Devenir vendeur")}
      ${state.isAdmin ? item("#/admin", "shield", "Administration") : ""}
    </nav>
    <button class="btn outline big" id="out">${ic("logout", 18)} Déconnexion</button></section>`);
  $("#out").onclick = async () => { await sb.auth.signOut(); await loadSession(); document.dispatchEvent(new CustomEvent("auth")); go("/"); };
}

export async function infos(root) {
  if (!requireLogin()) return;
  const p = state.profile || {};
  setHTML(root, html`<section class="wrap narrow"><a class="back" href="#/compte">${ic("back", 18)} Mon compte</a><h1>Mes informations</h1>
    <form class="panel" id="f">
      <label>Nom complet<input name="full_name" value="${p.full_name || ""}"></label>
      <label>Téléphone de contact<input name="phone" type="tel" value="${p.phone || ""}"></label>
      <div class="two"><label>Ville<select name="city">${CITIES.map((c) => html`<option ${p.city === c ? "selected" : ""}>${c}</option>`)}</select></label>
      <label>Quartier / adresse<input name="address" value="${p.address || ""}"></label></div>
      <button class="btn" id="save">Enregistrer</button></form>
    <form class="panel" id="pw"><h3>Changer le mot de passe</h3><label>Nouveau mot de passe<input name="password" type="password" minlength="6" required autocomplete="new-password"></label><button class="btn outline">Changer</button></form>
  </section>`);
  $("#f").onsubmit = (e) => { e.preventDefault(); run($("#save"), async () => { must(await sb.from("profiles").update(Object.fromEntries(new FormData(e.target))).eq("id", state.user.id)); await loadSession(); toast("Enregistré"); }); };
  $("#pw").onsubmit = (e) => { e.preventDefault(); run(e.submitter, async () => { must(await sb.auth.updateUser({ password: e.target.password.value })); e.target.reset(); toast("Mot de passe changé"); }); };
}

// ---------- Devenir vendeur ----------
export async function becomeSeller(root) {
  if (state.shop) return go("/vendeur");
  setHTML(root, html`<section class="wrap narrow"><a class="back" href="#/compte">${ic("back", 18)} Mon compte</a>
    <h1>Devenir vendeur</h1>
    <div class="panel steps">
      <div>${ic("store", 22)}<span><b>Créez votre boutique</b><br><small class="muted">Nom, ville, contact. Gratuit.</small></span></div>
      <div>${ic("camera", 22)}<span><b>Publiez vos produits</b><br><small class="muted">Photos réelles, prix au détail et prix de gros.</small></span></div>
      <div>${ic("message", 22)}<span><b>Répondez et vendez</b><br><small class="muted">Les clients vous écrivent et commandent directement.</small></span></div>
    </div>
    <p class="muted small">Votre boutique est vérifiée par l'équipe ANW KA SUGU avant d'être visible. Une petite commission est prise seulement sur les ventes livrées.</p>
    <a class="btn big" href="${state.user ? "#/vendeur" : "#/connexion?mode=inscription&retour=/vendeur"}">Commencer l'inscription vendeur</a>
  </section>`);
}

// ---------- Commandes et suivi ----------
export async function orders(root) {
  if (!requireLogin()) return;
  setHTML(root, loading());
  const { data } = await sb.from("orders").select("*, sub_orders(status, shops(name))").eq("customer_id", state.user.id).order("created_at", { ascending: false }).limit(100);
  setHTML(root, html`<section class="wrap narrow"><h1>Mes commandes</h1>
    ${data?.length ? html`<div class="list">${data.map((o) => html`<a class="orow" href="#/commande/${o.id}">
      <div class="grow"><b>N° ${o.reference}</b><br><small class="muted">${fdate(o.created_at)} · ${o.sub_orders.map((s) => s.shops?.name).join(", ")}</small>
      <div>${[...new Set(o.sub_orders.map((s) => s.status))].map(statusBadge)}</div></div>
      <b>${fcfa(o.total)}</b>${ic("chevron", 18, "muted")}</a>`)}</div>`
    : empty("Aucune commande pour l'instant.", html`<a class="btn" href="#/catalogue">Découvrir les produits</a>`)}</section>`);
}

const timeline = (s) => s === "cancelled" ? html`<div class="cancelled">${ic("x", 16)} Commande annulée</div>` : html`<ol class="track">${ORDER_STEPS.map((k, i) => {
  const cur = ORDER_STEPS.indexOf(s); return html`<li class="${i < cur ? "done" : i === cur ? "now" : ""}"><span class="dot">${i <= cur ? ic("check", 12) : ""}</span>${ORDER_STATUS[k]}</li>`; })}</ol>`;

let paymentEnabled = null;
async function paymentOn() {
  if (paymentEnabled !== null) return paymentEnabled;
  try { const { data } = await sb.functions.invoke("paiement", { method: "GET" }); paymentEnabled = !!data?.enabled; } catch { paymentEnabled = false; }
  return paymentEnabled;
}

export async function order(root, id) {
  if (!requireLogin()) return;
  setHTML(root, loading());
  const q = query();
  if (q.tx) {
    try { const { data } = await sb.functions.invoke("paiement", { body: { action: "check", transaction_id: q.tx } });
      if (data?.status === "paid") toast("Paiement reçu"); else if (data?.status === "failed") toast("Paiement refusé ou annulé", "err");
    } catch { /* la notification CinetPay fera la mise à jour */ }
  }
  const { data: o } = await sb.from("orders").select("*, sub_orders(*, shops(id,name,whatsapp,verified), order_items(*), reviews(id))").eq("id", id).maybeSingle();
  if (!o) return setHTML(root, empty("Commande introuvable."));
  const mine = o.customer_id === state.user.id;
  const canPay = mine && o.payment_status !== "paid" && o.total > 0 && o.payment_method === "mobile_money" && await paymentOn();
  setHTML(root, html`<section class="wrap narrow receipt">
    <a class="back no-print" href="#/commandes">${ic("back", 18)} Mes commandes</a>
    <img src="logo.png" alt="ANW KA SUGU" class="print-only" width="180">
    <h1>Commande N° ${o.reference}</h1>
    <p class="muted small">${fdatetime(o.created_at)} · ${o.delivery_mode === "delivery" ? `Livraison : ${o.city}, ${o.address}` : "Retrait en boutique"} · ${o.customer_name} (${fphone(o.phone)})</p>
    ${o.note ? html`<p class="note">Précisions : ${o.note}</p>` : ""}
    ${o.payment_status === "paid" ? html`<div class="note ok">${ic("check", 16)} Payée par mobile money : ${fcfa(o.paid_amount)}. L'argent est versé au vendeur quand vous confirmez la réception.</div>`
      : canPay ? html`<button class="btn big gold" id="pay">Payer ${fcfa(o.total)} avec Orange Money / Moov Money</button>` : ""}
    ${o.sub_orders.map((s) => html`<div class="panel">
      <div class="row"><span class="gshop">${ic("store", 16)} <b>${s.shops?.name}</b> ${verifiedBadge(s.shops)}</span>${statusBadge(s.status)}</div>
      ${timeline(s.status)}
      ${s.order_items.map((i) => html`<div class="row small"><span>${i.quantity} ${i.unit} × ${i.name} <span class="muted">(${fcfa(i.unit_price)})</span></span><b>${fcfa(i.unit_price * i.quantity)}</b></div>`)}
      ${s.delivery_fee ? html`<div class="row small"><span>Livraison</span><b>${fcfa(s.delivery_fee)}</b></div>` : ""}
      <div class="row total"><span>Sous-total</span><b>${fcfa(s.total)}</b></div>
      ${s.payout_status !== "none" ? html`<p class="muted small">${PAYOUT[s.payout_status]}</p>` : ""}
      ${mine ? html`<div class="actions no-print">
        ${["shipped", "delivered"].includes(s.status) ? html`<button class="btn" data-recv="${s.id}">${ic("check", 18)} J'ai bien reçu</button>` : ""}
        ${["delivered", "completed"].includes(s.status) && !s.reviews?.length ? html`<button class="btn outline" data-review="${s.id}" data-shop="${s.shop_id}">${ic("star", 16)} Donner un avis</button>` : ""}
        <button class="btn outline" data-msg="${s.shop_id}">${ic("message", 18)} Écrire</button>
        ${s.status === "new" ? html`<button class="btn ghost" data-cancel="${s.id}">Annuler</button>` : ""}
      </div>` : ""}
    </div>`)}
    <div class="panel"><div class="row total"><span>Total commande</span><b>${fcfa(o.total)}</b></div></div>
    <button class="btn outline no-print" onclick="window.print()">${ic("printer", 18)} Imprimer le reçu</button>
  </section>`);

  $("#pay")?.addEventListener("click", (e) => run(e.currentTarget, async () => {
    const { data, error } = await sb.functions.invoke("paiement", { body: { action: "start", order_id: o.id } });
    if (error) { const b = await error.context?.json?.().catch(() => null); throw new Error(b?.error || error.message); }
    if (data?.error) throw new Error(data.error);
    location.href = data.url;
  }));
  $$("[data-cancel]", root).forEach((b) => { b.onclick = () => { if (confirm("Annuler cette partie de la commande ?")) run(b, async () => { must(await sb.rpc("cancel_my_sub_order", { _sub: b.dataset.cancel })); toast("Annulée"); order(root, id); }); }; });
  $$("[data-recv]", root).forEach((b) => { b.onclick = () => { if (confirm("Confirmez-vous avoir reçu cette commande en bon état ?")) run(b, async () => { must(await sb.rpc("confirm_receipt", { _sub: b.dataset.recv })); toast("Merci ! Commande terminée."); order(root, id); }); }; });
  $$("[data-msg]", root).forEach((b) => { b.onclick = async () => { const { data, error } = await sb.rpc("open_conversation", { _shop: b.dataset.msg, _product: null }); if (error) return toast(errMsg(error), "err"); go(`/messages/${data}`); }; });
  $$("[data-review]", root).forEach((b) => { b.onclick = () => reviewForm(b, () => order(root, id)); });
}

function reviewForm(btn, done) {
  const box = document.createElement("form"); box.className = "review-form";
  setHTML(box, html`<div class="rate">${[5, 4, 3, 2, 1].map((n) => html`<input type="radio" name="rating" value="${n}" id="r${n}" ${n === 5 ? "checked" : ""}><label for="r${n}" title="${n} sur 5">${ic("star", 26)}</label>`)}</div>
    <textarea name="comment" maxlength="1000" placeholder="Votre avis (facultatif)"></textarea><button class="btn">Publier l'avis</button>`);
  btn.replaceWith(box);
  box.onsubmit = (e) => {
    e.preventDefault();
    run(e.submitter, async () => {
      must(await sb.from("reviews").insert({ sub_order_id: btn.dataset.review, shop_id: btn.dataset.shop, rating: Number(box.rating.value), comment: box.comment.value.trim() }));
      toast("Merci pour votre avis"); done();
    });
  };
}

// ---------- Discussions (liées aux produits) ----------
/** Liste des discussions : mode « client » (mes achats) ou « boutique » (clients de ma boutique). */
export async function conversationList(el, mode) {
  setHTML(el, loading());
  let rq = sb.from("conversations").select("*, shops(id, name, owner_id), products(id, name, images)").order("last_message_at", { ascending: false }).limit(100);
  rq = mode === "boutique" ? rq.eq("shop_id", state.shop?.id) : rq.eq("customer_id", state.user.id);
  const { data } = await rq;
  setHTML(el, data?.length ? html`<div class="list">${data.map((c) => {
    const asShop = mode === "boutique";
    const unread = new Date(c.last_message_at) > new Date(asShop ? c.shop_read_at : c.customer_read_at);
    return html`<a class="conv ${unread ? "unread" : ""}" href="#/messages/${c.id}">
      <span class="lthumb">${c.products ? photo(c.products.images?.[0]) : ic(asShop ? "user" : "store", 22)}</span>
      <span class="grow"><b>${asShop ? c.customer_name || "Client" : c.shops?.name}</b>${c.products ? html`<small class="muted"> · ${c.products.name}</small>` : ""}
        <br><small class="muted ell">${c.last_message || "Nouvelle discussion"}</small></span>
      <small class="muted">${fdatetime(c.last_message_at)}</small>${unread ? html`<span class="udot" aria-label="Non lu"></span>` : ""}</a>`;
  })}</div>` : empty(mode === "boutique" ? "Aucun message de client pour l'instant." : "Aucune discussion. Sur la page d'un produit, appuyez sur « Poser une question au vendeur »."));
}

export async function messages(root) {
  if (!requireLogin()) return;
  setHTML(root, html`<section class="wrap narrow"><a class="back" href="#/compte">${ic("back", 18)} Mon compte</a><h1>Mes discussions</h1><div id="l"></div>
    ${state.shop ? html`<p class="muted small">Les messages des clients de votre boutique sont dans <a href="#/vendeur?onglet=messages">Ma boutique › Messages</a>.</p>` : ""}</section>`);
  await conversationList($("#l"), "client");
}

let channel = null;
const QUICK = ["Est-ce disponible ?", "Quel est le prix pour 10 pièces ?", "Livrez-vous dans mon quartier ?", "Avez-vous une autre couleur ?"];
export async function thread(root, id) {
  if (!requireLogin()) return;
  const { data: c } = await sb.from("conversations").select("*, shops(id, name, owner_id, verified), products(id, name, images, retail_price, min_price, unit, stock, price_tiers(min_qty,unit_price))").eq("id", id).maybeSingle();
  if (!c) return setHTML(root, empty("Discussion introuvable."));
  const asShop = c.shops?.owner_id === state.user.id; const p = c.products;
  setHTML(root, html`<section class="wrap narrow chat">
    <div class="chathead"><a href="${asShop ? "#/vendeur?onglet=messages" : "#/messages"}" aria-label="Retour">${ic("back", 20)}</a>
      <b class="grow">${asShop ? c.customer_name || "Client" : c.shops?.name}</b>${!asShop ? html`<a class="small" href="#/boutique/${c.shop_id}">Boutique</a>` : ""}</div>
    ${p ? html`<div class="ctx"><a class="lthumb" href="#/produit/${p.id}">${photo(p.images?.[0])}</a>
      <div class="grow"><a href="#/produit/${p.id}" class="lname">${p.name}</a><br><small><b>${fromPrice(p) ? fcfa(fromPrice(p)) : "Prix sur demande"}</b> · ${c.shops?.name}</small></div>
      ${!asShop && p.stock > 0 ? html`<button class="btn sm" id="buy">Commander ce produit</button>` : ""}</div>` : ""}
    <div class="bubbles" id="b">${loading()}</div>
    ${!asShop ? html`<div class="quick">${QUICK.map((t) => html`<button type="button" class="chip">${t}</button>`)}</div>` : ""}
    <form class="send" id="f"><input name="body" maxlength="2000" required placeholder="Votre message…" autocomplete="off"><button class="btn" aria-label="Envoyer">${ic("send", 18)}</button></form></section>`);
  const box = $("#b");
  const add = (m) => { if (box.querySelector(`[data-id="${m.id}"]`)) return;
    box.querySelector(".hint")?.remove();
    box.insertAdjacentHTML("beforeend", html`<div class="bubble ${m.sender_id === state.user.id ? "me" : ""}" data-id="${m.id}">${m.body}<small>${fdatetime(m.created_at)}</small></div>`.s);
    box.scrollTop = box.scrollHeight; };
  const { data: msgs } = await sb.from("messages").select("*").eq("conversation_id", id).order("created_at").limit(300);
  box.innerHTML = ""; (msgs || []).forEach(add);
  if (!msgs?.length) setHTML(box, html`<p class="muted center hint">${asShop ? "Aucun message." : "Posez votre question : la boutique vous répond ici."}</p>`);
  sb.rpc("mark_conversation_read", { _conv: id }).then(() => document.dispatchEvent(new CustomEvent("unread")));
  if (channel) sb.removeChannel(channel);
  channel = sb.channel(`conv-${id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
    (pl) => { if (!root.isConnected) return; add(pl.new); sb.rpc("mark_conversation_read", { _conv: id }).then(() => {}); }).subscribe();
  const f = $("#f");
  $$(".quick .chip", root).forEach((b) => { b.onclick = () => { f.body.value = b.textContent; f.body.focus(); }; });
  $("#buy")?.addEventListener("click", () => go(`/commander?p=${p.id}&q=${minQty(p)}`));
  f.onsubmit = async (e) => {
    e.preventDefault(); const body = f.body.value.trim(); if (!body) return;
    f.body.value = "";
    const { data, error } = await sb.from("messages").insert({ conversation_id: id, body }).select().single();
    if (error) { toast(errMsg(error), "err"); f.body.value = body; return; }
    add(data);
  };
}

// ---------- Favoris ----------
export async function favorites(root) {
  if (!requireLogin()) return;
  setHTML(root, loading());
  const { data } = await sb.from("favorites").select(`created_at, products(${PRODUCT_COLS})`).order("created_at", { ascending: false });
  const prods = (data || []).map((f) => f.products).filter(Boolean);
  setHTML(root, html`<section class="wrap"><a class="back" href="#/compte">${ic("back", 18)} Mon compte</a><h1>Mes favoris</h1>
    ${prods.length ? html`<div class="pgrid">${prods.map(productCard)}</div>` : empty("Aucun favori. Appuyez sur le cœur d'un produit pour le retrouver ici.")}</section>`);
}

/** Nombre de discussions non lues (client + boutique). */
export async function countUnread() {
  if (!state.user) return 0;
  const { data } = await sb.from("conversations").select("customer_id, last_message_at, customer_read_at, shop_read_at, shops(owner_id)").limit(300);
  return (data || []).filter((c) => (c.customer_id === state.user.id && new Date(c.last_message_at) > new Date(c.customer_read_at))
    || (c.shops?.owner_id === state.user.id && new Date(c.last_message_at) > new Date(c.shop_read_at))).length;
}
export { tiersOf, unitPrice };
