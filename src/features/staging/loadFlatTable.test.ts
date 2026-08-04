import { describe, expect, it } from "vitest"

import type { Row } from "@/domain"

import { loadFlatTable } from "./loadFlatTable"
import type { Result } from "./result"
import { err, ok } from "./result"
import type { StagedTable, StagingError, StagingPort } from "./stagingPort"
import { parseStagingSchemaName, type StagingSchemaName } from "./stagingSchemaName"

function requireSchema(candidate: string): StagingSchemaName {
  const result = parseStagingSchemaName(candidate)
  if (!result.ok) {
    throw new Error("expected a valid schema name in this fixture")
  }
  return result.value
}

const SCHEMA = requireSchema("staging_test")

/** A hand-written in-memory fake of `StagingPort` — no `pg`, no network. */
class FakeStagingPort implements StagingPort {
  public resetSchemaCalls = 0
  public runScriptCalls: string[] = []

  constructor(
    private readonly resetResult: Result<void, StagingError> = ok(undefined),
    private readonly runScriptResult: Result<void, StagingError> = ok(undefined),
    private readonly discoverResult: Result<StagedTable, StagingError> = ok({
      tableName: "customers",
      columns: [{ name: "id", sqlType: "integer", nullable: false }],
    }),
    private readonly readRowsResult: Result<readonly Row[], StagingError> = ok([
      { id: 1 },
      { id: 2 },
    ]),
  ) {}

  async resetSchema(): Promise<Result<void, StagingError>> {
    this.resetSchemaCalls += 1
    return this.resetResult
  }

  async runScript(_schema: StagingSchemaName, sql: string): Promise<Result<void, StagingError>> {
    this.runScriptCalls.push(sql)
    return this.runScriptResult
  }

  async discoverCreatedTable(): Promise<Result<StagedTable, StagingError>> {
    return this.discoverResult
  }

  async readRows(): Promise<Result<readonly Row[], StagingError>> {
    return this.readRowsResult
  }
}

describe("loadFlatTable", () => {
  it("resets the schema, runs the script, then assembles a FlatTable from the discovered table and rows", async () => {
    const port = new FakeStagingPort()

    const result = await loadFlatTable(port, SCHEMA, "CREATE TABLE customers (id int);")

    expect(port.resetSchemaCalls).toBe(1)
    expect(port.runScriptCalls).toEqual(["CREATE TABLE customers (id int);"])
    expect(result).toEqual({
      ok: true,
      value: {
        name: "customers",
        columns: [{ name: "id", sqlType: "integer", nullable: false }],
        rows: [{ id: 1 }, { id: 2 }],
      },
    })
  })

  it("short-circuits and returns the error when resetSchema fails", async () => {
    const failure = err<StagingError>({ kind: "connection-failed", message: "refused" })
    const port = new FakeStagingPort(failure)

    const result = await loadFlatTable(port, SCHEMA, "SELECT 1;")

    expect(result).toEqual(failure)
    expect(port.runScriptCalls).toEqual([])
  })

  it("short-circuits and returns the error when runScript fails", async () => {
    const failure = err<StagingError>({ kind: "script-execution-failed", message: "syntax error" })
    const port = new FakeStagingPort(ok(undefined), failure)

    const result = await loadFlatTable(port, SCHEMA, "not sql at all")

    expect(result).toEqual(failure)
  })

  it("short-circuits and returns the error when discoverCreatedTable fails", async () => {
    const failure = err<StagingError>({ kind: "no-table-created" })
    const port = new FakeStagingPort(ok(undefined), ok(undefined), failure)

    const result = await loadFlatTable(port, SCHEMA, "SELECT 1;")

    expect(result).toEqual(failure)
  })

  it("short-circuits and returns the error when readRows fails", async () => {
    const failure = err<StagingError>({ kind: "read-failed", message: "connection reset" })
    const port = new FakeStagingPort(
      ok(undefined),
      ok(undefined),
      ok({ tableName: "customers", columns: [] }),
      failure,
    )

    const result = await loadFlatTable(port, SCHEMA, "SELECT 1;")

    expect(result).toEqual(failure)
  })
})
