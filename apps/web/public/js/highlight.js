import { escapeHtml } from "./dom.js";

// Realce de sintaxe leve para C e JavaScript, sem dependências. Tokeniza com
// uma única expressão regular; tudo que não casa é texto comum (escapado).
const KEYWORDS = {
  c: new Set([
    "auto", "break", "case", "const", "continue", "default", "do", "else", "enum", "extern",
    "for", "goto", "if", "inline", "register", "restrict", "return", "sizeof", "static",
    "struct", "switch", "typedef", "union", "volatile", "while", "NULL", "true", "false"
  ]),
  javascript: new Set([
    "async", "await", "break", "case", "catch", "class", "const", "continue", "default",
    "delete", "do", "else", "export", "extends", "false", "finally", "for", "function", "if",
    "import", "in", "instanceof", "let", "new", "null", "of", "return", "static", "super",
    "switch", "this", "throw", "true", "try", "typeof", "undefined", "var", "void", "while", "yield"
  ])
};

const TYPES = {
  c: new Set([
    "char", "double", "float", "int", "long", "short", "signed", "unsigned", "void", "bool",
    "size_t", "FILE", "int8_t", "int16_t", "int32_t", "int64_t", "uint8_t", "uint16_t",
    "uint32_t", "uint64_t"
  ]),
  javascript: new Set(["Array", "Boolean", "Date", "JSON", "Map", "Math", "Number", "Object", "Promise", "Set", "String", "console", "require", "process"])
};

const TOKEN = new RegExp(
  [
    "(?<comment>\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$))",
    "(?<string>\"(?:\\\\.|[^\"\\\\\\n])*\"?|'(?:\\\\.|[^'\\\\\\n])*'?|`(?:\\\\.|[^`\\\\])*`?)",
    "(?<preprocessor>^[ \\t]*#[ \\t]*\\w+(?:[ \\t]*<[^>\\n]*>)?)",
    "(?<number>\\b0[xX][0-9a-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?[uUlLfF]*\\b)",
    "(?<word>\\b[A-Za-z_$][\\w$]*\\b)"
  ].join("|"),
  "gm"
);

const span = (className, text) => `<span class="tok-${className}">${escapeHtml(text)}</span>`;

export function highlight(code, language = "javascript") {
  const keywords = KEYWORDS[language] ?? KEYWORDS.javascript;
  const types = TYPES[language] ?? TYPES.javascript;
  let output = "";
  let last = 0;

  for (const match of code.matchAll(TOKEN)) {
    const [text] = match;
    const { comment, string, preprocessor, number, word } = match.groups;
    output += escapeHtml(code.slice(last, match.index));
    last = match.index + text.length;

    if (comment) output += span("comment", text);
    else if (string) output += span("string", text);
    else if (preprocessor) output += language === "c" ? span("preprocessor", text) : escapeHtml(text);
    else if (number) output += span("number", text);
    else if (word) {
      if (keywords.has(word)) output += span("keyword", text);
      else if (types.has(word)) output += span("type", text);
      else if (/^\s*\(/.test(code.slice(last))) output += span("function", text);
      else output += escapeHtml(text);
    }
  }
  return output + escapeHtml(code.slice(last));
}
