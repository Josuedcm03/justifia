# Investigación: modelos de visión locales para la extracción de documentos

> Fecha: 2026-10-21 · Estado: investigación previa, sin change abierto.
> Change del roadmap: #4 `document-extraction` (RF-11, RNF-03).
> Continúa [`ocr-document-extraction.md`](./ocr-document-extraction.md), sección 9 (nivel 4).

## Índice

1. [Por qué hace falta](#1-por-qué-hace-falta)
2. [Qué buscamos en el modelo](#2-qué-buscamos-en-el-modelo)
3. [Candidatos](#3-candidatos)
4. [Pros y contras](#4-pros-y-contras)
5. [Recomendación](#5-recomendación)
6. [Cómo probarlo](#6-cómo-probarlo)
7. [Riesgos](#7-riesgos)
8. [Fuentes](#8-fuentes)

---

## 1. Por qué hace falta

El spike con Tesseract (2026-10-21) se corrió sobre 9 documentos reales de
muestra (guardados fuera del repositorio, en `docs/utils/`, que está en
`.gitignore` por contener datos personales). Resultado por tipo:

| Tipo de documento | Muestras | Resultado con Tesseract |
|---|---|---|
| PDF digital | 1 | Texto exacto en ~100 ms con `unpdf`, sin OCR |
| Captura impresa (informe de matrícula) | 2 | Bien, ~2 s, errores menores en códigos |
| Carta de la UAM con campos manuscritos | 2 | Lo impreso bien; lo manuscrito ilegible |
| Constancia médica | 2 | Emisor (membrete impreso) bien; fecha, nombre y reposo manuscritos, nada |
| Formulario mayormente manuscrito | 1 | Ilegible |
| HEIC | 1 | No se pudo leer (formato no admitido por el sistema) |

Por campo de RF-11: el **emisor** se obtiene de forma fiable; la **fecha** solo
cuando está impresa; el **período de reposo** y el **nombre** no se
recuperaron en ningún documento manuscrito. En las constancias médicas esos
datos casi siempre están escritos a mano.

Conclusión: Tesseract sirve para documentos impresos y digitales; para el
manuscrito hace falta un modelo de visión (VLM).

## 2. Qué buscamos en el modelo

| Criterio | Por qué |
|---|---|
| Lee manuscrito en español | Es el caso común en las constancias médicas |
| Ligero: 4B parámetros o menos, cuantizado en ≤ 4 GB | Correr en un servidor propio modesto, idealmente sin GPU |
| Extracción estructurada (imagen → JSON con un esquema) | RF-11 pide cuatro campos concretos, no una transcripción |
| No inventa datos | Un VLM puede «alucinar» una fecha verosímil |
| Licencia que permita uso en producción | Apache 2.0 o MIT; evitar licencias de investigación o no comerciales |
| Fácil de servir (Ollama, llama.cpp o vLLM) | El equipo es chico; nada de entrenamiento propio |

## 3. Candidatos

| Modelo | Tamaño | Tipo | Licencia | Servido con |
|---|---|---|---|---|
| **NuExtract3** (NuMind, may. 2026) | 4B (base Qwen3.5-4B) | Extracción estructurada + OCR | Apache 2.0 | vLLM; Ollama según guías de terceros |
| **Qwen3.5** (Alibaba, mar. 2026) | 0.8B / 2B / 4B | VLM general | Apache 2.0 | Ollama (`qwen3.5:2b`, `qwen3.5:4b`) |
| **Qwen3-VL** (Alibaba, oct. 2025) | 2B (1,9 GB) / 4B (3,3 GB) / 8B | VLM general | Apache 2.0 | Ollama (`qwen3-vl:2b`, `qwen3-vl:4b`) |
| **PaddleOCR-VL 1.5** (Baidu) | 0.9B | OCR especializado | Apache 2.0 | PaddleOCR (Python), vLLM |
| **LightOnOCR-3** (LightOn) | 0.8B / 1B / 4B | OCR especializado | Apache 2.0 | Ollama (builds de la comunidad) |
| **Nanonets-OCR2** | 3B | OCR especializado | Apache 2.0 según terceros (verificar) | GGUF de la comunidad |
| **Gemma 4** (Google, abr. 2026) | E2B / E4B | VLM general | Gemma Terms of Use | Ollama (`gemma4:e2b`, `gemma4:e4b`) |
| **NuExtract 2.0** (NuMind, 2025) | 2B (base Qwen2-VL-2B) | Extracción estructurada | MIT | GGUF oficial |

## 4. Pros y contras

### NuExtract3 4B

**Pros**
- Hecho exactamente para esto: se le pasa la imagen y una plantilla JSON con los campos, y devuelve los valores. No hace falta escribir reglas de parsing.
- Tipos de campo como `verbatim-string`, que obligan a devolver texto presente en el documento: la mejor mitigación disponible contra la alucinación.
- Según su propio benchmark de extracción estructurada, supera a modelos generales del mismo tamaño (65,2 frente a 53,8 de Gemma 4 4B y 50,7 de Qwen3.5 4B).
- Apache 2.0. Razonamiento activable: se puede apagar para ganar velocidad.

**Contras**
- Benchmarks reportados por el propio fabricante, no independientes.
- Pesa ~9,3 GB en safetensors; la disponibilidad oficial de GGUF/Ollama no está verificada. En CPU puede ser lento.
- NuMind dice que el manuscrito «a veces es un desafío» (lo dijo de la versión 2.0; no hay datos de la 3).

### Qwen3.5 (2B / 4B)

**Pros**
- El más fácil de probar: está en el registro oficial de Ollama.
- La versión 2B corre con ~4 GB de RAM y sin GPU dedicada; según una guía secundaria, marca 84,5 en OCRBench.
- Apache 2.0. Es la base de NuExtract3, así que sirve como línea de comparación.

**Contras**
- Modelo general: la extracción depende del prompt y es más propensa a inventar o a devolver JSON mal formado.
- Sin evaluación publicada de manuscrito en español.

### Qwen3-VL (2B / 4B / 8B)

**Pros**
- Es la única familia con evidencia independiente en manuscrito: en OmniHandwritingOCR (2026), la versión 8B obtuvo el mejor puntaje global de todos los sistemas evaluados.
- En Ollama oficial con tamaños chicos (1,9 GB y 3,3 GB). Apache 2.0.

**Contras**
- El resultado del benchmark es del 8B, que excede el límite de «ligero»; no está claro cuánto se mantiene en 2B o 4B.
- Generación anterior a Qwen3.5.

### PaddleOCR-VL 1.5 (0.9B)

**Pros**
- El más liviano: 0.9B, ~2,5 GB de VRAM según una prueba de terceros; puede correr en CPU.
- Reporta resultados líderes en manuscrito (inglés y chino) y cubre 111 idiomas. Apache 2.0.

**Contras**
- Solo transcribe: devuelve texto o markdown, no los campos. Habría que mantener las reglas de parsing.
- Evaluación de manuscrito hecha por el propio autor y sin español.
- Ecosistema Python (PaddlePaddle): más pesado de desplegar que Ollama.

### LightOnOCR-3 (0.8B / 1B / 4B)

**Pros**
- En su benchmark de documentos en francés, la versión 4B lidera en páginas manuscritas (46,1) y en formularios (49,6). El francés es lo más cercano al español en la evidencia disponible.
- Apache 2.0; hay builds en Ollama.

**Contras**
- Solo transcribe (como PaddleOCR-VL).
- Los builds de Ollama son de la comunidad, no oficiales.
- Aun el mejor puntaje en manuscrito es bajo en términos absolutos.

### Nanonets-OCR2 3B

**Pros**
- En OmniHandwritingOCR fue el mejor de los modelos especializados en OCR, con menor tasa de error que los demás.
- Marca casillas (☐ ☑) y firmas (`<signature>`): útil para formularios como la constancia de SERMESA.

**Contras**
- Licencia: un tercero la indica como Apache 2.0, pero el modelo está basado en Qwen2.5-VL-3B, cuya licencia es más restrictiva. Hay que verificarla antes de usarlo.
- Solo transcribe. Sin soporte oficial en Ollama (GGUF de la comunidad).

### Gemma 4 (E2B / E4B)

**Pros**
- Oficial en Ollama, pensado para dispositivos chicos (~4–8 GB).

**Contras**
- No hay evidencia de manuscrito. En su categoría quedó por debajo de NuExtract3 en extracción estructurada.
- Licencia propia de Google, más restrictiva que Apache 2.0.

### NuExtract 2.0 2B

**Pros**
- Extracción estructurada con `verbatim-string`; MIT; GGUF oficial; ligero.

**Contras**
- Superado por NuExtract3; base Qwen2-VL, dos generaciones atrás.

## 5. Recomendación

**Ningún modelo tiene evidencia publicada de manuscrito en español.** La
decisión se toma probando con nuestros documentos. Para esa prueba:

1. **Candidato principal: NuExtract3 4B.** Es el único que resuelve el
   requisito completo (imagen → los cuatro campos de RF-11 en JSON) y trae una
   defensa contra la alucinación (`verbatim-string`). Si funciona, reemplaza
   las reglas de parsing en los documentos manuscritos.
2. **Línea de comparación ligera: Qwen3.5 2B o Qwen3-VL 4B en Ollama.** Se
   instalan con un comando y muestran cuánto aporta la especialización de
   NuExtract3 frente a un modelo general.
3. **Plan B ultraligero: PaddleOCR-VL 1.5.** Si el manuscrito lo transcribe
   bien, se combina con las reglas de parsing ya previstas; corre en CPU.

En cualquier caso se mantiene el diseño en capas: `unpdf` para PDF digitales
(sin modelo), Tesseract o el VLM para imágenes, y RF-14 (la secretaría) como
respaldo de lo que no se reconozca.

## 6. Cómo probarlo

- **Conjunto:** los 9 documentos de `docs/utils/ocr docs`, más los que se
  consigan. Antes, anotar a mano el valor correcto de cada campo (emisor,
  fecha de emisión, período de reposo, nombre) para medir aciertos.
- **Métricas:** acierto exacto por campo, campos inventados (valor que no
  está en el documento), tiempo por documento y memoria usada.
- **Entorno:** una máquina local con Ollama o vLLM. Ningún documento sale de
  la máquina (RNF-03).
- **Umbral sugerido para el go:** que el modelo acierte la fecha y el reposo
  manuscritos en la mayoría de las constancias médicas sin inventar valores.

## 7. Riesgos

- **Infraestructura:** ninguno de estos modelos entra en una función de
  Vercel. Requieren un servidor propio (con GPU o mucha RAM), expuesto como
  API interna. Hay que confirmar que ese servidor cuenta como «propio entorno
  de ejecución» para RNF-03.
- **Alucinación:** mitigable con `verbatim-string`, con la validación contra
  el texto del OCR y porque el resultado nunca decide (RF-05 d, RN-24).
- **Muestra chica:** solo 2 de los 9 documentos son constancias médicas.
- **Fuentes secundarias:** varias cifras de tamaño y rendimiento vienen de
  guías de terceros; hay que verificarlas en las fichas oficiales.

## 8. Fuentes

Benchmarks y comparativas:

- [OmniHandwritingOCR (arXiv 2608.18586)](https://arxiv.org/html/2608.18586v1)
- [Best open-source OCR models in 2026 (Roboflow)](https://blog.roboflow.com/best-open-source-ocr-models/)
- [The best OCR models in 2026 (Docsumo)](https://www.docsumo.com/blog/best-ocr-models)

Modelos:

- [NuExtract3 release (NuMind)](https://about.nuextract.ai/blog/nuextract-3-release)
- [NuExtract3: self-hosted 4B VLM (buildmvpfast)](https://www.buildmvpfast.com/blog/nuextract3-open-weight-vlm-structured-extraction-self-hosted-2026)
- [NuExtract 2.0 (NuMind)](https://numind.ai/blog/outclassing-frontier-llms-nuextract-2-0)
- [NuExtract-2.0-2B-GGUF (Hugging Face)](https://huggingface.co/numind/NuExtract-2.0-2B-GGUF)
- [Qwen3.5-4B (Hugging Face)](https://huggingface.co/Qwen/Qwen3.5-4B)
- [Qwen 3.5 small models (InsiderLLM)](https://insiderllm.com/guides/qwen-3-5-small-models-9b-beats-30b/)
- [qwen3-vl:2b (Ollama)](https://registry.ollama.ai/library/qwen3-vl:2b)
- [PaddleOCR-VL (arXiv 2510.14528)](https://arxiv.org/pdf/2510.14528)
- [PaddleOCR-VL: guía (sonusahani)](https://sonusahani.com/blogs/paddleocr-vl)
- [LightOnOCR-3 (Hugging Face blog)](https://huggingface.co/blog/lightonai/lightonocr-3)
- [LightOnOCR-3 4B (Ollama, comunidad)](https://ollama.com/maternion/LightOnOCR-3:4b-q8_0)
- [Nanonets-OCR2 (Nanonets)](https://nanonets.com/research/nanonets-ocr-2)
- [Nanonets-OCR2-3B (Voxel51)](https://docs.voxel51.com/model_zoo/models/nanonets_Nanonets_OCR2_3B.html)
- [gemma4 (Ollama)](https://registry.ollama.ai/library/gemma4)
- [Gemma 4 (Simon Willison)](https://simonwillison.net/2026/apr/2/gemma-4)
