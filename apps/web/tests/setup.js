import { afterEach, beforeEach } from "vitest";

// Nos navegadores, os campos de um formulário são acessíveis pelo nome (form.email, form.name),
// inclusive sobrescrevendo propriedades nativas como form.name. O jsdom não implementa isso,
// e o código das telas depende dele; este atalho reproduz o comportamento do navegador.
for (const campo of ["email", "password", "confirmation", "name", "current", "next", "code"]) {
  Object.defineProperty(HTMLFormElement.prototype, campo, {
    configurable: true,
    get() {
      return this.elements.namedItem(campo);
    }
  });
}

// Esqueleto mínimo do index.html que os módulos esperam encontrar.
const SHELL = `
  <aside id="sidebar"></aside>
  <div id="sidebar-backdrop" hidden></div>
  <header id="topbar"></header>
  <main id="app"></main>
  <div id="toasts"></div>
  <div id="overlay-root"></div>
`;

beforeEach(() => {
  document.body.innerHTML = SHELL;
  document.body.className = "";
  document.title = "";
  window.location.hash = "";
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  // jsdom não implementa rolagem.
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  document.body.innerHTML = "";
});
