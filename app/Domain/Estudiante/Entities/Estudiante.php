<?php

namespace App\Domain\Estudiante\Entities;

use App\Domain\Shared\ValueObjects\Cif;
use App\Domain\Shared\ValueObjects\EntityId;

final class Estudiante
{
    private ?EntityId $id;
    private Cif $cif;
    private EntityId $usuarioId;
    private EntityId $carreraId;

    private function __construct(?EntityId $id, Cif $cif, EntityId $usuarioId, EntityId $carreraId)
    {
        $this->id = $id;
        $this->cif = $cif;
        $this->usuarioId = $usuarioId;
        $this->carreraId = $carreraId;
    }

    public static function registrar(string $cif, int $usuarioId, int $carreraId): self
    {
        return new self(
            null,
            new Cif($cif),
            EntityId::fromInt($usuarioId),
            EntityId::fromInt($carreraId)
        );
    }

    public static function reconstruir(int $id, string $cif, int $usuarioId, int $carreraId): self
    {
        return new self(
            EntityId::fromInt($id),
            new Cif($cif),
            EntityId::fromInt($usuarioId),
            EntityId::fromInt($carreraId)
        );
    }

    public function cambiarCarrera(int $carreraId): void
    {
        $this->carreraId = EntityId::fromInt($carreraId);
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

    public function carreraId(): EntityId
    {
        return $this->carreraId;
    }

    /**
     * @return array<string, int|string>
     */
    public function toArray(): array
    {
        return [
            'cif' => $this->cif->value(),
            'usuario_id' => $this->usuarioId->value(),
            'carrera_id' => $this->carreraId->value(),
        ];
    }
}

\class_alias(Estudiante::class, 'App\\Models\\ModuloEstudiante\\Estudiante');
