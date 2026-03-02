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

function mount() {
  createRoot(document.getElementById("root")!).render(<App />);
}

// Geotab addin registration — MyGeotab calls initialize/focus/blur
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any;
if (win.geotab) {
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
} else {
  // Dev mode — no Geotab, uses mock data
  mount();
}
