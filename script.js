// --- World setup -----------------------------------------------------------

const LOCATIONS = [
  { id: "nyc", name: "New York", x: 180, y: 160 },
  { id: "london", name: "London", x: 430, y: 110 },
  { id: "cairo", name: "Cairo", x: 540, y: 240 },
  { id: "tokyo", name: "Tokyo", x: 780, y: 170 },
  { id: "sydney", name: "Sydney", x: 760, y: 420 },
  { id: "rio", name: "Rio", x: 260, y: 400 },
];

const TYPE_INFO = {
  human: { color: "#ffb454", cost: 40, cooldownMs: 5000, icon: "human" },
  hardware: { color: "#7ee787", cost: 25, cooldownMs: 1500, icon: "hardware" },
  software: { color: "#a78bfa", cost: 8, cooldownMs: 0, icon: "software" },
};

let entities = [
  { id: "e1", name: "Dr. Aria Chen", type: "human", location: "nyc" },
  { id: "e2", name: "Marcus Webb", type: "human", location: "london" },
  { id: "e3", name: "Server Rack A7", type: "hardware", location: "nyc" },
  { id: "e4", name: "Prototype Drone", type: "hardware", location: "tokyo" },
  { id: "e5", name: "Inventory Ledger v3", type: "software", location: "cairo" },
  { id: "e6", name: "Neural Net Weights", type: "software", location: "rio" },
  { id: "e7", name: "Yuki Tanaka", type: "human", location: "sydney" },
];

let cooldowns = {}; // entityId -> timestamp when available again
let selectedId = null;
let energy = 100;
const MAX_ENERGY = 100;
const REGEN_PER_SEC = 4;

let particles = []; // in-flight teleport effects

// --- DOM refs ----------------------------------------------------------

const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const entityListEl = document.getElementById("entity-list");
const selectedInfoEl = document.getElementById("selected-info");
const logListEl = document.getElementById("log-list");
const energyFillEl = document.getElementById("energy-fill");
const energyValueEl = document.getElementById("energy-value");

function locById(id) {
  return LOCATIONS.find((l) => l.id === id);
}

// --- Logging -------------------------------------------------------------

function log(message, kind = "") {
  const div = document.createElement("div");
  div.className = `entry ${kind}`;
  const time = new Date().toLocaleTimeString([], { hour12: false });
  div.textContent = `[${time}] ${message}`;
  logListEl.appendChild(div);
  logListEl.scrollTop = logListEl.scrollHeight;
}

// --- Rendering: side panel -------------------------------------------------

function renderEntityList() {
  entityListEl.innerHTML = "";
  for (const ent of entities) {
    const row = document.createElement("div");
    const onCooldown = (cooldowns[ent.id] || 0) > Date.now();
    row.className = "entity-row" + (ent.id === selectedId ? " selected" : "") + (onCooldown ? " cooldown" : "");

    const dot = document.createElement("span");
    dot.className = `dot ${ent.type}`;
    row.appendChild(dot);

    const name = document.createElement("span");
    name.textContent = ent.name;
    row.appendChild(name);

    const loc = document.createElement("span");
    loc.className = "entity-loc";
    loc.textContent = locById(ent.location).name;
    row.appendChild(loc);

    row.addEventListener("click", () => {
      if (onCooldown || isTeleporting(ent.id)) return;
      selectedId = ent.id === selectedId ? null : ent.id;
      renderEntityList();
      renderSelectedInfo();
    });

    entityListEl.appendChild(row);
  }
}

function renderSelectedInfo() {
  if (!selectedId) {
    selectedInfoEl.innerHTML = "Select an entity, then click a pad to teleport it.";
    return;
  }
  const ent = entities.find((e) => e.id === selectedId);
  const info = TYPE_INFO[ent.type];
  selectedInfoEl.innerHTML = `
    <b>${ent.name}</b><br/>
    Type: ${ent.type}<br/>
    Location: ${locById(ent.location).name}<br/>
    Teleport cost: ${info.cost} energy
  `;
}

function renderEnergy() {
  const pct = Math.max(0, Math.min(100, (energy / MAX_ENERGY) * 100));
  energyFillEl.style.width = `${pct}%`;
  energyValueEl.textContent = Math.round(energy);
}

// --- Teleportation logic ---------------------------------------------------

function isTeleporting(entityId) {
  return particles.some((p) => p.entityId === entityId);
}

function tryTeleport(entity, destId) {
  if (entity.location === destId) {
    log(`${entity.name} is already at ${locById(destId).name}.`, "warn");
    return;
  }
  if (isTeleporting(entity.id)) return;

  const onCooldown = (cooldowns[entity.id] || 0) > Date.now();
  if (onCooldown) {
    log(`${entity.name} is still rematerializing. Please wait.`, "warn");
    return;
  }

  const info = TYPE_INFO[entity.type];
  if (energy < info.cost) {
    log(`Not enough energy to teleport ${entity.name} (needs ${info.cost}).`, "warn");
    return;
  }

  energy -= info.cost;
  renderEnergy();

  const from = locById(entity.location);
  const to = locById(destId);
  spawnTeleportEffect(entity, from, to);

  log(`Teleporting ${entity.name} from ${from.name} to ${to.name}...`);

  cooldowns[entity.id] = Date.now() + 700 + info.cooldownMs; // brief in-flight + type cooldown

  setTimeout(() => {
    entity.location = destId;
    renderEntityList();
    renderSelectedInfo();

    if (entity.type === "human" && Math.random() < 0.12) {
      log(`${entity.name} arrived reporting mild deja vu. No lasting effects.`, "warn");
    } else {
      log(`${entity.name} materialized safely at ${to.name}.`, "ok");
    }
  }, 700);
}

