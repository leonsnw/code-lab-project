import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Challenge, ScoreSummary, Track, UserCredentials } from "../domain/types.js";
import { buildCatalog, type Catalog } from "./catalog/index.js";

export { createRandom, randomInt } from "./catalog/helpers.js";

const studentId = "user-marina";
let cachedCatalog: Catalog | null = null;

const here = dirname(fileURLToPath(import.meta.url));

/** Arquivos que definem o catálogo: se algum mudar, o cache em disco é descartado. */
function catalogSources(): string[] {
  const catalogDir = join(here, "catalog");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : /\.(ts|js)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [join(dir, entry.name)] : []
    );
  const generator = ["ts", "js"].map((extension) => join(here, "../modules/submissions", `generated-input.${extension}`)).filter(existsSync);
  return [...walk(catalogDir), ...generator].sort();
}

/**
 * Gerar o catálogo custa segundos (casos grandes calculados com as soluções
 * de referência). O resultado é determinístico, então fica guardado em
 * node_modules/.cache, com a chave derivada do conteúdo dos arquivos-fonte.
 * CODELAB_CATALOG_CACHE=0 desliga o cache.
 */
function loadCatalog(): Catalog {
  if (process.env.CODELAB_CATALOG_CACHE === "0") return buildCatalog();
  let file: string | null = null;
  try {
    const hash = createHash("sha256");
    for (const source of catalogSources()) hash.update(source.slice(here.length)).update(readFileSync(source));
    const cacheDir = join(here, "../../../../node_modules/.cache/codelab");
    file = join(cacheDir, `catalogo-${hash.digest("hex").slice(0, 24)}.json`);
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as Catalog;
    mkdirSync(cacheDir, { recursive: true });
  } catch {
    file = null;
  }
  const catalog = buildCatalog();
  if (file) {
    try {
      // Escreve num temporário e renomeia: processos paralelos nunca leem um arquivo pela metade.
      const temporary = `${file}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify(catalog));
      renameSync(temporary, file);
    } catch {
      // Sem permissão de escrita: segue sem cache.
    }
  }
  return catalog;
}
const adminId = "user-admin";

export function buildSeedData(): {
  users: UserCredentials[];
  challenges: Challenge[];
  scores: ScoreSummary[];
  tracks: Track[];
} {
  const users: UserCredentials[] = [
    {
      id: studentId,
      name: "Marina Silva",
      email: "marina@codelab.local",
      role: "student",
      passwordHash: "$2b$10$fH3DkQnuSlijgJH9aknS6.aP8l5.uolrmIvkHdjFk.55mx7l9Puri"
    },
    {
      id: adminId,
      name: "Professor Henrique",
      email: "admin@codelab.local",
      role: "admin",
      passwordHash: "$2b$10$Xbta0b/UjXloCggKssF8YOZawYGElB3QRDJlxHDFQ/NqiFK4nwFae"
    }
  ];

  const scores: ScoreSummary[] = [
    {
      userId: studentId,
      totalPoints: 0,
      solvedChallengeIds: [],
      updatedAt: new Date()
    }
  ];

  // O catálogo é determinístico e caro de gerar (casos grandes): monta uma
  // vez por processo e entrega uma cópia a cada store.
  cachedCatalog ??= loadCatalog();
  const catalog = structuredClone(cachedCatalog);
  return { users, challenges: catalog.challenges, scores, tracks: catalog.tracks };
}

export const defaultStudentId = studentId;
