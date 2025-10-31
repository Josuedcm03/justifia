<?php

namespace App\Domain\Shared\ValueObjects;

use App\Domain\Shared\DomainException;

final class ArchivoConstancia
{
    private const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg'];

    private string $path;

    private function __construct(string $path)
    {
        $path = trim($path);

        if ($path === '') {
            throw DomainException::withMessage('La ruta de la constancia no puede estar vacía.');
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        if ($extension === '') {
            throw DomainException::withMessage(
                'El archivo de constancia debe tener extensión.',
                ['path' => $path],
            );
        }

        if (! in_array($extension, self::EXTENSIONES_PERMITIDAS, true)) {
            throw DomainException::withMessage(
                'El archivo de constancia debe ser PDF o JPG.',
                ['path' => $path, 'extension' => $extension],
            );
        }

        $this->path = $path;
    }

    public static function fromPath(string $path): self
    {
        return new self($path);
    }

    public static function fromNullable(?string $path): ?self
    {
        if ($path === null) {
            return null;
        }

        return new self($path);
    }

    public function path(): string
    {
        return $this->path;
    }

    public function __toString(): string
    {
        return $this->path;
    }
}
