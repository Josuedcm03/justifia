<?php

namespace App\Domain\Shared\ValueObjects;

use InvalidArgumentException;

final class ArchivoConstancia
{
    private const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png'];

    public function __construct(private readonly string $ruta)
    {
        $extension = strtolower(pathinfo($ruta, PATHINFO_EXTENSION));

        if ($extension === '') {
            throw new InvalidArgumentException('El archivo de constancia debe tener una extensión.');
        }

        if (! in_array($extension, self::EXTENSIONES_PERMITIDAS, true)) {
            throw new InvalidArgumentException('Extensión de constancia no permitida.');
        }
    }

    public function ruta(): string
    {
        return $this->ruta;
    }

    public function extension(): string
    {
        return strtolower(pathinfo($this->ruta, PATHINFO_EXTENSION));
    }

    public function __toString(): string
    {
        return $this->ruta;
    }
}
