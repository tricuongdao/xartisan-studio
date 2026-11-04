/* Volta — demo catalogue and editorial content. All prices in AUD, GST inclusive. */

export const money = (n) =>
  "A$" + Number(n).toLocaleString("en-AU", { maximumFractionDigits: 0 });

export const COLOURS = {
  bone:     { name: "Bone",     hex: "#E7E0D0" },
  graphite: { name: "Graphite", hex: "#3B4046" },
  cobalt:   { name: "Cobalt",   hex: "#2743E8" },
  sage:     { name: "Sage",     hex: "#A3B29C" },
  clay:     { name: "Clay",     hex: "#C36A4E" },
};

export const PRODUCTS = [
  {
    id: "lite",
    name: "Volta Lite",
    image: "assets/img/products/volta-lite.webp",
    tagline: "The lightest way into electric.",
    category: "city",
    price: 1990,
    compareAt: null,
    badge: "Entry",
    badgeStyle: "dark",
    blurb: "A pared-back city scooter for short hops, flat streets and first-time riders. Same battery chemistry as the rest of the range, 18 kg lighter than the One.",
    colours: ["sage", "bone", "graphite", "cobalt"],
    specs: {
      range: "55 km",
      speed: "45 km/h",
      battery: "1.4 kWh removable",
      motor: "1.2 kW hub",
      charge: "3.5 h (0–100%)",
      weight: "68 kg",
      load: "120 kg",
      wheels: "10-inch alloy",
      brakes: "Disc / drum",
      warranty: "3 years + 5 years battery",
    },
    highlights: [
      "Removable 1.4 kWh battery — charge at your desk",
      "68 kg kerb weight, walk-in friendly",
      "Integrated front basket mount",
      "Three-year warranty, five on the battery",
    ],
    inBox: ["Volta Lite scooter", "Removable battery", "400 W charger", "Two keys + fob", "Tool kit"],
    rating: 4.7,
    reviewCount: 84,
  },
  {
    id: "one",
    name: "Volta One",
    image: "assets/img/products/volta-one.webp",
    tagline: "The everyday city scooter.",
    category: "city",
    price: 2990,
    compareAt: 3290,
    badge: "Best seller",
    badgeStyle: "volt",
    blurb: "Our most-sold model, and the one we recommend to most people. Bigger battery, a plusher seat and enough range for a week of commuting without thinking about it.",
    colours: ["bone", "cobalt", "graphite", "sage", "clay"],
    specs: {
      range: "70 km",
      speed: "50 km/h",
      battery: "1.8 kWh removable",
      motor: "1.6 kW hub",
      charge: "4.5 h (0–100%)",
      weight: "82 kg",
      load: "150 kg",
      wheels: "12-inch alloy",
      brakes: "Disc / disc",
      warranty: "5 years + 8 years battery",
    },
    highlights: [
      "70 km real-world range, 1.8 kWh removable pack",
      "Disc brakes front and rear with regen",
      "Under-seat storage for a full-face helmet",
      "Five-year warranty, eight on the battery",
    ],
    inBox: ["Volta One scooter", "Removable battery", "650 W charger", "Two keys + fob", "Tool kit"],
    rating: 4.9,
    reviewCount: 212,
  },
  {
    id: "one-s",
    name: "Volta One S",
    image: "assets/img/products/volta-one-s.webp",
    tagline: "Same body. Sharper everything.",
    category: "sport",
    price: 3890,
    compareAt: 4290,
    badge: "New",
    badgeStyle: "dark",
    blurb: "The One S turns the volume up: a 2.4 kWh pack, a 2.4 kW motor and sport geometry. Sixty-five kilometres an hour, and it still fits in a lift.",
    colours: ["cobalt", "graphite", "clay", "bone"],
    specs: {
      range: "90 km",
      speed: "65 km/h",
      battery: "2.4 kWh removable",
      motor: "2.4 kW hub",
      charge: "5 h (0–100%)",
      weight: "92 kg",
      load: "150 kg",
      wheels: "12-inch alloy",
      brakes: "Disc / disc, ABS",
      warranty: "5 years + 8 years battery",
    },
    highlights: [
      "90 km range with the 2.4 kWh pack",
      "65 km/h top speed, 2.4 kW peak motor",
      "Sport-tuned suspension and ABS front brake",
      "TFT dash with navigation from the Volta app",
    ],
    inBox: ["Volta One S scooter", "Removable battery", "750 W charger", "Two keys + fob", "Sport mirror set"],
    rating: 4.8,
    reviewCount: 96,
  },
  {
    id: "cargo",
    name: "Volta Cargo",
    image: "assets/img/products/volta-cargo.webp",
    tagline: "A small van that parks anywhere.",
    category: "utility",
    price: 4490,
    compareAt: null,
    badge: "Utility",
    badgeStyle: "dark",
    blurb: "Built for deliveries, market runs and anyone who has ever strapped a box to a scooter and hoped. A reinforced frame, a 60 kg rear rack and the same removable battery.",
    colours: ["graphite", "bone", "sage"],
    specs: {
      range: "80 km",
      speed: "45 km/h",
      battery: "2.4 kWh removable",
      motor: "2.0 kW hub",
      charge: "5 h (0–100%)",
      weight: "104 kg",
      load: "180 kg",
      wheels: "12-inch reinforced",
      brakes: "Disc / disc, ABS",
      warranty: "5 years + 8 years battery",
    },
    highlights: [
      "60 kg-rated rear rack with anchor points",
      "Reinforced frame and heavier-duty suspension",
      "80 km range under load",
      "Fleet servicing and telemetry available",
    ],
    inBox: ["Volta Cargo scooter", "Removable battery", "750 W charger", "Two keys + fob", "Rack straps"],
    rating: 4.6,
    reviewCount: 38,
  },
];

