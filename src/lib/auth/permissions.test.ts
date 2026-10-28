import { describe, expect, it } from "vitest";

import {
  canAssignRole,
  canCreateUsers,
  canImportCatalog,
  canManageCatalog,
  isCarreraScopedRole,
  rolesAsignablesPor,
  rolesQueCreanUsuarios,
  rolesQueGestionanCatalogo,
  rolesVisibles,
  rolesVisiblesPara,
} from "@/lib/auth/permissions";
import * as perms from "@/lib/auth/permissions";
import {
  coordinationScopeFor,
  type CoordinationScope,
} from "@/lib/intake/coordination-scope";
import type { RequestScope } from "@/lib/intake/request-scope";
import { ESTADOS_SOLICITUD, VISIBLE_STATES } from "@/lib/intake/states";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

const NO_COORDINATION: CoordinationScope = { kind: "none" };

const ALLOWED_PAIRS = new Set([
  "administrador:coordinacion",
  "coordinacion:secretaria",
  "secretaria:docente",
]);

const ALL_ROLE_PAIRS = rolesUsuario.flatMap((caller) =>
  rolesUsuario.map((target) => [caller, target] as const),
);

describe("rolesQueCreanUsuarios", () => {
  it("covers every role except estudiante and docente", () => {
    expect([...rolesQueCreanUsuarios].sort()).toEqual([
      "administrador",
      "coordinacion",
      "secretaria",
    ]);
  });
});

describe("canAssignRole", () => {
  it.each(ALL_ROLE_PAIRS)("caller %s -> target %s", (caller, target) => {
    const expected = ALLOWED_PAIRS.has(`${caller}:${target}`);
    expect(canAssignRole(caller, target)).toBe(expected);
  });

  it("denies an unknown target role for every caller", () => {
    for (const caller of rolesUsuario) {
      expect(canAssignRole(caller, "noSoyUnRol")).toBe(false);
    }
  });
});

describe("canCreateUsers", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "allows %s",
    (rol) => {
      expect(canCreateUsers(rol)).toBe(true);
    },
  );

  it.each(["docente", "estudiante"] as const)("denies %s", (rol) => {
    expect(canCreateUsers(rol)).toBe(false);
  });

  it("denies a missing caller role", () => {
    expect(canCreateUsers(undefined)).toBe(false);
  });
});

describe("canImportCatalog (CEI: Only secretaria may import)", () => {
  it("allows secretaria", () => {
    expect(canImportCatalog("secretaria")).toBe(true);
  });

  it.each([
    "administrador",
    "coordinacion",
    "docente",
    "estudiante",
    undefined,
  ] as const)("denies %s", (rol) => {
    expect(canImportCatalog(rol)).toBe(false);
  });

  it("tracks canAssignRole(rol, 'docente') for every role", () => {
    for (const rol of rolesUsuario) {
      expect(canImportCatalog(rol)).toBe(canAssignRole(rol, "docente"));
    }
  });
});

describe("rolesAsignablesPor", () => {
  it("returns an empty list for a missing caller role", () => {
    expect(rolesAsignablesPor(undefined)).toEqual([]);
  });
});

describe("single source of truth", () => {
  it("no longer exports the superseded module-policy names", () => {
    expect(perms).not.toHaveProperty("canManageUsers");
    expect(perms).not.toHaveProperty("rolesQueGestionanUsuarios");
  });
});

describe("rolesVisibles", () => {
  it("is total over every role", () => {
    expect(Object.keys(rolesVisibles).sort()).toEqual([...rolesUsuario].sort());
  });

  it.each(["administrador", "coordinacion"] as const)(
    "%s sees every role",
    (rol) => {
      expect([...rolesVisibles[rol]].sort()).toEqual([...rolesUsuario].sort());
    },
  );

  it("secretaria sees exactly docente, not administrador", () => {
    expect(rolesVisibles.secretaria).toEqual(["docente"]);
    expect(rolesVisibles.secretaria).not.toContain("administrador");
  });

  it.each(["docente", "estudiante"] as const)("%s sees nobody", (rol) => {
    expect(rolesVisibles[rol]).toEqual([]);
  });
});

