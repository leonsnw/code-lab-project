import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { DomainError } from "../domain-error.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next
) => {
  if (error instanceof DomainError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: "Entrada invalida.",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Erro interno do servidor." });
};
