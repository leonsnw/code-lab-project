import { html, render as paint } from "../dom.js";

export function render({ root }) {
  paint(
    root,
    html`
      <div class="card tw:max-w-[560px] tw:mx-auto tw:my-10 tw:text-center">
        <h1>Página não encontrada</h1>
        <p class="lead">O endereço acessado não existe no CodeLab.</p>
        <p class="btn-row tw:justify-center tw:mt-4.5">
          <a class="btn btn-primary" href="#/desafios">Ver desafios</a>
          <a class="btn" href="#/">Início</a>
        </p>
      </div>
    `
  );
}
