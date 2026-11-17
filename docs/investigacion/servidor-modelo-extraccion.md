# Dónde alojar el modelo de extracción (NuExtract3)

> Fecha de consulta de todas las fuentes: **2026-10-28**. Precios sin IVA salvo que se diga otra cosa.
> Contexto: [`nuextract3-instalacion.md`](./nuextract3-instalacion.md) · límites en `src/lib/extraction/limits.ts` (rama `origin/feat/document-extraction`).

## 1. Resumen y recomendación

**Recomendación: GPU serverless con escala a cero, corriendo la imagen propia de `llama.cpp` con los dos GGUF. Primera opción, Modal (GPU L4). Segunda, RunPod Serverless.**

| | Costo mensual |
|---|---|
| Uso típico del piloto (unos 300 documentos al mes, en sesiones de prueba) | **≈ US$ 1** (estimación) |
| Peor caso supuesto (900 documentos al mes, cada uno con arranque en frío) | **≈ US$ 25** (estimación) |
| Desembolso real en Modal | **US$ 0**, porque el plan Starter incluye US$ 30 mensuales en créditos |
| Presupuesto sugerido | **US$ 5 al mes**, más unos US$ 3 por cada demostración en vivo con el modelo siempre encendido |

Hetzner **no** es la opción recomendada para este volumen:

- La única GPU de Hetzner que sirve es la **GEX45** (24 GB de VRAM): **€ 214/mes + € 209 de instalación** una sola vez. Dos meses de piloto cuestan ≈ € 637 (≈ € 318/mes), para atender decenas de documentos al día.
- Los servidores en la nube de Hetzner no tienen GPU. Con solo CPU, el límite de 120 s por llamada probablemente no se cumple (sección 3.2).

Hetzner sigue siendo la mejor opción **si la facultad exige que el dato quede en la UE y alguien paga la cuota fija**. Los pasos de ese plan B están en la sección 7.

La arquitectura recomendada **deja la web en Vercel** (plan Hobby) y aloja solo el modelo aparte (sección 5).

## 2. Cómo se comunican hoy la aplicación y el modelo

Leído en la rama `origin/feat/document-extraction`:

- `config.ts`: `EXTRACTION_API_URL` va sin `/v1`. Acepta `https://` en cualquier host y `http://` solo para loopback. No admite usuario ni contraseña en la URL. `EXTRACTION_API_KEY` viaja como `Authorization: Bearer`.
- `nuextract-http-extractor.ts`: hace un `POST {URL}/v1/chat/completions` con `redirect: "error"`. Envía **todas las páginas del documento en una sola petición** (un JPEG por página, hasta 5), con `max_tokens: 512`, temperatura 0,2 y la plantilla de RF-11 en `chat_template_kwargs`.
- Ante un error de red o un 502/503/504 hace **un solo reintento** a los 5 s, y solo si queda presupuesto de al menos 20 s. Cualquier otro fallo es `model_error`. Los comentarios de `limits.ts` ya prevén un arranque en frío de GPU serverless (`FETCH_TIMEOUT_MS`, `COLD_START_RETRY_DELAY_MS`).
- `limits.ts`: 3 intentos por documento, 120 s por llamada, `EXTRACTION_MAX_DURATION_S = 300` por invocación (coincide con el máximo del plan Hobby, sección 5.1), imágenes de 1.600 px y barrido diario.
- La extracción corre con `after()` tras el envío. Si el modelo no está disponible, el documento queda pendiente y lo retoma el barrido diario. **La aplicación ya tolera un modelo caído o dormido**, por eso no hace falta un servidor encendido las 24 horas.

Consecuencia práctica: **el servidor del modelo no necesita cambios en la aplicación**. Solo tiene que hablar `POST /v1/chat/completions` por HTTPS, aceptar `Authorization: Bearer <clave>` y responder en menos de 120 s.

## 3. Hetzner

### 3.1 Servidores dedicados con GPU

Fuentes: páginas oficiales de producto y tabla de ajuste de precios (sección 9).

