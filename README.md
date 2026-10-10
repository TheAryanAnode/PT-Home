# Motion rehab twin

React renders the product and 3D avatar. A local Python process owns Bluetooth
and publishes clean motion data over `ws://127.0.0.1:8765`. React never talks
to BLE directly.

## Run with simulated sensors

First-time bridge setup:

```bash
cd bridge
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Then run `python main.py --simulate` in that terminal. In a second terminal,
from the project root, run `npm run dev` and open <http://127.0.0.1:5173>.
The website reconnects automatically after the bridge restarts.

For hardware, flash [firmware/RehabMotion](firmware/RehabMotion/RehabMotion.ino)
then run `python main.py --ble`. The Feather will not show up in macOS
Bluetooth settings. See [bridge/README.md](bridge/README.md) and
[firmware/README.md](firmware/README.md).

## Vite notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
