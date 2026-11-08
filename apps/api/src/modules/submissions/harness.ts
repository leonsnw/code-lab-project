import type { FunctionSpec, SubmissionLanguage, ValueType } from "../../domain/types.js";

/**
 * Harnesses do modo função (estilo LeetCode). O caso de teste guarda os
 * argumentos como um array JSON; o harness chama a função do aluno e imprime
 * o retorno em JSON depois de um marcador, separado do que o aluno imprimir
 * para depurar.
 *
 * Tipos `list` e `tree` chegam como nós de verdade (ListNode e TreeNode,
 * como no LeetCode): listas como vetor JSON e árvores em ordem de níveis com
 * `null` para filhos ausentes.
 */
export const RESULT_MARKER = "\u0001CODELAB_RESULT\u0001";
const C_RESULT_MARKER = "\\001CODELAB_RESULT\\001";

/** Limite de nós ao serializar um retorno (protege contra estruturas com ciclo). */
const MAX_SERIALIZED_NODES = 200000;
const LIST_CYCLE_ERROR = "A lista retornada tem um ciclo: algum next aponta para um no anterior.";
const TREE_CYCLE_ERROR = "A arvore retornada tem um ciclo ou um no repetido.";

export function splitFunctionOutput(stdout: string): { debug: string; result: string | null } {
  const index = stdout.lastIndexOf(RESULT_MARKER);
  if (index < 0) return { debug: stdout, result: null };
  return {
    debug: stdout.slice(0, index).replace(/\n$/, ""),
    result: stdout.slice(index + RESULT_MARKER.length).trim()
  };
}

const usesType = (spec: FunctionSpec, type: ValueType) =>
  spec.returns === type || spec.params.some((param) => param.type === type);

// ---------- JavaScript ----------
export function javascriptHarness(spec: FunctionSpec): string {
  const convert = spec.params
    .map((param, index) => {
      if (param.type === "list") {
        const cycle = spec.cycleParam === param.name ? "__args[__args.length - 1]" : "-1";
        return `__args[${index}] = __toList(__args[${index}], ${cycle});`;
      }
      if (param.type === "tree") return `__args[${index}] = __toTree(__args[${index}]);`;
      return "";
    })
    .filter(Boolean)
    .join("\n  ");
  const output =
    spec.returns === "list" ? "__fromList(__result)" : spec.returns === "tree" ? "__fromTree(__result)" : "__result";
  return `
;(() => {
  const __ListNode = class ListNode { constructor(val = 0, next = null) { this.val = val; this.next = next; } };
  const __TreeNode = class TreeNode { constructor(val = 0, left = null, right = null) { this.val = val; this.left = left; this.right = right; } };
  if (typeof globalThis.ListNode === "undefined") globalThis.ListNode = __ListNode;
  if (typeof globalThis.TreeNode === "undefined") globalThis.TreeNode = __TreeNode;
  const __toList = (values, cycle) => {
    const nodes = values.map((value) => new __ListNode(value));
    nodes.forEach((node, index) => { node.next = nodes[index + 1] ?? null; });
    if (cycle >= 0 && nodes.length) nodes[nodes.length - 1].next = nodes[cycle];
    return nodes[0] ?? null;
  };
  const __fromList = (head) => {
    const values = [];
    const seen = new Set();
    for (let node = head; node; node = node.next) {
      if (seen.has(node) || values.length >= ${MAX_SERIALIZED_NODES}) throw new Error(${JSON.stringify(LIST_CYCLE_ERROR)});
      seen.add(node);
      values.push(node.val);
    }
    return values;
  };
  const __toTree = (values) => {
    if (!values.length || values[0] === null) return null;
    const root = new __TreeNode(values[0]);
    const queue = [root];
    let index = 1;
    while (queue.length && index < values.length) {
      const node = queue.shift();
      if (index < values.length && values[index] !== null) queue.push((node.left = new __TreeNode(values[index])));
      index += 1;
      if (index < values.length && values[index] !== null) queue.push((node.right = new __TreeNode(values[index])));
      index += 1;
    }
    return root;
  };
  const __fromTree = (root) => {
    const values = [];
    const queue = [root];
    const seen = new Set();
    for (let index = 0; index < queue.length; index += 1) {
      const node = queue[index];
      if (!node) { values.push(null); continue; }
      if (seen.has(node) || seen.size >= ${MAX_SERIALIZED_NODES}) throw new Error(${JSON.stringify(TREE_CYCLE_ERROR)});
      seen.add(node);
      values.push(node.val);
      queue.push(node.left ?? null, node.right ?? null);
    }
    while (values.length && values[values.length - 1] === null) values.pop();
    return values;
  };
  const __args = JSON.parse(require("fs").readFileSync(0, "utf8"));
  if (typeof ${spec.name} !== "function") {
    throw new Error("Defina a função ${spec.name}(${spec.params.map((param) => param.name).join(", ")}).");
  }
  ${convert}
  const __result = ${spec.name}(...__args.slice(0, ${spec.params.length}));
  const __value = ${output};
  process.stdout.write("\\n" + ${JSON.stringify(RESULT_MARKER)} + JSON.stringify(__value === undefined ? null : __value));
})();
`;
}

