<?php

namespace App\Domain\Apelaciones\Entities;

use App\Domain\Shared\Contracts\Entity;
use App\Enums\EstadoApelacion;
use App\Domain\Shared\ValueObjects\EntityId;
use App\Domain\Shared\ValueObjects\Texto;

final class Apelacion implements Entity
{
    private ?EntityId $id;
    private Texto $observacion;
    private ?Texto $respuesta;
    private EstadoApelacion $estado;
    private EntityId $solicitudId;
    private ?EntityId $apelacionPadreId;

    /**
     * @param ?EntityId $id
     * @param Texto $observacion
     * @param ?Texto $respuesta
     * @param EstadoApelacion $estado
     * @param EntityId $solicitudId
     * @param ?EntityId $apelacionPadreId
     */
    private function __construct(
        ?EntityId $id,
        Texto $observacion,
        ?Texto $respuesta,
        EstadoApelacion $estado,
        EntityId $solicitudId,
        ?EntityId $apelacionPadreId
    ) {
        $this->id = $id;
        $this->observacion = $observacion;
        $this->respuesta = $respuesta;
        $this->estado = $estado;
        $this->solicitudId = $solicitudId;
        $this->apelacionPadreId = $apelacionPadreId;

        $this->ensureRespuestaConsistente();
    }

    public static function crear(string $observacion, int $solicitudId, ?int $apelacionPadreId = null): self
    {
        return new self(
            null,
            new Texto($observacion),
            null,
            EstadoApelacion::Pendiente,
            EntityId::fromInt($solicitudId),
            $apelacionPadreId ? EntityId::fromInt($apelacionPadreId) : null
        );
    }

    public static function reconstruir(
        int $id,
        string $observacion,
        ?string $respuesta,
        EstadoApelacion $estado,
        int $solicitudId,
        ?int $apelacionPadreId
    ): self {
        return new self(
            EntityId::fromInt($id),
            new Texto($observacion),
            $respuesta !== null ? new Texto($respuesta) : null,
            $estado,
            EntityId::fromInt($solicitudId),
            $apelacionPadreId ? EntityId::fromInt($apelacionPadreId) : null
        );
    }

    public function registrarRespuesta(string $respuesta, EstadoApelacion $estado): void
    {
        $this->respuesta = new Texto($respuesta);
        $this->estado = $estado;
        $this->ensureRespuestaConsistente();
    }

    public function dejarPendiente(): void
    {
        $this->estado = EstadoApelacion::Pendiente;
        $this->respuesta = null;
    }

    public function id(): ?EntityId
    {
        return $this->id;
    }

    public function observacion(): Texto
    {
        return $this->observacion;
    }

    public function respuesta(): ?Texto
    {
        return $this->respuesta;
    }

    public function estado(): EstadoApelacion
    {
        return $this->estado;
    }

    public function solicitudId(): EntityId
    {
        return $this->solicitudId;
    }

    public function apelacionPadreId(): ?EntityId
    {
        return $this->apelacionPadreId;
    }

    /**
     * @param list<Apelacion> $cadena
     * @return list<array{autor:string,mensaje:string}>
     */
    public function historial(?string $respuestaInicial, array $cadena): array
    {
        $historial = [];

        if ($respuestaInicial) {
            $historial[] = ['autor' => 'secretaria', 'mensaje' => trim($respuestaInicial)];
        }

        foreach ($cadena as $apelacion) {
            $historial[] = ['autor' => 'estudiante', 'mensaje' => $apelacion->observacion->value()];
            if ($apelacion->respuesta) {
                $historial[] = ['autor' => 'secretaria', 'mensaje' => $apelacion->respuesta->value()];
            }
        }

        return $historial;
    }

    /**
     * @return array<string, int|string|null|EstadoApelacion>
     */
    public function toArray(): array
    {
        return [
            'observacion' => $this->observacion->value(),
            'respuesta' => $this->respuesta?->value(),
            'estado' => $this->estado,
            'solicitud_id' => $this->solicitudId->value(),
            'apelacion_id' => $this->apelacionPadreId?->value(),
        ];
    }

    private function ensureRespuestaConsistente(): void
    {
        if ($this->estado !== EstadoApelacion::Pendiente && $this->respuesta === null) {
            throw new \InvalidArgumentException('Una apelación resuelta debe contar con respuesta.');
        }
    }
