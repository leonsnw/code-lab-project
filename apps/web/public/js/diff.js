// Diferença linha a linha (maior subsequência comum), para comparar duas
// submissões. Códigos de desafio têm poucas centenas de linhas, então a
// tabela O(n·m) é suficiente; acima do limite, compara só por posição.
const MAX_CELLS = 4_000_000;

export function diffLines(before, after) {
  const a = String(before ?? "").replace(/\r\n/g, "\n").split("\n");
  const b = String(after ?? "").replace(/\r\n/g, "\n").split("\n");
  if (a.length * b.length > MAX_CELLS) {
    const length = Math.max(a.length, b.length);
    return Array.from({ length }, (_, index) =>
      a[index] === b[index]
        ? { type: "same", text: a[index], left: index + 1, right: index + 1 }
        : { type: "changed", removed: a[index], added: b[index], left: a[index] === undefined ? null : index + 1, right: b[index] === undefined ? null : index + 1 }
    ).flatMap((row) =>
      row.type === "changed"
        ? [
            ...(row.removed !== undefined ? [{ type: "removed", text: row.removed, left: row.left, right: null }] : []),
            ...(row.added !== undefined ? [{ type: "added", text: row.added, left: null, right: row.right }] : [])
          ]
        : [row]
    );
  }

  const table = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      rows.push({ type: "same", text: a[i], left: i + 1, right: j + 1 });
      i += 1;
      j += 1;
    } else if (j < b.length && (i === a.length || table[i][j + 1] >= table[i + 1][j])) {
      rows.push({ type: "added", text: b[j], left: null, right: j + 1 });
      j += 1;
    } else {
      rows.push({ type: "removed", text: a[i], left: i + 1, right: null });
      i += 1;
    }
  }
  return rows;
}

export function diffSummary(rows) {
  return {
    added: rows.filter((row) => row.type === "added").length,
    removed: rows.filter((row) => row.type === "removed").length
  };
}
