import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

function stringifySearch(search: Record<string, unknown>) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === "") continue;
    usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

function parseSearch(searchStr: string) {
  const raw = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
  const usp = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  usp.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    stringifySearch,
    parseSearch,
  });
}
