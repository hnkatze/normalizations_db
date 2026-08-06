import { describe, expect, it } from "vitest"

import { paginate } from "./paginate"

const items = ["a", "b", "c", "d", "e", "f", "g"]

describe("paginate", () => {
  it("returns one empty page for an empty list", () => {
    // Cero páginas obligaría a cada consumidor a distinguir "sin datos" de
    // "página fuera de rango". Una lista vacía es una página vacía.
    const page = paginate([], 3, 1)

    expect(page.items).toEqual([])
    expect(page.pageCount).toBe(1)
    expect(page.pageNumber).toBe(1)
    expect(page.firstItemNumber).toBe(0)
    expect(page.lastItemNumber).toBe(0)
  })

  it("cuts the first page and reports its bounds", () => {
    const page = paginate(items, 3, 1)

    expect(page.items).toEqual(["a", "b", "c"])
    expect(page.pageCount).toBe(3)
    expect(page.firstItemNumber).toBe(1)
    expect(page.lastItemNumber).toBe(3)
    expect(page.totalItems).toBe(7)
  })

  it("cuts a partial last page", () => {
    const page = paginate(items, 3, 3)

    expect(page.items).toEqual(["g"])
    expect(page.firstItemNumber).toBe(7)
    expect(page.lastItemNumber).toBe(7)
  })

  it("clamps a page number past the end to the last real page", () => {
    // El caso que motiva el ajuste: la lista se acorta mientras el usuario
    // confirma reglas, y quien estaba al final se quedaría sin nada que ver.
    const page = paginate(items, 3, 99)

    expect(page.pageNumber).toBe(3)
    expect(page.items).toEqual(["g"])
  })

  it("clamps a page number below one", () => {
    const page = paginate(items, 3, 0)

    expect(page.pageNumber).toBe(1)
    expect(page.items).toEqual(["a", "b", "c"])
  })

  it("puts everything on one page when the size covers the whole list", () => {
    const page = paginate(items, 50, 1)

    expect(page.pageCount).toBe(1)
    expect(page.items).toEqual(items)
  })

  it("rejects a page size that cannot produce pages", () => {
    // Un tamaño de cero produciría una división por cero y un pageCount
    // infinito; fallar acá es preferible a renderizar para siempre.
    expect(() => paginate(items, 0, 1)).toThrow()
    expect(() => paginate(items, -3, 1)).toThrow()
  })

  it("does not mutate the input list", () => {
    const original = [...items]
    paginate(items, 2, 2)

    expect(items).toEqual(original)
  })
})
