export function toast(message, type = "info") {
  const region = document.getElementById("toasts");
  if (!region) return;
  const item = document.createElement("div");
  item.className = `toast ${type === "error" ? "is-error" : type === "success" ? "is-success" : ""}`;
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 4200);
}
