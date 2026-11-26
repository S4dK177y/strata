import { describe, expect, it } from "vitest";
import { evaluateAmountExpression } from "../src/calculator";

describe("evaluateAmountExpression", () => {
  it("evaluates simple integers and Google Sheet style expressions", () => {
    expect(evaluateAmountExpression("500")).toBe(50000);
    expect(evaluateAmountExpression("=320+185")).toBe(50500);
    expect(evaluateAmountExpression("1200 + 350.50")).toBe(155050);
    expect(evaluateAmountExpression("100,25 + 99,75")).toBe(20000);
    expect(evaluateAmountExpression("(100 + 50) * 2 / 3")).toBe(10000);
  });

  it("rejects zero, negative, division by zero, and unsafe tokens", () => {
    expect(evaluateAmountExpression("")).toBeNull();
    expect(evaluateAmountExpression("0")).toBeNull();
    expect(evaluateAmountExpression("100 - 200")).toBeNull();
    expect(evaluateAmountExpression("100 / 0")).toBeNull();
    expect(evaluateAmountExpression("alert(1)")).toBeNull();
    expect(evaluateAmountExpression("100 +")).toBeNull();
  });
});
