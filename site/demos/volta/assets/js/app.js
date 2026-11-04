/* Volta — storefront behaviour: catalogue rendering, cart, configurator,
   product page, checkout demo, forms and scroll reveals. */

import { PRODUCTS, COLOURS, REVIEWS, JOURNAL, STORES, TECH, productById, money } from "./data.js";
import { renderScooter } from "./scooter.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

/* ------------------------------------------------------------------ cart */
const CART_KEY = "volta.cart.v2";
const SHIPPING = { standard: 0, express: 49 };
const FREE_METRO = 0;

const readCart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
};
const writeCart = (cart) => {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  syncCartUI();
};

const cartSubtotal = (cart = readCart()) =>
  cart.reduce((sum, l) => sum + (productById(l.id)?.price || 0) * l.qty, 0);

const cartCount = (cart = readCart()) => cart.reduce((n, l) => n + l.qty, 0);

function addToCart(id, colour, qty = 1) {
  const product = productById(id);
  if (!product) return;
  const paint = product.colours.includes(colour) ? colour : product.colours[0];
  const cart = readCart();
  const line = cart.find((l) => l.id === id && l.colour === paint);
  if (line) line.qty = Math.min(line.qty + qty, 9);
  else cart.push({ id, colour: paint, qty });
  writeCart(cart);
  openDrawer();
}

function setQty(id, colour, qty) {
  let cart = readCart();
  const line = cart.find((l) => l.id === id && l.colour === colour);
  if (!line) return;
  line.qty = Math.max(0, Math.min(9, qty));
  cart = cart.filter((l) => l.qty > 0);
  writeCart(cart);
}