// ---------- Python ----------
export function pythonHarness(spec: FunctionSpec): string {
  const convert = spec.params
    .map((param, index) => {
      if (param.type === "list") {
        const cycle = spec.cycleParam === param.name ? "__args[-1]" : "-1";
        return `__args[${index}] = __to_list(__args[${index}], ${cycle})`;
      }
      if (param.type === "tree") return `__args[${index}] = __to_tree(__args[${index}])`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
  const output =
    spec.returns === "list" ? "__from_list(__result)" : spec.returns === "tree" ? "__from_tree(__result)" : "__result";
  return `import json, sys
from collections import deque


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def __to_list(values, cycle):
    nodes = [ListNode(value) for value in values]
    for index in range(len(nodes) - 1):
        nodes[index].next = nodes[index + 1]
    if cycle >= 0 and nodes:
        nodes[-1].next = nodes[cycle]
    return nodes[0] if nodes else None


def __from_list(head):
    values, seen = [], set()
    while head is not None:
        if id(head) in seen or len(values) >= ${MAX_SERIALIZED_NODES}:
            raise ValueError(${JSON.stringify(LIST_CYCLE_ERROR)})
        seen.add(id(head))
        values.append(head.val)
        head = head.next
    return values


def __to_tree(values):
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue = deque([root])
    index = 1
    while queue and index < len(values):
        node = queue.popleft()
        if index < len(values) and values[index] is not None:
            node.left = TreeNode(values[index])
            queue.append(node.left)
        index += 1
        if index < len(values) and values[index] is not None:
            node.right = TreeNode(values[index])
            queue.append(node.right)
        index += 1
    return root


def __from_tree(root):
    values, queue, seen = [], deque([root]), set()
    while queue:
        node = queue.popleft()
        if node is None:
            values.append(None)
            continue
        if id(node) in seen or len(seen) >= ${MAX_SERIALIZED_NODES}:
            raise ValueError(${JSON.stringify(TREE_CYCLE_ERROR)})
        seen.add(id(node))
        values.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while values and values[-1] is None:
        values.pop()
    return values


sys.setrecursionlimit(20000)
__source = open("/box/solucao.py", encoding="utf-8").read()
__namespace = {"__name__": "solucao", "ListNode": ListNode, "TreeNode": TreeNode}
exec(compile(__source, "solucao.py", "exec"), __namespace)
if not callable(__namespace.get(${JSON.stringify(spec.name)})):
    raise NameError("Defina a função ${spec.name}(${spec.params.map((param) => param.name).join(", ")}).")
__args = json.loads(sys.stdin.read())
${convert}
__result = __namespace[${JSON.stringify(spec.name)}](*__args[:${spec.params.length}])
if isinstance(__result, tuple):
    __result = list(__result)
sys.stdout.write("\\n" + ${JSON.stringify(RESULT_MARKER)} + json.dumps(${output}))
`;
}

// ---------- C ----------
const C_SCALAR: Partial<Record<ValueType, string>> = {
  int: "int",
  long: "long long",
  double: "double",
  bool: "bool",
  string: "char*",
  list: "struct ListNode*",
  tree: "struct TreeNode*"
};

const C_STRUCTS = {
  list: "struct ListNode {\n    int val;\n    struct ListNode *next;\n};",
  tree: "struct TreeNode {\n    int val;\n    struct TreeNode *left;\n    struct TreeNode *right;\n};"
};

/** Parâmetros em C, na convenção do LeetCode para vetores e matrizes. */
function cParameters(spec: FunctionSpec): string[] {
  return spec.params.flatMap(({ name, type }) => {
    if (C_SCALAR[type]) return [`${C_SCALAR[type]} ${name}`];
    if (type === "int[]") return [`int* ${name}`, `int ${name}Size`];
    if (type === "double[]") return [`double* ${name}`, `int ${name}Size`];
    if (type === "string[]") return [`char** ${name}`, `int ${name}Size`];
    return [`int** ${name}`, `int ${name}Size`, `int* ${name}ColSize`];
  });
}

function cReturnType(type: ValueType): string {
  if (C_SCALAR[type]) return C_SCALAR[type]!;
  if (type === "int[]") return "int*";
  if (type === "double[]") return "double*";
  if (type === "string[]") return "char**";
  return "int**";
}

function cReturnExtras(type: ValueType): string[] {
  if (type === "int[]" || type === "double[]" || type === "string[]") return ["int* returnSize"];
  if (type === "int[][]") return ["int* returnSize", "int** returnColumnSizes"];
  return [];
}

/** Assinatura que o aluno precisa implementar em C. */
export function cSignature(spec: FunctionSpec): string {
  const params = [...cParameters(spec), ...cReturnExtras(spec.returns)];
  return `${cReturnType(spec.returns)} ${spec.name}(${params.join(", ") || "void"})`;
}

/** Definições de struct exibidas (e fornecidas pelo juiz) para listas e árvores. */
export function cStructDefinitions(spec: FunctionSpec): string {
  return [usesType(spec, "list") && C_STRUCTS.list, usesType(spec, "tree") && C_STRUCTS.tree].filter(Boolean).join("\n\n");
}

function cParseStatement(spec: FunctionSpec, name: string, type: ValueType): string {
  switch (type) {
    case "int":
      return `int ${name} = (int)cl_parse_ll();`;
    case "long":
      return `long long ${name} = cl_parse_ll();`;
    case "double":
      return `double ${name} = cl_parse_double();`;
    case "bool":
      return `bool ${name} = cl_parse_bool();`;
    case "string":
      return `char* ${name} = cl_parse_string();`;
    case "int[]":
      return `int ${name}Size = 0; int* ${name} = cl_parse_int_array(&${name}Size);`;
    case "double[]":
      return `int ${name}Size = 0; double* ${name} = cl_parse_double_array(&${name}Size);`;
    case "string[]":
      return `int ${name}Size = 0; char** ${name} = cl_parse_string_array(&${name}Size);`;
    case "int[][]":
      return `int ${name}Size = 0; int* ${name}ColSize = 0; int** ${name} = cl_parse_int_matrix(&${name}Size, &${name}ColSize);`;
    case "list":
      return `int ${name}Count = 0; int* ${name}Values = cl_parse_int_array(&${name}Count); struct ListNode* ${name} = cl_build_list(${name}Values, ${name}Count);${spec.cycleParam === name ? ` cl_cycle_list = ${name}; cl_cycle_count = ${name}Count;` : ""}`;
    case "tree":
      return `struct TreeNode* ${name} = cl_parse_tree();`;
  }
}

function cCallArguments(spec: FunctionSpec): string[] {
  return spec.params.flatMap(({ name, type }) => {
    if (C_SCALAR[type]) return [name];
    if (type === "int[][]") return [name, `${name}Size`, `${name}ColSize`];
    return [name, `${name}Size`];
  });
}

function cPrintResult(type: ValueType): string {
  switch (type) {
    case "int":
      return `printf("%d", __result);`;
    case "long":
      return `printf("%lld", __result);`;
    case "double":
      return `cl_print_double(__result);`;
    case "bool":
      return `fputs(__result ? "true" : "false", stdout);`;
    case "string":
      return `cl_print_string(__result);`;
    case "int[]":
      return `putchar('['); for (int i = 0; i < __size; i++) printf(i ? ",%d" : "%d", __result[i]); putchar(']');`;
    case "double[]":
      return `putchar('['); for (int i = 0; i < __size; i++) { if (i) putchar(','); cl_print_double(__result[i]); } putchar(']');`;
    case "string[]":
      return `putchar('['); for (int i = 0; i < __size; i++) { if (i) putchar(','); cl_print_string(__result[i]); } putchar(']');`;
    case "int[][]":
      return `putchar('['); for (int i = 0; i < __size; i++) { if (i) putchar(','); putchar('['); for (int j = 0; j < __cols[i]; j++) printf(j ? ",%d" : "%d", __result[i][j]); putchar(']'); } putchar(']');`;
    case "list":
      return `cl_print_list(__result);`;
    case "tree":
      return `cl_print_tree(__result);`;
  }
}

const C_LIST_HELPERS = `
__attribute__((no_instrument_function)) static struct ListNode *cl_build_list(int *values, int count) {
  struct ListNode *head = 0, *tail = 0;
  for (int i = 0; i < count; i++) {
    struct ListNode *node = calloc(1, sizeof(struct ListNode));
    node->val = values[i];
    if (tail) tail->next = node; else head = node;
    tail = node;
  }
  return head;
}
__attribute__((no_instrument_function)) static void cl_print_list(struct ListNode *head) {
  for (struct ListNode *slow = head, *fast = head; fast && fast->next;) {
    slow = slow->next; fast = fast->next->next;
    if (slow == fast) { fprintf(stderr, "${LIST_CYCLE_ERROR}\\n"); exit(1); }
  }
  putchar('[');
  for (int count = 0; head && count < ${MAX_SERIALIZED_NODES}; head = head->next, count++) printf(count ? ",%d" : "%d", head->val);
  putchar(']');
}
`;

const C_TREE_HELPERS = `
__attribute__((no_instrument_function)) static struct TreeNode *cl_parse_tree(void) {
  cl_expect('[');
  int cap = 16, count = 0;
  struct TreeNode **nodes = malloc(sizeof(struct TreeNode *) * cap);
  if (!cl_peek(']')) {
    do {
      if (count == cap) { cap *= 2; nodes = realloc(nodes, sizeof(struct TreeNode *) * cap); }
      cl_ws();
      if (!strncmp(cl_buffer + cl_pos, "null", 4)) { cl_pos += 4; nodes[count++] = 0; }
      else { struct TreeNode *node = calloc(1, sizeof(struct TreeNode)); node->val = (int)cl_parse_ll(); nodes[count++] = node; }
      cl_ws();
    } while (cl_buffer[cl_pos] == ',' && ++cl_pos);
  }
  cl_expect(']');
  if (!count || !nodes[0]) return 0;
  int parent = 0;
  for (int index = 1; index < count; parent++) {
    while (parent < count && !nodes[parent]) parent++;
    if (parent >= count) break;
    nodes[parent]->left = nodes[index++];
    if (index < count) nodes[parent]->right = nodes[index++];
  }
  return nodes[0];
}
__attribute__((no_instrument_function)) static void cl_print_tree(struct TreeNode *root) {
  int cap = 64, head = 0, tail = 0, last = -1, orderLen = 0, orderCap = 64;
  struct TreeNode **queue = malloc(sizeof(struct TreeNode *) * cap);
  struct TreeNode **order = malloc(sizeof(struct TreeNode *) * orderCap);
  queue[tail++] = root;
  while (head < tail) {
    struct TreeNode *node = queue[head++];
    if (orderLen >= ${MAX_SERIALIZED_NODES}) { fprintf(stderr, "${TREE_CYCLE_ERROR}\\n"); exit(1); }
    if (orderLen == orderCap) { orderCap *= 2; order = realloc(order, sizeof(struct TreeNode *) * orderCap); }
    order[orderLen++] = node;
    if (node) {
      last = orderLen - 1;
      if (tail + 2 > cap) { cap *= 2; queue = realloc(queue, sizeof(struct TreeNode *) * cap); }
      queue[tail++] = node->left;
      queue[tail++] = node->right;
    }
  }
  putchar('[');
  for (int i = 0; i <= last; i++) {
    if (i) putchar(',');
    if (order[i]) printf("%d", order[i]->val); else fputs("null", stdout);
  }
  putchar(']');
}
`;

/**
 * main gerado para o modo função. Inclui o código do aluno depois das
 * definições de struct, para que os erros apontem para linhas de solucao.c.
 */
export function cHarness(spec: FunctionSpec): string {
  const extras = cReturnExtras(spec.returns);
  const callArgs = [
    ...cCallArguments(spec),
    ...(extras.length ? ["&__size"] : []),
    ...(spec.returns === "int[][]" ? ["&__cols"] : [])
  ];
  const cycle = Boolean(spec.cycleParam);
  return `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <ctype.h>
${cStructDefinitions(spec)}
#include "solucao.c"

static char *cl_buffer;
static size_t cl_pos;
${cycle ? "static struct ListNode *cl_cycle_list; static int cl_cycle_count;" : ""}

__attribute__((no_instrument_function)) static void cl_fail(const char *what) {
  fprintf(stderr, "Entrada do caso inválida (%s).\\n", what);
  exit(2);
}
__attribute__((no_instrument_function)) static void cl_ws(void) { while (cl_buffer[cl_pos] && isspace((unsigned char)cl_buffer[cl_pos])) cl_pos++; }
__attribute__((no_instrument_function)) static void cl_expect(char c) { cl_ws(); if (cl_buffer[cl_pos] != c) cl_fail("caractere inesperado"); cl_pos++; }
__attribute__((no_instrument_function)) static int cl_peek(char c) { cl_ws(); return cl_buffer[cl_pos] == c; }
__attribute__((no_instrument_function)) static long long cl_parse_ll(void) { cl_ws(); char *end; long long v = strtoll(cl_buffer + cl_pos, &end, 10); if (end == cl_buffer + cl_pos) cl_fail("inteiro"); cl_pos = (size_t)(end - cl_buffer); return v; }
__attribute__((no_instrument_function)) static double cl_parse_double(void) { cl_ws(); char *end; double v = strtod(cl_buffer + cl_pos, &end); if (end == cl_buffer + cl_pos) cl_fail("número"); cl_pos = (size_t)(end - cl_buffer); return v; }
__attribute__((no_instrument_function)) static bool cl_parse_bool(void) { cl_ws(); if (!strncmp(cl_buffer + cl_pos, "true", 4)) { cl_pos += 4; return true; } if (!strncmp(cl_buffer + cl_pos, "false", 5)) { cl_pos += 5; return false; } cl_fail("booleano"); return false; }
__attribute__((no_instrument_function)) static char *cl_parse_string(void) {
  cl_expect('"');
  size_t cap = 16, len = 0; char *out = malloc(cap);
  while (cl_buffer[cl_pos] && cl_buffer[cl_pos] != '"') {
    char c = cl_buffer[cl_pos++];
    if (c == '\\\\') {
      char e = cl_buffer[cl_pos++];
      c = e == 'n' ? '\\n' : e == 't' ? '\\t' : e == 'r' ? '\\r' : e == 'u' ? '?' : e;
      if (e == 'u') cl_pos += 4;
    }
    if (len + 2 > cap) { cap *= 2; out = realloc(out, cap); }
    out[len++] = c;
  }
  cl_expect('"');
  out[len] = 0;
  return out;
}
__attribute__((no_instrument_function)) static int *cl_parse_int_array(int *size) {
  cl_expect('['); int cap = 8; int *out = malloc(sizeof(int) * cap); *size = 0;
  if (cl_peek(']')) { cl_pos++; return out; }
  do { if (*size == cap) { cap *= 2; out = realloc(out, sizeof(int) * cap); } out[(*size)++] = (int)cl_parse_ll(); cl_ws(); } while (cl_buffer[cl_pos] == ',' && ++cl_pos);
  cl_expect(']'); return out;
}
__attribute__((no_instrument_function)) static double *cl_parse_double_array(int *size) {
  cl_expect('['); int cap = 8; double *out = malloc(sizeof(double) * cap); *size = 0;
  if (cl_peek(']')) { cl_pos++; return out; }
  do { if (*size == cap) { cap *= 2; out = realloc(out, sizeof(double) * cap); } out[(*size)++] = cl_parse_double(); cl_ws(); } while (cl_buffer[cl_pos] == ',' && ++cl_pos);
  cl_expect(']'); return out;
}
__attribute__((no_instrument_function)) static char **cl_parse_string_array(int *size) {
  cl_expect('['); int cap = 8; char **out = malloc(sizeof(char *) * cap); *size = 0;
  if (cl_peek(']')) { cl_pos++; return out; }
  do { if (*size == cap) { cap *= 2; out = realloc(out, sizeof(char *) * cap); } out[(*size)++] = cl_parse_string(); cl_ws(); } while (cl_buffer[cl_pos] == ',' && ++cl_pos);
  cl_expect(']'); return out;
}
__attribute__((no_instrument_function)) static int **cl_parse_int_matrix(int *rows, int **cols) {
  cl_expect('['); int cap = 8; int **out = malloc(sizeof(int *) * cap); *cols = malloc(sizeof(int) * cap); *rows = 0;
  if (cl_peek(']')) { cl_pos++; return out; }
  do { if (*rows == cap) { cap *= 2; out = realloc(out, sizeof(int *) * cap); *cols = realloc(*cols, sizeof(int) * cap); } out[*rows] = cl_parse_int_array(&(*cols)[*rows]); (*rows)++; cl_ws(); } while (cl_buffer[cl_pos] == ',' && ++cl_pos);
  cl_expect(']'); return out;
}
__attribute__((no_instrument_function)) static void cl_print_double(double v) { printf("%.10g", v); }
__attribute__((no_instrument_function)) static void cl_print_string(const char *s) {
  putchar('"');
  for (; s && *s; s++) {
    if (*s == '"' || *s == '\\\\') { putchar('\\\\'); putchar(*s); }
    else if (*s == '\\n') fputs("\\\\n", stdout);
    else if (*s == '\\t') fputs("\\\\t", stdout);
    else putchar(*s);
  }
  putchar('"');
}
${usesType(spec, "list") ? C_LIST_HELPERS : ""}
${usesType(spec, "tree") ? C_TREE_HELPERS : ""}

__attribute__((no_instrument_function)) int main(void) {
  size_t cap = 1 << 16, len = 0; cl_buffer = malloc(cap); size_t got;
  while ((got = fread(cl_buffer + len, 1, cap - len - 1, stdin)) > 0) { len += got; if (len + 1 >= cap) { cap *= 2; cl_buffer = realloc(cl_buffer, cap); } }
  cl_buffer[len] = 0;
  cl_expect('[');
${spec.params
  .map((param, index) => `  ${index ? "cl_expect(','); " : ""}${cParseStatement(spec, param.name, param.type)}`)
  .join("\n")}
${cycle
  ? `  cl_expect(','); int cl_cycle_at = (int)cl_parse_ll();
  if (cl_cycle_at >= 0 && cl_cycle_count > 0) { struct ListNode *target = cl_cycle_list, *tail = cl_cycle_list; for (int i = 0; i < cl_cycle_at; i++) target = target->next; while (tail->next) tail = tail->next; tail->next = target; }`
  : ""}
  cl_expect(']');
  ${extras.length ? "int __size = 0;" : ""}${spec.returns === "int[][]" ? " int* __cols = 0;" : ""}
  ${cReturnType(spec.returns)} __result = ${spec.name}(${callArgs.join(", ")});
  fflush(stdout);
  printf("\\n%s", "${C_RESULT_MARKER}");
  ${cPrintResult(spec.returns)}
  fflush(stdout);
  return 0;
}
`;
}

/** Modelo inicial do modo função, por linguagem. */
export function functionStarter(spec: FunctionSpec, language: SubmissionLanguage): string {
  const names = spec.params.map((param) => param.name).join(", ");
  const needsNodes = usesType(spec, "list") || usesType(spec, "tree");
  if (language === "python") {
    const nodes = needsNodes
      ? `# O juiz fornece as classes:\n${usesType(spec, "list") ? "# class ListNode: val, next\n" : ""}${usesType(spec, "tree") ? "# class TreeNode: val, left, right\n" : ""}\n`
      : "";
    return `${nodes}def ${spec.name}(${names}):\n    # Escreva sua solução e retorne o resultado.\n    pass\n`;
  }
  if (language === "c") {
    const structs = cStructDefinitions(spec);
    const header = structs
      ? `/* O juiz já define estas structs (não as declare de novo):\n${structs.split("\n").map((line) => ` * ${line}`).join("\n")}\n */\n\n`
      : "";
    return `#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n\n${header}${cSignature(spec)} {\n    // Escreva sua solução e retorne o resultado.\n}\n`;
  }
  const nodes = needsNodes
    ? `// O juiz fornece as classes:\n${usesType(spec, "list") ? "// class ListNode { val; next }\n" : ""}${usesType(spec, "tree") ? "// class TreeNode { val; left; right }\n" : ""}\n`
    : "";
  return `${nodes}function ${spec.name}(${names}) {\n  // Escreva sua solução e retorne o resultado.\n}\n`;
}
