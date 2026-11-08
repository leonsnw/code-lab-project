// Formatação de entradas e saídas do modo função (argumentos e retornos em JSON).
export function isFunctionMode(challenge) {
  return challenge?.mode === "function" && challenge.functionSpec;
}

const fmt = (value) => (Math.abs(value) >= 1e6 && value % 1e5 === 0 ? value.toExponential().replace("e+", "e") : String(value));

/** Descrição legível de um argumento gerado pelo juiz ({"$gen": ...}). */
export function describeGenerated(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.$gen !== "string") return null;
  switch (value.$gen) {
    case "ints": {
      const order = value.sorted === "asc" ? ", em ordem crescente" : value.sorted === "desc" ? ", em ordem decrescente" : "";
      return `‹${value.n} inteiros${value.distinct ? " distintos" : ""} entre ${fmt(value.min)} e ${fmt(value.max)}${order}, gerados pelo juiz›`;
    }
    case "range":
      return `‹${value.n} inteiros a partir de ${value.start ?? 0}, passo ${value.step ?? 1}›`;
    case "perm":
      return `‹permutação de ${value.start ?? 1} a ${(value.start ?? 1) + value.n - 1}, gerada pelo juiz›`;
    case "string":
      return `‹texto de ${value.n} caracteres${value.alphabet ? ` sobre "${value.alphabet}"` : ""}, gerado pelo juiz›`;
    case "matrix":
      return `‹matriz ${value.rows}×${value.cols} com valores entre ${fmt(value.min)} e ${fmt(value.max)}›`;
    case "grid":
      return `‹grade ${value.rows}×${value.cols} com os caracteres "${value.alphabet}"›`;
    case "edges":
      return value.tree ? `‹árvore aleatória com ${value.n} vértices›` : `‹${value.m ?? 0} arestas aleatórias entre ${value.n} vértices›`;
    case "repeat":
      return `‹${value.n} cópias de ${JSON.stringify(value.value)}›`;
    case "concat":
      return value.parts.map((part) => describeGenerated(part) ?? JSON.stringify(part)).join(" + ");
    default:
      return "‹entrada gerada pelo juiz›";
  }
}

const formatValue = (value) => describeGenerated(value) ?? JSON.stringify(value);

export function formatArguments(input, spec) {
  if (!spec) return input;
  try {
    const args = JSON.parse(input);
    if (!Array.isArray(args)) return input;
    const lines = spec.params.map((param, index) => `${param.name} = ${formatValue(args[index])}`);
    // Listas com ciclo: o último argumento é a posição onde a cauda se liga (-1 = sem ciclo).
    if (spec.cycleParam && args.length > spec.params.length) lines.push(`pos = ${JSON.stringify(args[args.length - 1])}`);
    return lines.join("\n");
  } catch {
    return input;
  }
}

export function formatReturn(text) {
  if (text === null || text === undefined || text === "") return text;
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
}

const TYPE_LABELS = {
  javascript: { int: "number", long: "number", double: "number", bool: "boolean", string: "string", "int[]": "number[]", "double[]": "number[]", "string[]": "string[]", "int[][]": "number[][]", list: "ListNode | null", tree: "TreeNode | null" },
  python: { int: "int", long: "int", double: "float", bool: "bool", string: "str", "int[]": "list[int]", "double[]": "list[float]", "string[]": "list[str]", "int[][]": "list[list[int]]", list: "Optional[ListNode]", tree: "Optional[TreeNode]" }
};

/** Assinatura exibida no enunciado, na convenção de cada linguagem. */
export function signatureFor(spec, language, cSignature) {
  if (language === "c") return cSignature;
  const types = TYPE_LABELS[language] ?? TYPE_LABELS.javascript;
  if (language === "python") {
    return `def ${spec.name}(${spec.params.map((param) => `${param.name}: ${types[param.type]}`).join(", ")}) -> ${types[spec.returns]}`;
  }
  return `function ${spec.name}(${spec.params.map((param) => param.name).join(", ")}) // (${spec.params.map((param) => `${param.name}: ${types[param.type]}`).join(", ")}) => ${types[spec.returns]}`;
}
