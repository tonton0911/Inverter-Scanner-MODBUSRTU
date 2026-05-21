# Modbus RTU Inspector

A browser-based Modbus RTU frame builder, register scanner, and response decoder for solar inverters. No server required — runs entirely in the browser as a static site.

![Dark theme Modbus RTU Inspector](https://img.shields.io/badge/theme-dark-22c55e?style=flat-square) ![Static site](https://img.shields.io/badge/deployment-static-blue?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)

---

## Features

- **Register Scanner** — scan a hex address range with configurable start/end, chunk size, and quick presets per inverter brand
- **Frame Builder** — build and preview any Modbus RTU frame (FC 0x03 / 0x04 / 0x06) with live CRC-16 computation
- **Response Decoder** — paste raw hex bytes and decode register values with uint16, int16, and scaled views
- **Dashboard** — live-style metrics for Grid, PV, and Battery telemetry (demo data; wire to backend for live use)
- **CSV Export** — export scan results to a CSV file
- **Inverter profiles** — named register maps for SolaX X1 G4, Huawei SUN2000, Deye SUN, Solis S5/S6, SAJ H1/R5/HS2, Fox ESS H1/AC1/T

---

## Supported Inverter Profiles

| Profile | Register range | Protocol reference |
|---|---|---|
| SolaX X1 Hybrid G4 | 0x0000–0x0047 | SolaX Modbus V3.21 |
| Huawei SUN2000 | 0x1000–0x202F | SUN2000 SmartLogger |
| Deye SUN Series | 0x006D–0x00BF | Deye Modbus V1.34 |
| Solis S5/S6 | 0x0033–0x00AB | Solis Modbus V1.8 |
| SAJ H1/R5/HS2 | 0x0100–0x0155 | SAJ Modbus V1.0 |
| Fox ESS H1/AC1/T | 0x0000–0x001F | FoxESS Modbus V1.0 |
| Generic | — | Raw register view |

---

## Getting Started

### Option 1 — Open directly (no build step)

```bash
git clone https://github.com/YOUR_USERNAME/modbus-rtu-inspector.git
cd modbus-rtu-inspector
# Open index.html in any modern browser
open index.html
```

### Option 2 — Serve locally

```bash
# Python 3
python -m http.server 8080
# then visit http://localhost:8080
```

### Option 3 — GitHub Pages

1. Push to GitHub
2. Go to **Settings > Pages**
3. Set source to `main` branch, `/ (root)` folder
4. Your app is live at `https://YOUR_USERNAME.github.io/modbus-rtu-inspector/`

---

## Project Structure

```
modbus-rtu-inspector/
├── index.html      # App shell, panels, markup
├── style.css       # Dark industrial theme, all layout
├── app.js          # CRC-16, frame builder, scanner, decoder
├── README.md
└── .github/
    └── workflows/
        └── deploy.yml  # Auto-deploy to GitHub Pages
```

---

## Live Hardware Usage

This app is a **browser-only frontend**. To communicate with a real inverter over serial RS-485:

1. Use the companion Python backend (`app.py`, requires `pyserial` and `crcmod`)
2. Or use a Modbus-to-TCP bridge (e.g. `mbusd`, `socat`) and adapt the fetch calls in `app.js`

The demo/simulation mode uses the SolaX X1 G4 register map with realistic sample values.

---

## Adding a New Inverter Profile

In `app.js`, add an entry to `REGISTER_NAMES`:

```js
my_brand: {
  0x0000: 'grid_voltage',
  0x0001: 'grid_current',
  // ...
},
```

Then add the `<option>` to the profile `<select>` in `index.html`.

---

## Dependencies

All loaded from CDN — no `npm install` required.

| Library | Purpose |
|---|---|
| [Tabler Icons](https://tabler.io/icons) | Outline icon font |

---

## License

MIT — see [LICENSE](LICENSE) for details.
