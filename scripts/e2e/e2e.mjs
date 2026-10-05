import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.E2E_URL ?? "http://localhost:3401";
// fileURLToPath decodifica acentos do caminho (URL.pathname deixaria "%C3%B3").
const SHOTS = process.env.E2E_SHOTS ?? fileURLToPath(new URL("./shots/", import.meta.url));
mkdirSync(SHOTS, { recursive: true });
const results = [];
const pageErrors = [];
const step = async (name, fn) => {
  const started = Date.now();
  try {
    await fn();
    results.push(`OK   ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message.split("\n")[0]}`);
  }
};

const browser = await puppeteer.launch({ browser: "firefox", executablePath: process.env.FIREFOX_PATH ?? "/usr/bin/firefox", headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 860 });
page.on("pageerror", (error) => pageErrors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error" && !/favicon|401|Failed to load resource/.test(message.text())) pageErrors.push(`console: ${message.text()}`);
});

const go = async (hash) => {
  await page.goto(`${BASE}/#${hash}`, { waitUntil: "load" });
  await page.waitForFunction(() => !document.querySelector("[aria-busy='true']"), { timeout: 15000 });
};
const text = () => page.evaluate(() => document.querySelector("#app").innerText);
const fill = (selector, value) =>
  page.evaluate(
    (sel, val) => {
      const el = document.querySelector(sel);
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    selector,
    value
  );
const click = (selector) => page.evaluate((sel) => document.querySelector(sel).click(), selector);
const waitText = (needle, timeout = 20000) => page.waitForFunction((n) => document.body.innerText.includes(n), { timeout }, needle);
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: false });
const email = `e2e${Date.now()}@codelab.local`;
// Sai da conta e recarrega de verdade (mudar só o hash não reinicia a SPA).
const logoutTo = async (hash) => {
  await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));
  await page.goto(`${BASE}/?t=${Date.now()}#${hash}`, { waitUntil: "load" });
  await page.waitForFunction(() => !document.querySelector("[aria-busy='true']"), { timeout: 15000 });
};

await step("home com título, números e trilhas", async () => {
  await go("/");
  await waitText("Code Lab");
  const body = await text();
  if (!body.includes("Escreva o código. O juiz mostra onde você errou.")) throw new Error("slogan ausente");
  if (!/174\s*desafios/.test(body)) throw new Error("contagem de desafios ausente");
  if (!body.includes("Preparação para Entrevistas")) throw new Error("trilhas ausentes");
  await shot("01-home-claro");
});

await step("cadastro mostra onboarding e aviso de verificação", async () => {
  await go("/cadastro");
  await fill("#auth-name", "Estudante E2E");
  await fill("#auth-email", email);
  await fill("#auth-password", "senha123");
  await fill("#auth-confirmation", "senha123");
  await click("#auth-form button[type=submit]");
  await waitText("Por onde começar?");
  await waitText("Confirme o seu e-mail");
  await shot("02-dashboard-onboarding");
});

await step("link de verificação confirma o e-mail", async () => {
  const outbox = await (await fetch(`${BASE}/__outbox`)).json();
  const mail = outbox.find((item) => item.to === email);
  const link = mail.text.match(/http\S+/)[0];
  await page.goto(link, { waitUntil: "load" });
  await waitText("E-mail verificado");
});

await step("Ctrl+K encontra um desafio e abre", async () => {
  await go("/dashboard");
  await page.keyboard.down("Control");
  await page.keyboard.press("k");
  await page.keyboard.up("Control");
  await page.waitForSelector(".palette-input input");
  await fill(".palette-input input", "menor custo dijkstra");
  await page.waitForFunction(() => [...document.querySelectorAll(".palette-option")].some((option) => option.innerText.toLowerCase().includes("dijkstra")), { timeout: 10000 }).catch(async (error) => {
    console.log("PALETA:", await page.evaluate(() => document.querySelector(".dialog")?.innerText));
    throw error;
  });
  await shot("03-busca-rapida");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.hash.startsWith("#/desafios/"), { timeout: 10000 });
});

