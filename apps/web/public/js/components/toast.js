export function toast(message, type = "info") {
  const region = document.getElementById("toasts");
  if (!region) return;
  const item = document.createElement("div");
  item.className = `toast tw:cursor-pointer ${type === "error" ? "is-error" : type === "success" ? "is-success" : ""}`;
  item.title = "Clique para fechar";
  item.textContent = message;
  item.addEventListener("click", () => item.remove());
  region.append(item);
  setTimeout(() => item.remove(), 4200);
}
