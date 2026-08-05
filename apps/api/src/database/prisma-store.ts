import {
  Prisma,
  PrismaClient,
  UserRole as PrismaUserRole
} from "@prisma/client";
import { DomainError } from "../common/domain-error.js";
import type {
  CreateUserInput,
  User,
  UserCredentials,
  UserRole
} from "../domain/types.js";
import type { CodeLabStore } from "./codelab-store.js";

export class PrismaStore implements CodeLabStore {
  constructor(private readonly prisma = new PrismaClient()) {}

  async findUserById(userId: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? mapUser(user) : undefined;
  }

  async findUserCredentialsByEmail(
    email: string
  ): Promise<UserCredentials | undefined> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? { ...mapUser(user), passwordHash: user.passwordHash } : undefined;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          id: input.id,
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash,
          role: toPrismaUserRole(input.role)
        }
      });
      return mapUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new DomainError("E-mail ja cadastrado.", 409);
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

function mapUser(user: {
  id: string;
  name: string;
  email: string;
  role: PrismaUserRole;
}): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === PrismaUserRole.ADMIN ? "admin" : "student"
  };
}

function toPrismaUserRole(role: UserRole): PrismaUserRole {
  return role === "admin" ? PrismaUserRole.ADMIN : PrismaUserRole.STUDENT;
}
