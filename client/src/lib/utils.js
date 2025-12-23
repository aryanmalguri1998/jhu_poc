import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Normalizes page names into route-friendly slugs
export function createPageUrl(pageName = "") {
  const safeName = String(pageName).trim();
  if (!safeName) return "/";
  return "/" + safeName.toLowerCase().replace(/\s+/g, "-");
}
