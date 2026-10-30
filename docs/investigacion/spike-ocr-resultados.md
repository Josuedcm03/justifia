# Spike: resultados de OCR y extracción (`document-extraction`)

> Fecha: 2026-10-21 · Estado: spike cerrado, sin change abierto. Actualizado
> el 2026-10-23 con la medición en modo texto y las firmas de `unpdf`.
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

## Modo texto en PDF con capa de texto (DE-14, 2026-10-23)

Medición de la tarea 0.3 del change `document-extraction`. Se generaron 3 PDF
sintéticos con capa de texto, con datos ficticios (ningún documento real): una
constancia médica con reposo en rango de fechas, un certificado con reposo
expresado en horas y una constancia de matrícula de 2 páginas sin reposo. El
texto se extrajo con `unpdf` (`extractText`, una cadena por página, marcadores
de página, máximo 6.000 caracteres) y se envió como mensaje de texto al
contrato DE-8: NuExtract3 4B `Q4_K_M`, sin razonamiento, temperatura 0,2,
`max_tokens` 512. Se hicieron 2 corridas por documento (6 en total). Fecha de
referencia de la ventana: 2026-10-22. La comprobación «aparece en el texto»
aplica las reglas de DE-10 (sin distinguir mayúsculas, acentos ni espacios;
una fecha cuenta si el texto trae día, mes y año en forma numérica o larga).
Tiempo: 2,2 a 3,1 s por documento con el servidor ya caliente.

| Documento | Corrida | Nombre | Emisor | Fecha de emisión | Período de reposo |
|---|---|---|---|---|---|
| Constancia con rango | 1 | correcto, aparece | correcto (membrete), aparece | correcta, aparece | correcto (fechas y 3 días), aparece |
| Constancia con rango | 2 | correcto, aparece | **incorrecto**: devuelve al médico que firma; aparece | correcta, aparece | correcto, aparece |
| Certificado en horas | 1 | correcto, aparece | **incorrecto**: devuelve al médico que firma; aparece | correcta (`08/10/2026`), aparece | sin fechas; `rest_days` = 48 (las horas como días; lo correcto es 2) |
| Certificado en horas | 2 | correcto, aparece | **incorrecto**: devuelve al médico que firma; aparece | correcta, aparece | igual a la corrida 1 |
| Matrícula, 2 páginas | 1 | correcto, aparece | correcto, aparece | correcta, aparece | sin fechas; `rest_days` = 30 **inventado** (vigencia de la constancia) |
| Matrícula, 2 páginas | 2 | correcto, aparece | correcto, aparece | correcta, aparece | **inventado**: `rest_from` = fecha de emisión, `rest_to` = 30 días después (no aparece en el texto), `rest_days` = 30 |

Resumen por campo (6 corridas):

| Campo | Correcto | Aparece en el texto | Observación |
|---|---|---|---|
| Nombre del estudiante | 6 de 6 | 6 de 6 | |
| Fecha de emisión | 6 de 6 | 6 de 6 | Formatos `15 de octubre de 2026`, `08/10/2026` y `30 de septiembre de 2026` |
| Emisor | 3 de 6 (constancia 1 de 2, certificado 0 de 2, matrícula 2 de 2) | 6 de 6 | Los 3 errores son el nombre del médico que firma, que sí figura en el texto |
| Período de reposo | 2 de 6 | n/a | Horas devueltas como días en 2 corridas; reposo inventado en 2 corridas |

**Gate de DE-14** (emisor y fecha de emisión correctos y con «aparece en el
texto» en cada muestra): **FAIL**. La fecha cumple en todas las corridas, pero
el emisor falla en 2 de las 3 muestras. La comprobación «aparece en el texto»
no lo detecta: verifica presencia, no el papel que cumple el valor en el
documento (membrete frente a firma), y los documentos con membrete y firma son
lo habitual.

Consecuencia (decisión del 2026-10-22): los PDF con capa de texto siguen la
ruta de imagen, igual que los escaneados, y no se construye un extractor por
reglas. Las tareas `[TEXT PATH]` del change se descartan. La ruta de imagen del
spike del 2026-10-21 dio el emisor correcto en todos los documentos, incluido
el recetario dentro del PDF.