| Modelo | GPU / VRAM | CPU / RAM | Mensual | Instalación | Ubicación | Contrato |
|---|---|---|---|---|---|---|
| **GEX45** (lanzado el 2026-09-01) | RTX PRO 4000 Blackwell SFF, **24 GB** GDDR7 | i5-13500, 64 GB DDR4, 2×512 GB NVMe | **€ 214,00** (IPv4 incluida); € 0,3429/h | **€ 209,00** | HEL1 (Helsinki) | "No minimum contract term"; cancelación "immediately" |
| GEX44 (tabla de ajuste de precios, página modificada el 2026-07-08) | no consta en las fuentes consultadas | no consta | € 232,30 sin IPv4 | € 114,00 | Falkenstein | no consta |
| GEX63 | RTX PRO 6000 Blackwell Max-Q, 96 GB | 128 GB | € 999,00 | € 999,00 | HEL1 | no consta |
| GEX131 | 96 GB | desde 256 GB | desde € 1.499,00 | € 1.499,00 | FSN1, HEL1 | no consta |
| GEX430 | 4×96 GB | 128 GB | € 3.599,00 | € 3.599,00 | HEL1 | no consta |

Observaciones:

- La **GEX44 ya no aparece** en las páginas de producto de la GPU ni en la matriz (consultadas el 2026-10-28). Solo figura en la tabla de ajuste de precios de la documentación. No pude confirmar si todavía se puede pedir, ni si la GEX45 la reemplaza. Hay que mirarlo en el configurador de pedidos.
- Las cifras de GEX131 **no coinciden** entre la página de producto (desde € 1.499) y la tabla de documentación (€ 1.197,30 + € 599 de instalación). Es irrelevante para este proyecto (96 GB es excesivo), pero indica que Hetzner cambió los precios varias veces en 2026 (2 de febrero, 1 de abril, 29 de abril y 15 de junio, según las fuentes de la sección 9). **Los precios pueden volver a cambiar antes de pedir.**
- Disponibilidad: la página de la GEX45 muestra "New" y el botón "Configure". No hay indicación de falta de existencias, pero tampoco una garantía. Confirmar al pedir.
- La GEX45 es la única GPU de Hetzner en el rango de precio razonable para este proyecto. 24 GB sobra: el modelo ocupa unos 5 GB.
- IVA: los precios excluyen IVA. Las páginas tienen un selector de país, pero no pude verificar qué IVA se aplicaría a un cliente en Nicaragua.
- Alta de cuenta: Hetzner puede pedir verificación de identidad a clientes nuevos. No lo verifiqué en las fuentes, y puede ser un obstáculo para estudiantes fuera de la UE.

### 3.2 Servidores en la nube sin GPU (CX, CPX, CCX, CAX)

Precios de las páginas de producto. Los precios de CPX incluyen IPv4 y los de la tabla de ajuste de precios no, por eso difieren unos € 0,50.

| Plan | vCPU | RAM | Mensual (UE) | Por hora |
|---|---|---|---|---|
| CX43 (compartidos, x86) | 8 | 16 GB | € 16,49 | € 0,0264 |
| CAX31 (Arm) | 8 | 16 GB | € 21,49 | € 0,0344 |
| CPX42 (compartidos) | 8 | 16 GB | € 69,99 | € 0,1122 |
| CCX33 (dedicados, AMD) | 8 | 32 GB | € 138,99 | € 0,2227 |
| CCX43 (dedicados, AMD) | 16 | 64 GB | € 276,49 | € 0,4431 |

**¿Puede `llama.cpp` correr NuExtract3 solo con CPU?** Sí, técnicamente. La ficha de Hugging Face no da requisitos de CPU ni de RAM, pero los archivos suman unos 3,5 GB. Con el contexto de 8.192 tokens bastan 8 GB de RAM, y 16 GB dan holgura. La RAM no es el problema. **La latencia sí.**

No encontré ninguna medición de NuExtract3 ni de Qwen3.5-4B con visión en CPU pura. Lo más cercano:

