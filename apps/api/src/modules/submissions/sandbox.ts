import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";

/**
 * Raised when the sandbox itself cannot start (missing `unshare`/`bwrap`,
 * user namespaces disabled...). It is an infrastructure failure, never a
 * verdict about the student's code.
 */
export class SandboxUnavailableError extends Error {
  constructor(reason: string) {
    super(`Sandbox de avaliação indisponível: ${reason}`);
    this.name = "SandboxUnavailableError";
  }
}

export interface RawProcessResult {
  outcome: "exited" | "timeout" | "output_limit";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Conteúdo lido do fd 4 (relatório do runtime instrumentado). */
  report: string;
  durationMs: number;
}

export interface SpawnOptions {
  cwd: string;
  stdin: string;
  timeoutMs: number;
  maxOutputBytes: number;
  /** Programa BPF entregue ao bwrap pelo fd 3 (`--seccomp 3`). */
  seccompProgram?: Buffer;
}

const STDERR_TRUNCATED_NOTICE = "\n[stderr truncado]";

// ---------- seccomp ----------
// Syscalls que um programa de exercício nunca precisa. Negadas com EPERM
// (em vez de matar o processo) para que a falha apareça como erro comum.
const DENIED_SYSCALLS_X86_64 = [
  101, // ptrace
  103, // syslog
  134, // uselib
  135, // personality
  153, // vhangup
  155, // pivot_root
  159, // adjtimex
  161, // chroot
  163, // acct
  164, // settimeofday
  165, // mount
  166, // umount2
  167, // swapon
  168, // swapoff
  169, // reboot
  172, // iopl
  173, // ioperm
  175, // init_module
  176, // delete_module
  179, // quotactl
  212, // lookup_dcookie
  246, // kexec_load
  248, // add_key
  249, // request_key
  250, // keyctl
  272, // unshare
  298, // perf_event_open
  303, // name_to_handle_at
  304, // open_by_handle_at
  308, // setns
  310, // process_vm_readv
  311, // process_vm_writev
  313, // finit_module
  320, // kexec_file_load
  321, // bpf
  323, // userfaultfd
  425, // io_uring_setup
  426, // io_uring_enter
  427, // io_uring_register
  428, // open_tree
  429, // move_mount
  430, // fsopen
  431, // fsconfig
  432, // fsmount
  433, // fspick
  442 // mount_setattr
];

const AUDIT_ARCH_X86_64 = 0xc000003e;
const X32_SYSCALL_BIT = 0x40000000;
const SECCOMP_RET_KILL_PROCESS = 0x80000000;
const SECCOMP_RET_ALLOW = 0x7fff0000;
const SECCOMP_RET_ERRNO_EPERM = 0x00050000 | 1;
const BPF_LD_W_ABS = 0x20;
const BPF_JMP_JEQ_K = 0x15;
const BPF_JMP_JGE_K = 0x35;
const BPF_RET_K = 0x06;

let cachedSeccompProgram: Buffer | null = null;

/** Filtro BPF clássico (formato `struct sock_filter`) para `bwrap --seccomp`. */
export function buildSeccompProgram(): Buffer | undefined {
  if (process.arch !== "x64") {
    return undefined;
  }
  if (cachedSeccompProgram) {
    return cachedSeccompProgram;
  }
  const instructions: Array<[number, number, number, number]> = [];
  const push = (code: number, jt: number, jf: number, k: number) => instructions.push([code, jt, jf, k >>> 0]);

  push(BPF_LD_W_ABS, 0, 0, 4); // seccomp_data.arch
  push(BPF_JMP_JEQ_K, 1, 0, AUDIT_ARCH_X86_64);
  push(BPF_RET_K, 0, 0, SECCOMP_RET_KILL_PROCESS);
  push(BPF_LD_W_ABS, 0, 0, 0); // seccomp_data.nr
  push(BPF_JMP_JGE_K, 0, 1, X32_SYSCALL_BIT);
  push(BPF_RET_K, 0, 0, SECCOMP_RET_KILL_PROCESS);
  DENIED_SYSCALLS_X86_64.forEach((syscall, index) => {
    const remaining = DENIED_SYSCALLS_X86_64.length - index;
    push(BPF_JMP_JEQ_K, remaining, 0, syscall);
  });
  push(BPF_RET_K, 0, 0, SECCOMP_RET_ALLOW);
  push(BPF_RET_K, 0, 0, SECCOMP_RET_ERRNO_EPERM);

  const program = Buffer.alloc(instructions.length * 8);
  instructions.forEach(([code, jt, jf, k], index) => {
    const offset = index * 8;
    program.writeUInt16LE(code, offset);
    program.writeUInt8(jt, offset + 2);
    program.writeUInt8(jf, offset + 3);
    program.writeUInt32LE(k, offset + 4);
  });
  cachedSeccompProgram = program;
  return program;
}

// ---------- bubblewrap ----------
export const BWRAP_BASE = [
  "--unshare-all",
  "--die-with-parent",
  "--new-session",
  "--cap-drop",
  "ALL",
  "--ro-bind",
  "/usr",
  "/usr",
  "--symlink",
  "usr/lib",
  "/lib",
  "--symlink",
  "usr/lib64",
  "/lib64",
  "--symlink",
  "usr/bin",
  "/bin",
  "--proc",
  "/proc",
  "--dev",
  "/dev",
  "--tmpfs",
  "/tmp",
  "--clearenv",
  "--setenv",
  "PATH",
  "/usr/bin",
  "--setenv",
  "LANG",
  "C.UTF-8"
];

