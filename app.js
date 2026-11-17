let db = null,
  currentUser = null,
  influencers = [],
  campaigns = [],
  payments = [];
const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove("hidden");
const hide = (id) => $(id).classList.add("hidden");
const say = (id, msg) => ($(id).textContent = msg || "");
const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
function connect() {
  const url = localStorage.getItem("fm_project_url"),
    key = localStorage.getItem("fm_publishable_key");
  if (url && key && window.supabase) {
    db = window.supabase.createClient(url, key);
    return true;
  }
  return false;
}
function showSetup() {
  $("projectUrl").value = localStorage.getItem("fm_project_url") || "";
  $("publishableKey").value = localStorage.getItem("fm_publishable_key") || "";
  hide("auth");
  hide("app");
  show("setup");
}
$("settingsBtn").onclick = showSetup;
$("saveSetup").onclick = () => {
  const u = $("projectUrl").value.trim(),
    k = $("publishableKey").value.trim();
  if (
    !u.startsWith("https://") ||
    !u.includes(".supabase.co") ||
    !k.startsWith("sb_publishable_")
  ) {
    say("setupMsg", "Enter the Supabase project URL and publishable key.");
    return;
  }
  localStorage.setItem("fm_project_url", u);
  localStorage.setItem("fm_publishable_key", k);
  connect();
  hide("setup");
  show("auth");
  say("authMsg", "Connection details saved on this device.");
};
$("adminLogin").onclick = async () => {
  if (!connect()) {
    say(
      "authMsg",
      "Open connection settings and save your Supabase details first."
    );
    return;
  }
  say("authMsg", "Signing in…");
  const { data, error } = await db.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value,
  });
  if (error) {
    say("authMsg", error.message);
    return;
  }
  currentUser = data.user;
  const { data: profile, error: pe } = await db
    .from("profiles")
    .select("full_name,role")
    .eq("id", currentUser.id)
    .maybeSingle();
  if (pe) {
    say("authMsg", "Profile check failed: " + pe.message);
    return;
  }
  if (!profile || String(profile.role).toLowerCase() !== "admin") {
    await db.auth.signOut();
    say("authMsg", "This account does not have the admin role.");
    return;
  }
  hide("auth");
  show("app");
  show("logout");
  $("hello").textContent =
    "Welcome" + (profile.full_name ? ", " + profile.full_name : "");
  await loadReferenceData();
  await loadPayments();
};
async function loadReferenceData() {
  say("formMsg", "Loading influencers and campaigns…");
  const [ir, cr] = await Promise.all([
    db
      .from("influencers")
      .select("id,profile_id,instagram_handle")
      .order("created_at", { ascending: false }),
    db
      .from("campaigns")
      .select("id,name")
      .order("created_at", { ascending: false }),
  ]);
  if (ir.error) {
    say("formMsg", "Could not load influencers: " + ir.error.message);
    return;
  }
  if (cr.error) {
    say("formMsg", "Could not load campaigns: " + cr.error.message);
    return;
  }
  influencers = ir.data || [];
  campaigns = cr.data || [];
  const profileIds = [
    ...new Set(influencers.map((x) => x.profile_id).filter(Boolean)),
  ];
  let profiles = [];
  if (profileIds.length) {
    const pr = await db
      .from("profiles")
      .select("id,full_name,phone")
      .in("id", profileIds);
    if (pr.error) {
      say("formMsg", "Could not load influencer names: " + pr.error.message);
      return;
    }
    profiles = pr.data || [];
  }
  const pmap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  $("influencerSelect").innerHTML =
    '<option value="">Choose influencer</option>' +
    influencers
      .map((i) => {
        const p = pmap[i.profile_id] || {};
        return `<option value="${i.id}">${esc( p.full_name || i.instagram_handle || "Influencer" )} — ${esc(i.instagram_handle || "No Instagram handle")}</option>`;
      })
      .join("");
  $("campaignSelect").innerHTML =
    '<option value="">Choose campaign</option>' +
    campaigns
      .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
      .join("");
  say(
    "formMsg",
    influencers.length
      ? "Choose an influencer and campaign to add a payment."
      : "No influencer profiles found yet. Add influencer records before recording payments."
  );
}
function esc(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}
async function loadPayments() {
  $("paymentList").innerHTML = '<p class="muted">Loading payments…</p>';
  const { data, error } = await db
    .from("payments")
    .select(
      "id,influencer_id,campaign_id,amount,currency,description,status,paid_at,created_at"
    )
    .order("created_at", { ascending: false });
  if (error) {
    $("paymentList").innerHTML =
      '<p class="message">Could not load payments: ' +
      esc(error.message) +
      "</p>";
    return;
  }
  payments = data || [];
  const imap = Object.fromEntries(influencers.map((i) => [i.id, i]));
  const cmap = Object.fromEntries(campaigns.map((c) => [c.id, c.name]));
  const ids = [
    ...new Set(influencers.map((i) => i.profile_id).filter(Boolean)),
  ];
  let profs = [];
  if (ids.length) {
    const r = await db.from("profiles").select("id,full_name").in("id", ids);
    if (!r.error) profs = r.data || [];
  }
  const pmap = Object.fromEntries(profs.map((p) => [p.id, p.full_name]));
  const paid = payments
    .filter((p) => String(p.status).toLowerCase() === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const pending = payments
    .filter((p) => String(p.status).toLowerCase() !== "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  $("totalAmount").textContent = money(paid + pending);
  $("paidAmount").textContent = money(paid);
  $("pendingAmount").textContent = money(pending);
  if (!payments.length) {
    $("paymentList").innerHTML =
      '<div class="empty">No payments recorded yet.</div>';
    return;
  }
  $("paymentList").innerHTML =
    "<table><thead><tr><th>Influencer</th><th>Campaign</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>" +
    payments
      .map((p) => {
        const inf = imap[p.influencer_id],
          name = inf
            ? pmap[inf.profile_id] || inf.instagram_handle || "Influencer"
            : "Unknown influencer";
        const paid = String(p.status).toLowerCase() === "paid";
        return `<tr><td>${esc(name)}</td><td>${esc( cmap[p.campaign_id] || "Unknown campaign" )}</td><td>${money(p.amount)}</td><td><span class="pill ${ paid ? "paid" : "" }">${esc(p.status || "pending")}</span></td><td>${ paid ? "—" : `<button class="smallBtn" data-paid="${p.id}">Mark paid</button>` }</td></tr>`;
      })
      .join("") +
    "</tbody></table>";
  document
    .querySelectorAll("[data-paid]")
    .forEach((b) => (b.onclick = () => markPaid(b.dataset.paid)));
}
$("addPayment").onclick = async () => {
  const influencer_id = $("influencerSelect").value,
    campaign_id = $("campaignSelect").value,
    amount = Number($("amount").value),
    description = $("description").value.trim();
  if (!influencer_id || !campaign_id || !amount || amount <= 0) {
    say(
      "formMsg",
      "Select an influencer, select a campaign, and enter an amount greater than zero."
    );
    return;
  }
  $("addPayment").disabled = true;
  say("formMsg", "Saving payment…");
  const { error } = await db
    .from("payments")
    .insert({
      influencer_id,
      campaign_id,
      amount,
      currency: "INR",
      description: description || null,
      status: "pending",
    });
  $("addPayment").disabled = false;
  if (error) {
    say("formMsg", "Could not save payment: " + error.message);
    return;
  }
  $("amount").value = "";
  $("description").value = "";
  say("formMsg", "Payment saved as pending.");
  await loadPayments();
};
async function markPaid(id) {
  if (!confirm("Mark this payment as paid?")) return;
  const { error } = await db
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    alert("Could not update payment: " + error.message);
    return;
  }
  await loadPayments();
}
$("refresh").onclick = async () => {
  await loadReferenceData();
  await loadPayments();
};
$("logout").onclick = async () => {
  if (db) await db.auth.signOut();
  hide("app");
  hide("logout");
  show("auth");
  say("authMsg", "Signed out.");
};
if (connect())
  db.auth.getSession().then(async ({ data }) => {
    if (data.session) {
      currentUser = data.session.user;
      const r = await db
        .from("profiles")
        .select("full_name,role")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (!r.error && r.data && String(r.data.role).toLowerCase() === "admin") {
        hide("auth");
        show("app");
        show("logout");
        $("hello").textContent =
          "Welcome" + (r.data.full_name ? ", " + r.data.full_name : "");
        await loadReferenceData();
        await loadPayments();
      }