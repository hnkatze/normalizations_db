import { describe, expect, it } from "vitest"

import { paginate } from "./paginate"

describe("paginate", () => {
  it("returns the requested slice of items", () => {
    const items = Array.from({ length: 25 }, (_, index) => index)

    const page = paginate(items, 10, 2)

    expect(page).toEqual({ items: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], pageNumber: 2, pageCount: 3 })
  })

  it("returns a partial last page", () => {
    const items = Array.from({ length: 25 }, (_, index) => index)

    const page = paginate(items, 10, 3)

    expect(page).toEqual({ items: [20, 21, 22, 23, 24], pageNumber: 3, pageCount: 3 })
  })

  it("clamps a page number above the last page down to the last page", () => {
    const items = Array.from({ length: 5 }, (_, index) => index)

    const page = paginate(items, 10, 99)

    expect(page).toEqual({ items: [0, 1, 2, 3, 4], pageNumber: 1, pageCount: 1 })
  })

  it("clamps a page number below 1 up to 1", () => {
    const items = [1, 2, 3]

    const page = paginate(items, 10, 0)

    expect(page).toEqual({ items: [1, 2, 3], pageNumber: 1, pageCount: 1 })
  })

  it("reports one empty page for an empty list, never a zero page count", () => {
    const page = paginate<number>([], 10, 1)

    expect(page).toEqual({ items: [], pageNumber: 1, pageCount: 1 })
  })

  it("clamps a pageSize of 0 up to 1 instead of producing an infinite page count", () => {
    const page = paginate([1, 2, 3], 0, 1)

    expect(page).toEqual({ items: [1], pageNumber: 1, pageCount: 3 })
  })

  it("clamps a negative pageSize up to 1 instead of slicing with a negative end index", () => {
    const page = paginate([1, 2, 3], -5, 2)

    expect(page).toEqual({ items: [2], pageNumber: 2, pageCount: 3 })
  })
})
