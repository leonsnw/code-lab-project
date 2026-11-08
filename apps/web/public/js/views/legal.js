import { html, render as paint } from "../dom.js";
import { renderMarkdown } from "../markdown.js";

// Termos de uso e política de privacidade. O texto é um modelo para a
// instituição que opera esta instância do CodeLab; revise com o jurídico
// antes de abrir a plataforma ao público.
const UPDATED_AT = "30 de setembro de 2026";

const TERMS = `
## 1. O que é o CodeLab

O CodeLab é uma plataforma de estudo de programação: trilhas com lições, desafios corrigidos automaticamente, ranking e turmas. Esta instância é mantida pela instituição de ensino que a disponibilizou para você ("nós").

## 2. Sua conta

- Use dados verdadeiros e um e-mail que você acesse: é por ele que você recupera a senha.
- A conta é pessoal. Não compartilhe a senha; você responde pelo que for feito com ela.
- Você pode apagar a conta a qualquer momento em **Perfil › Excluir conta**.

## 3. Uso aceitável

O juiz executa o seu código num ambiente isolado, sem rede e sem acesso a arquivos. Mesmo assim, é proibido:

- tentar escapar do ambiente de execução, sobrecarregá-lo de propósito ou atacar a plataforma;
- tentar descobrir os casos de teste ocultos por meios que não sejam resolver o problema;
- publicar nos comentários a solução completa sem marcá-la como spoiler, conteúdo ofensivo, discriminatório ou que viole direitos de terceiros;
- usar a plataforma para fraudar avaliações de uma disciplina (por exemplo, enviar a solução de outra pessoa como sua).

Contas que violarem estas regras podem ser suspensas, e os pontos obtidos de forma indevida podem ser removidos.

## 4. Conteúdo

Os enunciados, as lições e as soluções comentadas são da instituição e dos autores do CodeLab. O código que você escreve continua sendo seu; você nos autoriza a guardá-lo e executá-lo para corrigir as submissões e montar as estatísticas da plataforma.

## 5. Disponibilidade

Fazemos o possível para manter a plataforma no ar, mas ela pode passar por manutenções e falhas. Pontuação e ranking servem para acompanhar o estudo e não substituem a avaliação oficial das disciplinas, a menos que o professor diga o contrário.

## 6. Mudanças

Podemos atualizar estes termos. Mudanças relevantes serão avisadas na plataforma.
`;

const PRIVACY = `
Esta política explica quais dados pessoais o CodeLab trata e como você exerce os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).

## Quais dados guardamos

| Dado | Para quê |
| --- | --- |
| Nome e e-mail | Identificar a sua conta, recuperar a senha e mostrar o nome no ranking |
| Senha | Guardada só como hash bcrypt; ninguém consegue lê-la |
| Código enviado, vereditos e tempos | Corrigir as submissões, mostrar o seu histórico e comparar tempos |
| Lições concluídas, dicas e soluções reveladas | Montar o progresso nas trilhas e aplicar as regras de pontuação |
| Comentários e avaliações | Exibir a discussão de cada desafio |
| Turmas em que você entrou | Permitir que o professor acompanhe o progresso da turma |

Não usamos cookies de rastreamento nem de publicidade. O único cookie é o da sessão (HttpOnly), necessário para você continuar logado. Preferências de exibição, como o tema e os rascunhos de código, ficam só no seu navegador.

## Quem vê o quê

- **Perfil público:** o nome, os pontos, os desafios resolvidos, as conquistas e o mapa de atividade. O e-mail nunca aparece.
- **Professores (administradores):** estatísticas agregadas da plataforma e, nas turmas em que você entrou, o seu nome, o e-mail e o progresso. O professor pode exportar esses dados da turma em CSV.
- Não vendemos nem compartilhamos dados com terceiros para fins comerciais.

## Base legal e retenção

Tratamos os dados para executar o serviço que você pediu ao criar a conta (art. 7º, V) e, nas turmas, para a finalidade educacional da instituição (art. 7º, IX). Os dados ficam guardados enquanto a conta existir. Ao excluir a conta, apagamos o cadastro, as submissões, os comentários, as avaliações, o progresso e a participação em turmas.

## Seus direitos

Pela LGPD (art. 18), você pode:

- **acessar e levar seus dados:** em **Perfil › Baixar meus dados** você recebe tudo em JSON;
- **corrigir dados:** o nome pode ser alterado no perfil;
- **eliminar dados:** em **Perfil › Excluir conta**, com confirmação da senha;
- **tirar dúvidas ou reclamar:** fale com o encarregado de dados da instituição que mantém esta instância ou com a Autoridade Nacional de Proteção de Dados (ANPD).

## Segurança

O código enviado roda isolado (sem rede, sem acesso a arquivos, com limites de tempo e memória). As senhas usam bcrypt, a sessão expira em até 8 horas de inatividade, e trocar a senha encerra as outras sessões.
`;

export function render({ root, mode }) {
  const isTerms = mode === "terms";
  paint(
    root,
    html`
      <article class="legal-page">
        <nav class="breadcrumb" aria-label="Trilha"><a href="#/">Início</a><span>›</span><span>${isTerms ? "Termos de uso" : "Privacidade"}</span></nav>
        <h1>${isTerms ? "Termos de uso" : "Política de privacidade"}</h1>
        <p class="muted small">Última atualização: ${UPDATED_AT}</p>
        <div class="markdown">${renderMarkdown(isTerms ? TERMS : PRIVACY)}</div>
        <p class="muted small">Veja também: ${isTerms ? html`<a href="#/privacidade">Política de privacidade</a>` : html`<a href="#/termos">Termos de uso</a>`}</p>
      </article>
    `
  );
}
