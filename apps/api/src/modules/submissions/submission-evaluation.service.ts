import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Script } from "node:vm";
import type {
  ChallengeMode,
  ExecutionStatus,
  FunctionSpec,
  OutputChecker,
  SourceRule,
  SubmissionLanguage,
  SubmissionStatus,
  SubmissionTestResult,
  TestCase
} from "../../domain/types.js";
import { checkOutput } from "./checker.js";
import { expandGeneratedArgs, GeneratedInputError } from "./generated-input.js";
import { cHarness, javascriptHarness, pythonHarness, splitFunctionOutput } from "./harness.js";
import {
  BWRAP_BASE,
  bwrap,
  buildSeccompProgram,
  judgeQueue,
  SandboxUnavailableError,
  SIGNALS,
  spawnProcess
} from "./sandbox.js";
import { checkSourceRules } from "./source-rules.js";

export { SandboxUnavailableError } from "./sandbox.js";
export { normalizeOutput } from "./checker.js";

export type EvaluationStatus = Exclude<SubmissionStatus, "pending" | "internal_error">;

export interface EvaluationResult {
  status: EvaluationStatus;
  testResults: SubmissionTestResult[];
  totalTests: number;
  passedTests: number;
  errorMessage: string | null;
  compileWarnings: string | null;
}

export interface RunCase {
  label: string;
  input: string;
  expectedOutput?: string;
}

export interface RunCaseResult {
  label: string;
  input: string;
  expectedOutput: string | null;
  actualOutput: string;
  stderr: string;
  error: string | null;
  executionStatus: ExecutionStatus;
  passed: boolean | null;
  durationMs: number;
}

export interface RunResult {
  compileError: string | null;
  compileWarnings: string | null;
  ruleViolations: string[];
  cases: RunCaseResult[];
}

interface JudgeOptions {
  language: SubmissionLanguage;
  sourceCode: string;
  sourceRules?: SourceRule[];
  mode?: ChallengeMode;
  functionSpec?: FunctionSpec | null;
  checker?: OutputChecker;
  timeLimitMs?: number | null;
  memoryLimitMb?: number | null;
}

export interface EvaluationInput extends JudgeOptions {
  testCases: TestCase[];
}

export interface RunInput extends JudgeOptions {
  cases: RunCase[];
}

export interface SubmissionEvaluator {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
  run(input: RunInput): Promise<RunResult>;
}

export interface EvaluationLimits {
  timeoutMs: number;
  maxOutputBytes: number;
  memoryLimitMb: number;
}

export const DEFAULT_EVALUATION_LIMITS: EvaluationLimits = {
  timeoutMs: 1500,
  maxOutputBytes: 64 * 1024,
  memoryLimitMb: 64
};

/** Memória padrão por linguagem (JavaScript: heap do V8; C e Python: espaço de endereçamento). */
export const DEFAULT_MEMORY_MB: Record<SubmissionLanguage, number> = {
  javascript: 64,
  c: 256,
  python: 256
};
export const C_MEMORY_LIMIT_MB = DEFAULT_MEMORY_MB.c;

/** Python é interpretado e mais lento: recebe o dobro do tempo, como no LeetCode. */
export const LANGUAGE_TIME_FACTOR: Record<SubmissionLanguage, number> = {
  javascript: 1,
  c: 1,
  python: 2
};

const COMPILE_TIMEOUT_MS = 20000;
const JS_FILE_LABEL = "solucao.js";
const STORED_TEXT_LIMIT = 4000;

const C_COMPILE_FLAGS = [
  "-std=gnu11",
  "-O2",
  "-pipe",
  "-fdiagnostics-color=never",
  "-Wall",
  "-Wextra",
  "-Wno-unused-parameter",
  "-Wno-unused-result",
  "-Wno-unused-variable",
  "-Wno-unused-but-set-variable",
  "-Wno-unused-function",
  "-Wno-sign-compare",
  "-fsanitize=undefined",
  "-fno-sanitize-recover=all",
  "-fstack-protector-strong",
  "-D_FORTIFY_SOURCE=2"
];

