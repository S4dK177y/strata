/**
 * Safe recursive-descent arithmetic expression evaluator for Quick Add.
 * Supports +, -, *, /, parentheses, spaces, comma/dot decimals, and optional leading '='.
 * Returns positive integer minor units (kopecks/cents) or null if invalid / <= 0.
 */
export function evaluateAmountExpression(rawInput: string): number | null {
  let expr = rawInput.trim();
  if (!expr) return null;
  if (expr.startsWith("=")) {
    expr = expr.slice(1).trim();
  }
  if (!expr) return null;

  // Normalize comma decimal separators and remove spaces
  const normalized = expr.replace(/,/g, ".").replace(/\s+/g, "");
  if (!/^[0-9+\-*/().]+$/.test(normalized)) {
    return null;
  }

  let pos = 0;

  function peek(): string | undefined {
    return normalized[pos];
  }

  function consume(): string | undefined {
    const ch = normalized[pos];
    pos += 1;
    return ch;
  }

  function parseNumber(): number | null {
    const start = pos;
    let dotCount = 0;
    while (pos < normalized.length) {
      const ch = normalized[pos];
      if (ch !== undefined && ch >= "0" && ch <= "9") {
        pos += 1;
      } else if (ch === ".") {
        dotCount += 1;
        if (dotCount > 1) return null;
        pos += 1;
      } else {
        break;
      }
    }
    if (pos === start) return null;
    const slice = normalized.slice(start, pos);
    if (slice === ".") return null;
    const val = Number(slice);
    return Number.isFinite(val) ? val : null;
  }

  function parseFactor(): number | null {
    const ch = peek();
    if (ch === "+" || ch === "-") {
      consume();
      const inner = parseFactor();
      if (inner === null) return null;
      return ch === "-" ? -inner : inner;
    }
    if (ch === "(") {
      consume();
      const inner = parseExpression();
      if (inner === null || consume() !== ")") return null;
      return inner;
    }
    return parseNumber();
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parseFactor();
      if (right === null) return null;
      if (op === "/") {
        if (right === 0) return null;
        left /= right;
      } else {
        left *= right;
      }
      if (!Number.isFinite(left)) return null;
    }
    return left;
  }

  function parseExpression(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
      if (!Number.isFinite(left)) return null;
    }
    return left;
  }

  const result = parseExpression();
  if (result === null || pos !== normalized.length || !Number.isFinite(result) || result <= 0) {
    return null;
  }

  const minor = Math.round(result * 100);
  return minor > 0 ? minor : null;
}
