# Seguranca da Avaliacao de Submissoes

## Modelo de ameaca

O codigo enviado por um estudante e considerado nao confiavel. Ele pode tentar ler configuracoes da API, acessar arquivos, abrir conexoes, criar subprocessos, consumir memoria, produzir saida ilimitada ou permanecer em loop.

## Controles implementados

Cada caso de teste executa em um processo Node separado com estas restricoes:

- ambiente minimo sem credenciais do processo principal;
- namespace Linux separado para usuario e rede por meio de `unshare`;
- `--permission` habilitado;
- leitura permitida somente para o arquivo temporario da submissao;
- escrita em filesystem bloqueada;
- rede bloqueada;
- criacao de subprocessos bloqueada;
- heap limitado a 64 MB;
- stdout e stderr limitados a 64 KB;
- timeout de 1,5 segundo;
- encerramento forcado ao exceder limites;
- remocao do diretorio temporario em bloco `finally`.

Os testes automatizados demonstram isolamento de variaveis, bloqueio de `/etc/passwd`, bloqueio de subprocessos, timeout e limite de saida.

## Privacidade dos casos

O banco guarda o resultado completo para auditoria. A camada `submission.presenter.ts` controla o contrato externo:

- casos publicos exibem entrada, esperado, recebido e erro;
- casos privados nao saem individualmente da API;
- o retorno informa apenas que existem casos ocultos e se algum falhou;
- identificador, entrada, esperado, recebido e erro privados nao saem da API.

Essa decisao evita transformar a resposta da submissao em um oraculo. Se cada
caso privado retornasse individualmente `passed: true/false`, um usuario poderia
fazer muitas tentativas e inferir progressivamente o conjunto de testes ocultos.

## Feedback para o estudante

O retorno da submissao possui um objeto `feedback` com:

- mensagem de veredito, como resposta aceita, resposta incorreta, erro de execucao ou timeout;
- quantidade de casos publicos aprovados;
- indicacao de que existem casos ocultos;
- indicacao generica de falha nos casos ocultos, sem revelar entrada ou saida esperada.

Nos casos publicos, a interface mostra a entrada, a saida esperada, a saida
recebida e o erro de execucao quando existir. Assim o estudante consegue corrigir
o codigo sem receber o gabarito privado.

## Protecao contra tentativa de descoberta

Submissoes autenticadas possuem limite de 20 tentativas por cinco minutos. O
catalogo administrativo tambem exige pelo menos um caso publico e um caso
oculto em cada desafio. Os casos ocultos devem cobrir entradas diferentes dos
exemplos publicos; eles sao a protecao principal contra solucoes que apenas
imprimem a resposta do exemplo.

## Risco residual e evolucao

O processo restrito ainda e iniciado pelo host da API. Isso e adequado ao ambiente academico controlado do RFC, mas nao equivale a isolamento por container ou maquina virtual.

Antes de exposicao publica em escala, o avaliador deve migrar para o worker previsto na arquitetura, executando em container descartavel sem rede, com limites de CPU, memoria, processos e filesystem impostos pelo sistema operacional. A fila Redis prevista pode desacoplar recebimento e avaliacao e limitar concorrencia global.
