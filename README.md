# world-teleportation

A browser-based teleportation network simulator. Six pads scattered across the globe
(New York, London, Cairo, Tokyo, Sydney, Rio) hold a mix of humans, hardware, and
software entities. Select an entity, click a destination pad, and watch it dissolve
into particles and rematerialize on arrival.

- **Humans** cost the most energy to move and have a rematerialization cooldown
  (occasionally arriving with mild deja vu — cosmetic only).
- **Hardware** costs less and has a short cooldown.
- **Software** is nearly free and teleports almost instantly.

Energy regenerates over time and gates how often you can teleport.

## Run it

No build step — it's static HTML/CSS/JS.

```
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.