/** Monta `bwrap ... -- <comando>`, com seccomp quando disponível. */
export function bwrap(mounts: string[], command: string[], seccomp: boolean): string[] {
  return ["bwrap", ...BWRAP_BASE, ...(seccomp ? ["--seccomp", "3"] : []), ...mounts, "--", ...command];
}

// ---------- Concorrência global ----------
/**
 * Fila com limite de avaliações simultâneas no servidor inteiro, para que
 * muitos envios ao mesmo tempo não derrubem a máquina (JUDGE_CONCURRENCY).
 */
export class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(readonly limit: number) {}

  get pending(): number {
    return this.waiting.length;
  }

  get running(): number {
    return this.active;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}

function defaultConcurrency(): number {
  const configured = Number(process.env.JUDGE_CONCURRENCY);
  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }
  return Math.max(2, Math.floor(availableParallelism() / 2));
}

export const judgeQueue = new Semaphore(defaultConcurrency());

// ---------- Execução ----------
export function spawnProcess(argv: string[], options: SpawnOptions): Promise<RawProcessResult> {
  return new Promise<RawProcessResult>((resolve, reject) => {
    const [command, ...args] = argv;
    const child = spawn(command, args, {
      // fd 3: programa seccomp para o bwrap; fd 4: relatório do runtime.
      stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"],
      cwd: options.cwd,
      detached: true,
      env: { NODE_NO_WARNINGS: "1" }
    });

    let stdout = "";
    let stderr = "";
    let report = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stderrTruncated = false;
    let finished = false;
    let startedAt = Date.now();
    let timeout: NodeJS.Timeout | undefined;

    const elapsed = () => Date.now() - startedAt;
    const withNotice = () => stderr + (stderrTruncated ? STDERR_TRUNCATED_NOTICE : "");

    const finish = (result: RawProcessResult, kill = false) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (kill) killProcessGroup(child.pid);
      resolve(result);
    };

    const fail = (error: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      killProcessGroup(child.pid);
      reject(error);
    };

    // The clock starts once the OS process exists, so the time spent by
    // `spawn` itself is not charged to the student.
    child.on("spawn", () => {
      startedAt = Date.now();
      timeout = setTimeout(() => {
        finish(
          { outcome: "timeout", exitCode: null, stdout, stderr: withNotice(), report, durationMs: elapsed() },
          true
        );
      }, options.timeoutMs);
    });

    // stdout and stderr have independent budgets: debug messages written
    // to stderr never consume the space of the evaluated answer.
    child.stdout?.on("data", (chunk: Buffer) => {
      if (finished) return;
      const remaining = options.maxOutputBytes - stdoutBytes;
      const accepted = chunk.subarray(0, Math.max(0, remaining));
      stdoutBytes += accepted.length;
      stdout += accepted.toString("utf8");
      if (chunk.length > remaining) {
        finish(
          { outcome: "output_limit", exitCode: null, stdout, stderr: withNotice(), report, durationMs: elapsed() },
          true
        );
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      if (finished || stderrTruncated) return;
      const remaining = options.maxOutputBytes - stderrBytes;
      const accepted = chunk.subarray(0, Math.max(0, remaining));
      stderrBytes += accepted.length;
      stderr += accepted.toString("utf8");
      if (chunk.length > remaining) stderrTruncated = true;
    });

    const reportStream = child.stdio[4] as NodeJS.ReadableStream | null;
    reportStream?.on("data", (chunk: Buffer) => {
      if (report.length < 256) report += chunk.toString("utf8");
    });
    reportStream?.on("error", () => undefined);

    const seccompStream = child.stdio[3] as NodeJS.WritableStream | null;
    seccompStream?.on("error", () => undefined);
    if (options.seccompProgram) {
      seccompStream?.end(options.seccompProgram);
    } else {
      seccompStream?.end();
    }

    child.on("close", (code, signal) => {
      if (finished) return;
      if (code !== 0 && isSandboxFailure(stderr)) {
        fail(new SandboxUnavailableError(stderr.trim()));
        return;
      }
      finish({
        outcome: "exited",
        exitCode: code ?? (signal ? 128 + signalNumber(signal) : null),
        stdout,
        stderr: withNotice(),
        report,
        durationMs: elapsed()
      });
    });

    child.on("error", (error) => {
      fail(new SandboxUnavailableError(error.message));
    });

    child.stdin?.on("error", () => undefined);
    child.stdin?.end(options.stdin);
  });
}

function isSandboxFailure(stderr: string): boolean {
  return /^(unshare|bwrap): /m.test(stderr);
}

export const SIGNALS: Record<string, number> = {
  SIGILL: 4,
  SIGABRT: 6,
  SIGBUS: 7,
  SIGFPE: 8,
  SIGKILL: 9,
  SIGSEGV: 11,
  SIGSYS: 31,
  SIGXCPU: 24,
  SIGXFSZ: 25
};

function signalNumber(signal: string): number {
  return SIGNALS[signal] ?? 0;
}

function killProcessGroup(processId: number | undefined): void {
  if (!processId) return;
  try {
    process.kill(-processId, "SIGKILL");
  } catch {
    // The process may already have exited between the event and cleanup.
  }
}
