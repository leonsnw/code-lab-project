import { randomUUID } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { judgeQueue } from "../submissions/sandbox.js";

/**
 * Observabilidade sem dependências: log estruturado (uma linha JSON por
 * requisição, com request id) e métricas no formato texto do Prometheus
 * em GET /metrics.
 */
const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000];

class Counter {
  private readonly values = new Map<string, number>();
  constructor(readonly name: string, readonly help: string) {}
  inc(labels: Record<string, string>, value = 1) {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }
  render(): string[] {
    return [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`, ...[...this.values].map(([key, value]) => `${this.name}${key} ${value}`)];
  }
}

class Histogram {
  private readonly series = new Map<string, { buckets: number[]; sum: number; count: number }>();
  constructor(readonly name: string, readonly help: string) {}
  observe(labels: Record<string, string>, value: number) {
    const key = labelKey(labels);
    const entry = this.series.get(key) ?? { buckets: DURATION_BUCKETS_MS.map(() => 0), sum: 0, count: 0 };
    DURATION_BUCKETS_MS.forEach((limit, index) => {
      if (value <= limit) entry.buckets[index] += 1;
    });
    entry.sum += value;
    entry.count += 1;
    this.series.set(key, entry);
  }
  render(): string[] {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const [key, entry] of this.series) {
      const base = key.slice(1, -1);
      const withLe = (le: string) => `{${base ? `${base},` : ""}le="${le}"}`;
      DURATION_BUCKETS_MS.forEach((limit, index) => lines.push(`${this.name}_bucket${withLe(String(limit))} ${entry.buckets[index]}`));
      lines.push(`${this.name}_bucket${withLe("+Inf")} ${entry.count}`, `${this.name}_sum${key} ${entry.sum}`, `${this.name}_count${key} ${entry.count}`);
    }
    return lines;
  }
}

function labelKey(labels: Record<string, string>): string {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? `{${entries.map(([name, value]) => `${name}="${value.replace(/["\\\n]/g, "_")}"`).join(",")}}` : "";
}

export class Metrics {
  readonly startedAt = Date.now();
  readonly httpRequests = new Counter("codelab_http_requests_total", "Requisições HTTP por método, rota e status.");
  readonly httpDuration = new Histogram("codelab_http_request_duration_ms", "Duração das requisições HTTP em milissegundos.");
  readonly submissions = new Counter("codelab_submissions_total", "Submissões avaliadas por linguagem e veredito.");
  readonly judgeDuration = new Histogram("codelab_judge_duration_ms", "Tempo total de avaliação de uma submissão.");

  recordSubmission(language: string, status: string, durationMs: number) {
    this.submissions.inc({ language, status });
    this.judgeDuration.observe({ language }, durationMs);
  }

  render(): string {
    return [
      ...this.httpRequests.render(),
      ...this.httpDuration.render(),
      ...this.submissions.render(),
      ...this.judgeDuration.render(),
      "# HELP codelab_judge_running Avaliações em execução agora.",
      "# TYPE codelab_judge_running gauge",
      `codelab_judge_running ${judgeQueue.running}`,
      "# HELP codelab_judge_waiting Avaliações aguardando na fila do juiz.",
      "# TYPE codelab_judge_waiting gauge",
      `codelab_judge_waiting ${judgeQueue.pending}`,
      "# HELP codelab_uptime_seconds Tempo desde o início do processo.",
      "# TYPE codelab_uptime_seconds gauge",
      `codelab_uptime_seconds ${Math.round((Date.now() - this.startedAt) / 1000)}`,
      ""
    ].join("\n");
  }
}

/** Rota normalizada (ex.: /api/challenges/:slug) para não explodir a cardinalidade das métricas. */
function routeOf(request: Request): string {
  const pattern = request.route?.path;
  if (typeof pattern === "string") return `${request.baseUrl}${pattern}`;
  if (request.path.startsWith("/api/")) return "/api/*";
  return "static";
}

export function requestObservability(metrics: Metrics, options: { log: boolean }): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    const header = request.header("X-Request-Id");
    const requestId = header && /^[\w-]{8,64}$/.test(header) ? header : randomUUID();
    response.locals.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    const started = process.hrtime.bigint();
    response.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const route = routeOf(request);
      metrics.httpRequests.inc({ method: request.method, route, status: String(response.statusCode) });
      metrics.httpDuration.observe({ method: request.method, route }, durationMs);
      if (options.log && route !== "static") {
        const user = response.locals.authenticatedUser as { id?: string } | undefined;
        process.stdout.write(
          `${JSON.stringify({
            level: response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info",
            time: new Date().toISOString(),
            requestId,
            method: request.method,
            route,
            status: response.statusCode,
            durationMs: Math.round(durationMs * 10) / 10,
            ...(user?.id ? { userId: user.id } : {})
          })}\n`
        );
      }
    });
    next();
  };
}

/** /metrics exige METRICS_TOKEN em produção (Authorization: Bearer <token>). */
export function metricsHandler(metrics: Metrics, production: boolean): RequestHandler {
  return (request, response) => {
    const token = process.env.METRICS_TOKEN;
    if (token ? request.header("Authorization") !== `Bearer ${token}` : production) {
      response.status(404).json({ error: "Não encontrado." });
      return;
    }
    response.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    response.send(metrics.render());
  };
}
