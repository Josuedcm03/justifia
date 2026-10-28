# Guía: instalar y probar NuExtract3 en local (Windows)

> Fecha: 2026-10-21 · Para el spike del change #4 `document-extraction`.
> Contexto: [`modelos-vlm-extraccion.md`](./modelos-vlm-extraccion.md).

Esta guía instala **NuExtract3 4B** (NuMind, Apache 2.0, base Qwen3.5-4B) en
una máquina de desarrollo con Windows y lo usa para extraer los campos de
RF-11 de los documentos de muestra. Todo corre en la máquina: ningún
documento sale de ella (RNF-03).

## Índice

1. [Máquina de referencia](#1-máquina-de-referencia)
2. [Qué cuantización usar](#2-qué-cuantización-usar)
3. [Por qué llama.cpp y no Ollama](#3-por-qué-llamacpp-y-no-ollama)
4. [Instalación](#4-instalación)
5. [Levantar el servidor](#5-levantar-el-servidor)
6. [Probar con un documento](#6-probar-con-un-documento)
7. [Plantilla de RF-11](#7-plantilla-de-rf-11)
8. [Problemas frecuentes](#8-problemas-frecuentes)
9. [Fuentes](#9-fuentes)

---

## 1. Máquina de referencia

| Componente | Valor |
|---|---|
| CPU | AMD Ryzen 7 serie 7000 |
| RAM | 24 GB |
| GPU | NVIDIA GeForce RTX 3050 (portátil: 4 o 6 GB de VRAM, según el modelo) |
| Sistema | Windows 11 |

Lo primero es confirmar la VRAM real, porque define la cuantización:

```powershell
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv
```

## 2. Qué cuantización usar

El repositorio oficial `numind/NuExtract3-GGUF` publica estos archivos:

| Archivo | Tamaño |
|---|---|
| `NuExtract3-Q3_K_M.gguf` | 2,32 GB |
| `NuExtract3-Q4_K_M.gguf` | 2,78 GB |
| `NuExtract3-Q5_K_M.gguf` | 3,16 GB |
| `NuExtract3-Q6_K.gguf` | 3,56 GB |
| `NuExtract3-Q8_0.gguf` | 4,61 GB |
| `mmproj-NuExtract3-BF16.gguf` (proyector de visión, obligatorio) | 676 MB |

El modelo necesita **los dos archivos**: el de lenguaje y el `mmproj`, que es
el que «ve» la imagen. A eso se suma la memoria del contexto (~0,5–1 GB con
8K tokens).

| VRAM | Configuración recomendada |
|---|---|
| 6 GB | `Q4_K_M` + `mmproj`, todo en la GPU |
| 4 GB | `Q4_K_M` con el `mmproj` en CPU (`--no-mmproj-offload`), o descargar parte de las capas a la RAM (`-ngl` menor a 99) |

Con 24 GB de RAM, cualquiera de las dos variantes entra holgada. Evitar `Q2_K`
y `Q3_K_M` salvo que no quede otra: la precisión cae justo en lo que nos
importa (leer manuscrito).

## 3. Por qué llama.cpp y no Ollama

NuExtract3 recibe la plantilla de campos **como argumento de la plantilla de
chat** (`chat_template_kwargs`: `template` y `enable_thinking`), no como texto
del mensaje.

- **llama.cpp (`llama-server`)** acepta `chat_template_kwargs` en la
  petición cuando se arranca con `--jinja`. Es el camino que respeta el
  formato oficial.
- **Ollama** puede bajar el modelo (`ollama run hf.co/numind/NuExtract3-GGUF:Q4_K_M`),
  pero no permite pasar `chat_template_kwargs` y la ficha oficial no confirma
  que su soporte de visión cubra la arquitectura Qwen3.5. Queda como
  alternativa, no como camino principal.
- **vLLM** es el que documenta la ficha, pero no corre nativo en Windows
  (requiere WSL2) y pide más VRAM de la disponible.

## 4. Instalación

### 4.0 Camino recomendado en Windows: Docker

En Windows 11 con **Smart App Control** activado, los binarios de llama.cpp
(opciones A y B de abajo) se bloquean con el mensaje «ha sido bloqueado por la
directiva de Device Guard de su organización», porque no están firmados.
Para comprobarlo:

```powershell
(Get-MpComputerStatus).SmartAppControlState   # On = activado
```

No conviene desactivarlo: en muchas versiones no se puede volver a activar sin
reinstalar Windows. La solución es correr la imagen oficial de llama.cpp en
Docker Desktop, que corre en WSL2, donde Smart App Control no aplica.
Probado el 2026-10-21 con una RTX 3050 de 6 GB.

1. Abrir Docker Desktop y verificar que los contenedores ven la GPU:

   ```powershell
   docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
   ```

2. Bajar la imagen y los archivos del modelo:

   ```powershell
   docker pull ghcr.io/ggml-org/llama.cpp:server-cuda
   mkdir C:\models\nuextract3
   curl.exe -L -o C:\models\nuextract3\NuExtract3-Q4_K_M.gguf https://huggingface.co/numind/NuExtract3-GGUF/resolve/main/NuExtract3-Q4_K_M.gguf
   curl.exe -L -o C:\models\nuextract3\mmproj-NuExtract3-BF16.gguf https://huggingface.co/numind/NuExtract3-GGUF/resolve/main/mmproj-NuExtract3-BF16.gguf
   ```

3. Levantar el servidor (el puerto queda publicado solo en `127.0.0.1`):

   ```powershell
   docker run -d --name nuextract3 --gpus all `
     -p 127.0.0.1:8080:8080 `
     -v C:/models/nuextract3:/models:ro `
     ghcr.io/ggml-org/llama.cpp:server-cuda `
     -m /models/NuExtract3-Q4_K_M.gguf `
     --mmproj /models/mmproj-NuExtract3-BF16.gguf `
     --jinja -ngl 99 -c 8192 --host 0.0.0.0 --port 8080
   ```

4. Esperar a que `curl.exe http://127.0.0.1:8080/health` responda
   `{"status":"ok"}` (unos 30 s) y seguir en la sección 6.

Para detenerlo: `docker stop nuextract3`; para volver a arrancarlo:
`docker start nuextract3`. Con todo en la GPU usa ~5,1 GB de los 6 GB de VRAM.

Las opciones A y B siguientes sirven en máquinas sin Smart App Control.

### 4.1 Driver de NVIDIA

Tener un driver reciente (el de GeForce Experience o la app de NVIDIA alcanza).
`nvidia-smi` debe responder sin errores.

### 4.2 llama.cpp

**Opción A — winget (la más simple):**

```powershell
winget install llama.cpp
```

Abrir una terminal nueva y verificar qué dispositivos detecta:

```powershell
llama-server --version
llama-server --list-devices
```

Si la lista muestra la RTX 3050 (por CUDA o Vulkan), seguir al paso 5. Si
solo aparece la CPU, usar la opción B.

**Opción B — binarios con CUDA desde GitHub:**

1. Ir a <https://github.com/ggml-org/llama.cpp/releases> (última versión).
2. Descargar `llama-<versión>-bin-win-cuda-12.4-x64.zip` y
   `cudart-llama-bin-win-cuda-12.4-x64.zip`.
3. Descomprimir ambos en la misma carpeta, por ejemplo `C:\tools\llama.cpp`.
4. Agregar esa carpeta al `PATH`, o ejecutar los comandos desde ella.

> Nota: la arquitectura Qwen3.5 necesita una versión reciente de llama.cpp.
> Si el modelo no carga con un error de arquitectura desconocida, actualizar.

### 4.3 Descargar el modelo

La forma directa descarga el modelo y su `mmproj` a la caché de llama.cpp en
el primer arranque:

```powershell
llama-server -hf numind/NuExtract3-GGUF:Q4_K_M
```

Para trabajar sin conexión y con rutas explícitas, descargar los dos archivos
a mano desde <https://huggingface.co/numind/NuExtract3-GGUF/tree/main> a una
carpeta como `C:\models\nuextract3\`.

La descarga es la única conexión a internet del proceso; no lleva documentos.

## 5. Levantar el servidor

**Con 6 GB de VRAM** (todo en la GPU):

```powershell
llama-server `
  -m C:\models\nuextract3\NuExtract3-Q4_K_M.gguf `
  --mmproj C:\models\nuextract3\mmproj-NuExtract3-BF16.gguf `
  --jinja -ngl 99 -c 8192 --host 127.0.0.1 --port 8080
```

**Con 4 GB de VRAM** (visión en CPU):

```powershell
llama-server `
  -m C:\models\nuextract3\NuExtract3-Q4_K_M.gguf `
  --mmproj C:\models\nuextract3\mmproj-NuExtract3-BF16.gguf `
  --no-mmproj-offload --jinja -ngl 99 -c 8192 --host 127.0.0.1 --port 8080
```

Si aun así falta memoria, bajar `-ngl` (por ejemplo, `-ngl 20`) para dejar
parte de las capas en la RAM, a costa de velocidad.

| Flag | Para qué |
|---|---|
| `--jinja` | Habilita la plantilla de chat del modelo y `chat_template_kwargs` |
| `-ngl 99` | Cuántas capas van a la GPU (99 = todas) |
| `-c 8192` | Tamaño de contexto; alcanza para una página |
| `--host 127.0.0.1` | Solo accesible desde la máquina (RNF-03) |

El servidor queda listo cuando imprime `server is listening on http://127.0.0.1:8080`.
También trae una interfaz web en esa dirección.

## 6. Probar con un documento

El servidor expone una API compatible con OpenAI. Script en Node (Node 24 ya
trae `fetch`); guardarlo fuera del repositorio:

```js
// extract.mjs — usage: node extract.mjs <image>
import { readFile } from "node:fs/promises";
import path from "node:path";

const file = process.argv[2];
const mime = path.extname(file).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
const dataUrl = `data:${mime};base64,${(await readFile(file)).toString("base64")}`;

const template = {
  student_name: "verbatim-string",
  issuer: "verbatim-string",
  issue_date: "date",
  rest_from: "date",
  rest_to: "date",
  rest_days: "integer",
};

const t0 = performance.now();
const res = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    temperature: 0.2,
    messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: dataUrl } }] }],
    chat_template_kwargs: { template: JSON.stringify(template, null, 4), enable_thinking: false },
  }),
});
const json = await res.json();
console.log(json.choices?.[0]?.message?.content ?? json);
console.log(`${Math.round(performance.now() - t0)} ms`);
```

```powershell
node extract.mjs "docs\utils\ocr docs\Pio_17_sept.jpg"
```

Recomendaciones:

- **Empezar sin razonamiento** (`enable_thinking: false`, temperatura 0,2),
  como recomienda la ficha. En el spike del 2026-10-21 el modo con
  razonamiento (`true`, temperatura 0,6) fue de 3 a 4 veces más lento e
  inventó más datos (horas como fechas de reposo, años erróneos, un reposo
  en un informe de matrícula); solo mejoró un cálculo de días.
- **Achicar las fotos grandes** antes de enviarlas (por ejemplo, a 2000 px de
  ancho respetando la orientación EXIF, como en el spike de Tesseract). Una
  foto de 12 MP genera muchos tokens de imagen y tarda más.
- **PDF de varias páginas:** convertir cada página a PNG y enviar un
  `image_url` por página, en orden.
- Un campo que no aparece vuelve como `null`: es exactamente el «no
  reconocido» de RF-11 (b).

## 7. Plantilla de RF-11

| Campo de RF-11 | Clave | Tipo | Por qué ese tipo |
|---|---|---|---|
| Nombre del estudiante | `student_name` | `verbatim-string` | Debe estar escrito en el documento; no se infiere |
| Emisor | `issuer` | `verbatim-string` | Ídem |
| Fecha de emisión | `issue_date` | `date` | Normaliza a ISO-8601 (`17.09.26` → `2026-09-17`) |
| Período de reposo | `rest_from`, `rest_to`, `rest_days` | `date`, `date`, `integer` | El documento puede dar un rango o una duración («72 hrs (3 días)») |

Al medir, revisar especialmente los campos `date`: el modelo los normaliza,
así que hay que confirmar contra el documento que no los haya inventado. El
tipo `verbatim-string` no aplica a fechas.

Lista completa de tipos: `TYPES.md` en el repositorio del modelo.

## 8. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `unknown model architecture` | llama.cpp viejo | Actualizar a la última versión |
| `CUDA out of memory` | Falta VRAM | `--no-mmproj-offload`, bajar `-ngl` o `-c` |
| La respuesta ignora la plantilla | Falta `--jinja` | Reiniciar el servidor con `--jinja` |
| Respuesta con `<think>…</think>` | Razonamiento activado | `enable_thinking: false`, o quedarse con lo que va después de `</think>` |
| Repite texto en bucle | Temperatura alta | Usar 0,2 sin razonamiento |
| Muy lento | Capas en CPU o imagen enorme | Subir `-ngl` y achicar la imagen |

## 9. Fuentes

- [numind/NuExtract3 (Hugging Face)](https://huggingface.co/numind/NuExtract3)
- [numind/NuExtract3-GGUF (Hugging Face)](https://huggingface.co/numind/NuExtract3-GGUF)
- [Archivos de NuExtract3-GGUF](https://huggingface.co/numind/NuExtract3-GGUF/tree/main)
- [NuExtract3 release (NuMind)](https://about.nuextract.ai/blog/nuextract-3-release)
- [llama.cpp releases (GitHub)](https://github.com/ggml-org/llama.cpp/releases)
- [Trying out llama.cpp's new vision support (Simon Willison)](https://simonwillison.net/2025/May/10/llama-cpp-vision/)