/** Avisos do gcc que costumam explicar uma resposta errada ou um crash. */
const RELEVANT_WARNINGS =
  /\[-W(sequence-point|uninitialized|maybe-uninitialized|format[\w=-]*|return-type|array-bounds[\w=-]*|implicit-function-declaration|int-conversion|incompatible-pointer-types|parentheses|div-by-zero|overflow|stringop-[\w-]+|dangling-pointer[\w=-]*|use-after-free[\w=-]*|return-local-addr|free-nonheap-object|misleading-indentation|shift-count-[\w-]+|int-in-bool-context|type-limits)\]/;

/**
 * Runtime ligado ao binário do aluno quando o desafio mede recursão: conta a
 * profundidade real de chamadas (gcc -finstrument-functions) e informa pelo
 * fd 4, que o código do aluno não usa. `__attribute__` e os nomes
 * `__cyg_profile_*` ficam proibidos nesses desafios para que o aluno não
 * substitua as funções.
 */
const C_DEPTH_RUNTIME = `#include <stdio.h>
static int codelab_depth, codelab_max_depth;
__attribute__((no_instrument_function)) void __cyg_profile_func_enter(void *fn, void *site) { (void)fn; (void)site; if (++codelab_depth > codelab_max_depth) codelab_max_depth = codelab_depth; }
__attribute__((no_instrument_function)) void __cyg_profile_func_exit(void *fn, void *site) { (void)fn; (void)site; codelab_depth--; }
__attribute__((no_instrument_function, destructor)) static void codelab_report(void) { dprintf(4, "depth=%d\\n", codelab_max_depth); }
`;

const DEPTH_GUARD_RULE: SourceRule = {
  kind: "forbid",
  pattern: "__attribute__|__cyg_profile|\\b_exit\\s*\\(|\\b_Exit\\s*\\(|\\bquick_exit\\s*\\(",
  message: "Neste desafio não use __attribute__, _exit nem funções __cyg_profile: o juiz mede a recursão durante a execução."
};

interface PreparedProgram {
  argv: string[];
  cwd: string;
  seccomp: boolean;
  describeFailure(exitCode: number | null, stderr: string): string;
  cleanStderr(stderr: string): string;
}

type Preparation =
  | { kind: "ready"; program: PreparedProgram; warnings: string | null }
  | { kind: "compile_error"; message: string };

interface ExecutionResult {
  status: ExecutionStatus;
  actual: string;
  debug: string;
  error: string | null;
  durationMs: number;
  depth: number | null;
  checkMessage?: string;
}

export class SubmissionEvaluationService implements SubmissionEvaluator {
  readonly limits: EvaluationLimits;

  constructor(options: number | Partial<EvaluationLimits> = {}) {
    this.limits = {
      ...DEFAULT_EVALUATION_LIMITS,
      ...(typeof options === "number" ? { timeoutMs: options } : options)
    };
  }

  evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    return judgeQueue.run(() => this.evaluateNow(input));
  }

  run(input: RunInput): Promise<RunResult> {
    return judgeQueue.run(() => this.runNow(input));
  }

  private async evaluateNow(input: EvaluationInput): Promise<EvaluationResult> {
    assertSupportedLanguage(input.language);
    const orderedCases = orderTestCases(input.testCases);
    const totalTests = orderedCases.length;
    const rules = this.effectiveRules(input);
    const depthRule = this.depthRule(input);
    const failure = (status: EvaluationStatus, errorMessage: string, compileWarnings: string | null = null): EvaluationResult => ({
      status,
      testResults: [],
      totalTests,
      passedTests: 0,
      errorMessage,
      compileWarnings
    });

    // A proteção do medidor de recursão vem antes da compilação: substituir as
    // funções do runtime quebraria o link com uma mensagem pouco clara.
    if (depthRule) {
      const guard = checkSourceRules(input.sourceCode, [DEPTH_GUARD_RULE], input.language);
      if (guard.length > 0) return failure("rule_violation", guard.join("\n"));
    }

    const testResults: SubmissionTestResult[] = [];
    let maxDepth = 0;
    const outcome = await this.withWorkspace(input, Boolean(depthRule), async (program, warnings) => {
      const violations = checkSourceRules(input.sourceCode, rules, input.language);
      if (violations.length > 0) {
        return failure("rule_violation", violations.join("\n"), warnings);
      }

      for (const [index, testCase] of orderedCases.entries()) {
        const execution = await this.execute(program, input, testCase.input, testCase.expectedOutput);
        maxDepth = Math.max(maxDepth, execution.depth ?? 0);
        const passed = execution.status === "completed" && execution.checkMessage === undefined
          ? true
          : false;

        testResults.push({
          testCaseId: testCase.id,
          position: index + 1,
          executionStatus: execution.status,
          isPublic: testCase.isPublic,
          passed,
          input: truncateForStorage(testCase.input),
          expectedOutput: truncateForStorage(testCase.expectedOutput),
          actualOutput: truncateForStorage(execution.actual),
          stderr: execution.debug ? truncateForStorage(execution.debug) : undefined,
          error: execution.error ?? execution.checkMessage ?? undefined,
          durationMs: execution.durationMs
        });

        // Like LeetCode, the judge stops at the first failing case. The
        // remaining cases are never executed, so a submission cannot probe
        // the hidden suite through timeouts or crashes on later inputs.
        if (!passed) break;
      }
      return warnings;
    });

    if (outcome.kind === "compile_error") {
      return failure("compile_error", outcome.message);
    }
    if (typeof outcome.value === "object" && outcome.value !== null) {
      return outcome.value;
    }
    const compileWarnings = outcome.value;

    const passedTests = testResults.filter((result) => result.passed).length;
    const status = resolveStatus(testResults, totalTests);

    // Regra dinâmica: a recursão precisa acontecer de verdade durante os testes.
    if (status === "accepted" && depthRule?.minDepth && maxDepth < depthRule.minDepth) {
      return {
        status: "rule_violation",
        testResults: [],
        totalTests,
        passedTests: 0,
        errorMessage: `${depthRule.message}\nA recursão precisa acontecer de fato: a maior profundidade de chamadas medida nos testes foi ${maxDepth}, e este desafio espera pelo menos ${depthRule.minDepth}.`,
        compileWarnings
      };
    }

    return { status, testResults, totalTests, passedTests, errorMessage: null, compileWarnings };
  }

  private async runNow(input: RunInput): Promise<RunResult> {
    assertSupportedLanguage(input.language);
    const ruleViolations = checkSourceRules(input.sourceCode, this.effectiveRules(input), input.language);
    const cases: RunCaseResult[] = [];

    const outcome = await this.withWorkspace(input, Boolean(this.depthRule(input)), async (program, warnings) => {
      for (const runCase of input.cases) {
        const hasExpected = runCase.expectedOutput !== undefined;
        const execution = await this.execute(program, input, runCase.input, runCase.expectedOutput);
        cases.push({
          label: runCase.label,
          input: runCase.input,
          expectedOutput: runCase.expectedOutput ?? null,
          actualOutput: execution.actual,
          stderr: execution.debug,
          error: execution.error ?? (hasExpected ? execution.checkMessage ?? null : null),
          executionStatus: execution.status,
          passed: hasExpected ? execution.status === "completed" && execution.checkMessage === undefined : null,
          durationMs: execution.durationMs
        });
      }
      return warnings;
    });

    if (outcome.kind === "compile_error") {
      return { compileError: outcome.message, compileWarnings: null, ruleViolations, cases: [] };
    }
    return { compileError: null, compileWarnings: outcome.value, ruleViolations, cases };
  }

  private depthRule(input: JudgeOptions): Extract<SourceRule, { kind: "recursion" }> | undefined {
    if (input.language !== "c") return undefined;
    return (input.sourceRules ?? []).find(
      (rule): rule is Extract<SourceRule, { kind: "recursion" }> => rule.kind === "recursion" && Boolean(rule.minDepth)
    );
  }

  private effectiveRules(input: JudgeOptions): SourceRule[] {
    const rules = input.sourceRules ?? [];
    return this.depthRule(input) ? [...rules, DEPTH_GUARD_RULE] : rules;
  }

  private timeoutFor(input: JudgeOptions): number {
    return (input.timeLimitMs ?? this.limits.timeoutMs) * LANGUAGE_TIME_FACTOR[input.language];
  }

  private memoryFor(input: JudgeOptions): number {
    if (input.memoryLimitMb) return input.memoryLimitMb;
    return input.language === "javascript" ? this.limits.memoryLimitMb : DEFAULT_MEMORY_MB[input.language];
  }

  private async withWorkspace<T>(
    input: JudgeOptions,
    measureDepth: boolean,
    task: (program: PreparedProgram, warnings: string | null) => Promise<T>
  ): Promise<{ kind: "done"; value: T } | { kind: "compile_error"; message: string }> {
    const mode = input.mode ?? "stdio";
    if (mode === "function" && !input.functionSpec) {
      throw new Error("Desafio no modo função sem assinatura definida.");
    }
    // Syntax errors in JavaScript are found without creating any process.
    if (input.language === "javascript") {
      const syntaxError = checkJavaScriptSyntax(input.sourceCode);
      if (syntaxError) return { kind: "compile_error", message: syntaxError };
    }

    const dir = await mkdtemp(join(tmpdir(), "codelab-"));
    try {
      const preparation =
        input.language === "c"
          ? await this.prepareC(dir, input, measureDepth)
          : input.language === "python"
            ? await this.preparePython(dir, input)
            : await this.prepareJavaScript(dir, input);
      if (preparation.kind === "compile_error") {
        return { kind: "compile_error", message: preparation.message };
      }
      return { kind: "done", value: await task(preparation.program, preparation.warnings) };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  // ---------- JavaScript ----------
  private async prepareJavaScript(dir: string, input: JudgeOptions): Promise<Preparation> {
    const filePath = join(dir, `${randomUUID()}.cjs`);
    const harness = input.mode === "function" && input.functionSpec ? javascriptHarness(input.functionSpec) : "";
    await writeFile(filePath, `${input.sourceCode}\n${harness}`, "utf8");
    const memoryLimitMb = this.memoryFor(input);
    return {
      kind: "ready",
      warnings: null,
      program: {
        cwd: dir,
        seccomp: false,
        argv: [
          "unshare",
          "--user",
          "--map-root-user",
          "--net",
          process.execPath,
          "--permission",
          `--allow-fs-read=${filePath}`,
          `--max-old-space-size=${memoryLimitMb}`,
          "--disable-warning=ExperimentalWarning",
          "--stack-trace-limit=10",
          filePath
        ],
        cleanStderr: (stderr) => cleanJavaScriptStderr(stderr, filePath),
        describeFailure: (_exitCode, stderr) => describeJavaScriptError(stderr, memoryLimitMb)
      }
    };
  }

  // ---------- C ----------
  /**
   * Compila dentro do bubblewrap e com limites próprios: o compilador só
   * enxerga /usr e a pasta da submissão, então `#include "/caminho/do/host"`
   * não vaza nada, e um código feito para esgotar o gcc é interrompido.
   */
  private async prepareC(dir: string, input: JudgeOptions, measureDepth: boolean): Promise<Preparation> {
    const functionMode = input.mode === "function" && input.functionSpec;
    if (functionMode && /\bmain\s*\(/.test(input.sourceCode)) {
      return {
        kind: "compile_error",
        message: `Neste desafio você implementa apenas a função ${input.functionSpec!.name}; o juiz já fornece o main. Remova a função main do seu código.`
      };
    }
    await writeFile(join(dir, "solucao.c"), input.sourceCode, "utf8");
    const sources = [functionMode ? "harness.c" : "solucao.c"];
    if (functionMode) await writeFile(join(dir, "harness.c"), cHarness(input.functionSpec!), "utf8");
    if (measureDepth) {
      await writeFile(join(dir, "codelab_runtime.c"), C_DEPTH_RUNTIME, "utf8");
      sources.push("codelab_runtime.c");
    }

    const seccomp = Boolean(buildSeccompProgram());
    const compilation = await spawnProcess(
      bwrap(
        ["--bind", dir, "/box", "--chdir", "/box"],
        [
          "/usr/bin/prlimit",
          "--as=2147483648",
          "--cpu=20",
          `--fsize=${64 * 1024 * 1024}`,
          "--",
          "gcc",
          ...C_COMPILE_FLAGS,
          ...(measureDepth ? ["-finstrument-functions", "-fno-optimize-sibling-calls"] : []),
          "-o",
          "prog",
          ...sources,
          "-lm"
        ],
        seccomp
      ),
      { cwd: dir, stdin: "", timeoutMs: COMPILE_TIMEOUT_MS, maxOutputBytes: this.limits.maxOutputBytes, seccompProgram: buildSeccompProgram() }
    );

    if (compilation.outcome === "timeout") {
      return { kind: "compile_error", message: "A compilação excedeu o tempo limite." };
    }
    if (compilation.exitCode !== 0) {
      return { kind: "compile_error", message: formatCompilerOutput(compilation.stderr) || "Falha na compilação." };
    }

    const memoryLimitMb = this.memoryFor(input);
    const cpuSeconds = Math.ceil(this.timeoutFor(input) / 1000) + 1;
    return {
      kind: "ready",
      warnings: relevantWarnings(compilation.stderr),
      program: {
        cwd: dir,
        seccomp,
        argv: bwrap(
          [
            "--ro-bind",
            join(dir, "prog"),
            "/box/prog",
            "--chdir",
            "/box",
            "--setenv",
            "UBSAN_OPTIONS",
            "print_stacktrace=0:halt_on_error=1"
          ],
          [
            "/usr/bin/prlimit",
            `--as=${memoryLimitMb * 1024 * 1024}`,
            `--stack=${64 * 1024 * 1024}`,
            "--nproc=1",
            "--nofile=16",
            "--fsize=0",
            `--cpu=${cpuSeconds}`,
            "--",
            "/box/prog"
          ],
          seccomp
        ),
        cleanStderr: cleanCStderr,
        describeFailure: (exitCode, stderr) => describeCError(exitCode, stderr, memoryLimitMb)
      }
    };
  }

  // ---------- Python ----------
  private async preparePython(dir: string, input: JudgeOptions): Promise<Preparation> {
    await writeFile(join(dir, "solucao.py"), input.sourceCode, "utf8");
    const functionMode = input.mode === "function" && input.functionSpec;
    if (functionMode) await writeFile(join(dir, "harness.py"), pythonHarness(input.functionSpec!), "utf8");
    const seccomp = Boolean(buildSeccompProgram());
    const mounts = ["--ro-bind", join(dir, "solucao.py"), "/box/solucao.py", "--chdir", "/box"];
    if (functionMode) mounts.push("--ro-bind", join(dir, "harness.py"), "/box/harness.py");

    const syntax = await spawnProcess(
      bwrap(
        mounts,
        [
          "/usr/bin/python3",
          "-I",
          "-S",
          "-B",
          "-c",
          "import sys\ntry:\n    compile(open('/box/solucao.py', encoding='utf-8').read(), 'solucao.py', 'exec')\nexcept SyntaxError as e:\n    import traceback; sys.stderr.write(''.join(traceback.format_exception_only(type(e), e))); sys.exit(1)"
        ],
        seccomp
      ),
      { cwd: dir, stdin: "", timeoutMs: COMPILE_TIMEOUT_MS, maxOutputBytes: this.limits.maxOutputBytes, seccompProgram: buildSeccompProgram() }
    );
    if (syntax.exitCode !== 0) {
      return { kind: "compile_error", message: cleanPythonStderr(syntax.stderr) || "Erro de sintaxe." };
    }

    const memoryLimitMb = this.memoryFor(input);
    const cpuSeconds = Math.ceil(this.timeoutFor(input) / 1000) + 1;
    return {
      kind: "ready",
      warnings: null,
      program: {
        cwd: dir,
        seccomp,
        argv: bwrap(
          [...mounts, "--setenv", "PYTHONIOENCODING", "utf-8"],
          [
            "/usr/bin/prlimit",
            `--as=${memoryLimitMb * 1024 * 1024}`,
            `--stack=${64 * 1024 * 1024}`,
            "--nproc=1",
            "--nofile=16",
            "--fsize=0",
            `--cpu=${cpuSeconds}`,
            "--",
            "/usr/bin/python3",
            "-I",
            "-S",
            "-B",
            functionMode ? "/box/harness.py" : "/box/solucao.py"
          ],
          seccomp
        ),
        cleanStderr: cleanPythonStderr,
        describeFailure: (exitCode, stderr) => describePythonError(exitCode, stderr, memoryLimitMb)
      }
    };
  }

  private async execute(
    program: PreparedProgram,
    input: JudgeOptions,
    stdin: string,
    expected: string | undefined
  ): Promise<ExecutionResult> {
    const timeoutMs = this.timeoutFor(input);
    let programInput = stdin;
    if (input.mode === "function") {
      try {
        programInput = expandGeneratedArgs(stdin);
      } catch (error) {
        if (!(error instanceof GeneratedInputError)) throw error;
        return { debug: "", durationMs: 0, depth: null, status: "runtime_error", actual: "", error: error.message };
      }
    }
    const raw = await spawnProcess(program.argv, {
      cwd: program.cwd,
      stdin: programInput,
      timeoutMs,
      maxOutputBytes: this.limits.maxOutputBytes,
      seccompProgram: program.seccomp ? buildSeccompProgram() : undefined
    });
    const depthMatch = raw.report.match(/depth=(\d+)/);
    const depth = depthMatch ? Number(depthMatch[1]) : null;
    const stderr = program.cleanStderr(raw.stderr);
    const functionMode = input.mode === "function";
    const { debug: printed, result } = functionMode ? splitFunctionOutput(raw.stdout) : { debug: "", result: null };
    const debug = [printed, stderr].filter(Boolean).join("\n");
    const base = { debug, durationMs: raw.durationMs, depth };

    if (raw.outcome === "timeout" || raw.exitCode === 128 + SIGNALS.SIGXCPU) {
      return { ...base, status: "timeout", actual: functionMode ? "" : raw.stdout, error: `Tempo limite de ${timeoutMs} ms excedido.` };
    }
    if (raw.outcome === "output_limit") {
      return { ...base, status: "runtime_error", actual: raw.stdout, error: `Limite de saída excedido (${formatBytes(this.limits.maxOutputBytes)}).` };
    }
    if (raw.exitCode !== 0) {
      return { ...base, debug: functionMode ? printed : "", status: "runtime_error", actual: functionMode ? "" : raw.stdout, error: program.describeFailure(raw.exitCode, stderr) };
    }

    const actual = functionMode ? result ?? "" : raw.stdout;
    if (functionMode && result === null) {
      return { ...base, status: "runtime_error", actual: "", error: "A função não devolveu resultado: confira o nome e a assinatura pedidos no enunciado." };
    }
    if (expected === undefined) {
      return { ...base, status: "completed", actual, error: null };
    }
    const check = checkOutput({
      mode: input.mode ?? "stdio",
      checker: input.checker ?? { kind: "exact" },
      caseInput: programInput,
      expected,
      actual
    });
    return {
      ...base,
      status: "completed",
      actual,
      error: null,
      checkMessage: check.passed ? undefined : check.message ?? ""
    };
  }
}

/**
 * Verifies once, at startup, that each sandbox can be created so the operator
 * gets an explicit message instead of every submission failing.
 */
export async function checkSandboxAvailability(): Promise<{
  available: boolean;
  reason?: string;
  languages: Record<SubmissionLanguage, { available: boolean; reason?: string }>;
}> {
  const probe = (command: string, args: string[]) =>
    new Promise<{ available: boolean; reason?: string }>((resolve) => {
      const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"], env: {} });
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (error) => resolve({ available: false, reason: error.message }));
      child.on("close", (code) =>
        resolve(code === 0 ? { available: true } : { available: false, reason: stderr.trim() || `codigo ${code}` })
      );
    });

  const [javascript, c, python] = await Promise.all([
    probe("unshare", ["--user", "--map-root-user", "--net", process.execPath, "-e", ""]),
    probe("bwrap", [...BWRAP_BASE, "--", "gcc", "--version"]),
    probe("bwrap", [...BWRAP_BASE, "--", "/usr/bin/python3", "-I", "-S", "-c", "pass"])
  ]);
  const failures = [
    !javascript.available && `JavaScript (unshare): ${javascript.reason}`,
    !c.available && `C (bwrap + gcc): ${c.reason}`,
    !python.available && `Python (bwrap + python3): ${python.reason}`
  ].filter(Boolean);
  return {
    available: failures.length === 0,
    reason: failures.join("; ") || undefined,
    languages: { javascript, c, python }
  };
}

function assertSupportedLanguage(language: SubmissionLanguage): void {
  if (language !== "javascript" && language !== "c" && language !== "python") {
    throw new Error(`Linguagem não suportada: ${language}`);
  }
}

function orderTestCases(testCases: TestCase[]): TestCase[] {
  return [...testCases.filter((testCase) => testCase.isPublic), ...testCases.filter((testCase) => !testCase.isPublic)];
}

/**
 * Compiles, without running, the source with the same wrapper Node uses for
 * CommonJS modules. Syntax errors are reported before any test executes, with
 * the line and column of the student's file.
 */
function checkJavaScriptSyntax(sourceCode: string): string | null {
  try {
    new Script(`(function (exports, require, module, __filename, __dirname) {\n${sourceCode}\n})`, {
      filename: JS_FILE_LABEL,
      lineOffset: -1
    });
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === "SyntaxError") {
      const lines = (error.stack ?? `${error.name}: ${error.message}`).split("\n");
      const messageIndex = lines.findIndex((line) => line.startsWith("SyntaxError:"));
      return (messageIndex >= 0 ? lines.slice(0, messageIndex + 1) : lines).join("\n").trim();
    }
    throw error;
  }
}

