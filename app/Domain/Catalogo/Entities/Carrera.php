<?php

namespace App\Domain\Catalogo\Entities;

use App\Domain\Shared\Contracts\Entity;
use App\Domain\Shared\ValueObjects\EntityId;
use App\Domain\Shared\ValueObjects\Nombre;

final class Carrera implements Entity
{
    private ?EntityId $id;
    private Nombre $nombre;
    private EntityId $facultadId;

    private function __construct(?EntityId $id, Nombre $nombre, EntityId $facultadId)
    {
        $this->id = $id;
        $this->nombre = $nombre;
        $this->facultadId = $facultadId;
    }

    public static function crear(string $nombre, int $facultadId): self
    {
        return new self(null, new Nombre($nombre), EntityId::fromInt($facultadId));
    }

    public static function reconstruir(int $id, string $nombre, int $facultadId): self
    {
        return new self(EntityId::fromInt($id), new Nombre($nombre), EntityId::fromInt($facultadId));
    }

    public function cambiarFacultad(int $facultadId): void
    {
        $this->facultadId = EntityId::fromInt($facultadId);
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

    public function facultadId(): EntityId
    {
        return $this->facultadId;
    }

    /**
     * @return array<string, int|string>
     */
    public function toArray(): array
    {
        return [
            'nombre' => $this->nombre->value(),
            'facultad_id' => $this->facultadId->value(),
        ];
    }
}
