# Segurança da avaliação e da plataforma

## Modelo de ameaça

Todo código enviado por estudantes é hostil até prova em contrário. Ele pode tentar:

- ler configurações da API (`.env`, `DATABASE_URL`, `JWT_SECRET`) ou arquivos do servidor;
- abrir conexões (inclusive com o PostgreSQL local) ou criar processos;
- esgotar CPU, memória, disco ou descritores, ou produzir saída sem fim;
- escapar do isolamento por syscalls do kernel (namespaces, `ptrace`, `bpf`, `io_uring`);
- descobrir os casos ocultos para "decorar" respostas;
- satisfazer as regras do desafio com atalhos (ordenação pronta, recursão de fachada).

Contas também são alvo: enumeração de e-mails, força bruta de senha, sequestro de sessão e injeção em telas de outros usuários (comentários, nomes).

## Isolamento por linguagem

Cada caso de teste roda num processo novo, com ambiente limpo (sem nenhuma variável da API) e diretório temporário próprio, apagado ao final.

### JavaScript

- namespace de usuário e de rede separados (`unshare`);
- `node --permission`: leitura só do arquivo da solução, sem escrita, sem processos filhos e sem workers;
- heap do V8 limitado (64 MB por padrão).

### C e Python (bubblewrap)

- **Compilação isolada.** O `gcc` roda dentro do `bwrap` e só enxerga `/usr` (somente leitura) e a pasta da submissão. `#include "/caminho/do/host"` não lê arquivos do servidor.
- **Flags:** `-std=gnu11 -O2 -Wall -Wextra -fsanitize=undefined -fno-sanitize-recover=all -fstack-protector-strong -D_FORTIFY_SOURCE=2`. O UBSan aponta índice fora do vetor, overflow com sinal, divisão por zero e ponteiro nulo, com linha.
- **Namespaces:** `--unshare-all` (sem rede, sem ver outros processos), `/usr` só leitura, `/tmp` em tmpfs, sem capabilities e com `--die-with-parent`.
- **Seccomp (BPF próprio, entregue ao bwrap pelo fd 3).** Nega com `EPERM` as syscalls que um exercício nunca precisa:
  - `ptrace` e `process_vm_readv/writev`;
  - `unshare` e `setns` (impedem aninhar namespaces);
  - `mount` e a nova API de montagem (`fsopen`, `open_tree`…);
  - `bpf`, `perf_event_open`, `userfaultfd`, `io_uring_*`, `keyctl`, `kexec_*`, módulos do kernel e `personality`.
  - Chamadas x32 são recusadas.
- **Limites (`prlimit`):** memória de 256 MB por padrão (configurável por desafio), pilha de 64 MB, `nproc=1` (sem `fork`), 16 descritores, `fsize=0` (sem gravar arquivos) e limite de CPU, além do timeout de parede.
- **Python:** o harness roda `solucao.py` num namespace de módulo próprio. O traceback é limpo para apontar `solucao.py`, e o tempo é o dobro do de C/JS, como no LeetCode.

### Limites comuns

- **Tempo:** 1,5 s por caso por padrão (configurável por desafio), contado depois da criação do processo.
- **Saída:** stdout e stderr com 64 KB cada, em orçamentos separados.
- **Concorrência:** uma fila global (`JUDGE_CONCURRENCY`) limita as avaliações simultâneas no servidor inteiro.
- **Argumentos gerados** (`{"$gen": …}`): expandidos pelo servidor com no máximo 1 milhão de elementos por caso. Uma especificação abusiva enviada em "Executar" vira erro, não trava a API.

Testes que comprovam os bloqueios:
- **`c-evaluation.test.ts`:** leitura de `/etc/passwd` e do projeto, `fork`, conexão ao PostgreSQL e `#include` do host.
- **`sandbox.test.ts`:** o filtro seccomp e a medição de recursão.
- **`submission-evaluation.service.test.ts`:** isolamento do JavaScript.

## Modo função

No modo função o aluno envia só a função. O harness gerado pelo juiz lê os argumentos em JSON, constrói `ListNode`/`TreeNode` e chama a função. O retorno vem impresso depois de um marcador (`\u0001CODELAB_RESULT\u0001`), separado de qualquer `print` de depuração. O próprio harness recusa:

- listas ou árvores retornadas com ciclo (erro claro, sem saída infinita);
- `main` escrito pelo aluno em C.

## Regras sobre o código-fonte

As regras são verificadas antes dos testes (`source-rules.ts`), com comentários e literais de texto removidos:

- **Por linguagem:** em Python, `#` é comentário, `//` é divisão inteira e docstrings com aspas triplas são ignoradas.
- **`recursion`:** exige uma função que chame a si mesma. Reconhece `def` em Python e funções, arrow functions e function expressions em JavaScript.
- **Recursão em C:** a profundidade real também é medida na execução, com `-finstrument-functions` e um relatório no fd 4. Recursão "de fachada" (uma chamada só) é recusada. O código não pode usar `__attribute__`, `_exit` nem `__cyg_profile`, que desligariam a medição.
- **`forbid` / `require`:** expressões regulares, por exemplo sem `qsort`/`sort`, sem laços, `malloc` obrigatório ou `struct` autorreferente.

