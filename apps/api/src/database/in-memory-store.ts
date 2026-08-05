import { DomainError } from "../common/domain-error.js";
import type {
  CreateUserInput,
  User,
  UserCredentials
} from "../domain/types.js";
import type { CodeLabStore } from "./codelab-store.js";

export class InMemoryStore implements CodeLabStore {
  private readonly users = new Map<string, UserCredentials>();

  constructor(seed: UserCredentials[] = []) {
    seed.forEach((user) => this.users.set(user.id, user));
  }

  async findUserById(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    return user ? sanitizeUser(user) : undefined;
  }

  async findUserCredentialsByEmail(
    email: string
  ): Promise<UserCredentials | undefined> {
    return [...this.users.values()].find((user) => user.email === email);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    if (await this.findUserCredentialsByEmail(input.email)) {
      throw new DomainError("E-mail ja cadastrado.", 409);
    }
    const user: UserCredentials = { ...input };
    this.users.set(user.id, user);
    return sanitizeUser(user);
  }
}

function sanitizeUser(user: UserCredentials): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}
