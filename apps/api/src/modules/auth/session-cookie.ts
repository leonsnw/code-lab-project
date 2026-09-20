import type { CookieOptions, Response } from "express";

export const SESSION_COOKIE_NAME = "codelab_session";
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

export function setSessionCookie(
  response: Response,
  token: string,
  production: boolean
): void {
  response.cookie(SESSION_COOKIE_NAME, token, cookieOptions(production));
}

export function clearSessionCookie(
  response: Response,
  production: boolean
): void {
  const options = cookieOptions(production);
  delete options.maxAge;
  response.clearCookie(SESSION_COOKIE_NAME, options);
}

function cookieOptions(production: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: production,
    path: "/",
    maxAge: EIGHT_HOURS_MS
  };
}
