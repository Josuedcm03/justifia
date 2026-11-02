# Entorno local con extracción de documentos

Guía para levantar Justifia en una máquina nueva con la extracción de
documentos (NuExtract3) funcionando, y para configurar Claude Code en el
repositorio. Está pensada para Windows 11 con una GPU NVIDIA; las diferencias
para otros equipos se indican en cada paso.

Al terminar tendrás:

- la aplicación corriendo en `http://localhost:3000`;
- el servidor del modelo corriendo en `http://127.0.0.1:8080`;
- las solicitudes que envíes extrayendo sus documentos automáticamente;
- Claude Code trabajando en el repositorio con sus reglas.

## 1. Requisitos

| Herramienta    | Versión                               | Para qué                           |
| -------------- | ------------------------------------- | ---------------------------------- |
| Git            | cualquiera reciente                   | clonar el repositorio              |
| Node.js        | 24 LTS (el repo usa `@types/node` 24) | la aplicación                      |
| npm            | el que trae Node                      | dependencias (`package-lock.json`) |
| Docker Desktop | con backend WSL 2                     | el servidor del modelo             |
| Driver NVIDIA  | reciente, con soporte CUDA 12         | correr el modelo en la GPU         |

Memoria de video (VRAM) recomendada:

- **6 GB o más:** todo el modelo en la GPU (configuración de referencia, ~5 GB).
- **4 GB:** el codificador de imágenes va a la CPU (ver paso 3.4).
- **Sin GPU NVIDIA:** la aplicación funciona igual, pero sin extracción; los
  documentos quedan en «pendiente» y el detalle de la solicitud avisa que falta
  configurar la extracción.

