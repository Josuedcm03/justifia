# Justifia

Aplicación Laravel para gestionar justificaciones de inasistencias.

## Requisitos
- PHP >= 8.1
- Composer
- Node.js y npm

## Instalación

1. Clona el repositorio y entra en la carpeta del proyecto.
2. Instala las dependencias de PHP:

 ```bash
   composer install
   ```

3. Copia el archivo de variables de entorno y genera la clave de la aplicación:

   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

4. Ejecuta las migraciones y carga los datos iniciales:

   ```bash
   php artisan migrate
   php artisan db:seed
   ```

5. Crea el enlace simbólico para el almacenamiento:

   ```bash
   php artisan storage:link
   ```

6. Instala las dependencias de JavaScript y compila los assets:

   ```bash
   npm install
   npm run dev
   ```

7. Cambia APP_URL=http://justifia.test para que funcione correctamente.

## Puesta en marcha

Inicia el servidor de desarrollo con:

```bash
php artisan serve
```