```yaml
schema: gentle-ai.sdd-research/v1
request_ids: [request-consent-research-001]
revision: 1
status: done
admission:
  requested_classes: [documentation, open-web]
  observed_grants: [documentation, open-web]
accessed_at: 2026-10-20
sources_count: 4
```

# Research: request-consent (Ley 787 / Decreto 36-2012)

Not legal advice. UAM legal counsel must review before anything ships. Every
question has mapped claims; open gaps and contradictions are recorded below.

## Summary

- **Consent rules.** Consent must be free, unequivocal, specific and informed
  (Ley Art. 3(d)), given "por escrito o por otro medio idóneo, físico o
  electrónico" (Art. 6). In the digital setting the Reglamento accepts any
  mechanism that identifies the holder (Reglamento Art. 10 p2). An
  authenticated checkbox is plausibly valid; no authoritative ruling found.
- **Health data.** Sensitive data includes health (Art. 3(g)), needs consent
  (Art. 8(a)), and the Reglamento requires it to be express (Art. 7(c)). The
  holder may refuse to supply sensitive data (Art. 17).
- **Disclosure to teachers** is a cesión: prior consent, purpose and an
  identified recipient (Art. 13).
- **Transfer abroad.** Art. 14 prohibits transfers to countries without
  adequate protection, with no consent exception. No adequacy list or
  authority exists, so this stays unresolved.
- **Authority.** Created by Art. 28; secondary sources report it was never
  operational. Duties still apply; the proof burden is on the controller.
- **Draft v1 gaps.** Missing controller identity, revocation, ARCO rights,
  retention, the provider abroad, and express consent for health data.

## Sources

| ID | Class | Title | Publisher | URL | accessed_at | Excerpt |
|---|---|---|---|---|---|---|
| S1 | documentation | Ley 787 Ley de Protección de Datos Personales (La Gaceta 61, 29-03-2012) | Justia Nicaragua (republication) | http://nicaragua.justia.com/nacionales/leyes/ley-de-proteccion-de-datos-personales-mar-29-2012/gdoc/ | 2026-10-20 | Art. 6: «El consentimiento deberá ser otorgado por escrito o por otro medio idóneo, físico o electrónico. Dicho consentimiento podrá ser revocado sin efecto retroactivo». Art. 14: «Se prohíbe la cesión y transferencia de datos personales de cualquier tipo con países u organismos internacionales, que no proporcionen niveles de seguridad y protección adecuados». |
| S2 | documentation | Reglamento de la Ley 787, Decreto 36-2012 (La Gaceta 200, 19-10-2012) | Justia Nicaragua (republication) | http://nicaragua.justia.com/nacionales/decretos-ejecutivos/reglamento-de-la-ley-no-787-ley-de-proteccion-de-datos-personales-oct-19-2012/gdoc/ | 2026-10-20 | Art. 10 p2: «Tratándose del entorno digital, podrán utilizarse firma electrónica o cualquier mecanismo o procedimiento que al efecto se establezca y permita identificar al titular y recabar su consentimiento». |
| S3 | open-web | Data Protection in Nicaragua | DLA Piper | https://www.dlapiperdataprotection.com/index.html?c=NI&t=law | 2026-10-20 | The Directorate "has not been formally incorporated"; the registry does not exist in practice (page modified 2024-01-28). |
| S4 | open-web | Nicaragua, Ley 787 (2012), Governance Atlas | atlas.ayoadeabel.tech | https://atlas.ayoadeabel.tech/countries/nicaragua | 2026-10-20 | The Dirección was "created by law but never made operational" (preliminary research, Aug 2026). |

## Claims

### Q1 — Content and form of consent

- **C1.** Consent is "libre, inequívoca, específica e informada" (S1 Art.
  3(d)); the Reglamento defines free, specific (tied to determined purposes)
  and informed (holder knew the prior aviso informativo) (S2 Art. 4).
  Confidence high. [S1, S2]
- **C2.** Before collection the controller informs, "de forma expresa y
  clara": purpose and recipients; existence of the file and controller
  identity and domicile; whether answers are mandatory or optional, especially
  for sensitive data; consequences of supplying, refusing or giving inaccurate
  data; the access/rectification/cancellation rights; use only for the stated
  purposes; cancellation when no longer needed (S1 Art. 7(a)-(e),(g),(j)). The
  aviso informativo precedes processing (S2 Art. 14), is simple and clear (S2
  Art. 15), physical or electronic, with the proof burden on the controller
  (S2 Art. 16). Confidence high. [S1, S2]
