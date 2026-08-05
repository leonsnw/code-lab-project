import bcrypt from "bcryptjs";
import type { PasswordHasher } from "./auth.contracts.js";

export class BcryptPasswordHasher implements PasswordHasher {
  hash(password: string, saltRounds: number): Promise<string> {
    return bcrypt.hash(password, saltRounds);
  }

  compare(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