describe("rolesVisiblesPara", () => {
  it("returns an empty list for a missing viewer role", () => {
    expect(rolesVisiblesPara(undefined)).toEqual([]);
  });

  it.each(["docente", "estudiante"] as const)(
    "returns an empty list for %s",
    (rol) => {
      expect(rolesVisiblesPara(rol)).toEqual([]);
    },
  );
});

describe("viewing right matches module access", () => {
  it("roles with a non-empty visibility row equal rolesQueCreanUsuarios", () => {
    const canSee = rolesUsuario.filter(
      (rol) => rolesVisiblesPara(rol).length > 0,
    );
    expect([...canSee].sort()).toEqual([...rolesQueCreanUsuarios].sort());
  });
});

describe("canFileRequests (justification-intake: only students file requests)", () => {
  it("allows estudiante", () => {
    expect(perms.canFileRequests("estudiante")).toBe(true);
  });

  it.each(["administrador", "coordinacion", "secretaria", "docente"] as const)(
    "denies %s",
    (rol) => {
      expect(perms.canFileRequests(rol)).toBe(false);
    },
  );

  it("denies a missing role", () => {
    expect(perms.canFileRequests(undefined)).toBe(false);
  });
});

describe("canManageOwnEnrollment (student-enrollment: derived from the requesting roles)", () => {
  it.each([...rolesUsuario, undefined] as const)(
    "matches canFileRequests for %s",
    (rol) => {
      expect(perms.canManageOwnEnrollment(rol)).toBe(
        perms.canFileRequests(rol),
      );
    },
  );

  it("allows only estudiante", () => {
    expect(perms.canManageOwnEnrollment("estudiante")).toBe(true);
    expect(perms.canManageOwnEnrollment(undefined)).toBe(false);
  });
});

describe("canReviewRequests (RN-15: only secretaria reviews)", () => {
  it("lists exactly secretaria as the reviewing role", () => {
    expect([...perms.rolesRevisores]).toEqual(["secretaria"]);
  });

  it("allows secretaria", () => {
    expect(perms.canReviewRequests("secretaria")).toBe(true);
  });

  it.each(["administrador", "coordinacion", "docente", "estudiante"] as const)(
    "denies %s",
    (rol) => {
      expect(perms.canReviewRequests(rol)).toBe(false);
    },
  );

  it("denies a missing role", () => {
    expect(perms.canReviewRequests(undefined)).toBe(false);
  });
});