| Dato | Equipo | Resultado | Fecha |
|---|---|---|---|
| Codificador de imagen (mmproj) en CPU, Qwen3.5-9B | Laptop Core i5-1235U | **13,5 s** para una imagen de ≈ 1.100 tokens (ocurrió por un error que mandaba el proyector a la CPU, corregido luego) | 2026-04-01 |
| Codificador de imagen, BF16, modelo de 27B | Ryzen 9950X, 16 hilos | 3,0 s para 1120×1120 px | 2026-10-01 |
| Codificador de imagen de una imagen 4K, Qwen3.5-9B | Ryzen 7950X | 82 s (informe cuestionado por el mantenedor) | 2026-05-01 |
| Generación de texto, Qwen3.5-4B Q4_K_M | CPU de escritorio i5-12400 / Ryzen 7700X | ≈ 15 / ≈ 24 tokens/s (estimación de un sitio de terceros) | 2026 |

**Estimación propia (no medida):** una página a 1.600 px de ancho genera del orden de 1.000 a 3.500 tokens de imagen. En 8 vCPU compartidos hay que sumar la codificación de la imagen (unos 15 a 40 s), el procesamiento de esos tokens por el modelo de 4B (decenas de segundos) y la salida de 100 a 150 tokens a 8-15 tokens/s (7 a 20 s). El total por página queda **entre 40 y 150 s**. Un PDF de 5 páginas se envía en una sola petición y **casi seguro supera los 120 s**.

Con 16 vCPU dedicados (CCX43, € 276/mes) mejora, pero sale más caro que la GEX45 con GPU. **Los planes de nube de Hetzner no sirven como solución permanente.** Solo valen para una prueba: un servidor CCX33 por una hora cuesta € 0,22 y permite medir la latencia real con un documento de verdad.

Disponibilidad en la nube: al consultar, **todos los planes CX/CAX/CPX mostraban "currently unavailable"**, y la página de estado de Hetzner tiene un aviso "Limited availability of cloud instances" desde el 2026-06-26 sin hora de cierre. Es una escasez real de existencias (sección 9).

### 3.3 Facturación

- Hetzner **no cobra por petición ni por token**. No existe tarifa de uso de la API del modelo, porque el modelo lo corre uno mismo.
- **Nube:** facturación por hora (postpago) con tope mensual. Si se borra el servidor antes de fin de mes, se paga solo el tiempo que corrió. Apagarlo no deja de cobrar: hay que **borrarlo**.
- **Dedicados:** cuota mensual más cuota de instalación única. La página también muestra una tarifa por hora (€ 0,3429/h en la GEX45) y "cancelación inmediata", pero no pude confirmar cómo se factura en la práctica una cancelación a mitad de mes. La cuota de instalación no se recupera.
- Tráfico: ilimitado y gratuito en la GEX45. La nube incluye 20 TB en la UE.

## 4. Alternativas (máximo tres)

Todas permiten correr la **imagen propia** con los GGUF propios. Ninguna recibe el documento en una API ajena de extracción.