await step("atalho ? abre a lista de atalhos", async () => {
  await go("/trilhas");
  await page.keyboard.press("?");
  await waitText("Atalhos de teclado");
  await page.keyboard.press("Escape");
});

const setCode = (code) =>
  page.evaluate((value) => {
    const textarea = document.querySelector("#editor textarea");
    textarea.value = value;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, code);

await step("enviar em Python: errada e depois aceita, com comparação de tempo", async () => {
  await go("/desafios/soma-de-dois-numeros");
  await page.select("#language", "python");
  await setCode("def somar(a, b):\n    return a - b\n");
  await click("#submit-button");
  await waitText("Resposta errada", 30000);
  await setCode("def somar(a, b):\n    return a + b\n");
  await click("#submit-button");
  await waitText("casos aprovados", 30000);
  await page.waitForFunction(() => document.querySelector(".verdict-title.accepted"), { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector("#runtime-box")?.innerText.includes("Comparando"), { timeout: 15000 });
  await shot("04-desafio-aceito");
});

await step("comparar duas submissões mostra o diff", async () => {
  await click("[data-left-tab='submissions']");
  await page.waitForSelector("[data-compare='0']");
  await click("[data-compare='0']");
  await click("[data-compare='1']");
  await page.waitForSelector(".diff-view");
  const removed = await page.evaluate(() => document.querySelectorAll(".diff-removed").length);
  if (removed < 1) throw new Error("diff sem linhas removidas");
  await shot("05-comparacao");
});

await step("comentário em Markdown com spoiler", async () => {
  await click("[data-left-tab='discussion']");
  await page.waitForSelector("#comment-content");
  await fill("#comment-content", "Dica: use `a + b`. Resposta: ||return a + b||");
  await click("#comment-form button[type=submit]");
  await page.waitForSelector(".comment-body .spoiler");
  await page.waitForSelector(".comment-body code");
  await click(".comment-body .spoiler");
  await page.waitForSelector(".spoiler.is-revealed");
});

await step("editor: fechar parênteses e Ctrl+/ comenta", async () => {
  await click("[data-left-tab='description']");
  await setCode("");
  await page.focus("#editor textarea");
  await page.keyboard.type("x = (1");
  let value = await page.$eval("#editor textarea", (el) => el.value);
  if (value !== "x = (1)") throw new Error(`auto-close: "${value}"`);
  await page.keyboard.down("Control");
  await page.keyboard.press("/");
  await page.keyboard.up("Control");
  value = await page.$eval("#editor textarea", (el) => el.value);
  if (!value.startsWith("# x = (1)")) throw new Error(`comentário: "${value}"`);
});

await step("tela cheia e divisória redimensionável", async () => {
  const before = await page.evaluate(() => getComputedStyle(document.querySelector("#workspace")).gridTemplateColumns);
  await page.focus(".splitter-x");
  for (let index = 0; index < 5; index += 1) await page.keyboard.press("ArrowRight");
  const after = await page.evaluate(() => getComputedStyle(document.querySelector("#workspace")).gridTemplateColumns);
  if (before === after) throw new Error("divisória não mudou o layout");
});

await step("tema escuro", async () => {
  await go("/dashboard");
  await click("[data-theme-toggle]");
  await click("[data-theme-toggle]");
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  if (theme !== "dark") throw new Error(`tema = ${theme}`);
  await page.waitForSelector(".heatmap");
  await shot("06-dashboard-escuro");
  await go("/desafios/soma-de-dois-numeros");
  await shot("07-desafio-escuro");
  await go("/");
  await shot("08-home-escuro");
  await click("[data-theme-toggle]");
});

await step("perfil: conquistas, turmas e dados", async () => {
  await go("/perfil");
  await waitText("Conquistas");
  await waitText("Primeiro aceito");
  await waitText("Baixar meus dados");
  await shot("09-perfil");
});

await step("ranking com filtros e perfil público", async () => {
  await go("/ranking");
  await click("[data-period='semana']");
  await waitText("Estudante E2E");
  await click(".ranking-user");
  await page.waitForFunction(() => location.hash.startsWith("#/u/"), { timeout: 10000 });
  await waitText("Resolvidos recentemente");
  const body = await text();
  if (body.includes(email)) throw new Error("perfil público expõe e-mail");
});

let classCode = "";
await step("professor cria turma", async () => {
  await logoutTo("/entrar");
  await fill("#auth-email", "admin@codelab.local");
  await fill("#auth-password", "admin123");
  await click("#auth-form button[type=submit]");
  await page.waitForFunction(() => location.hash.startsWith("#/dashboard"), { timeout: 10000 });
  await go("/admin/turmas");
  await fill("#class-name", "Turma E2E");
  await click("#class-form button[type=submit]");
  await page.waitForFunction(() => location.hash.startsWith("#/admin/turmas/"), { timeout: 10000 });
  await page.waitForSelector(".class-code-lg");
  classCode = await page.$eval(".class-code-lg", (el) => el.textContent.trim());
  await shot("10-turma-vazia");
});

await step("estatísticas mostram onde os estudantes erram", async () => {
  await go("/admin/estatisticas");
  await waitText("Onde os estudantes mais erram");
  await page.waitForSelector(".failure-bar");
  await shot("11-estatisticas");
});

await step("editor de desafio: rascunho e validação de solução", async () => {
  await go("/admin/desafios/novo");
  await page.waitForSelector("#tool-source");
  const published = await page.$eval("input[name='isPublished']", (el) => el.checked);
  if (published) throw new Error("novo desafio deveria nascer como rascunho");
  await shot("12-editor-desafio");
});

await step("estudante entra na turma e aparece no relatório", async () => {
  await logoutTo("/entrar");
  await fill("#auth-email", email);
  await fill("#auth-password", "senha123");
  await click("#auth-form button[type=submit]");
  await page.waitForFunction(() => location.hash.startsWith("#/dashboard"), { timeout: 10000 });
  await go("/perfil");
  await page.waitForSelector("#class-code");
  await fill("#class-code", classCode);
  await click("#join-form button[type=submit]");
  await waitText("Turma E2E");
});

await step("esqueci a senha: link, nova senha e login", async () => {
  await logoutTo("/esqueci-senha");
  await fill("#recovery-email", email);
  await click("#recovery-form button[type=submit]");
  await waitText("Se houver uma conta");
  const outbox = await (await fetch(`${BASE}/__outbox`)).json();
  const mail = [...outbox].reverse().find((item) => item.to === email && item.subject.includes("Redefinir"));
  await page.goto(mail.text.match(/http\S+/)[0], { waitUntil: "load" });
  await page.waitForSelector("#reset-password");
  await fill("#reset-password", "senha-nova-1");
  await fill("#reset-confirmation", "senha-nova-1");
  await click("#reset-form button[type=submit]");
  await page.waitForFunction(() => location.hash.startsWith("#/entrar"), { timeout: 10000 });
  await fill("#auth-email", email);
  await fill("#auth-password", "senha-nova-1");
  await click("#auth-form button[type=submit]");
  await page.waitForFunction(() => location.hash.startsWith("#/dashboard"), { timeout: 10000 });
});

await step("páginas legais e 404", async () => {
  await go("/privacidade");
  await waitText("Lei Geral de Proteção de Dados");
  await go("/termos");
  await waitText("Uso aceitável");
  await go("/nao-existe");
  await waitText("não encontrada");
});

await step("mobile: home, trilha e desafio", async () => {
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await go("/");
  await shot("13-mobile-home");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`rolagem horizontal de ${overflow}px`);
  await go("/trilhas/estrutura-de-dados");
  await shot("14-mobile-trilha");
  await go("/desafios/dijkstra");
  await shot("15-mobile-desafio");
  const overflowChallenge = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflowChallenge > 1) throw new Error(`rolagem horizontal no desafio: ${overflowChallenge}px`);
});

await browser.close();
console.log(results.join("\n"));
console.log(pageErrors.length ? `\nErros na página:\n${[...new Set(pageErrors)].join("\n")}` : "\nSem erros na página.");
