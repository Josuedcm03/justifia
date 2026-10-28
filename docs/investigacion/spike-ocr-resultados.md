# Spike: resultados de OCR y extracción (`document-extraction`)

> Fecha: 2026-10-21 · Estado: spike cerrado, sin change abierto.
> Change del roadmap: #4 `document-extraction` (RF-11, RNF-03).
> Relacionados: [`ocr-document-extraction.md`](./ocr-document-extraction.md),
> [`modelos-vlm-extraccion.md`](./modelos-vlm-extraccion.md),
> [`nuextract3-instalacion.md`](./nuextract3-instalacion.md).

## Muestra

9 documentos reales, sin anonimizar, guardados solo en local en
`docs/utils/ocr docs/` (ignorado por git). Los scripts y las salidas crudas
están en `docs/utils/ocr-spike/`. Este documento no reproduce datos
personales.

| Tipo | Cantidad |
|---|---|
| Constancia médica manuscrita (con membrete impreso) | 2 |
| PDF de solicitud con un recetario médico escaneado adjunto | 1 |
| Carta de la UAM con campos manuscritos | 2 |
| Informe de matrícula (captura impresa) | 2 |
| Formulario de solicitud mayormente manuscrito | 1 |
| HEIC (formato no admitido por el sistema) | 1 |

## Motores probados

| Motor | Configuración |
|---|---|
| Tesseract | tesseract.js 7, modelo `spa` 4.0.0_best_int local, `sharp` para orientar y escalar, `unpdf` para la capa de texto de los PDF |
| NuExtract3 4B | `Q4_K_M` + `mmproj` BF16, llama.cpp `server-cuda` en Docker, RTX 3050 6 GB; plantilla de RF-11 vía `chat_template_kwargs` |

## Resultados por campo de RF-11

| Campo | Tesseract | NuExtract3 (sin razonamiento) |
|---|---|---|
| Emisor | Bien cuando está impreso | Bien en todos los documentos, incluido el recetario dentro del PDF |
| Fecha de emisión | Solo si está impresa | Bien en 7 de 8; falló una manuscrita difícil |
| Período de reposo | Nunca (siempre manuscrito) | Correcto en la constancia con reposo («72 hrs (3 días)» → 3 días) |
| Nombre del estudiante | Nunca si es manuscrito | Bien en letra clara; adivina en letra difícil |

Tiempos de NuExtract3 en la GPU: 2–5 s por imagen, 15 s para un PDF de 3
páginas; ~5,1 GB de VRAM.

## Fallas observadas en NuExtract3

1. **Reposo inventado:** en documentos sin reposo copia la fecha del documento
   en `rest_from`.
2. **Años completados:** un año escrito «202_» volvió como `2022`.
3. **Aritmética:** del 20 al 24 de julio devolvió 4 días (son 5).
4. **Nombres manuscritos difíciles:** devuelve un nombre verosímil pero
   incorrecto.

## Modo con razonamiento

Probado con `enable_thinking: true` y temperatura 0,6: de 3 a 4 veces más
lento (8–24 s por documento) y con más datos inventados (horas de atención
como período de reposo, un año erróneo, un reposo en un informe de
matrícula, el emisor equivocado en el PDF). Solo corrigió el cálculo de días.
**Se descarta.**

## Comparación con NuExtract 2.0 2B (2026-10-22)

Se probó un modelo más chico para reducir el uso de VRAM: `Q4_K_M` + `mmproj`
BF16 (2,3 GB en disco), mismo preprocesado y mismos campos, temperatura 0.

| Aspecto | NuExtract3 4B | NuExtract 2.0 2B |
|---|---|---|
| VRAM ocupada | ~4,2 GB; ~2,95 GB con el codificador de imagen en CPU (`--no-mmproj-offload`) | ~2,9–3,1 GB |
| Tiempo por imagen | 2–5 s | 1,5–2 s impresas; 6–8 s manuscritas |
| Constancia con reposo de 72 h | Fecha y reposo correctos | Año de emisión 1976, sin fechas de reposo, apellido equivocado |
| Recetario dentro del PDF | Emisor correcto | Devuelve la facultad como emisor |
| Constancia sin reposo | Sin reposo (correcto) | Inventa un reposo de 0 días con una hora |
| Reposo del 20 al 24 de julio | Fechas correctas, días mal calculados | Fecha de fin errónea (29 de julio) |

**Se descarta.** Falla justo en los documentos médicos manuscritos, que son
la razón del change, y no ahorra VRAM frente a NuExtract3 con el codificador
de imagen en CPU.

## Conclusiones para el change

1. **Go para NuExtract3 sin razonamiento** (temperatura 0,2) en imágenes y
   PDF escaneados. Los PDF con capa de texto se leen con `unpdf`.
2. **Validación propia:** aceptar un reposo solo si el documento trae fechas o
   una duración explícitas; calcular los días en código, no en el modelo.
3. **RF-14 y RN-24 siguen siendo necesarios** para los nombres manuscritos
   difíciles y los datos no reconocidos.
4. **Preprocesado:** orientar por EXIF y reducir las fotos grandes antes de
   enviarlas.
5. **Infraestructura pendiente:** el modelo necesita un servidor con GPU (o
   mucha RAM); no corre en una función de Vercel. Hay que decidir dónde vive y
   confirmar que cumple RNF-03 («propio entorno de ejecución»).
6. **Muestra chica:** 3 documentos médicos de 9. Conviene ampliarla durante
   el change para medir con más fundamento.

## Pendientes

- Decidir el hosting del servidor del modelo.
- Resolver las preguntas abiertas de `ocr-document-extraction.md` (cola,
  auditoría, reproceso en correcciones).
- Orden del roadmap: el #0 y el #3 siguen pendientes antes del #4.
- Abrir el change con `/sdd-new document-extraction` usando
  `docs/sdd-new-template.md`.