| | A. Modal (GPU L4 serverless) | B. RunPod Serverless (endpoint de balanceo de carga) | C. RunPod Pod por hora (Secure Cloud) |
|---|---|---|---|
| Tarifa | US$ 0,000222/s (L4) = US$ 0,80/h, más CPU y memoria (≈ US$ 0,91/h en total con 2 vCPU y 8 GiB) | US$ 0,69/h (clase 24 GB: L4, A5000, 3090) o US$ 0,58/h (16 GB: A4000) | A5000: US$ 0,27/h; 4090: US$ 0,89/h; L4: US$ 0,59/h |
| Escala a cero | Sí. `scaledown_window` de 2 a 1.200 s, por omisión 60 s | Sí. Tiempo de inactividad por omisión de 5 s, facturado | No. Hay que encenderlo y apagarlo a mano o por API |
| Créditos gratis | **US$ 30/mes** en el plan Starter | no consta | no consta |
| Costo del piloto (estimado) | **≈ US$ 1 típico, ≈ US$ 25 peor caso** (US$ 0 de bolsillo) | ≈ US$ 0,4 típico, ≈ US$ 9 peor caso | ≈ US$ 11 al mes encendido 40 h; US$ 0 apagado, más el disco |
| Arranque en frío | Segundos a minutos según la documentación. **No hay cifra para este modelo** | Facturado desde que el worker arranca. FlashBoot y caché de modelos lo reducen; no hay cifra | Minutos al encender |
| Cómo corre la imagen | `modal.Image.from_registry(...)` + `@modal.web_server(8080)`. Requiere un archivo Python corto | Imagen propia en un registro, con el modelo dentro. Sin función `handler`, usa tu servidor HTTP | Contenedor Docker normal |
| HTTPS | Incluido (`*.modal.run`) | Incluido (`https://ID.api.runpod.ai`) | Hay que poner proxy y certificado |
| Autenticación | La clave Bearer de la app llega intacta a `llama-server --api-key`. La autenticación propia de Modal es opcional | **Posible conflicto:** el endpoint usa `Authorization: Bearer` de RunPod, y la app solo envía un Bearer (sección 8) | `--api-key` propio |
| Ubicación del dato | Por omisión las entradas pasan por `us-east`. Se puede fijar `eu` (EEE) con recargo de 1,15× | Región por elegir; no la verifiqué | Secure Cloud en centros de datos de socios |
| Pros | Gratis dentro del crédito; HTTPS y escala a cero listos; la clave de la app no cambia | Imagen Docker tal cual, sin Python; el más barato por segundo | Predecible; sin arranque en frío si está encendido |
| Contras | Aprender Modal; Alemania no existe como región; entradas de más de 2 MiB suben a almacenamiento en `us-east` (dudoso para peticiones HTTP, no verificado) | Conflicto de claves; el Pod "Community" corre en máquinas de terceros, **no sirve para documentos de salud** | Manual; paga mientras esté encendido; sin HTTPS listo |

Supuestos del cálculo (mi estimación, no medición):

- Una inferencia de 4 s por documento en una GPU de 24 GB.
- Un arranque en frío de 45 s (carga del modelo en VRAM).
- Típico: 20 sesiones al mes de 15 documentos. Peor caso: 900 documentos al mes, cada uno con su arranque en frío más 60 s de espera antes de apagar.
- Modal típico: 20 × (45 + 60 + 60) s ≈ 3.300 s × US$ 0,000253/s ≈ US$ 0,84. Modal peor caso: 900 × (45 + 4 + 60) s ≈ 98.100 s × US$ 0,000253/s ≈ US$ 24,8.
- RunPod típico: 20 × (45 + 60 + 5) s × US$ 0,000192/s ≈ US$ 0,42. RunPod peor caso: 900 × 54 s × US$ 0,000192/s ≈ US$ 9,3.
- El tiempo de arranque en frío es lo más incierto de todo el cálculo. Hay que medirlo con la imagen real antes de fiarse de estos números.

## 5. Arquitectura

### 5.1 ¿Mover la web a Hetzner o dejar Vercel?

**Dejar la web en Vercel y poner solo el modelo aparte.**

| Criterio | Vercel Hobby + modelo aparte | Todo en Hetzner |
|---|---|---|
| Costo | US$ 0 (Vercel) + costo del modelo | Cuota fija del servidor (mínimo ≈ € 17 en nube CPU, sin GPU), más reemplazar Blob y el cron |
| Duración de funciones | Hobby: **300 s por defecto y máximo** con fluid compute. La llamada de 120 s y la invocación de 300 s de `limits.ts` caben | Sin límite |
| Cron | Hobby: una vez al día, con precisión de ±59 min. El barrido diario ya cumple | Cron propio |
| Mantenimiento (2 personas) | Despliegue automático, TLS, previews | Parches, backups, Docker, Caddy, monitoreo |
| Carga | La web no usa GPU; la extracción corre en segundo plano | Habría que dimensionar web y modelo juntos |

