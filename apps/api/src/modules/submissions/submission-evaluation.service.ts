import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type {
  SubmissionLanguage,
  SubmissionStatus,
  SubmissionTestResult,
  TestCase
} from "../../domain/types.js";

export interface EvaluationResult {
  status: Exclude<SubmissionStatus, "pending">;
  testResults: SubmissionTestResult[];
}

export interface SubmissionEvaluator {
  evaluate(input: {
    language: SubmissionLanguage;
    sourceCode: string;
    testCases: TestCase[];
  }): Promise<EvaluationResult>;
}

interface ProcessExecutionResult {
  status: "completed" | "runtime_error" | "timeout";
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface EvaluationLimits {
  timeoutMs: number;
  maxOutputBytes: number;
  memoryLimitMb: number;
}

const DEFAULT_LIMITS: EvaluationLimits = {
  timeoutMs: 1500,
  maxOutputBytes: 64 * 1024,
  memoryLimitMb: 64
};

export class SubmissionEvaluationService implements SubmissionEvaluator {
  private readonly limits: EvaluationLimits;

  constructor(options: number | Partial<EvaluationLimits> = {}) {
    this.limits = {
      ...DEFAULT_LIMITS,
      ...(typeof options === "number" ? { timeoutMs: options } : options)
    };
  }

  async evaluate(input: {
    language: SubmissionLanguage;
    sourceCode: string;
    testCases: TestCase[];
  }): Promise<EvaluationResult> {
    if (input.language !== "javascript") {
      throw new Error("Apenas JavaScript esta disponivel nesta versao.");
    }

    const testResults: SubmissionTestResult[] = [];

    for (const testCase of input.testCases) {
      const execution = await this.runJavaScript(
        input.sourceCode,
        testCase.input
      );

      const actualOutput = normalizeOutput(execution.stdout);
      const expectedOutput = normalizeOutput(testCase.expectedOutput);
      const passed =
        execution.status === "completed" && actualOutput === expectedOutput;

      testResults.push({
        testCaseId: testCase.id,
        executionStatus: execution.status,
        isPublic: testCase.isPublic,
        passed,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: execution.stdout,
        error: execution.stderr || undefined,
        durationMs: execution.durationMs
      });
    }

    const status = resolveStatus(testResults);
    return { status, testResults };
  }

  private async runJavaScript(
    sourceCode: string,
    stdin: string
  ): Promise<ProcessExecutionResult> {
    const dir = await mkdtemp(join(tmpdir(), "codelab-"));
    const filePath = join(dir, `${randomUUID()}.cjs`);
    await writeFile(filePath, sourceCode, "utf8");

    const startedAt = Date.now();

    try {
      return await new Promise<ProcessExecutionResult>((resolve) => {
        const child = spawn(
          "unshare",
          [
            "--user",
            "--map-root-user",
            "--net",
            process.execPath,
            "--permission",
            `--allow-fs-read=${filePath}`,
            `--max-old-space-size=${this.limits.memoryLimitMb}`,
            "--disable-warning=ExperimentalWarning",
            filePath
          ],
          {
            stdio: ["pipe", "pipe", "pipe"],
            cwd: dir,
            detached: true,
            env: {
              NODE_NO_WARNINGS: "1"
            }
          }
        );

        let stdout = "";
        let stderr = "";
        let finished = false;
        let outputBytes = 0;

        const finish = (result: ProcessExecutionResult, kill = false) => {
          if (finished) {
            return;
          }
          finished = true;
          clearTimeout(timeout);
          if (kill) {
            killProcessGroup(child.pid);
          }
          resolve(result);
        };

        const appendOutput = (current: string, chunk: Buffer): string => {
          const remaining = this.limits.maxOutputBytes - outputBytes;
          const accepted = chunk.subarray(0, Math.max(0, remaining));
          outputBytes += accepted.length;
          return current + accepted.toString("utf8");
        };

        const stopForOutputLimit = () => {
          finish(
            {
              status: "runtime_error",
              stdout,
              stderr: "Limite de saida excedido.",
              durationMs: Date.now() - startedAt
            },
            true
          );
        };

        const timeout = setTimeout(() => {
          finish(
            {
              status: "timeout",
              stdout,
              stderr: stderr || "Tempo limite excedido.",
              durationMs: Date.now() - startedAt
            },
            true
          );
        }, this.limits.timeoutMs);

        child.stdout.on("data", (chunk: Buffer) => {
          if (finished) {
            return;
          }
          const exceedsLimit = outputBytes + chunk.length > this.limits.maxOutputBytes;
          stdout = appendOutput(stdout, chunk);
          if (exceedsLimit) {
            stopForOutputLimit();
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          if (finished) {
            return;
          }
          const exceedsLimit = outputBytes + chunk.length > this.limits.maxOutputBytes;
          stderr = appendOutput(stderr, chunk);
          if (exceedsLimit) {
            stopForOutputLimit();
          }
        });

        child.on("close", (code) => {
          finish({
            status: code === 0 ? "completed" : "runtime_error",
            stdout,
            stderr,
            durationMs: Date.now() - startedAt
          });
        });

        child.on("error", (error) => {
          finish({
            status: "runtime_error",
            stdout,
            stderr: `Falha ao iniciar avaliacao: ${error.message}`,
            durationMs: Date.now() - startedAt
          });
        });

        child.stdin.on("error", () => undefined);
        child.stdin.end(stdin);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

function killProcessGroup(processId: number | undefined): void {
  if (!processId) {
    return;
  }

  try {
    process.kill(-processId, "SIGKILL");
  } catch {
    // The process may already have exited between the event and cleanup.
  }
}

function normalizeOutput(output: string): string {
  return output
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function resolveStatus(
  testResults: SubmissionTestResult[]
): Exclude<SubmissionStatus, "pending"> {
  if (testResults.some((result) => result.executionStatus === "timeout")) {
    return "timeout";
  }

  if (testResults.some((result) => result.executionStatus === "runtime_error")) {
    return "runtime_error";
  }

  return testResults.every((result) => result.passed)
    ? "accepted"
    : "wrong_answer";
}
