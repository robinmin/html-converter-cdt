import { expect, it } from "vitest"

import { square } from "./square"

it("should return the square of a positive number", () => {
  expect(square(3)).toBe(9)
})

it("should return the square of a negative number", () => {
  expect(square(-5)).toBe(25)
})

it("should return zero when input is zero", () => {
  expect(square(0)).toBe(0)
})
