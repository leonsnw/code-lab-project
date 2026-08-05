import type {
  CreateUserInput,
  User,
  UserCredentials
} from "../domain/types.js";

export interface CodeLabStore {
  findUserById(userId: string): Promise<User | undefined>;
  findUserCredentialsByEmail(email: string): Promise<UserCredentials | undefined>;
  createUser(input: CreateUserInput): Promise<User>;
}
