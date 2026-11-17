"""NuExtract3 model server on Modal (GPU serverless, scale to zero).

Serves the same OpenAI-compatible llama.cpp server as the local setup
(docs/setup-local.md, section 3.3), so the application only needs
EXTRACTION_API_URL (without /v1) and EXTRACTION_API_KEY.

Deploy:   modal deploy infra/modal/nuextract.py
Secret:   modal secret create nuextract-key LLAMA_API_KEY=<32+ random chars>
Warm:     NUEXTRACT_MIN_CONTAINERS=1 modal deploy infra/modal/nuextract.py
          (only around a usability session; redeploy without it afterwards)

Choices documented in docs/investigacion/servidor-modelo-extraccion.md:
- the llama.cpp image is pinned by digest and the GGUF files by revision,
  so a redeploy never changes the model's behaviour;
- the files are baked into the image at build time, not downloaded on start;
- -c 8192 matches MAX_IMAGE_TOKENS (6144) in src/lib/extraction/limits.ts.
"""

import os
import subprocess

import modal

LLAMA_IMAGE = (
    "ghcr.io/ggml-org/llama.cpp@sha256:"
    "a361e47e28e8801e290f3c855292e0f25047e5d8e998b0d101431f54db68e008"
)
HF_REPO = "numind/NuExtract3-GGUF"
HF_REVISION = "28a1aae6288c5d50bdf999ca2e572240966d669b"
MODEL = "NuExtract3-Q4_K_M.gguf"
MMPROJ = "mmproj-NuExtract3-BF16.gguf"
# SHA-256 of the model file as verified for the local server.
MODEL_SHA256 = "7ee3c0ee9e5699a4391624ae758487f583f73b3242aa4e73dc2bb33e508d703e"
PORT = 8080

image = (
    modal.Image.from_registry(LLAMA_IMAGE, add_python="3.12")
    .entrypoint([])
    .run_commands(
        "mkdir -p /models",
        *(
            f"python -c \"import urllib.request; urllib.request.urlretrieve("
            f"'https://huggingface.co/{HF_REPO}/resolve/{HF_REVISION}/{name}', "
            f"'/models/{name}')\""
            for name in (MODEL, MMPROJ)
        ),
        f"echo '{MODEL_SHA256}  /models/{MODEL}' | sha256sum -c -",
    )
)

app = modal.App("justifia-nuextract", image=image)


@app.function(
    # Fallbacks in order: L4 capacity ran out on the first deploy (2026-11-10).
    # The model needs ~4 GB of VRAM, so any of the three fits.
    gpu=["L4", "A10G", "T4"],
    secrets=[modal.Secret.from_name("nuextract-key")],
    scaledown_window=300,
    min_containers=int(os.environ.get("NUEXTRACT_MIN_CONTAINERS", "0")),
    max_containers=1,
    timeout=600,
)
@modal.concurrent(max_inputs=4)
@modal.web_server(PORT, startup_timeout=300)
def serve() -> None:
    subprocess.Popen(
        [
            "/app/llama-server",
            "-m", f"/models/{MODEL}",
            "--mmproj", f"/models/{MMPROJ}",
            "--jinja",
            "-ngl", "99",
            "-c", "8192",
            "--host", "0.0.0.0",
            "--port", str(PORT),
            "--api-key", os.environ["LLAMA_API_KEY"],
        ]
    )
