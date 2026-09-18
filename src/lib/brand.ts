export const brands = ["uam", "fia"] as const;

export type Brand = (typeof brands)[number];

export const defaultBrand: Brand = "uam";

/**
 * Active brand palette. Set NEXT_PUBLIC_BRAND=fia to switch the whole app to
 * the Facultad de Ingeniería palette. Falls back to UAM for any other value.
 */
export const brand: Brand = brands.includes(
  process.env.NEXT_PUBLIC_BRAND as Brand,
)
  ? (process.env.NEXT_PUBLIC_BRAND as Brand)
  : defaultBrand;
