import type { Submission, SubmissionTestResult } from "../../domain/types.js";

type PublicTestResult = SubmissionTestResult;

interface PrivateTestResult {
  executionStatus: SubmissionTestResult["executionStatus"];
  isPublic: false;
  passed: boolean;
  durationMs: number;
}

export type PresentedTestResult = PublicTestResult | PrivateTestResult;

export interface PresentedSubmission
  extends Omit<Submission, "testResults"> {
  testResults: PresentedTestResult[];
}

export function presentSubmission(
  submission: Submission
): PresentedSubmission {
  return {
    ...submission,
    testResults: submission.testResults.map((result) => {
      if (result.isPublic) {
        return result;
      }

      return {
        executionStatus: result.executionStatus,
        isPublic: false,
        passed: result.passed,
        durationMs: result.durationMs
      };
    })
  };
}