- **C3.** Consent may be written or by another suitable physical or
  electronic means (S1 Art. 6); digitally, any mechanism that identifies the
  holder (S2 Art. 10); the controller offers a simple and free means (S2 Art.
  8). Confidence high on the text, medium on the inference that an
  authenticated checkbox qualifies. [S1, S2]
- **C4.** The controller bears the burden of proving consent and notice (S2
  Arts. 11, 16). Confidence high. [S2]
- **C5.** Tacit consent is the general rule; express consent is required for
  sensitive data, when a law requires it, and for financial data (S2 Arts.
  5-7). Confidence high. [S2]
- **C6.** Consent is not required to fulfil obligations of a legal
  relationship between holder and controller (S1 Art. 6(c)); this may cover
  core non-sensitive processing but not obviously sensitive data or the Art.
  13 cesión. Confidence medium. [S1, S2]

### Q2 — Sensitive and health data

- **C7.** Health data is sensitive (S1 Art. 3(g)); processing only for
  general-interest reasons set by law, with consent, or by court order (S1
  Art. 8(a)). Confidence high. [S1]
- **C8.** Express consent for sensitive data (S2 Art. 7(c)). Confidence high.
  [S2]
- **C9.** The holder may refuse to supply sensitive data (S1 Art. 17); the
  notice states whether such answers are mandatory or optional (S1 Art. 7(c)).
  Confidence medium. [S1]
- **C10.** Art. 7(l) prohibits files storing sensitive data "salvo lo
  dispuesto en la ley"; its interaction with Art. 8(a) is unclear. Confidence
  high on text, low on application. [S1]
- **C11.** Art. 8(b) on health data targets health providers and does not
  appear to govern a university. Confidence medium. [S1]
- **C12.** Data must be adequate, proportional and necessary for the purpose
  (S1 Art. 9), which supports minimizing what teachers receive. Confidence
  high. [S1]

### Q3 — Third parties and international transfer

- **C13.** Cesión (S1 Art. 3(c)) needs a related legitimate interest, the
  holder's prior consent, the purpose and the identified recipient (S1 Art.
  13). Confidence high. [S1]
- **C14.** Cesión consent is revocable; listed exceptions (law, State
  institutions, public health, dissociated data) do not clearly fit a private
  university (S1 Art. 13). Confidence medium. [S1]
- **C15.** International transfer to countries without adequate protection is
  prohibited; exceptions do not include consent; no adequacy list or issuing
  body found (S1 Art. 14). Confidence high on text, low on application to a
  mail provider. [S1]
- **C16.** The Ley does not define a processor ("encargado"), so a mail
  provider abroad may read literally as a cesionario. Confidence low. [S1]
- **C17.** The controller adopts security measures; lacking minimum security
  is a serious infraction (S1 Arts. 9, 11, 45(e)). Confidence high. [S1]

### Q4 — Retention, revocation, notice

- **C18.** Consent is revocable without retroactive effect (S1 Art. 6) through
  simple, free mechanisms at least by the same channel; the controller
  confirms cessation in writing and informs recipients (S2 Art. 12).
  Confidence high. [S1, S2]
- **C19a.** Data is cancelled when no longer needed, after a blocking period
  until the legal or contractual prescription term, then deleted (S1 Arts.
  7(j), 19; S2 Arts. 31-33). No numeric period; UAM must define it.
  Confidence high on the rule. [S1, S2]
- **C19b.** Rights are exercised in writing (S1 Art. 9); access answered in 10
  business days (S1 Art. 17), rectification-type requests in 5 (S1 Art.
  19(b)); rectification is free (S2 Art. 21). Confidence medium-high. [S1, S2]
- **C20.** Processing without required express consent and forms without the
  required notices are minor infractions (S1 Art. 44(a),(d)); obstructing
  rights and lacking security are serious (S1 Art. 45(b),(e)). Confidence
  medium-high. [S1]

### Q5 — Supervisory authority

- **C21.** The Dirección is created under the Ministerio de Hacienda y Crédito
  Público with advisory, sanctioning and registry functions; controllers
  register their files (S1 Arts. 22, 28, 29). Confidence high on text. [S1]
