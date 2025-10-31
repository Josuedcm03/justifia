<?php

namespace App\Domain\Catalogo\Entities;

use App\Domain\Shared\ValueObjects\EntityId;
use App\Domain\Shared\ValueObjects\Nombre;

final class Facultad
{
    private ?EntityId $id;
    private Nombre $nombre;

    private function __construct(?EntityId $id, Nombre $nombre)
    {
        $this->id = $id;
        $this->nombre = $nombre;
    }

    public static function crear(string $nombre): self
    {
        return new self(null, new Nombre($nombre));
    }

    public static function reconstruir(int $id, string $nombre): self
    {
        return new self(EntityId::fromInt($id), new Nombre($nombre));
    }

    public function renombrar(string $nombre): void
    {
        $this->nombre = new Nombre($nombre);
    }

    public function id(): ?EntityId
    {
        return $this->id;
    }

    public function nombre(): Nombre
    {
        return $this->nombre;
    }

    /**
     * @return array<string, string>
     */
    public function toArray(): array
    {
        return ['nombre' => $this->nombre->value()];
    }
}