/* ------------------------------------------------------------------ toast */
function toast(message) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg><span>${message}</span>`;
  el.classList.add("is-visible");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("is-visible"), 2600);
}

/* ------------------------------------------------------------------ drawer */
let lastFocus = null;
function openDrawer() {
  const drawer = $("#cartDrawer");
  if (!drawer) return;
  renderCart();
  lastFocus = document.activeElement;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  $("#overlay")?.classList.add("is-open");
  document.body.classList.add("no-scroll");
  setTimeout(() => $("#drawerClose")?.focus(), 120);
}
function closeDrawer() {
  const drawer = $("#cartDrawer");
  if (!drawer) return;
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  $("#overlay")?.classList.remove("is-open");
  document.body.classList.remove("no-scroll");
  lastFocus?.focus?.();
}

function renderCart() {
  const body = $("#cartBody");
  if (!body) return;
  const cart = readCart();
  const subtotal = cartSubtotal(cart);

  if (!cart.length) {
    body.innerHTML = `
      <div class="cart-empty">
        <p class="h3">Your bag is empty.</p>
        <p>Pick a scooter, choose a colour, and we'll bring it to your door.</p>
        <a class="btn btn--dark btn--sm" href="shop.html" style="margin-top:1.25rem">Shop the range</a>
      </div>`;
  } else {
    body.innerHTML = cart.map((line) => {
      const p = productById(line.id);
      if (!p) return "";
      return `
      <div class="cart-item">
        <div class="thumb"><img src="${p.image}" alt=""></div>
        <div class="info">
          <strong>${p.name}</strong>
          <span>${COLOURS[line.colour]?.name || ""} · ${p.specs.range} range</span>
          <div class="line">
            <div class="mini-qty">
              <button type="button" aria-label="Decrease quantity" data-qty="-1" data-id="${p.id}" data-colour="${line.colour}">−</button>
              <span>${line.qty}</span>
              <button type="button" aria-label="Increase quantity" data-qty="1" data-id="${p.id}" data-colour="${line.colour}">+</button>
            </div>
            <span class="amt">${money(p.price * line.qty)}</span>
          </div>
        </div>
      </div>`;
    }).join("");

    body.querySelectorAll("[data-qty]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id, colour = btn.dataset.colour;
        const line = readCart().find((l) => l.id === id && l.colour === colour);
        setQty(id, colour, (line?.qty || 1) + Number(btn.dataset.qty));
        renderCart();
      });
    });
  }

  const total = $("#cartTotal");
  if (total) total.textContent = money(subtotal);
  const foot = $("#cartFoot");
  if (foot) foot.style.display = cart.length ? "" : "none";
  const note = $("#cartInlineNote");
  if (note) note.style.display = cart.length ? "" : "none";
  syncBadges();
}

function syncBadges() {
  const n = cartCount();
  $$("[data-cart-count]").forEach((el) => { el.textContent = n; });
  $$("[data-open-cart]").forEach((el) => {
    el.setAttribute("aria-label", n === 0 ? "Shopping bag, empty" : `Shopping bag, ${n} item${n === 1 ? "" : "s"}`);
  });
}
function syncCartUI() { renderCart(); }

/* ------------------------------------------------------------------ cards */
function colourSwatches(product, active, size = "") {
  return `<div class="swatches" role="group" aria-label="Colour: ${product.name}">
    ${product.colours.map((c) => `
      <button type="button" data-colour="${c}" aria-pressed="${c === active}"
        aria-label="${COLOURS[c].name}" title="${COLOURS[c].name}"
        style="background:${COLOURS[c].hex}"></button>`).join("")}
  </div>`;
}

function productCard(product) {
  const was = product.compareAt
    ? `<span class="price--sm" style="text-decoration:line-through">${money(product.compareAt)}</span>` : "";
  return `
  <article class="pcard" data-product="${product.id}" data-reveal>
    <a class="pcard-media" href="product.html?model=${product.id}" aria-label="View ${product.name}">
      <span class="pcard-badge ${product.badgeStyle === "volt" ? "pcard-badge--volt" : ""}">${product.badge}</span>
      <img class="pcard-img" src="${product.image}" alt="${product.name} electric scooter" loading="lazy" width="900" height="1100">
      <span class="pcard-cta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
    </a>
    <div class="pcard-body">
      <div class="pcard-row">
        <h3>${product.name}</h3>
        <span class="price">${money(product.price)}${was}</span>
      </div>
      <p class="pcard-sub">${product.specs.speed} · ${product.specs.range} · ${product.specs.weight}</p>
      <button class="pcard-add" type="button" data-add="${product.id}" data-colour="${product.colours[0]}">Add to bag</button>
    </div>
  </article>`;
}

function hydrateCards(root = document) {
  $$("[data-product]", root).forEach((card) => {
    const id = card.dataset.product;
    const product = productById(id);
    if (!product) return;
    const addBtn = $("[data-add]", card);
    on(addBtn, "click", () => addToCart(product.id, product.colours[0]));
  });
}

/* ------------------------------------------------------------------ configurator */
function initConfigurator() {
  const stage = $("#configBike");
  if (!stage) return;
  let model = "one-s";
  let paint = "cobalt";
  let viewer = null;

  const draw = () => {
    const p = productById(model);
    if (viewer) viewer.setPaint(paint);
    else stage.innerHTML = renderScooter({ paint });
    $("#configName").textContent = p.name;
    $("#configPrice").innerHTML = `${money(p.price)}<small>incl. GST · or ${money(Math.round(p.price * 0.9 / 104))}/week</small>`;
    $("#configSpecs").innerHTML = `
      <div><dt>Range</dt><dd>${p.specs.range.replace(" km", "")}<small>km</small></dd></div>
      <div><dt>Top speed</dt><dd>${p.specs.speed.replace(" km/h", "")}<small>km/h</small></dd></div>
      <div><dt>Charge</dt><dd>${p.specs.charge.split(" ")[0]}<small>hrs</small></dd></div>`;
    $("#configColourName").innerHTML = `Colour — <strong>${COLOURS[paint].name}</strong>`;
    $("#configAdd").dataset.id = p.id;
    $("#configAdd").dataset.colour = paint;
    $("#configModels").querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.model === model));
    });
    $("#configColours").innerHTML = p.colours.map((c) => `
      <button type="button" data-colour="${c}" aria-label="${COLOURS[c].name}" title="${COLOURS[c].name}"
        aria-pressed="${c === paint}" style="background:${COLOURS[c].hex}"></button>`).join("");
    $$("#configColours [data-colour]").forEach((btn) => {
      btn.addEventListener("click", () => { paint = btn.dataset.colour; draw(); });
    });
  };

  $("#configModels").querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      model = btn.dataset.model;
      const p = productById(model);
      if (!p.colours.includes(paint)) paint = p.colours[0];
      draw();
    });
  });
  on($("#configAdd"), "click", () => addToCart($("#configAdd").dataset.id, $("#configAdd").dataset.colour));
  draw();

  import("./scooter3d.js").then(({ mountScooter3D }) => {
    stage.innerHTML = "";
    const v = mountScooter3D(stage, { paint, zoom: 0.78 });
    if (v) viewer = v;
    else stage.innerHTML = renderScooter({ paint });
  }).catch(() => { stage.innerHTML = renderScooter({ paint }); });
}

/* ------------------------------------------------------------------ hero 3D */
function initHero3D() {
  const stage = $("#heroStage");
  if (!stage) return;
  const dots = $$("#heroSwatches [data-colour]");
  const nameEl = $("#heroColourName");
  let current = "cobalt";

  const setColour = (key) => {
    current = key;
    dots.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.colour === key)));
    if (nameEl) nameEl.textContent = key.charAt(0).toUpperCase() + key.slice(1);
  };

  import("./scooter3d.js").then(({ mountScooter3D, PAINT_3D }) => {
    const viewer = mountScooter3D(stage, { paint: current });
    if (!viewer) {
      stage.innerHTML = `<div class="hero3d-fallback">${renderScooter({ paint: current })}</div>`;
      return;
    }
    dots.forEach((btn) => btn.addEventListener("click", () => {
      setColour(btn.dataset.colour);
      nameEl.textContent = PAINT_3D[btn.dataset.colour].name;
      viewer.setPaint(btn.dataset.colour);
    }));
  }).catch((err) => {
    console.warn("3D viewer unavailable", err);
    stage.innerHTML = `<div class="hero3d-fallback">${renderScooter({ paint: current })}</div>`;
  });
}

/* ------------------------------------------------------------------ shop */
function initShop() {
  const grid = $("#shopGrid");
  if (!grid) return;
  const params = new URLSearchParams(location.search);
  let filter = ["all", "city", "sport", "utility"].includes(params.get("filter")) ? params.get("filter") : "all";
  let sort = ["featured", "price-low", "price-high", "name"].includes(params.get("sort")) ? params.get("sort") : "featured";

  const draw = () => {
    let list = PRODUCTS.filter((p) => filter === "all" || p.category === filter);
    if (sort === "price-low") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-high") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    grid.innerHTML = list.map(productCard).join("");
    $("#shopCount").textContent = `${list.length} ${list.length === 1 ? "model" : "models"}`;
    $("#emptyState")?.classList.toggle("is-visible", list.length === 0);
    hydrateCards(grid);
    revealAll(grid);
  };

  $$("[data-filter]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.filter === filter));
    btn.addEventListener("click", () => {
      filter = btn.dataset.filter;
      $$("[data-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      draw();
    });
  });
  if ($("#sortSelect")) $("#sortSelect").value = sort;
  on($("#sortSelect"), "change", (e) => { sort = e.target.value; draw(); });
  draw();
}

/* ------------------------------------------------------------------ PDP */
function initPDP() {
  const nameEl = $("#pdpName");
  if (!nameEl) return;
  const params = new URLSearchParams(location.search);
  const product = productById(params.get("model") || "one") || PRODUCTS[1];
  let paint = product.colours[0];
  let qty = 1;
  let view = "full";

  document.title = `${product.name} — Volta`;
  $("#pdpCrumb").textContent = product.name;
  nameEl.textContent = product.name;
  $("#pdpTagline").textContent = product.tagline;
  $("#pdpBlurb").textContent = product.blurb;
  $("#pdpBadge").textContent = product.badge;
  $("#pdpPrice").textContent = money(product.price);
  const was = $("#pdpWas");
  if (product.compareAt) { was.textContent = money(product.compareAt); was.style.display = ""; }
  else was.style.display = "none";
  $("#pdpSave").textContent = product.compareAt
    ? `Save ${money(product.compareAt - product.price)}` : "";
  $("#pdpSave").style.display = product.compareAt ? "" : "none";
  $("#pdpRating").textContent = `${product.rating} · ${product.reviewCount} reviews`;
  $("#pdpWeekly").textContent = `or ${money(Math.round(product.price * 0.9 / 104))}/week with 0% finance`;
  $("#pdpSpecs").innerHTML = Object.entries(product.specs).map(([k, v]) => `
    <div><dt>${k.replace(/^./, (c) => c.toUpperCase())}</dt><dd>${v}</dd></div>`).join("");
  $("#pdpFeatures").innerHTML = product.highlights.map((h) => `<li>${h}</li>`).join("");
  $("#pdpInBox").innerHTML = product.inBox.map((h) => `<li>${h}</li>`).join("");

  const stage = $("#pdpStage");
  const img = $("#pdpImg");
  if (img) {
    img.src = product.image;
    img.alt = `${product.name} electric scooter`;
  }

  const setView = (v) => {
    view = v;
    stage.classList.remove("view-front", "view-rear");
    if (v === "front") stage.classList.add("view-front");
    if (v === "rear") stage.classList.add("view-rear");
    $$("#pdpThumbs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
  };
  $$("#pdpThumbs button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

  $("#pdpAdd").dataset.id = product.id;
  $("#pdpAdd").dataset.colour = product.colours[0];
  $("#pdpAdd").dataset.qty = "1";
  on($("#pdpAdd"), "click", () => addToCart(product.id, product.colours[0], qty));
  $$("#pdpQty button").forEach((btn) => {
    btn.addEventListener("click", () => {
      qty = Math.max(1, Math.min(9, qty + Number(btn.dataset.step)));
      $("#pdpQtyOutput").textContent = qty;
    });
  });

  const related = PRODUCTS.filter((p) => p.id !== product.id).slice(0, 3);
  $("#relatedGrid").innerHTML = related.map(productCard).join("");
  hydrateCards($("#relatedGrid"));
  revealAll($("#relatedGrid"));

  $$(".acc details").forEach((d) => d.addEventListener("toggle", () => {}));
}

/* ------------------------------------------------------------------ checkout */
function initCheckout() {
  const wrap = $("#checkoutItems");
  if (!wrap) return;
  let promo = 0;
  let shipping = "standard";
  const cart = readCart();

  const draw = () => {
    if (!cart.length) {
      wrap.innerHTML = `<div class="cart-empty"><p class="h3">Nothing to check out yet.</p><p>Your bag is empty — start with the range.</p><a class="btn btn--dark btn--sm" href="shop.html" style="margin-top:1rem">Shop scooters</a></div>`;
      $("#checkoutTotals").innerHTML = "";
      $("#placeOrder").disabled = true;
      return;
    }
    wrap.innerHTML = cart.map((l) => {
      const p = productById(l.id);
      return `
      <div class="summary-item">
        <div class="thumb"><img src="${p.image}" alt=""></div>
        <div class="info"><strong>${p.name}</strong><span>${COLOURS[l.colour].name} · Qty ${l.qty}</span></div>
        <div class="amt">${money(p.price * l.qty)}</div>
      </div>`;
    }).join("");

    const subtotal = cartSubtotal(cart);
    const discount = Math.round(subtotal * promo);
    const ship = SHIPPING[shipping] || 0;
    const total = subtotal - discount + ship;
    $("#checkoutTotals").innerHTML = `
      <div><span>Subtotal</span><span>${money(subtotal)}</span></div>
      ${discount ? `<div style="color:var(--cobalt)"><span>Discount (RIDE10)</span><span>−${money(discount)}</span></div>` : ""}
      <div><span>Delivery</span><span>${ship ? money(ship) : "Free"}</span></div>
      <div class="grand"><span>Total (AUD)</span><b>${money(total)}</b></div>`;
    $("#placeOrder").disabled = false;
    $("#placeOrder").dataset.total = total;
  };

  $$("input[name=shipping]").forEach((r) => r.addEventListener("change", () => {
    shipping = r.value;
    draw();
  }));

  on($("#promoForm"), "submit", (e) => {
    e.preventDefault();
    const code = $("#promoInput").value.trim().toUpperCase();
    if (code === "RIDE10") {
      promo = 0.1;
      $("#promoMsg").textContent = "RIDE10 applied — 10% off this order.";
      $("#promoMsg").style.color = "var(--cobalt)";
    } else {
      promo = 0;
      $("#promoMsg").textContent = "That code isn't valid. Try RIDE10 for this demo.";
      $("#promoMsg").style.color = "#b03024";
    }
    draw();
  });

  on($("#checkoutForm"), "submit", (e) => {
    e.preventDefault();
    if (!validateForm(e.currentTarget)) return;
    const id = "VOL-" + Math.floor(100000 + Math.random() * 899999);
    $("#orderId").textContent = `Order ${id}`;
    const email = $("#coEmail")?.value.trim();
    if (email && $("#orderEmail")) $("#orderEmail").textContent = `A receipt would be sent to ${email}.`;
    $("#checkoutGrid").style.display = "none";
    $("#orderDone").classList.add("is-visible");
    localStorage.removeItem(CART_KEY);
    syncBadges();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  draw();
}

/* ------------------------------------------------------------------ forms */
function validateForm(form) {
  let ok = true;
  form.querySelectorAll("[required]").forEach((input) => {
    const field = input.closest(".field") || input.parentElement;
    let bad = !input.value.trim();
    if (!bad && input.type === "email") bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
    field?.classList.toggle("has-error", bad);
    input.setAttribute("aria-invalid", String(bad));
    if (bad) ok = false;
  });
  if (!ok) form.querySelector("[aria-invalid=true]")?.focus();
  return ok;
}

function initForms() {
  $$("form[data-demo-form]").forEach((form) => {
    $$("input,select,textarea", form).forEach((i) =>
      i.addEventListener("input", () => i.closest(".field")?.classList.remove("has-error")));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateForm(form)) return;
      const success = form.parentElement.querySelector(".form-success");
      if (success) {
        form.style.display = "none";
        success.classList.add("is-visible");
        success.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        toast(form.dataset.success || "Thanks — we'll be in touch.");
        form.reset();
      }
    });
  });

  const newsletter = $("#newsletterForm");
  on(newsletter, "submit", (e) => {
    e.preventDefault();
    const input = newsletter.querySelector("input");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
      toast("Enter a valid email address.");
      input.focus();
      return;
    }
    toast("You're on the list. First dispatch lands Friday.");
    newsletter.reset();
  });
}

/* ------------------------------------------------------------------ ui chrome */
function initChrome() {
  const header = $(".site-header");
  const onScroll = () => header?.classList.toggle("is-stuck", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const nav = $("#mobileNav");
  const toggle = $("[data-menu-toggle]");
  on(toggle, "click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("no-scroll", open);
  });
  $$("#mobileNav a").forEach((a) => on(a, "click", () => {
    nav.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
    toggle.setAttribute("aria-expanded", "false");
  }));

  $$("[data-open-cart]").forEach((b) => on(b, "click", openDrawer));
  on($("#drawerClose"), "click", closeDrawer);
  on($("#overlay"), "click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  const yr = $("#year");
  if (yr) yr.textContent = new Date().getFullYear();
}

/* ------------------------------------------------------------------ reveal */
let observer;
function revealAll(root = document) {
  if (!("IntersectionObserver" in window)) return;
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); observer.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  }
  $$("[data-reveal]", root).forEach((el, i) => {
    if (el.classList.contains("is-in")) return;
    el.style.setProperty("--d", `${Math.min(i % 4, 3) * 50}ms`);
    observer.observe(el);
  });
}


/* ------------------------------------------------------------------ tech */
const TECH_FIGURES = {
  battery: `<svg viewBox="0 0 240 160" fill="none" stroke="#D9F26B" stroke-width="1.4" aria-hidden="true">
    <rect x="72" y="34" width="96" height="92" rx="10" />
    <rect x="88" y="50" width="64" height="16" rx="3" fill="rgba(217,242,107,.18)"/>
    <rect x="88" y="74" width="26" height="34" rx="3" fill="rgba(217,242,107,.18)"/>
    <rect x="120" y="74" width="32" height="34" rx="3" fill="rgba(217,242,107,.18)"/>
    <path d="M96 34v-8h48v8M96 126v8h48v-8" stroke="#8B958F"/>
    <path d="M44 80h-22M218 80h-22" stroke="#5C6661" stroke-dasharray="3 5"/>
    <circle cx="30" cy="80" r="8"/><circle cx="212" cy="80" r="8"/>
    <text x="120" y="150" fill="#7F8783" stroke="none" font-family="JetBrains Mono, monospace" font-size="8" text-anchor="middle" letter-spacing="2">2.4 KWH · LFP</text>
  </svg>`,
  motor: `<svg viewBox="0 0 240 160" fill="none" stroke="#D9F26B" stroke-width="1.4" aria-hidden="true">
    <circle cx="120" cy="80" r="54"/><circle cx="120" cy="80" r="40" stroke="#5C6661"/>
    <circle cx="120" cy="80" r="12" fill="rgba(217,242,107,.18)"/>
    <g stroke="#8B958F"><path d="M120 40v14M120 106v14M80 80h14M146 80h14M92 52l10 10M148 108l-10-10M148 52l-10 10M92 108l10-10"/></g>
    <path d="M158 42c14 8 24 22 26 38" stroke="#5C6661" stroke-dasharray="3 5"/>
    <text x="120" y="150" fill="#7F8783" stroke="none" font-family="JetBrains Mono, monospace" font-size="8" text-anchor="middle" letter-spacing="2">2.4 KW HUB</text>
  </svg>`,
  brakes: `<svg viewBox="0 0 240 160" fill="none" stroke="#D9F26B" stroke-width="1.4" aria-hidden="true">
    <circle cx="120" cy="80" r="52"/><circle cx="120" cy="80" r="30" stroke="#5C6661"/>
    <circle cx="120" cy="80" r="8" fill="rgba(217,242,107,.2)"/>
    <g stroke="#8B958F"><path d="M120 28v10M120 122v10M68 80h10M162 80h10M84 44l7 7M156 116l-7-7M156 44l-7 7M84 116l7-7"/></g>
    <path d="M156 58h18a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8h-18z" fill="rgba(217,242,107,.14)"/>
    <text x="120" y="150" fill="#7F8783" stroke="none" font-family="JetBrains Mono, monospace" font-size="8" text-anchor="middle" letter-spacing="2">REGEN + ABS</text>
  </svg>`,
  app: `<svg viewBox="0 0 240 160" fill="none" stroke="#D9F26B" stroke-width="1.4" aria-hidden="true">
    <rect x="88" y="20" width="64" height="120" rx="12"/>
    <rect x="100" y="36" width="40" height="58" rx="4" stroke="#5C6661"/>
    <path d="M104 88c6-14 10-6 14-18s8 4 16-10" stroke="#8B958F"/>
    <circle cx="120" cy="126" r="4" fill="#D9F26B"/>
    <path d="M160 54c12 8 20 18 20 30M170 44c18 12 28 26 28 42" stroke="#5C6661" stroke-dasharray="3 5"/>
    <text x="120" y="150" fill="#7F8783" stroke="none" font-family="JetBrains Mono, monospace" font-size="8" text-anchor="middle" letter-spacing="2">4G · OTA</text>
  </svg>`,
};

function initTech() {
  const list = $("#techList");
  if (!list) return;
  const panel = $("#techPanel");
  let active = 0;

  const drawList = () => {
    list.innerHTML = TECH.map((t, i) => `
      <button class="tech-item" type="button" role="tab" data-tech="${i}" aria-selected="${i === active}">
        <span class="num">0${i + 1}</span>
        <span class="t">${t.title}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>`).join("") + `<p class="tech-note">Measured at 25 °C with a 75 kg rider. Range varies with terrain, load and throttle habits.</p>`;
  };

  const drawPanel = () => {
    const t = TECH[active];
    panel.innerHTML = `
      <div class="tech-figure">${TECH_FIGURES[t.id]}</div>
      <h3>${t.title}</h3>
      <p>${t.copy}</p>
      <div class="tech-datum">
        ${t.datum.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join("")}
      </div>`;
  };

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tech]");
    if (!btn) return;
    active = Number(btn.dataset.tech);
    drawList();
    drawPanel();
  });

  drawList();
  drawPanel();
}

/* ------------------------------------------------------------------ finance */
function initFinance() {
  const weeklyEl = $("#finWeekly");
  if (!weeklyEl) return;
  const modelEl = $("#finModel");
  const depositEl = $("#finDeposit");
  const termRow = $("#finTerm");
  let term = 24;

  const draw = () => {
    const price = productById(modelEl.value).price;
    const depositPct = Number(depositEl.value);
    const deposit = Math.round(price * depositPct / 100);
    const financed = price - deposit;
    const weekly = financed / (term * 52 / 12);
    const monthly = financed / term;

    weeklyEl.innerHTML = `${money(Math.round(weekly))}<small> / week</small>`;
    $("#finMonthly").textContent = `${money(Math.round(monthly))} a month for ${term} months`;
    $("#finDepositOut").textContent = `${depositPct}% · ${money(deposit)}`;
    $("#finAmount").textContent = `${money(financed)} financed, ${money(deposit)} deposit at ${term} months.`;
    depositEl.style.setProperty("--fill", `${(depositPct / 50) * 100}%`);
    termRow.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.term) === term)));
  };

  modelEl.addEventListener("change", draw);
  depositEl.addEventListener("input", draw);
  termRow.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-term]");
    if (!btn) return;
    term = Number(btn.dataset.term);
    draw();
  });
  draw();
}

/* ------------------------------------------------------------------ counters */
function initCounters() {
  const els = $$("[data-count]");
  if (!els.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const target = Number(el.dataset.count);
      const start = performance.now();
      const dur = 1200;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString("en-AU");
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      io.unobserve(el);
    });
  }, { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ boot */
document.addEventListener("DOMContentLoaded", () => {
  initChrome();
  initHero3D();
  initConfigurator();
  initShop();
  initPDP();
  initCheckout();
  initForms();
  initTech();
  initFinance();
  initCounters();
  renderCart();
  syncBadges();

  const range = $("#rangeGrid");
  if (range) {
    const picks = ["lite", "one", "one-s", "cargo"].map(productById);
    range.innerHTML = picks.map(productCard).join("");
    hydrateCards(range);
  }

  const reviewGrid = $("#reviewGrid");
  if (reviewGrid) {
    reviewGrid.innerHTML = REVIEWS.slice(0, 3).map((r) => `
      <figure class="review" data-reveal>
        <div class="review-stars">${Array.from({ length: 5 }, (_, i) =>
          `<svg viewBox="0 0 24 24" fill="${i < r.stars ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.4"><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.8 6.2 20.8l1.1-6.4L2.6 9.8l6.5-.9Z"/></svg>`).join("")}</div>
        <blockquote><p>“${r.text}”</p></blockquote>
        <footer><b>${r.name}</b><span>${r.city}</span></footer>
      </figure>`).join("");
  }

  const storeGrid = $("#storeGrid");
  if (storeGrid) {
    storeGrid.innerHTML = STORES.map((s) => `
      <article class="store" data-reveal>
        <h3 class="city">${s.city}</h3>
        <address>${s.address}</address>
        <p class="hours">${s.hours}</p>
        <p class="mono" style="letter-spacing:.06em">${s.phone}</p>
        <a class="link-arrow" href="#book">Book a ride <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      </article>`).join("");
  }

  const journalGrid = $("#journalGrid");
  if (journalGrid) {
    journalGrid.innerHTML = JOURNAL.map((j) => `
      <article class="post" data-reveal>
        <a href="#" aria-label="${j.title}">
          <div class="post-art post-art--${j.art}"><span class="tag">${j.tag}</span><span class="glyph">${j.glyph}</span></div>
          <div class="post-body">
            <p class="meta">${j.date} · 4 min read</p>
            <h3>${j.title}</h3>
          </div>
        </a>
      </article>`).join("");
  }

  revealAll();
});