/**
 * Turns Node's crash output into something a student can act on: the temp
 * path becomes `solucao.js`, and Node internals and the version banner go.
 */
function cleanJavaScriptStderr(stderr: string, filePath: string): string {
  return stderr
    .split(filePath)
    .join(JS_FILE_LABEL)
    .split("\n")
    .filter((line) => !/^\s+at .*\(?node:/.test(line) && !/^Node\.js v\d/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function describeJavaScriptError(stderr: string, memoryLimitMb: number): string {
  if (/heap out of memory|Reached heap limit/i.test(stderr)) {
    return `Limite de memória excedido (${memoryLimitMb} MB).`;
  }
  if (/Maximum call stack size exceeded/.test(stderr)) {
    return `Recursão profunda demais: a pilha de chamadas estourou (falta caso base ou a entrada exige uma solução iterativa).\n\n${stderr}`;
  }
  if (/ERR_ACCESS_DENIED/.test(stderr)) {
    return [stderr, "", "O ambiente de avaliação bloqueia acesso a arquivos, rede e processos. Leia a entrada apenas por stdin."].join("\n");
  }
  return stderr || "O programa terminou com código de saída diferente de zero.";
}

function cleanCStderr(stderr: string): string {
  return stderr.replaceAll("/box/", "").trim();
}

function formatCompilerOutput(stderr: string): string {
  return cleanCStderr(stderr)
    .split("\n")
    .filter((line) => !/^collect2: error: ld returned/.test(line))
    .join("\n")
    .slice(0, STORED_TEXT_LIMIT)
    .trim();
}

/** Só os avisos do arquivo do aluno que ajudam a explicar erros de lógica. */
function relevantWarnings(stderr: string): string | null {
  const lines = cleanCStderr(stderr).split("\n");
  const blocks: string[] = [];
  lines.forEach((line, index) => {
    if (/^solucao\.c:\d+:\d+: warning:/.test(line) && RELEVANT_WARNINGS.test(line)) {
      const snippet = lines.slice(index + 1, index + 3).filter((next) => /^\s*\d*\s*\|/.test(next));
      blocks.push([line, ...snippet].join("\n"));
    }
  });
  return blocks.length ? blocks.slice(0, 8).join("\n") : null;
}

const UBSAN_TRANSLATIONS: Array<[RegExp, string]> = [
  [/index (-?\d+) out of bounds for type '([^']+)'/, "índice $1 fora dos limites do vetor ($2)"],
  [/signed integer overflow/, "overflow de inteiro com sinal: o resultado não cabe no tipo (considere long long)"],
  [/division by zero/, "divisão por zero"],
  [/load of null pointer|member access within null pointer|null pointer/, "acesso por ponteiro nulo"],
  [/shift exponent|left shift/, "deslocamento de bits inválido"],
  [/misaligned address/, "acesso a endereco desalinhado"]
];

/** Traduz sinais e mensagens do UBSan/glibc em explicações acionáveis. */
function describeCError(exitCode: number | null, stderr: string, memoryLimitMb: number): string {
  const ubsan = stderr.match(/^(solucao\.c:\d+:\d+): runtime error: (.+)$/m);
  if (ubsan) {
    const [, location, detail] = ubsan;
    const translated = UBSAN_TRANSLATIONS.find(([pattern]) => pattern.test(detail));
    const explanation = translated ? detail.replace(translated[0], translated[1]) : detail;
    return `Comportamento indefinido em ${location}: ${explanation}.\n\n${stderr}`;
  }
  const signal = exitCode !== null && exitCode > 128 ? exitCode - 128 : null;
  const withDetail = (message: string) => (stderr ? `${message}\n\n${stderr}` : message);

  if (/buffer overflow detected|stack smashing detected/.test(stderr)) {
    return withDetail("Estouro de buffer detectado: uma string ou vetor foi escrito além do tamanho reservado (verifique strcpy, scanf(\"%s\") e os limites dos laços).");
  }
  if (/malloc\(\)|free\(\)|double free|corrupted/.test(stderr)) {
    return withDetail("Corrupção de memória dinâmica detectada (free duplicado, escrita fora de um bloco alocado ou uso após free).");
  }
  if (/Entrada do caso invalida/.test(stderr)) {
    return withDetail("O juiz não conseguiu ler os argumentos deste caso. Avise o professor.");
  }
  switch (signal) {
    case SIGNALS.SIGSEGV:
      return withDetail("Falha de segmentação: acesso inválido a memória (ponteiro nulo ou não inicializado, índice fora do vetor ou recursão sem caso base).");
    case SIGNALS.SIGFPE:
      return withDetail("Erro aritmético: divisão inteira por zero.");
    case SIGNALS.SIGXFSZ:
      return withDetail("O programa tentou gravar em arquivo. Escreva a resposta apenas na saída padrão (printf).");
    case SIGNALS.SIGABRT:
      return withDetail("O programa foi abortado (abort ou assert falhou).");
    case SIGNALS.SIGSYS:
      return withDetail("O programa usou uma chamada de sistema bloqueada pelo ambiente de avaliação.");
    case SIGNALS.SIGKILL:
      return withDetail(`O programa foi encerrado, provavelmente por exceder o limite de memória (${memoryLimitMb} MB).`);
  }
  return withDetail(`O programa terminou com código ${exitCode}. Em C, main deve retornar 0 quando termina com sucesso.`);
}

function cleanPythonStderr(stderr: string): string {
  return stderr
    .replaceAll('File "/box/solucao.py"', 'File "solucao.py"')
    .split("\n")
    .filter((line, index, all) => {
      // Remove os quadros do harness e o cabeçalho do compile() do juiz.
      if (/File "\/box\/harness\.py"|File "<string>"/.test(line)) return false;
      const previous = all[index - 1] ?? "";
      if (/File "\/box\/harness\.py"|File "<string>"/.test(previous) && /^\s{4}\S/.test(line)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function describePythonError(exitCode: number | null, stderr: string, memoryLimitMb: number): string {
  if (/MemoryError/.test(stderr)) {
    return `Limite de memória excedido (${memoryLimitMb} MB).\n\n${stderr}`;
  }
  if (/RecursionError/.test(stderr)) {
    return `Recursão profunda demais: o Python limita a pilha a cerca de 1000 chamadas. Verifique o caso base ou use sys.setrecursionlimit.\n\n${stderr}`;
  }
  const signal = exitCode !== null && exitCode > 128 ? exitCode - 128 : null;
  if (signal === SIGNALS.SIGKILL || signal === SIGNALS.SIGSEGV) {
    return `O programa foi encerrado, provavelmente por exceder o limite de memória (${memoryLimitMb} MB) ou a pilha.\n\n${stderr}`.trim();
  }
  return stderr || `O programa terminou com código ${exitCode}.`;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} bytes` : `${Math.round(bytes / 1024)} KB`;
}

function truncateForStorage(text: string): string {
  return text.length > STORED_TEXT_LIMIT
    ? `${text.slice(0, STORED_TEXT_LIMIT)}\n… (${text.length - STORED_TEXT_LIMIT} caracteres omitidos)`
    : text;
}

function resolveStatus(testResults: SubmissionTestResult[], totalTests: number): EvaluationStatus {
  const failure = testResults.find((result) => !result.passed);
  if (!failure) {
    return testResults.length === totalTests ? "accepted" : "wrong_answer";
  }
  if (failure.executionStatus === "timeout") return "timeout";
  if (failure.executionStatus === "runtime_error") return "runtime_error";
  return "wrong_answer";
}