Uma violação gera `rule_violation`, sem executar casos. O estudante vê as mensagens; os padrões ficam no servidor.

## Veredito e privacidade dos casos

1. **Sintaxe primeiro:** compilação em C, `vm.Script` em JavaScript, `compile()` em Python. Um erro gera `compile_error`, com linha.
2. **Ordem fixa:** casos públicos primeiro, depois os ocultos.
3. **Parada no primeiro caso que falha**, como no LeetCode. Isso elimina o oráculo de "sondar por timeout" os casos seguintes.
4. **Só o caso que falhou é mostrado** (entrada, esperado, obtido e depuração). Casos ocultos aprovados e casos não executados nunca saem da API.

Cada envio revela no máximo um caso oculto. Decorar a suíte sai caro por quatro motivos:

- **Suítes grandes:** no mínimo 2 públicos e 12 ocultos por desafio (3.403 casos no total), com bordas e valores gerados deterministicamente.
- **Casos enormes:** entradas de até 200 mil elementos, impossíveis de decorar e que derrubam a solução ingênua por tempo.
- **Burlas testadas:** cada desafio tem, em `desafios/<slug>/`, pelo menos uma tentativa de burla que precisa ser reprovada. As de resposta errada passam nos exemplos públicos, então a suíte oculta é que as pega.
- **Limites de envio:** 20 submissões e 60 execuções a cada 5 minutos por usuário.

## Ferramentas do professor

- **Gerador de casos:** o JavaScript do professor roda em `node:vm` com timeout de 1 s, sem `require` e sem acesso ao processo. `node:vm` **não** é fronteira de segurança contra código hostil. A rota existe só para administradores, que já têm poder total sobre o catálogo. As saídas esperadas vêm da solução de referência, executada no juiz isolado.
- **Verificadores personalizados** (`checker.kind = "custom"`): mesma premissa (`node:vm`, 250 ms, só administradores).
- **Rotas de administração:** exigem sessão de administrador antes de aceitar corpos grandes (até 4 MB).

## Contas e sessões

- **Senhas:** bcrypt com custo 10. O login responde igual para e-mail inexistente e senha errada, e compara com um hash fictício para igualar o tempo. Há limite de 20 tentativas a cada 15 minutos.
- **Sessão:** JWT em cookie `HttpOnly`, `SameSite=Strict` e `Secure` em produção, com validade de 8 h. É renovada quando passa da metade da validade e o usuário continua ativo.
- **Troca de senha:** o JWT carrega uma impressão do hash da senha (`pwv`). Trocar ou redefinir a senha invalida todas as sessões abertas; a sessão atual recebe um cookie novo.
- **Links por e-mail:**
  - O token tem 32 bytes aleatórios e só o SHA-256 dele fica no banco. É de uso único e expira em 1 h (redefinição de senha) ou 48 h (verificação). Um pedido novo anula os anteriores.
  - "Esqueci minha senha" responde igual exista ou não a conta.
  - Há limite de 5 pedidos a cada 15 minutos.
- **LGPD:** exportação de todos os dados em JSON e exclusão da conta com confirmação de senha, em cascata no banco.

## HTTP e frontend

- **Cabeçalhos:**
  - `Content-Security-Policy`:
    - scripts só do próprio domínio, sem scripts inline;
    - `connect-src 'self'` e `frame-ancestors 'none'`.
  - `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` e `Cross-Origin-Opener-Policy`.
  - HSTS em produção.
- **CORS:** só para as origens de `WEB_ORIGIN`.
- **Escape de HTML:** todo HTML do frontend passa pelo template `html`, que escapa cada interpolação.
- **Markdown seguro:** o renderizador escapa todo o texto, não aceita HTML e só permite links `http(s)` e rotas internas. Isso vale para os comentários dos estudantes.
- **CSV das turmas:** células que começam com `=`, `+`, `-`, `@` recebem um apóstrofo, para não virar fórmula no Excel.

## Riscos residuais e próximos passos

- **O juiz roda no mesmo host (ou contêiner) da API.** O isolamento é o do kernel (namespaces, seccomp, rlimits), adequado ao ambiente acadêmico do RFC. Para exposição pública em escala, o recomendado é:
  - mover a avaliação para um worker dedicado, com usuário do sistema próprio e sem acesso ao banco;
  - ligar o worker à API por uma fila;
  - rodar o worker sob gVisor ou numa microVM (Firecracker), com cgroups limitando CPU e memória.
- **No contêiner de produção, o seccomp do Docker fica desligado e o `/proc` fica sem máscara** (`seccomp=unconfined`, `systempaths=unconfined`), porque o bwrap precisa criar user namespaces e montar um `/proc` próprio. O código dos estudantes continua sob o filtro próprio do juiz. O contêiner da API roda:
  - sem capabilities e com `no-new-privileges`;
  - com sistema de arquivos só leitura e `pids_limit`.
- **O limite de memória do JavaScript é o heap do V8,** não o espaço de endereçamento, então buffers nativos podem ultrapassá-lo um pouco. O teto do contêiner cobre esse caso.
- **Tempos medidos incluem a inicialização do ambiente.** A comparação de tempo entre soluções é indicativa, não um benchmark.
