import type {
  ExecutionStatus,
  Submission,
  SubmissionStatus,
  SubmissionTestResult
} from "../../domain/types.js";

export interface FailedTestDetail {
  position: number;
  isPublic: boolean;
  executionStatus: ExecutionStatus;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr: string | null;
  error: string | null;
  durationMs: number;
}

export interface SubmissionJudgeResult {
  passedTests: number;
  totalTests: number;
  runtimeMs: number | null;
  failedTest: FailedTestDetail | null;
  compileError: string | null;
  ruleViolations: string[];
  /** Avisos do gcc que ajudam a explicar erros de lógica (ex.: -Wsequence-point). */
  compileWarnings: string | null;
}

export interface SubmissionFeedback {
  title: string;
  message: string;
}

export interface PresentedSubmission
  extends Omit<Submission, "testResults" | "errorMessage" | "compileWarnings"> {
  result: SubmissionJudgeResult;
  feedback: SubmissionFeedback;
}

/**
 * Public contract of a submission, modelled on LeetCode: the verdict, how
 * many cases passed and the full detail of the first failing case, public or
 * hidden. Hidden cases that passed, and every case after the failure (never
 * executed), stay private.
 */
export function presentSubmission(
  submission: Submission
): PresentedSubmission {
  const { testResults, errorMessage, compileWarnings, ...rest } = submission;
  const failure = findFirstFailure(testResults);
  const compileError =
    submission.status === "compile_error" ? errorMessage : null;

  const result: SubmissionJudgeResult = {
    passedTests: submission.passedTests,
    totalTests: submission.totalTests,
    runtimeMs:
      submission.status === "accepted" && testResults.length > 0
        ? Math.max(...testResults.map((test) => test.durationMs))
        : null,
    failedTest: failure ? presentFailure(failure) : null,
    compileError,
    ruleViolations:
      submission.status === "rule_violation" && errorMessage
        ? errorMessage.split("\n").filter(Boolean)
        : [],
    compileWarnings: compileWarnings ?? null
  };

  return {
    ...rest,
    result,
    feedback: buildFeedback(submission.status, result, errorMessage)
  };
}

function findFirstFailure(
  testResults: SubmissionTestResult[]
): SubmissionTestResult | undefined {
  return [...testResults]
    .sort((a, b) => a.position - b.position)
    .find((test) => !test.passed);
}

function presentFailure(test: SubmissionTestResult): FailedTestDetail {
  return {
    position: test.position,
    isPublic: test.isPublic,
    executionStatus: test.executionStatus,
    input: test.input,
    expectedOutput: test.expectedOutput,
    actualOutput: test.actualOutput,
    stderr: test.stderr ?? null,
    error: test.error ?? null,
    durationMs: test.durationMs
  };
}

function buildFeedback(
  status: SubmissionStatus,
  result: SubmissionJudgeResult,
  errorMessage: string | null
): SubmissionFeedback {
  const position = result.failedTest?.position;
  const caseLabel = position
    ? `caso ${position} de ${result.totalTests}${result.failedTest?.isPublic ? "" : " (oculto)"}`
    : "";

  switch (status) {
    case "accepted":
      return {
        title: "Aceito",
        message: `Todos os ${result.totalTests} casos de teste foram aprovados.`
      };
    case "wrong_answer":
      return {
        title: "Resposta errada",
        message: `A saída do seu programa difere da esperada no ${caseLabel}. ${result.passedTests}/${result.totalTests} casos aprovados antes da falha.`
      };
    case "runtime_error":
      return {
        title: "Erro de execução",
        message: `O programa encerrou com erro no ${caseLabel}. Confira a mensagem e a linha indicadas abaixo.`
      };
    case "timeout":
      return {
        title: "Tempo limite excedido",
        message: `O programa não terminou a tempo no ${caseLabel}. Verifique loops infinitos, leitura da entrada e a complexidade da solução.`
      };
    case "compile_error":
      return {
        title: "Erro de compilação",
        message: "O código não pôde ser compilado/interpretado, então nenhum caso de teste foi executado. Corrija a linha indicada abaixo."
      };
    case "rule_violation":
      return {
        title: "Regra do desafio não atendida",
        message: "O código compila, mas não segue o que o enunciado exige. Nenhum caso de teste foi executado."
      };
    case "internal_error":
      return {
        title: "Falha na avaliação",
        message: errorMessage ?? "O ambiente de avaliação falhou antes de julgar o código."
      };
    default:
      return {
        title: "Aguardando avaliação",
        message: "A submissão está aguardando avaliação."
      };
  }
}