Mover la web no ahorra nada, porque la GPU es la parte cara, y agrega trabajo de operación para dos personas. El límite de 300 s de Hobby no es un problema: el peor caso (5 páginas, 3 intentos) se reparte entre invocaciones y el barrido diario.

### 5.2 Diagrama de conexión

```
Estudiante (navegador)
      |  HTTPS
      v
+-----------------------------+        +-----------------+   +----------------+
| Vercel (plan Hobby)         |------->| Neon (Postgres) |   | Vercel Blob    |
| Next.js, región cle1        |        +-----------------+   +----------------+
|  - Server Action de envío   |
|  - after(): extracción      |
|  - Cron diario (barrido)    |
+--------------+--------------+
               |  HTTPS  POST /v1/chat/completions
               |  Authorization: Bearer EXTRACTION_API_KEY
               |  (imágenes JPEG en base64, ≤ 5 páginas, ≤ 120 s)
               v
+------------------------------------------------------------+
| Recomendado: Modal (GPU L4, escala a cero)                 |
|   https://<workspace>--nuextract.modal.run                 |
|   contenedor: llama-server --api-key ... --jinja -ngl 99   |
|               -m NuExtract3-Q4_K_M.gguf --mmproj ...bf16   |
|                                                            |
| Plan B: Hetzner GEX45 (Helsinki)                           |
|   Internet -> Caddy :443 (Let's Encrypt)                   |
|            -> llama-server 127.0.0.1:8080 (Docker, API key)|
+------------------------------------------------------------+
```

### 5.3 Seguridad de la conexión

- **HTTPS:** la aplicación rechaza `http://` fuera de loopback. En Modal y RunPod el certificado ya viene incluido. En Hetzner hace falta dominio y Caddy o nginx con Let's Encrypt.
- **`--api-key`:** el servidor acepta una o varias claves separadas por coma (`LLAMA_API_KEY`) o un archivo con `--api-key-file`. Usar 32 caracteres o más (la app exige mínimo 16). **`/health` es público aunque haya clave**, según el README de `llama-server`. No devuelve datos, pero el proxy puede no exponerlo.
- **Restricción por IP:** en el plan Hobby **no hay IP de salida fija**. Vercel ofrece "Static IPs" solo en Pro y Enterprise, a US$ 100/mes por proyecto. Entonces no se puede cerrar el firewall del servidor a una IP de Vercel. La protección real queda en TLS, la clave larga, límite de tasa en el proxy y exponer solo `/v1/chat/completions`.
- **Firewall en Hetzner:** abrir solo 80 y 443 (y 22 con llave y mejor por VPN o IP propia). El puerto 8080 va ligado a `127.0.0.1`.
- **Reinicio automático:** `restart: unless-stopped` en Docker. En serverless no aplica, porque la plataforma reinicia el contenedor.
- **Redirecciones:** la app usa `redirect: "error"`, así que el proveedor no debe redirigir peticiones largas. Comprobar con una petición de prueba.

## 6. Ubicación del dato y protección de datos de salud

**Regiones de Hetzner:**

| Región | Códigos | Disponible para |
|---|---|---|
| Alemania | FSN1 (Falkenstein), NBG1 (Núremberg) | Nube, dedicados (GEX131 en FSN1) |
| Finlandia | HEL1 (Helsinki) | Nube, dedicados; **la GEX45 solo está en HEL1** |
| EE. UU. | HIL1 (Hillsboro), ASH1 (Ashburn) | Solo nube (CPX11/21/31/41/51 y CCX) |
| Singapur | SIN1 | Solo nube |

Ninguna GPU de Hetzner está fuera de la UE. La certificación ISO 27001:2022 de Hetzner abarca los tres parques de datos (Núremberg, Falkenstein, Helsinki), según su página de certificaciones. No pude verificar las fechas de validez del certificado ni el contenido actual de su contrato de encargado de tratamiento.

**Qué implica para los datos de salud (constancias médicas):**

