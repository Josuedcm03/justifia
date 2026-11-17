import { describe, expect, it } from "vitest";

import { filterQueueRows } from "@/app/(dashboard)/review/queue-search";

const rows = [
  {
    id: 1,
    estudianteNombre: "María López",
    estudianteCif: "21-0001",
    estudianteCarrera: "Medicina",
  },
  {
    id: 2,
    estudianteNombre: "Juan Pérez",
    estudianteCif: "21-0002",
    estudianteCarrera: "Derecho",
  },
  {
    id: 3,
    estudianteNombre: null,
    estudianteCif: null,
    estudianteCarrera: null,
  },
];

const ids = (q: string) => filterQueueRows(rows, q).map((row) => row.id);

describe("filterQueueRows", () => {
  it("returns every row, in order, for an empty term", () => {
    expect(ids("")).toEqual([1, 2, 3]);
  });

  it("matches the name ignoring case and accents", () => {
    expect(ids("maria")).toEqual([1]);
    expect(ids("PÉREZ")).toEqual([2]);
  });

  it("matches the CIF and the career", () => {
    expect(ids("21-0002")).toEqual([2]);
    expect(ids("medic")).toEqual([1]);
  });

  it("requires every word of the term to match", () => {
    expect(ids("juan derecho")).toEqual([2]);
    expect(ids("juan medicina")).toEqual([]);
  });
});