function spawnTeleportEffect(entity, from, to) {
  const info = TYPE_INFO[entity.type];
  const particleCount = entity.type === "human" ? 26 : entity.type === "hardware" ? 18 : 10;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      entityId: entity.id,
      color: info.color,
      x: from.x,
      y: from.y,
      startX: from.x,
      startY: from.y,
      endX: to.x,
      endY: to.y,
      offsetAngle: Math.random() * Math.PI * 2,
      offsetRadius: Math.random() * 18,
      progress: -Math.random() * 0.25, // stagger start
      speed: 0.02 + Math.random() * 0.015,
    });
  }
}

// --- Canvas rendering --------------------------------------------------

function drawMap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // network lines between all pads
  ctx.strokeStyle = "rgba(94, 231, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < LOCATIONS.length; i++) {
    for (let j = i + 1; j < LOCATIONS.length; j++) {
      ctx.beginPath();
      ctx.moveTo(LOCATIONS[i].x, LOCATIONS[i].y);
      ctx.lineTo(LOCATIONS[j].x, LOCATIONS[j].y);
      ctx.stroke();
    }
  }

  // pads
  for (const loc of LOCATIONS) {
    const pulse = 3 + Math.sin(Date.now() / 400 + loc.x) * 2;

    ctx.beginPath();
    ctx.arc(loc.x, loc.y, 22 + pulse, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(94, 231, 255, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(loc.x, loc.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#5ee7ff";
    ctx.shadowColor = "#5ee7ff";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#dbe4ff";
    ctx.font = "13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(loc.name, loc.x, loc.y + 40);
  }

  drawEntitiesOnPads();
  drawParticles();
}

function drawEntitiesOnPads() {
  const byLocation = {};
  for (const ent of entities) {
    if (isTeleporting(ent.id)) continue;
    (byLocation[ent.location] ||= []).push(ent);
  }

  for (const [locId, list] of Object.entries(byLocation)) {
    const loc = locById(locId);
    list.forEach((ent, idx) => {
      const angle = (idx / list.length) * Math.PI * 2;
      const r = list.length > 1 ? 34 : 0;
      const x = loc.x + Math.cos(angle) * r;
      const y = loc.y - 34 + Math.sin(angle) * r * 0.5;
      drawEntityIcon(ent, x, y);
    });
  }
}

function drawEntityIcon(ent, x, y) {
  const info = TYPE_INFO[ent.type];
  const isSelected = ent.id === selectedId;

  ctx.beginPath();
  ctx.arc(x, y, isSelected ? 9 : 7, 0, Math.PI * 2);
  ctx.fillStyle = info.color;
  ctx.fill();

  if (isSelected) {
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawParticles() {
  particles = particles.filter((p) => p.progress <= 1.05);

  for (const p of particles) {
    p.progress += p.speed;
    if (p.progress < 0) continue;

    const t = Math.max(0, Math.min(1, p.progress));
    // arc trajectory with a lift in the middle
    const lift = -80 * Math.sin(t * Math.PI);
    const baseX = p.startX + (p.endX - p.startX) * t;
    const baseY = p.startY + (p.endY - p.startY) * t + lift;

    // dissolve near start, reassemble near end: spread shrinks at both extremes
    const spread = Math.sin(t * Math.PI) * p.offsetRadius * 3;
    const x = baseX + Math.cos(p.offsetAngle + t * 4) * spread;
    const y = baseY + Math.sin(p.offsetAngle + t * 4) * spread;

    const alpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;

    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function loop() {
  drawMap();
  requestAnimationFrame(loop);
}

// --- Input handling --------------------------------------------------------

canvas.addEventListener("click", (evt) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (evt.clientX - rect.left) * scaleX;
  const y = (evt.clientY - rect.top) * scaleY;

  const target = LOCATIONS.find((loc) => Math.hypot(loc.x - x, loc.y - y) < 30);
  if (!target || !selectedId) return;

  const entity = entities.find((e) => e.id === selectedId);
  if (entity) tryTeleport(entity, target.id);
});

// --- Energy regeneration ---------------------------------------------------

setInterval(() => {
  if (energy < MAX_ENERGY) {
    energy = Math.min(MAX_ENERGY, energy + REGEN_PER_SEC / 5);
    renderEnergy();
  }
  renderEntityList(); // refresh cooldown dimming
}, 200);

// --- Init --------------------------------------------------------------

renderEntityList();
renderSelectedInfo();
renderEnergy();
log("Teleportation network online. Select an entity and click a pad.");
loop();
