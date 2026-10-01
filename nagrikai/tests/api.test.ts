import { expect, it } from "vitest";
import { cleanProfile } from "@/lib/api";

it("keeps valid fields when one is invalid", () => {
  expect(cleanProfile({ age: 35, annualIncome: -5, isBPL: true })).toEqual({ age: 35, isBPL: true });
});