Opcional, para la integración con Claude:
[Claude Code](https://claude.com/claude-code), [ripgrep](https://github.com/BurntSushi/ripgrep)
y, si se usa memoria compartida, `engram`.

## 2. Aplicación

### 2.1 Clonar e instalar

```powershell
git clone https://github.com/Josuedcm03/justifia.git
cd justifia
npm install
```

`npm install` también ejecuta el script `prepare`, que configura
`core.hooksPath` en `.githooks/`. Esos hooks sincronizan la memoria de
`.engram/` y no hacen nada si `engram` no está instalado.

### 2.2 Base de datos

La base es Postgres en Neon. **Nunca uses la cadena de conexión de
producción en tu máquina.** Pide al responsable del proyecto una rama de Neon
propia para desarrollo y su cadena de conexión directa (la que no termina en
`-pooler`).

La rama debe tener aplicadas todas las migraciones de `drizzle/`, incluida
`0011_document_extraction.sql`, que crea la tabla `ExtraccionDocumento`. Si la
rama se creó desde producción ya las trae. Si no, se aplican con:

```powershell
npm run db:migrate
```

`npm run db:seed` crea los roles y tres usuarios de personal. Las contraseñas
se piden al responsable del proyecto; no están en esta guía.

### 2.3 Variables de entorno

Copia la plantilla y complétala. Tanto Next.js como Drizzle leen `.env` en la
raíz del repositorio.

```powershell
Copy-Item .env.example .env
```

| Variable                      | Obligatoria                     | Valor en local                                             |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`                | sí                              | la cadena de tu rama de Neon (paso 2.2)                    |
| `AUTH_SECRET`                 | sí                              | 32 caracteres o más, aleatorio (ver abajo)                 |
| `BLOB_READ_WRITE_TOKEN`       | para subir y extraer documentos | token del almacenamiento Vercel Blob, lo da el responsable |
| `EXTRACTION_API_URL`          | para extraer                    | `http://127.0.0.1:8080`                                    |
| `EXTRACTION_API_KEY`          | no                              | vacía en local                                             |
| `CRON_SECRET`                 | para probar el barrido          | 16 caracteres o más, aleatorio                             |
| `RESEND_API_KEY`, `MAIL_FROM` | no                              | solo para el correo de remisión a docentes                 |

Para generar un valor aleatorio:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Reglas de `EXTRACTION_API_URL` (las valida `src/lib/extraction/config.ts`):

- va **sin** `/v1`; la aplicación agrega `/v1/chat/completions`;
- `http://` solo se acepta para `localhost`, `127.x` o `[::1]`; cualquier otra
  dirección tiene que ser `https://`;
- no puede llevar usuario ni contraseña;
- si está vacía o no es válida, la aplicación arranca igual y la extracción
  queda «sin configurar» (en el log aparece `extraction_config_invalid`).

`EXTRACTION_API_KEY` solo se usa cuando el servidor del modelo se levanta con
`--api-key` (como en producción). Si la completas, tiene que tener 16
caracteres o más y ser la misma que recibe el servidor.

### 2.4 Comprobar que la aplicación funciona

```powershell
npm run typecheck
npm test
npm run dev
```

Abre `http://localhost:3000` e inicia sesión.

Sobre el lint en Windows: Git convierte los finales de línea a CRLF al hacer el
checkout y `npm run lint` reporta miles de errores `Delete ␍`. No son errores
reales. Para ver solo los reales:

```powershell
npx eslint . --rule '{\"prettier/prettier\":[\"error\",{\"endOfLine\":\"auto\"}]}'
```

## 3. Servidor del modelo (NuExtract3)

El modelo corre en un contenedor de `llama.cpp` con CUDA. La guía completa,
con alternativas y solución de problemas, está en
[`docs/investigacion/nuextract3-instalacion.md`](investigacion/nuextract3-instalacion.md);
estos son los pasos de la configuración que usamos.

### 3.1 Verificar que Docker ve la GPU

```powershell
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

Tiene que mostrar tu GPU. Si falla, revisa que Docker Desktop use WSL 2 y que
el driver NVIDIA esté actualizado.

### 3.2 Descargar la imagen y el modelo

Son unos 3.5 GB entre los dos archivos del modelo.

```powershell
docker pull ghcr.io/ggml-org/llama.cpp:server-cuda
mkdir C:\models\nuextract3
curl.exe -L -o C:\models\nuextract3\NuExtract3-Q4_K_M.gguf https://huggingface.co/numind/NuExtract3-GGUF/resolve/main/NuExtract3-Q4_K_M.gguf
curl.exe -L -o C:\models\nuextract3\mmproj-NuExtract3-BF16.gguf https://huggingface.co/numind/NuExtract3-GGUF/resolve/main/mmproj-NuExtract3-BF16.gguf
```

Hacen falta los dos: `NuExtract3-Q4_K_M.gguf` (2.78 GB) es el modelo y
`mmproj-NuExtract3-BF16.gguf` (676 MB) es el codificador de imágenes.

### 3.3 Crear el contenedor (GPU de 6 GB o más)

```powershell
docker run -d --name nuextract3 --gpus all `
  -p 127.0.0.1:8080:8080 `
  -v C:/models/nuextract3:/models:ro `
  ghcr.io/ggml-org/llama.cpp:server-cuda `
  -m /models/NuExtract3-Q4_K_M.gguf `
  --mmproj /models/mmproj-NuExtract3-BF16.gguf `
  --jinja -ngl 99 -c 8192 --host 0.0.0.0 --port 8080
```

El puerto queda publicado solo en `127.0.0.1`, así que no es accesible desde
la red. El contenedor no tiene `--api-key`, por eso `EXTRACTION_API_KEY` va
vacía.

### 3.4 Variante para GPU de 4 GB

Mismo comando que el 3.3, con `--no-mmproj-offload` al final. El codificador
de imágenes corre en la CPU: usa ~3 GB de VRAM y cada documento tarda más.

### 3.5 Comprobar el servidor

Espera unos 30 segundos después de crearlo:

```powershell
curl.exe http://127.0.0.1:8080/health
```

Tiene que responder `{"status":"ok"}`.

### 3.6 Uso diario

El contenedor no se reinicia solo con la máquina.

```powershell
docker start nuextract3   # antes de trabajar
docker stop nuextract3    # para liberar la GPU
docker logs -f nuextract3 # ver qué está haciendo
```

## 4. Probar la extracción de punta a punta

1. Con el contenedor corriendo y `npm run dev` levantado, inicia sesión como
   estudiante e inscríbete en un grupo en `/enrollment`.
2. Crea una solicitud en `/requests/new`, adjunta un documento (imagen o PDF)
   y envíala.
3. Al enviarla, la aplicación encola la extracción y la ejecuta en segundo
   plano. En `docker logs -f nuextract3` verás la petición; cada imagen
   tarda entre 2 y 5 segundos.
4. Inicia sesión como personal (secretaría o administración) y abre el detalle
   de la solicitud: la sección de datos extraídos muestra el resultado.

Si el modelo no estaba disponible al enviar, el documento queda pendiente y lo
retoma el barrido diario. Para correrlo a mano:

```powershell
curl.exe -H "Authorization: Bearer <tu CRON_SECRET>" http://localhost:3000/api/cron/intake-sweep
```

Sin `CRON_SECRET` en `.env`, el barrido siempre responde 401.

Límites que conviene conocer (`src/lib/extraction/limits.ts`): hasta 3 intentos
por documento, 120 segundos por llamada al modelo, como máximo 5 páginas por
PDF, y las imágenes se reducen a 1600 px de ancho.

### Problemas frecuentes

| Síntoma                                            | Causa probable                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| El detalle dice que falta configurar la extracción | `EXTRACTION_API_URL` vacía o no válida; reinicia `npm run dev` después de editar `.env` |
| Los documentos quedan en «pendiente»               | el contenedor está detenido o todavía cargando (`/health`)                              |
| Los PDF fallan y las imágenes no                   | no cargó `@napi-rs/canvas`; borra `node_modules` y ejecuta `npm install`                |
| El contenedor se cierra al arrancar                | poca VRAM; usa la variante del paso 3.4                                                 |
| Error de tabla `ExtraccionDocumento`               | falta la migración 0011 en tu rama de Neon                                              |

## 5. Claude Code

### 5.1 Instalar e iniciar sesión

```powershell
irm https://claude.ai/install.ps1 | iex
cd justifia
claude
```

La primera vez pide iniciar sesión con tu cuenta.

### 5.2 Qué lee Claude automáticamente

- **`CLAUDE.md`**: reglas del proyecto. Las más importantes: no ejecutar
  migraciones, seeds ni SQL de escritura sin pedir confirmación para cada
  comando, y dónde están los requisitos (`docs/requirements.md`) y el roadmap
  (`docs/roadmap.md`).
- **`AGENTS.md`**: avisa que esta versión de Next.js tiene cambios grandes y
  que hay que consultar `node_modules/next/dist/docs/`. `next dev` lo vuelve a
  agregar si se borra.
- **`openspec/`**: el flujo de desarrollo por especificaciones (SDD).
  `openspec/config.yaml` define TDD estricto y los comandos de test y lint; las
  specs vigentes están en `openspec/specs/` y los changes nuevos se inician con
  la plantilla de `docs/sdd-new-template.md`.

### 5.3 Reglas para trabajar con Claude en este repo

- **No le pases ni le pidas que escriba el `.env`.** Los secretos los cargas tú
  a mano. Si Claude necesita saber qué va en una variable, que lo lea de
  `src/env.ts`.
- **Base de datos:** confirma cada comando que escriba en Neon (`db:migrate`,
  `db:push`, `db:seed`, SQL). Revisa antes a qué rama apunta tu `DATABASE_URL`.
- **Antes de pedir un commit**, que corra `npm run typecheck` y `npm test`.

### 5.4 Integraciones opcionales

Ninguna es necesaria para trabajar; agregan contexto a Claude.

- **Neon (MCP):** permite que Claude consulte ramas y tablas.
  `claude mcp add --transport http neon https://mcp.neon.tech/mcp` y autoriza
  tu cuenta de Neon cuando lo pida.
- **Memoria compartida (`engram`):** `.engram/` guarda la memoria del proyecto
  en el repositorio. Con `engram` instalado, los hooks de `.githooks/` la
  sincronizan en cada commit y merge.
- **CodeGraph:** índice del código en `.codegraph/` (local, no se versiona).

### 5.5 Primer pedido para probar

Con todo levantado, puedes pedirle a Claude:

> Lee `docs/setup-local.md` y verifica mi entorno: que el contenedor
> `nuextract3` responda en `/health`, que `npm run typecheck` y `npm test`
> pasen, y dime qué variables de `src/env.ts` me faltan, sin abrir el `.env`.