describe("canViewDocument (SR-12: owner, or staff in facultad scope)", () => {
  const OWNER = 7;
  const FACULTAD_A = 3;
  const FACULTAD_B = 4;
  const SCOPE_A: RequestScope = { kind: "facultad", facultadId: FACULTAD_A };
  const NONE: RequestScope = { kind: "none" };

  function doc(overrides: Record<string, unknown> = {}) {
    return {
      estudianteId: OWNER,
      estudianteFacultadId: FACULTAD_A as number | null,
      estudianteCarreraId: 9 as number | null,
      solicitudEstado: "pendiente" as string,
      retiradoEn: null as Date | null,
      tieneEscalamientoAbierto: false,
      ...overrides,
    };
  }

  describe("owning student", () => {
    it("is allowed in any request state, drafts included", () => {
      expect(ESTADOS_SOLICITUD.length).toBeGreaterThan(0);
      for (const solicitudEstado of ESTADOS_SOLICITUD) {
        expect(
          perms.canViewDocument(
            { id: OWNER, rol: "estudiante" },
            doc({ solicitudEstado }),
            NONE,
          ),
        ).toBe(true);
      }
    });

    it("is allowed without a facultad (student with no carrera)", () => {
      expect(
        perms.canViewDocument(
          { id: OWNER, rol: "estudiante" },
          doc({ estudianteFacultadId: null }),
          NONE,
        ),
      ).toBe(true);
    });

    it("denies another student", () => {
      expect(
        perms.canViewDocument({ id: 8, rol: "estudiante" }, doc(), NONE),
      ).toBe(false);
    });
  });

  describe("secretaria", () => {
    const viewer = { id: 20, rol: "secretaria" } as const;

    it.each(VISIBLE_STATES)(
      "is allowed in scope for the visible state %s",
      (solicitudEstado) => {
        expect(
          perms.canViewDocument(viewer, doc({ solicitudEstado }), SCOPE_A),
        ).toBe(true);
      },
    );

    it("is denied for a borrador even in scope", () => {
      expect(
        perms.canViewDocument(
          viewer,
          doc({ solicitudEstado: "borrador" }),
          SCOPE_A,
        ),
      ).toBe(false);
    });

    it("is denied for another facultad", () => {
      expect(
        perms.canViewDocument(
          viewer,
          doc({ estudianteFacultadId: FACULTAD_B }),
          SCOPE_A,
        ),
      ).toBe(false);
    });

    it("is denied when the student has no facultad", () => {
      expect(
        perms.canViewDocument(
          viewer,
          doc({ estudianteFacultadId: null }),
          SCOPE_A,
        ),
      ).toBe(false);
    });

    it("is denied with the none scope (secretaria without facultad)", () => {
      expect(perms.canViewDocument(viewer, doc(), NONE)).toBe(false);
    });

    it("does not read as the owner when the id matches the student", () => {
      expect(
        perms.canViewDocument(
          { id: OWNER, rol: "secretaria" },
          doc({ estudianteFacultadId: FACULTAD_B }),
          SCOPE_A,
        ),
      ).toBe(false);
    });
  });

  it.each(["coordinacion", "administrador", "docente"] as const)(
    "denies %s in every scope, even with the matching facultad or owner id",
    (rol) => {
      expect(perms.canViewDocument({ id: 20, rol }, doc(), SCOPE_A)).toBe(
        false,
      );
      expect(perms.canViewDocument({ id: OWNER, rol }, doc(), SCOPE_A)).toBe(
        false,
      );
    },
  );

  describe("coordinacion (RNF-01, ES-9: only while an escalation of its career is open)", () => {
    const viewer = { id: 30, rol: "coordinacion" } as const;
    const CARRERA: CoordinationScope = { kind: "carrera", carreraId: 9 };
    const escalated = (overrides: Record<string, unknown> = {}) =>
      doc({
        solicitudEstado: "en_revision_coordinacion",
        tieneEscalamientoAbierto: true,
        ...overrides,
      });
    const allowed = (
      d: ReturnType<typeof doc>,
      c: CoordinationScope = CARRERA,
    ) => perms.canViewDocument(viewer, d, NONE, c);

    it("is allowed for a current document of an escalated request of its career", () => {
      expect(allowed(escalated())).toBe(true);
    });

    it("is allowed with a facultad scope of none: the secretary scope plays no part", () => {
      expect(perms.canViewDocument(viewer, escalated(), NONE, CARRERA)).toBe(
        true,
      );
      expect(perms.canViewDocument(viewer, escalated(), SCOPE_A, CARRERA)).toBe(
        true,
      );
    });

    it.each([
      ["answered and back in pendiente", { solicitudEstado: "pendiente" }],
      [
        "aprobada with a notice but no open suspicion",
        { solicitudEstado: "aprobada", tieneEscalamientoAbierto: false },
      ],
      [
        "aprobada even if an escalation flag leaked",
        { solicitudEstado: "aprobada" },
      ],
      [
        "in coordination without an open escalation",
        { tieneEscalamientoAbierto: false },
      ],
      ["a retired document", { retiradoEn: new Date("2026-10-07T10:00:00Z") }],
      ["another career", { estudianteCarreraId: 10 }],
      ["a student without a career", { estudianteCarreraId: null }],
      ["a borrador", { solicitudEstado: "borrador" }],
    ])("is denied for %s", (_label, overrides) => {
      expect(allowed(escalated(overrides))).toBe(false);
    });

    it("is denied with the none coordination scope (no career, inactive)", () => {
      expect(allowed(escalated(), NO_COORDINATION)).toBe(false);
      expect(perms.canViewDocument(viewer, escalated(), SCOPE_A)).toBe(false);
    });

    it("never reads as the owner when the id matches the student", () => {
      expect(
        perms.canViewDocument(
          { id: OWNER, rol: "coordinacion" },
          escalated({ estudianteCarreraId: 10 }),
          NONE,
          CARRERA,
        ),
      ).toBe(false);
    });

    it.each(["secretaria", "estudiante", "docente", "administrador"] as const)(
      "gives %s nothing from a coordination scope",
      (rol) => {
        expect(
          perms.canViewDocument({ id: 99, rol }, escalated(), NONE, CARRERA),
        ).toBe(false);
      },
    );
  });
});

