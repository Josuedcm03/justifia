<?php

namespace App\Domain\Docente\Entities;

use App\Domain\Shared\Contracts\Entity;
use App\Domain\Shared\ValueObjects\Cif;
use App\Domain\Shared\ValueObjects\EntityId;

final class Docente implements Entity
{
    private ?EntityId $id;
    private Cif $cif;
    private EntityId $usuarioId;

    private function __construct(?EntityId $id, Cif $cif, EntityId $usuarioId)
    {
        $this->id = $id;
        $this->cif = $cif;
        $this->usuarioId = $usuarioId;
    }

    public static function registrar(string $cif, int $usuarioId): self
    {
        return new self(null, new Cif($cif), EntityId::fromInt($usuarioId));
    }

    public static function reconstruir(int $id, string $cif, int $usuarioId): self
    {
        return new self(EntityId::fromInt($id), new Cif($cif), EntityId::fromInt($usuarioId));
    }

    public function id(): ?EntityId
    {
        return $this->id;
    }

    public function cif(): Cif
    {
        return $this->cif;
    }

    public function usuarioId(): EntityId
    {
        return $this->usuarioId;
    }

    /**
     * @return array<string, int|string>
     */
    public function toArray(): array
    {
        return [
            'cif' => $this->cif->value(),
            'usuario_id' => $this->usuarioId->value(),
        ];
    }
}
