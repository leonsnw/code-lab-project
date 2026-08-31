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
- casos privados exibem apenas status, aprovacao e duracao;
- identificador, entrada, esperado, recebido e erro privados nao saem da API.

## Risco residual e evolucao

O processo restrito ainda e iniciado pelo host da API. Isso e adequado ao ambiente academico controlado do RFC, mas nao equivale a isolamento por container ou maquina virtual.

Antes de exposicao publica em escala, o avaliador deve migrar para o worker previsto na arquitetura, executando em container descartavel sem rede, com limites de CPU, memoria, processos e filesystem impostos pelo sistema operacional. A fila Redis prevista pode desacoplar recebimento e avaliacao e limitar concorrencia global.