describe("canCoordinate (ES-9, RNF-01: only coordinacion answers an escalation)", () => {
  it("lists exactly coordinacion as the coordinating role", () => {
    expect([...perms.rolesCoordinadores]).toEqual(["coordinacion"]);
  });

  it("allows coordinacion", () => {
    expect(perms.canCoordinate("coordinacion")).toBe(true);
  });

  it.each(["administrador", "secretaria", "docente", "estudiante"] as const)(
    "denies %s",
    (rol) => {
      expect(perms.canCoordinate(rol)).toBe(false);
    },
  );

  it("denies a missing role", () => {
    expect(perms.canCoordinate(undefined)).toBe(false);
  });
});

// The access matrix of the user-roles delta. A coordinator surface needs the
// coordinating role AND a scope on the request's career; a secretary surface
// (tabs, escalate, report, resend) needs the reviewing role. A coordinator can
// never call a decision action: that guard is `rolesRevisores`.
describe("escalation access matrix (RNF-01)", () => {
  type Caller = {
    label: string;
    rol: RolUsuario | undefined;
    carreraId: number | null;
  };
  const REQUEST_CAREER = 9;
  const rows: readonly [Caller, boolean, boolean][] = [
    [
      { label: "coordinacion, own career", rol: "coordinacion", carreraId: 9 },
      true,
      false,
    ],
    [
      {
        label: "coordinacion, other career",
        rol: "coordinacion",
        carreraId: 10,
      },
      false,
      false,
    ],
    [
      {
        label: "coordinacion without career",
        rol: "coordinacion",
        carreraId: null,
      },
      false,
      false,
    ],
    [
      { label: "secretaria in scope", rol: "secretaria", carreraId: null },
      false,
      true,
    ],
    [{ label: "estudiante", rol: "estudiante", carreraId: 9 }, false, false],
    [{ label: "docente", rol: "docente", carreraId: 9 }, false, false],
    [
      { label: "administrador", rol: "administrador", carreraId: 9 },
      false,
      false,
    ],
    [{ label: "anonymous", rol: undefined, carreraId: null }, false, false],
  ];

  it.each(rows)(
    "%j: coordinator surface %s, secretary surface %s",
    (caller, coordinatorSurface, secretarySurface) => {
      const scope = caller.rol
        ? coordinationScopeFor(caller.rol, {
            carreraId: caller.carreraId,
            activo: true,
          })
        : NO_COORDINATION;
      const coordinator =
        perms.canCoordinate(caller.rol) &&
        scope.kind === "carrera" &&
        scope.carreraId === REQUEST_CAREER;

      expect(coordinator).toBe(coordinatorSurface);
      expect(perms.canReviewRequests(caller.rol)).toBe(secretarySurface);
    },
  );

  it("keeps the decision actions out of the coordinator's reach", () => {
    expect(perms.rolesRevisores).not.toContain("coordinacion");
    expect(perms.canReviewRequests("coordinacion")).toBe(false);
  });
});

describe("canManageCatalog (CM-ACC-1: role matrix)", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "allows %s",
    (rol) => {
      expect(canManageCatalog(rol)).toBe(true);
    },
  );

  it.each(["docente", "estudiante"] as const)("denies %s", (rol) => {
    expect(canManageCatalog(rol)).toBe(false);
  });

  it("is derived from canCreateUsers for every role, not a second list", () => {
    for (const rol of rolesUsuario) {
      expect(canManageCatalog(rol)).toBe(canCreateUsers(rol));
    }
  });

  it("denies a missing role", () => {
    expect(canManageCatalog(undefined)).toBe(false);
  });
});

describe("rolesQueGestionanCatalogo", () => {
  it("equals rolesUsuario filtered by canManageCatalog", () => {
    expect(rolesQueGestionanCatalogo).toEqual(
      rolesUsuario.filter(canManageCatalog),
    );
  });
});

describe("isCarreraScopedRole", () => {
  it.each(rolesUsuario)("%s", (rol) => {
    expect(isCarreraScopedRole(rol)).toBe(rol === "coordinacion");
  });

  it("is false for a missing role", () => {
    expect(isCarreraScopedRole(undefined)).toBe(false);
  });
});
