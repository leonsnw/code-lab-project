import type { SourceRule, SubmissionLanguage } from "../../domain/types.js";

/**
 * Remove comentários e o conteúdo de literais de string/caractere, mantendo
 * as quebras de linha. Assim uma regra como "exige malloc" não é satisfeita
 * por `// malloc` nem por `printf("malloc")`.
 *
 * Em Python, comentários começam com `#` e `//` é divisão inteira (não
 * comentário); strings podem ter aspas triplas.
 */
export function stripCommentsAndLiterals(source: string, language: SubmissionLanguage = "c"): string {
  const python = language === "python";
  let output = "";
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (python && char === "#") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (!python && char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (!python && char === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === "\n") output += "\n";
        index += 1;
      }
      index += 2;
      output += " ";
      continue;
    }
    if (python && (char === '"' || char === "'") && source[index + 1] === char && source[index + 2] === char) {
      const delimiter = char.repeat(3);
      output += delimiter;
      index += 3;
      while (index < source.length && source.slice(index, index + 3) !== delimiter) {
        if (source[index] === "\\") index += 1;
        else if (source[index] === "\n") output += "\n";
        index += 1;
      }
      output += delimiter;
      index += 3;
      continue;
    }
    if (char === '"' || char === "'" || (!python && char === "`")) {
      const quote = char;
      output += quote;
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\") index += 1;
        else if (source[index] === "\n") output += "\n";
        index += 1;
      }
      output += quote;
      index += 1;
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

const NOT_FUNCTIONS = new Set(["if", "for", "while", "switch", "return", "sizeof", "do", "else", "catch", "function"]);

function braceBody(code: string, bodyStart: number): string {
  let depth = 1;
  let cursor = bodyStart;
  while (cursor < code.length && depth > 0) {
    if (code[cursor] === "{") depth += 1;
    else if (code[cursor] === "}") depth -= 1;
    cursor += 1;
  }
  return code.slice(bodyStart, cursor - 1);
}

/** Funções Python (`def nome(...):`) cujo bloco indentado chama a própria função. */
function findRecursivePythonFunctions(code: string): string[] {
  const recursive: string[] = [];
  const lines = code.split("\n");
  lines.forEach((line, lineIndex) => {
    const match = line.match(/^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/);
    if (!match) return;
    const [, indent, name] = match;
    const body: string[] = [line.slice(line.indexOf(":", match[0].length) + 1)];
    for (let next = lineIndex + 1; next < lines.length; next += 1) {
      const current = lines[next];
      if (current.trim() && (current.match(/^\s*/)?.[0].length ?? 0) <= indent.length) break;
      body.push(current);
    }
    if (new RegExp(`\\b${name}\\s*\\(`).test(body.join("\n"))) recursive.push(name);
  });
  return recursive;
}

/**
 * Nomes das funções cujo corpo chama a própria função. Em C e JavaScript,
 * `nome(...) { ... }`; em JavaScript também `const nome = (...) => ...` e
 * `const nome = function (...) { ... }`; em Python, `def nome(...):`.
 */
export function findRecursiveFunctions(code: string, language: SubmissionLanguage = "c"): string[] {
  if (language === "python") return findRecursivePythonFunctions(code);
  const recursive = new Set<string>();
  const definition = /\b([A-Za-z_$][\w$]*)\s*\(([^;{}()]|\([^()]*\))*\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = definition.exec(code)) !== null) {
    const name = match[1];
    if (NOT_FUNCTIONS.has(name)) continue;
    const body = braceBody(code, match.index + match[0].length);
    if (new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, "\\$")}\\s*\\(`).test(body)) recursive.add(name);
  }
  if (language === "javascript") {
    // Funções atribuídas a variáveis: arrow functions e function expressions.
    const assigned = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b[^(]*\(|\(?[^=;]*?\)?\s*=>)/g;
    while ((match = assigned.exec(code)) !== null) {
      const name = match[1];
      const rest = code.slice(match.index + match[0].length);
      // Corpo: bloco entre chaves ou a expressão até o fim da instrução.
      const bodyStart = rest.search(/\S/);
      const body = rest[bodyStart] === "{" || /\{\s*$/.test(match[0]) ? braceBody(rest, rest.indexOf("{") + 1) : rest.split(/;\s*\n|\n\s*\n/)[0];
      if (new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, "\\$")}\\s*\\(`).test(body)) recursive.add(name);
    }
  }
  return [...recursive];
}

/** Devolve a mensagem de cada regra não atendida, na ordem em que foram definidas. */
export function checkSourceRules(source: string, rules: SourceRule[], language: SubmissionLanguage = "c"): string[] {
  if (rules.length === 0) return [];
  const code = stripCommentsAndLiterals(source, language);
  return rules
    .filter((rule) => {
      if (rule.kind === "recursion") return findRecursiveFunctions(code, language).length === 0;
      const matches = new RegExp(rule.pattern, "m").test(code);
      return rule.kind === "forbid" ? matches : !matches;
    })
    .map((rule) => rule.message);
}
