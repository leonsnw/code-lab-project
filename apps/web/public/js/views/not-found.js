import { html, render as paint } from "../dom.js";

export function render({ root }) {
  paint(
    root,
    html`
      <div class="card" style="max-width: 560px; margin: 40px auto; text-align: center">
        <h1>Página não encontrada</h1>
        <p class="lead">O endereço acessado não existe no CodeLab.</p>
        <p class="btn-row" style="justify-content: center; margin-top: 18px">
          <a class="btn btn-primary" href="#/desafios">Ver desafios</a>
          <a class="btn" href="#/">Início</a>
        </p>
      </div>
    `
  );
}
