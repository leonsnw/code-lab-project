import type { Submission, SubmissionStatus, SubmissionTestResult } from "../../domain/types.js";

type PublicTestResult = SubmissionTestResult;

export interface SubmissionFeedback {
  message: string;
  publicTestsPassed: number;
  publicTestsTotal: number;
  hiddenTestsPresent: boolean;
  hiddenTestsFailed: boolean;
}

export interface PresentedSubmission
  extends Omit<Submission, "testResults"> {
  testResults: PublicTestResult[];
  feedback: SubmissionFeedback;
}

export function presentSubmission(
  submission: Submission
): PresentedSubmission {
  const publicResults = submission.testResults.filter(
    (result) => result.isPublic
  );
  const hiddenResults = submission.testResults.filter(
    (result) => !result.isPublic
  );

  return {
    ...submission,
    testResults: publicResults,
    feedback: buildFeedback(submission.status, publicResults, hiddenResults)
  };
}

function buildFeedback(
  status: SubmissionStatus,
  publicResults: SubmissionTestResult[],
  hiddenResults: SubmissionTestResult[]
): SubmissionFeedback {
  const publicFailures = publicResults.filter((result) => !result.passed);
  const hiddenTestsFailed = hiddenResults.some((result) => !result.passed);

  let message: string;
  if (status === "accepted") {
    message = "Solucao aceita. Todos os casos de teste foram aprovados.";
  } else if (status === "wrong_answer") {
    message = publicFailures.length > 0
      ? "Resposta incorreta. Confira os casos publicos que falharam e compare a saida recebida com a esperada."
      : "Resposta incorreta. Um ou mais casos ocultos falharam; as entradas e saidas privadas nao sao exibidas.";
  } else if (status === "timeout") {
    message = "Tempo limite excedido. Verifique loops infinitos e a complexidade da solucao.";
  } else if (status === "runtime_error") {
    message = "Erro de execucao. Confira a mensagem dos casos publicos e revise o codigo antes de enviar novamente.";
  } else {
    message = "A submissao esta aguardando avaliacao.";
  }

  return {
    message,
    publicTestsPassed: publicResults.filter((result) => result.passed).length,
    publicTestsTotal: publicResults.length,
    hiddenTestsPresent: hiddenResults.length > 0,
    hiddenTestsFailed
  };
}
