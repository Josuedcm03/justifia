<?php

namespace App\Domain\Reprogramacion\Entities;

use App\Enums\EstadoAsistencia;
use App\Domain\Shared\ValueObjects\EntityId;
use App\Domain\Shared\ValueObjects\Hora;
use App\Domain\Shared\ValueObjects\Texto;
use DateTimeImmutable;

final class Reprogramacion
{
    private ?EntityId $id;
    private DateTimeImmutable $fecha;
    private Hora $hora;
    private EstadoAsistencia $asistencia;
    private ?Texto $observaciones;
    private EntityId $solicitudId;

    private function __construct(
        ?EntityId $id,
        DateTimeImmutable $fecha,
        Hora $hora,
        EstadoAsistencia $asistencia,
        ?Texto $observaciones,
        EntityId $solicitudId
    ) {
        $this->id = $id;
        $this->fecha = $fecha;
        $this->hora = $hora;
        $this->asistencia = $asistencia;
        $this->observaciones = $observaciones;
        $this->solicitudId = $solicitudId;
    }

    public static function crear(DateTimeImmutable $fecha, string $hora, ?string $observaciones, int $solicitudId): self
    {
        return new self(
            null,
            $fecha,
            new Hora($hora),
            EstadoAsistencia::Pendiente,
            $observaciones !== null ? new Texto($observaciones, allowEmpty: true) : null,
            EntityId::fromInt($solicitudId)
        );
    }

    public static function reconstruir(
        int $id,
        DateTimeImmutable $fecha,
        string $hora,
        EstadoAsistencia $asistencia,
        ?string $observaciones,
        int $solicitudId
    ): self {
        return new self(
            EntityId::fromInt($id),
            $fecha,
            new Hora($hora),
            $asistencia,
            $observaciones !== null ? new Texto($observaciones, allowEmpty: true) : null,
            EntityId::fromInt($solicitudId)
        );
    }

    public function reprogramar(DateTimeImmutable $fecha, string $hora, ?string $observaciones): void
    {
        $this->fecha = $fecha;
        $this->hora = new Hora($hora);
        $this->observaciones = $observaciones !== null ? new Texto($observaciones, allowEmpty: true) : null;
    }

    public function registrarAsistencia(EstadoAsistencia $estado): void
    {
        $this->asistencia = $estado;
    }

    public function id(): ?EntityId
    {
        return $this->id;
    }

    public function fecha(): DateTimeImmutable
    {
        return $this->fecha;
    }

    public function hora(): Hora
    {
        return $this->hora;
    }

    public function asistencia(): EstadoAsistencia
    {
        return $this->asistencia;
    }

    public function observaciones(): ?Texto
    {
        return $this->observaciones;
    }

    public function solicitudId(): EntityId
    {
        return $this->solicitudId;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'fecha' => $this->fecha->format('Y-m-d'),
            'hora' => $this->hora->value(),
            'asistencia' => $this->asistencia,
            'observaciones' => $this->observaciones?->value(),
            'solicitud_id' => $this->solicitudId->value(),
        ];
    }
}