- Los datos viajan en cada petición y el modelo los procesa en memoria. Con `llama.cpp` no se guardan en disco por omisión, pero conviene confirmarlo en la configuración final.
- La Ley N.º 787 (texto en `anexos/normativa/`) exige en el art. 13 el consentimiento previo del titular para la cesión o transferencia de datos personales, con información sobre la finalidad y la identidad del cesionario. El art. 14 prohíbe transferir datos a países u organismos que no den un nivel adecuado de protección, con excepciones, entre ellas el intercambio de datos de salud en ciertos casos.
- Si un proveedor de cómputo es un "cesionario" o solo un "encargado" que ejecuta el modelo propio es una **cuestión jurídica que este informe no resuelve**. Es consulta para el asesor de la tesis o el área legal de la UAM.
- Postura prudente y barata: **nombrar al proveedor del modelo y su país en el aviso de consentimiento**, igual que ya hay que hacerlo con Vercel y Neon.
- La UE (Alemania, Finlandia) es la ubicación más fácil de defender por el marco del RGPD. Pero hoy la web, la base y los archivos están en proveedores de EE. UU. (Vercel `cle1` = Cleveland). No tendría sentido sacar el modelo a la UE si el resto de los datos se queda en EE. UU. Conviene decidirlo para todo el sistema, no solo para el modelo.
- Modal permite fijar la región de ejecución (`eu` = EEE, con recargo de 1,15×). No pude confirmar dónde pasan las peticiones HTTP antes de llegar al contenedor (la documentación dice que por omisión las entradas se enrutan por `us-east`).

## 7. Pasos de instalación de alto nivel

### Opción recomendada: Modal

1. Crear la cuenta Modal (plan Starter) y fijar un **límite de gasto** en el espacio de trabajo. Instalar el cliente con `pip install modal` y ejecutar `modal setup`.
2. Crear un secreto con la clave de la API (32 caracteres o más aleatorios): `modal secret create nuextract-key LLAMA_API_KEY=<clave>`.
3. Escribir `modal_nuextract.py` (unas 30 líneas) que:
   - parta de la imagen `ghcr.io/ggml-org/llama.cpp:server-cuda` y anule su `ENTRYPOINT`;
   - descargue los dos GGUF desde `huggingface.co/numind/NuExtract3-GGUF` durante la construcción de la imagen (así quedan en la imagen, sin descarga en cada arranque);
   - defina una función con `gpu="L4"`, `scaledown_window=300` y `@modal.web_server(8080)` que lance `llama-server -m ... --mmproj ... --jinja -ngl 99 -c 8192 --host 0.0.0.0 --port 8080 --api-key $LLAMA_API_KEY`;
   - opcionalmente, `region="eu"` si se decide mantener el dato en la UE.
   La sintaxis exacta hay que confirmarla contra la documentación de Modal; este informe no la probó.
4. `modal deploy modal_nuextract.py`. Modal devuelve una URL `https://...modal.run`.
5. En Vercel, definir `EXTRACTION_API_URL` con esa URL (sin `/v1`) y `EXTRACTION_API_KEY` con la misma clave, y volver a desplegar.
6. Probar con `curl` a `/health` y luego a `/v1/chat/completions` con una imagen de muestra. **Medir el arranque en frío y el tiempo por página.** Si el arranque supera los 100 s, usar `min_containers=1` solo durante las sesiones de prueba y la demostración.
7. Registrar al proveedor en el aviso de consentimiento.

Mejora opcional, no hecha ni propuesta como cambio ya acordado: enviar un `GET /health` cuando el estudiante abre el formulario de carga, para calentar el contenedor antes del envío.

### Plan B: Hetzner GEX45

