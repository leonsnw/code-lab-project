// Aplica o tema salvo antes da primeira pintura (evita piscar em claro).
// Script clássico e síncrono, carregado no <head>.
try {
  var savedTheme = localStorage.getItem("codelab-theme");
  if (savedTheme === "light" || savedTheme === "dark") document.documentElement.dataset.theme = savedTheme;
} catch (error) {
  // Sem armazenamento: segue o tema do sistema.
}
