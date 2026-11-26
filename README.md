# Three.js walking simulator

Een 3D-scene in de browser met 1000 low-poly mensen in een abstract landschap. De camera staat op ooghoogte; door te scrollen loop je door de scene. Hover over een persoon om zijn (fictieve) naam en adres te zien.

**Live:** https://willmuijrers.github.io/Three.js-walking-simulator/

## Bediening

- **Scrollen / swipen / pijltjes / W-S** — vooruit en achteruit lopen
- **Muis bewegen** — rondkijken
- **Hover** — naam en adres van een persoon

## Lokaal draaien

Geen build-stap nodig; Three.js wordt via een CDN geladen.

```bash
python3 -m http.server 5173
```

Open daarna http://localhost:5173.

## Techniek

- Alle mensen zijn `InstancedMesh`'es (één per houding), waardoor de hele scene in ~9 draw calls wordt getekend.
- De idle-beweging (wiegen, ademen, armen, hoofd draaien) zit volledig in de vertex shader.
- NAW-gegevens worden willekeurig gegenereerd in `naw.js` en zijn fictief.