Notas para el change:

1. El reposo inventado se repite (fallas 1 y 3 de arriba) y aquí también
   aparece una duración sin fechas inventada (`rest_days` = 30). En la ruta de
   imagen no hay comprobación contra el texto, así que la validación en código
   por sí sola acepta una duración sin fechas; RF-14 y RN-24 siguen siendo
   necesarios.
2. Muestra chica (3 documentos sintéticos, 2 corridas cada uno). Los scripts y
   los PDF generados quedaron fuera del repositorio.

## Firmas de unpdf (tarea 0.4, 2026-10-23)

Versiones confirmadas: `unpdf` 1.9.1 (última publicada en npm a esta fecha;
Node >= 22), `@napi-rs/canvas` 1.0.13 (par opcional de `unpdf`:
`^0.1.69 || ^1.0.0`) y `sharp` 0.35.5. Fuente: las definiciones de tipos
instaladas en `docs/utils/ocr-spike/node_modules/unpdf/dist/index.d.mts` y una
ejecución en Node 24 con un PDF sintético (la herramienta de documentación
context7 no estuvo disponible en la sesión).

```ts
getDocumentProxy(data: DocumentInitParameters["data"], options?: DocumentInitParameters): Promise<PDFDocumentProxy>

extractText(data | PDFDocumentProxy, options?: { mergePages?: false }): Promise<{ totalPages: number; text: string[] }>
extractText(data | PDFDocumentProxy, options: { mergePages: true }): Promise<{ totalPages: number; text: string }>

renderPageAsImage(
  data | PDFDocumentProxy,
  pageNumber: number, // desde 1
  options?: {
    canvasImport?: () => Promise<typeof import("@napi-rs/canvas")>;
    scale?: number; // por defecto 1.0
    width?: number;
    height?: number;
    toDataURL?: false;
  },
): Promise<ArrayBuffer> // PNG; con `toDataURL: true` devuelve Promise<string>
```

Comportamiento observado:

- **Forma de llamada de DE-9 confirmada:** `renderPageAsImage(bytes, n, {
  canvasImport: () => import("@napi-rs/canvas") })`. En Node, `canvasImport`
  es obligatorio.
- **Tamaño de salida** (página A4): escala 1 = 595×842; `scale: 2` = 1190×1684;
  `width: 1600` = 1600×2264. Conviene pedir `width: 1600` y dejar que el paso
  de `sharp` (sin ampliar, JPEG q85) fije el formato final.
- **El buffer de entrada se transfiere:** tras `getDocumentProxy(bytes)` o
  `renderPageAsImage(bytes, …)` el `Uint8Array` queda con longitud 0. Hay que
  pasar `bytes.slice()` en cada llamada o crear un único `PDFDocumentProxy` y
  reutilizarlo (ambas funciones lo aceptan).
- **Caché de módulo:** `unpdf` guarda el resultado de un `canvasImport` que
  tuvo éxito; uno que rechaza no se guarda y el error se propaga en esa
  llamada. El test de `render_unavailable` (tarea 4.8) debe correr antes de
  cualquier render exitoso en la misma instancia del módulo (usar un archivo de
  test aparte o `vi.resetModules()`).
- **Bytes que no son PDF:** `getDocumentProxy` rechaza con
  `InvalidPDFException` («Invalid PDF structure.»), que se mapea a
  `unreadable_document`.
- **Ajuste a las tareas de la fase 5:** ninguno en la forma de llamada. Con la
  ruta de texto descartada, todo PDF se renderiza: el preparador usa
  `getDocumentProxy` una vez para contar páginas y luego `renderPageAsImage`
  sobre el mismo proxy para las páginas 1 a `min(numPages, 5)`; `extractText`
  deja de usarse.

## Conclusiones para el change

1. **Go para NuExtract3 sin razonamiento** (temperatura 0,2) en imágenes y
   PDF escaneados. Los PDF con capa de texto se leen con `unpdf`
   (actualización 2026-10-23: la medición en modo texto no pasó el gate de
   DE-14; en el change esos PDF van por la ruta de imagen).
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