1. Crear la cuenta (puede pedir verificación de identidad) y pedir la **GEX45** con Ubuntu 24.04 mediante `installimage`.
2. Instalar el controlador NVIDIA, Docker y el NVIDIA Container Toolkit. Comprobar con `docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi`.
3. Descargar los dos GGUF a `/models` y levantar `llama.cpp` con Docker Compose: puerto ligado a `127.0.0.1:8080`, `--api-key-file`, `restart: unless-stopped`, los mismos flags de `setup-local.md` (sin `--no-mmproj-offload`, sobra VRAM).
4. Apuntar un dominio (o subdominio) a la IP. Instalar Caddy con certificado Let's Encrypt automático y `reverse_proxy 127.0.0.1:8080`. Exponer solo `/v1/chat/completions` y, si se quiere, `/health`. Agregar límite de tasa.
5. Firewall: abrir 80 y 443, SSH solo con llave. Activar actualizaciones de seguridad automáticas.
6. En Vercel, `EXTRACTION_API_URL=https://modelo.<dominio>` y la misma clave en `EXTRACTION_API_KEY`.
7. Si el piloto termina, cancelar el servidor (sin contrato mínimo). La cuota de instalación no se recupera.

## 8. Riesgos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Arranque en frío mayor que el esperado (serverless) | La llamada de 120 s se agota, se consume un intento y el documento queda para el barrido diario | Medir antes de fiarse; `min_containers=1` en demostraciones; calentamiento al abrir el formulario |
| Conflicto de claves en RunPod | El endpoint exige la clave de cuenta de RunPod como Bearer y la app solo manda un Bearer. Usar esa clave en `llama-server --api-key` pondría una clave con poder sobre la cuenta en Vercel | Preferir Modal; o añadir a la app un encabezado propio (cambio de código que este informe no hizo) |
| Sin IP fija de salida en Hobby | No se puede restringir el servidor a Vercel | TLS, clave larga, límite de tasa, solo la ruta necesaria |
| Cambios de precio de Hetzner (4 en 2026) y escasez de existencias | El costo o la disponibilidad cambian antes de pedir | Reconfirmar en el configurador; no depender de Hetzner como única opción |
| Alta de cuenta en Hetzner o modo de pago desde Nicaragua | Retraso o rechazo | Sin verificar; probar con tiempo |
| Dato de salud en un proveedor de EE. UU. | Exposición jurídica (Ley N.º 787, arts. 13 y 14) | Fijar región UE en Modal; aviso de consentimiento; consulta legal |
| Gasto fuera de control en serverless | Cargos inesperados | Límite de gasto en el panel; `max workers` bajo (RunPod) |
| Mismo error del proyector en CPU | Si un `llama.cpp` reciente manda el proyector de visión a la CPU, la latencia sube 20 veces (incidente llama.cpp #21272) | Usar la imagen `:server-cuda` actualizada y vigilar el log `image slice encoded in` |
| Modelo con versión no fijada | Un cambio de imagen cambia resultados | Fijar el digest de la imagen de `llama.cpp` y la revisión de los GGUF |
| Sin existencias de GPU serverless en un momento dado | Documentos pendientes | La app ya los deja pendientes y los retoma el barrido |

## 9. Qué no pude verificar

- La latencia real de NuExtract3 en CPU y en las GPU candidatas (L4, A5000, RTX PRO 4000). Todas las cifras de latencia y de costo por uso son **estimaciones mías**, con los supuestos de la sección 4.
- El tiempo de arranque en frío en Modal y RunPod para este modelo.
- Si la GEX44 sigue disponible, y cómo factura Hetzner una cancelación a mitad de mes en dedicados.
- El IVA aplicable a un cliente en Nicaragua, y los requisitos de verificación de cuenta de Hetzner.
- La región por la que Modal enruta las peticiones HTTP, el límite de 150 s de sus endpoints web y el esquema de autenticación del endpoint de RunPod (la documentación no lo detalla).
- Las fechas de validez del certificado ISO 27001 de Hetzner.
- Las páginas se leyeron con una herramienta que devuelve resúmenes automáticos de cada página, no el texto literal. Antes de pagar hay que **reconfirmar cada precio** en la página oficial o en el configurador.

## 10. Fuentes (consultadas el 2026-10-28)

**Hetzner**

- Matriz de servidores GPU: <https://www.hetzner.com/dedicated-rootserver/matrix-gpu>
- Página de la GPU: <https://www.hetzner.com/gpu>
- GEX45: <https://www.hetzner.com/dedicated-rootserver/gex45/>
- GEX44 (la URL muestra la GEX45): <https://www.hetzner.com/dedicated-rootserver/gex44/>
- Anuncio de la GEX45 (2026-09-01): <https://www.hetzner.com/pressroom/hetzner-expands-its-gpu-portfolio-with-the-gex45/>
- Ajuste de precios (modificada el 2026-07-08; vigente desde el 2026-06-15): <https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/>
- Nube, rendimiento regular (CPX): <https://www.hetzner.com/cloud/regular-performance/>
- Nube, propósito general (CCX): <https://www.hetzner.com/cloud/general-purpose/>
- Nube, optimizado en costo (CX/CAX): <https://www.hetzner.com/cloud/cost-optimized/>
- Nube, resumen: <https://www.hetzner.com/cloud/>
- Centros de datos: <https://docs.hetzner.com/general/infrastructure-and-availability/data-centers-and-connection/>
- Certificaciones: <https://hetzner.com/unternehmen/zertifizierung>
- Estado (aviso "Limited availability of cloud instances", desde 2026-06-26): <https://status.hetzner.com/>
- Escasez en la categoría CX/CAX (blog, 2026-09-09; fuente de terceros): <https://www.vincentschmalbach.com/hetzner-cheap-cloud-unavailable-price-increases/>

**Modelo y `llama.cpp`**

- Ficha de NuExtract3-GGUF (Apache 2.0, 4B, configuración recomendada): <https://huggingface.co/numind/NuExtract3-GGUF>
- README del servidor de `llama.cpp` (`--api-key`, `--no-mmproj-offload`, `/health` público): <https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/README.md>
- Documentación multimodal de `llama.cpp`: <https://raw.githubusercontent.com/ggml-org/llama.cpp/master/docs/multimodal.md>
- Incidente #21272, proyector en CPU, 13,5 s (2026-04-01): <https://github.com/ggml-org/llama.cpp/issues/21272>
- Incidente #22582, codificador en CPU, 82 s (2026-05-01): <https://github.com/ggml-org/llama.cpp/issues/22582>
- PR #29806, tiempos del codificador en CPU de 16 hilos (2026-10-01): <https://github.com/ggml-org/llama.cpp/pull/29806>

**Alternativas**

- Modal, precios: <https://modal.com/pricing>
- Modal, endpoints web: <https://modal.com/docs/guide/webhooks>
- Modal, arranque en frío: <https://modal.com/docs/guide/cold-start>
- Modal, regiones: <https://modal.com/docs/guide/region-selection>
- RunPod, precios: <https://www.runpod.io/pricing>
- RunPod, facturación serverless: <https://docs.runpod.io/serverless/pricing>
- RunPod, configuración de endpoints: <https://docs.runpod.io/serverless/endpoints/endpoint-configurations>
- RunPod, endpoints de balanceo de carga: <https://docs.runpod.io/serverless/load-balancing/overview>
- RunPod, visión general: <https://docs.runpod.io/serverless/overview>

**Vercel**

- Duración máxima de funciones (modificada el 2026-08-24): <https://vercel.com/docs/functions/configuring-functions/duration>
- IP estáticas (modificada el 2026-06-30): <https://vercel.com/docs/connectivity/static-ips>
- Cron en Hobby (modificada el 2026-07-15): <https://vercel.com/docs/cron-jobs/usage-and-pricing>

**Normativa**

- Ley N.º 787, arts. 13 y 14: `C:\thesis-workspace\anexos\normativa\ley_787_proteccion_datos_gaceta_61_2012.md`

**Repositorio**

- `origin/feat/document-extraction`: `src/lib/extraction/config.ts`, `limits.ts`, `template.ts`, `adapters/nuextract-http-extractor.ts`, `adapters/after-queue.ts`, `docs/investigacion/nuextract3-instalacion.md`, `vercel.json`.
- `C:\thesis-workspace\setup-local.md`.
