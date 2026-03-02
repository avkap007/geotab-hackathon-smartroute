import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Geotab API type
export interface GeotabApi {
  call: (
    method: string,
    params: Record<string, unknown>,
    success?: (result: unknown) => void,
    error?: (err: unknown) => void,
  ) => void;
}

// Make Geotab API available to the rest of the app via this module export.
// Components can import { getGeotabApi } from './main' to access the live API.
let _api: GeotabApi | undefined;
export function getGeotabApi(): GeotabApi | undefined {
  return _api;
}

let mounted = false;

function mount() {
  if (mounted) return;
  mounted = true;
  createRoot(document.getElementById("root")!).render(<App />);
}

// Always register window.geotab.addin — create the namespace if Geotab hasn't
// injected it yet (dev mode). Geotab will find and call initialize() when ready.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any;
win.geotab = win.geotab ?? { addin: {} };
win.geotab.addin = win.geotab.addin ?? {};

win.geotab.addin["smartroute"] = function () {
  return {
    initialize(api: GeotabApi, _state: unknown, callback: () => void) {
      _api = api;
      mount();
      callback();
    },
    focus(api: GeotabApi) {
      _api = api;
    },
    blur() {},
  };
};

// Dev mode fallback: if Geotab never calls initialize() within 300ms, mount anyway
setTimeout(() => {
  mount();
}, 300);