export const productById = (id) => PRODUCTS.find((p) => p.id === id);

export const TECH = [
  {
    id: "battery",
    title: "Removable battery",
    copy: "Lift the pack out and carry it inside. LFP cells hold their capacity for thousands of cycles, and every pack is rated to eight years of daily charging.",
    datum: [["Capacity", "2.4 kWh"], ["Cycles", "3,000+"], ["Warranty", "8 years"]],
  },
  {
    id: "motor",
    title: "Hub motor",
    copy: "One moving part, sealed against rain and road grime. Peak power arrives instantly and quietly — no belts, no chain lube, no service intervals to remember.",
    datum: [["Peak power", "2.4 kW"], ["Torque", "58 Nm"], ["Service", "20,000 km"]],
  },
  {
    id: "brakes",
    title: "Regenerative braking",
    copy: "Every slow-down returns a little charge to the pack. The front ABS keeps the wheel from locking on wet tram tracks, and the rear disc is sized for a fully loaded rack.",
    datum: [["Front", "230 mm disc"], ["Rear", "200 mm disc"], ["Recovery", "up to 8%"]],
  },
  {
    id: "app",
    title: "Connected app",
    copy: "Battery health, charging sessions, service reminders and a live location pin. Your scooter reports in over 4G; you get a push notification if it ever moves without you.",
    datum: [["Connectivity", "4G LTE"], ["Updates", "Over the air"], ["Security", "Live location"]],
  },
];

export const REVIEWS = [
  { name: "Maya R.", city: "Melbourne, VIC", stars: 5, text: "I sold my second car. The One does the school run, the grocery run and the 12 minutes to work — and I charge it at my desk." },
  { name: "Tom H.", city: "Brisbane, QLD", stars: 5, text: "Test rode on a Saturday, delivered the following Thursday. The team actually answered the phone, which is rare." },
  { name: "Priya N.", city: "Sydney, NSW", stars: 5, text: "Six months, 2,400 km, zero dramas. The removable battery is the whole game — I live in an apartment with no garage." },
  { name: "Dan W.", city: "Perth, WA", stars: 4, text: "The Cargo has replaced my ute for local deliveries. Range drops a bit fully loaded, but it still does a full day." },
  { name: "Ellie K.", city: "Adelaide, SA", stars: 5, text: "Quiet, quick off the lights, and it looks like nothing else on the street. The sage colour gets commented on constantly." },
  { name: "Sam O.", city: "Hobart, TAS", stars: 5, text: "Servicing came to me. They picked the scooter up from the office and dropped it back the same afternoon." },
];

export const STORES = [
  { city: "Sydney", address: "14 Mitchell Road, Alexandria NSW 2015", hours: "Mon–Sat 9–5, Sun 10–4", phone: "(02) 8103 4420" },
  { city: "Melbourne", address: "88 Bendigo Street, Richmond VIC 3121", hours: "Mon–Sat 9–5, Sun 10–4", phone: "(03) 9068 2210" },
  { city: "Brisbane", address: "7 Doggett Street, Fortitude Valley QLD 4006", hours: "Mon–Sat 9–5", phone: "(07) 3121 8840" },
  { city: "Perth", address: "22 Stuart Street, Northbridge WA 6003", hours: "Tue–Sat 9–5", phone: "(08) 6371 5520" },
];

export const JOURNAL = [
  {
    tag: "Ownership",
    title: "Charging without a garage: a renter's guide",
    date: "12 Oct 2026",
    art: "a",
    glyph: "01",
    excerpt: "Lift-out batteries changed the maths for apartment riders. Here is what six months of desk charging actually looks like.",
  },
  {
    tag: "City",
    title: "The 12-minute city: mapping our favourite commute",
    date: "28 Sep 2026",
    art: "b",
    glyph: "02",
    excerpt: "We timed the same 4.8 km trip by car, tram and scooter on a wet Tuesday. The result was not close.",
  },
  {
    tag: "Engineering",
    title: "Why we chose LFP cells over everything else",
    date: "09 Sep 2026",
    art: "c",
    glyph: "03",
    excerpt: "Longer cycle life, better thermal behaviour, no cobalt. A short, non-technical explainer on the chemistry inside the pack.",
  },
];

export const FAQ = [
  { q: "Do I need a licence?", a: "In most Australian states a Volta is a moped-class vehicle: you will need a car or rider licence, registration and a helmet. Rules vary by state — we include a state-by-state guide with every order and will talk you through it before you buy." },
  { q: "How does delivery work?", a: "Metro delivery is free within 40 km of our four showrooms, usually within five business days. Regional delivery is quoted at checkout. Your scooter arrives charged, assembled and ready to ride." },
  { q: "Can I charge it at work?", a: "Yes. The battery lifts out and weighs between 9 and 14 kg depending on the model. It charges from a standard 240 V socket in four to five hours." },
  { q: "What does servicing cost?", a: "The first service at 1,000 km is free. After that, a standard service is A$149 and we collect and return within the metro area." },
  { q: "Is finance available?", a: "Yes — 0% interest over 12, 24 or 36 months on approved applications, with a minimum 10% deposit. Apply in store or over the phone; approval usually takes minutes." },
];
