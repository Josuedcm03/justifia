# Plantilla para iniciar un change con SDD

`/gentle-sdd-new` recibe solo el nombre del change. El contexto va en un mensaje previo, en la misma sesión.

## Antes de empezar

Crear la rama del change desde `main` actualizado:

```text
git switch main
git pull
git switch -c feat/<nombre-del-change>
```

## Mensaje 1: contexto

```text
Contexto para el change <nombre-del-change>; todavía no hagas nada.

- Roadmap: fila #<N> de docs/roadmap.md.
- Cubre: <RF-xx, RF-yy>; <RN-xx a RN-yy>; <RNF-xx> (docs/requirements.md).
- Fuera de alcance: <changes del roadmap que cubren el resto>.
- Depende de: <change o integrante> para <dato concreto>; estado: <listo / en curso>.
- Decisiones abiertas: <lista corta>.
```

## Mensaje 2: comando

```text
/gentle-sdd-new <nombre-del-change>
```

## Ejemplo: `justification-intake`

```text
Contexto para el change justification-intake; todavía no hagas nada.

- Roadmap: fila #1 de docs/roadmap.md.
- Cubre: RF-01 a RF-04; RN-01 a RN-06, RN-21, RN-22; RNF-11 (docs/requirements.md).
- Fuera de alcance: secretary-review, teacher-remission, document-extraction y validation-signals.
- Depende de: catalog-schedule (Josué) para los horarios por grupo de RN-22; estado: en curso.
- Decisiones abiertas: dónde se guardan los archivos de respaldo, cómo se valida su formato
  real en el servidor, y el modelo de la solicitud con los estados de RN-16.
```

```text
/gentle-sdd-new justification-intake
```
