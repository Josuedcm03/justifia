import "server-only";

import { asc, desc, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { ListSort, SortDir } from "@/lib/list-params";

/**
 * The single place the sort collation is written (design decision 4, gate S1:
 * `es-x-icu` exists on the database). If it were ever missing, this is the
 * one line to change, together with `collatedText` below (`lower(column)`).
 * A constant, never user input: it is inlined with `sql.raw`.
 */
export const TEXT_SORT_COLLATION = "es-x-icu";

/** One ordering term for a sortable column, direction included. */
export type SortExpr = (dir: SortDir) => SQL;

function directed(expr: SQL | AnyColumn, dir: SortDir): SQL {
  return dir === "asc" ? asc(expr) : desc(expr);
}

/** Person names and logins: Spanish-aware, so accents sort with their base
 *  letter and case does not decide. */
export function collatedText(column: AnyPgColumn): SortExpr {
  const collated = sql`${column} collate ${sql.raw(`"${TEXT_SORT_COLLATION}"`)}`;
  return (dir) => directed(collated, dir);
}

/** Codes and dates: the plain column under the database default. */
export function plainColumn(column: AnyPgColumn): SortExpr {
  return (dir) => directed(column, dir);
}

/** An empty or missing e-mail is not the largest value: it sorts last in
 *  BOTH directions. */
export function emailLast(column: AnyPgColumn): SortExpr {
  const normalized = sql`nullif(${column}, '')`;
  return (dir) => sql`${directed(normalized, dir)} nulls last`;
}

/** `asc` means active first, so the boolean runs in reverse. */
export function activeFirst(column: AnyPgColumn): SortExpr {
  return (dir) => directed(column, dir === "asc" ? "desc" : "asc");
}

/**
 * The ORDER BY terms for a list: the chosen key, then the list's default key
 * in its default direction (when it is not the chosen one), then the record
 * id in the direction of the chosen key so no row is skipped or repeated
 * across pages (DT-SORT-1).
 *
 * The sort key is only a lookup into a fixed server-side map; it is never
 * interpolated. A key without an own entry in the map (the parser already
 * narrows it, this is defence in depth) yields the list's default pair.
 */
export function orderByFor<K extends string>(
  map: Record<K, SortExpr>,
  sort: ListSort<K>,
  fallback: ListSort<K>,
  id: AnyPgColumn,
): SQL[] {
  const chosen = Object.hasOwn(map, sort.key) ? sort : fallback;
  const terms = [map[chosen.key](chosen.dir)];
  if (chosen.key !== fallback.key) {
    terms.push(map[fallback.key](fallback.dir));
  }
  terms.push(directed(id, chosen.dir));
  return terms;
}