- **C22.** It was never made operational and the registry does not function;
  enforcement risk is low (S3, S4). Confidence medium (secondary). [S3, S4]
- **C23.** The practical remedy is judicial habeas data (S4). Confidence low.
  [S4]

### Q6 — Check of draft v1

- **C24.** Draft v1 states purpose, class of recipients, channel and possible
  health data. [S1 Arts. 7, 8, 13; S2 Arts. 4, 7]
- **C25.** Draft v1 lacks: controller identity (S1 Art. 7(b)); revocation (S1
  Arts. 6, 13; S2 Art. 12); rights (S1 Art. 7(e)); mandatory/optional
  statement (S1 Art. 7(c)); express health consent (S2 Art. 7(c)); the
  provider abroad (S1 Art. 13); retention; and its scope is broader than
  necessary (S1 Art. 9). Confidence medium-high. [S1, S2]

## Product choices (non-authoritative)

Proposed checkbox 1 (required):

«Acepto que la Universidad Americana (UAM), como responsable, trate los datos
personales que consigno en esta solicitud solo para tramitarla y atender sus
correcciones, y que la información necesaria para resolverla se envíe por
correo electrónico a los docentes de las asignaturas afectadas[, mediante un
proveedor de correo ubicado fuera de Nicaragua]. Puedo revocar mi
consentimiento en cualquier momento, sin efecto retroactivo, y ejercer mis
derechos de acceso, rectificación, cancelación y oposición. Ver aviso de
privacidad.»

Proposed checkbox 2 (optional, shown when attaching a document):

«Autorizo expresamente que la UAM trate los datos de salud que contengan mis
documentos de respaldo, solo para tramitar esta justificación. Entiendo que
son datos sensibles y que entregarlos es voluntario[, y que no se enviarán a
los docentes].»

Privacy notice facts: (1) controller name, domicile and contact (S1 Art.
7(b)); (2) existence of the file; (3) purpose and single use (S1 Art.
7(a),(g)); (4) recipients, including the mail provider and its country (S1
Arts. 7(a), 13); (5) data categories and that health data is sensitive (S1
Arts. 3(g), 8); (6) mandatory vs optional (S1 Art. 7(c)); (7) consequences of
providing, refusing or inaccurate data (S1 Art. 7(d)); (8) rights, channel,
written form and deadlines (S1 Arts. 7(e), 9, 17, 19; S2 Arts. 19-24); (9)
revocation mechanism and effect (S1 Art. 6; S2 Art. 12); (10) retention and
blocking then deletion (S2 Arts. 31-33); (11) security summary (S1 Arts. 9,
11); (12) complaint route (S2 Art. 13; S1 Art. 16); (13) cookies if any (S2
Art. 6 p5); (14) notice version and date, referenced by the consent record
(S2 Arts. 11, 16).

## Contradictions and uncertainty

- Art. 6(c) (no consent for a legal relationship) vs Art. 13 (prior consent
  for cesión): unclear whether the exception reaches teachers.
- Art. 7(l) (no sensitive-data files) vs Art. 8(a) (processing with consent):
  no interpretation found.
- Art. 14 has no consent exception, yet no adequacy criteria or authority
  exists.
- Authority status rests on two consistent secondary sources only.
- No source addresses checkbox consent directly.

## Freshness

- Ley and Reglamento text from Justia, not verified against La Gaceta.
- No reform of Ley 787 found for 2025-2026.
- S3 dated January 2024; S4 August 2026 (preliminary).

## Gaps

- Official sites unreachable (legislacion.asamblea.gob.ni refused; La Gaceta
  not reachable); some quotes are close excerpts, not guaranteed verbatim.
- Reglamento Arts. 19-27 and full Ley Arts. 17, 19 from partial fetches.
- No adequacy list, no processor definition, no case law on checkboxes.
- No numeric retention period; UAM academic-record rules not researched.
- The mail provider's hosting country was not assessed.

## Risks

- A single bundled checkbox may fail "specific" and express health consent.
- Emailing medical documents to teachers through a provider abroad is the
  highest-risk path (Arts. 13, 14).
- The consent record (user, timestamp, text version, notice version) carries
  the proof burden.
- Undefined retention conflicts with the cancellation duty.
