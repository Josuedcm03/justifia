<?php

namespace App\Domain\Solicitud\Entities;

use App\Domain\Shared\Contracts\Entity;
use App\Enums\EstadoSolicitud;
use App\Domain\Shared\ValueObjects\ArchivoConstancia;
use App\Domain\Shared\ValueObjects\EntityId;
use App\Domain\Shared\ValueObjects\Texto;
use DateTimeImmutable;
use InvalidArgumentException;

final class Solicitud implements Entity
{
    private ?EntityId $id;
    private DateTimeImmutable $fechaAusencia;
    private ?ArchivoConstancia $constancia;
    private Texto $observaciones;
    private ?Texto $respuesta;
    private EstadoSolicitud $estado;
    private EntityId $estudianteId;
    private EntityId $docenteId;
    private EntityId $asignaturaId;
    private EntityId $tipoConstanciaId;

    private function __construct(
        ?EntityId $id,
        DateTimeImmutable $fechaAusencia,
        ?ArchivoConstancia $constancia,
        Texto $observaciones,
        ?Texto $respuesta,
        EstadoSolicitud $estado,
        EntityId $estudianteId,
        EntityId $docenteId,
        EntityId $asignaturaId,
        EntityId $tipoConstanciaId
    ) {
        $this->id = $id;
        $this->fechaAusencia = $fechaAusencia;
        $this->constancia = $constancia;
        $this->observaciones = $observaciones;
        $this->respuesta = $respuesta;
        $this->estado = $estado;
        $this->estudianteId = $estudianteId;
        $this->docenteId = $docenteId;
        $this->asignaturaId = $asignaturaId;
        $this->tipoConstanciaId = $tipoConstanciaId;

        $this->ensureRespuestaConsistente();
    }

    public static function crearNueva(
        DateTimeImmutable $fechaAusencia,
        ?ArchivoConstancia $constancia,
        string $observaciones,
        int $estudianteId,
        int $docenteId,
        int $asignaturaId,
        int $tipoConstanciaId
    ): self {
        return new self(
            null,
            $fechaAusencia,
            $constancia,
            new Texto($observaciones, allowEmpty: true, maxLength: 4000),
            null,
            EstadoSolicitud::Pendiente,
            EntityId::fromInt($estudianteId),
            EntityId::fromInt($docenteId),
            EntityId::fromInt($asignaturaId),
            EntityId::fromInt($tipoConstanciaId)
        );
    }

    public static function reconstruir(
        int $id,
        DateTimeImmutable $fechaAusencia,
        ?ArchivoConstancia $constancia,
        string $observaciones,
        ?string $respuesta,
        EstadoSolicitud $estado,
        int $estudianteId,
        int $docenteId,
        int $asignaturaId,
        int $tipoConstanciaId
    ): self {
        return new self(
            EntityId::fromInt($id),
            $fechaAusencia,
            $constancia,
            new Texto($observaciones, allowEmpty: true, maxLength: 4000),
            $respuesta !== null ? new Texto($respuesta, allowEmpty: true, maxLength: 4000) : null,
            $estado,
            EntityId::fromInt($estudianteId),
            EntityId::fromInt($docenteId),
            EntityId::fromInt($asignaturaId),
            EntityId::fromInt($tipoConstanciaId)
        );
    }

    public function actualizarDatos(
        DateTimeImmutable $fechaAusencia,
        string $observaciones,
        int $docenteId,
        int $asignaturaId,
        int $tipoConstanciaId
    ): void {
        $this->fechaAusencia = $fechaAusencia;
        $this->observaciones = new Texto($observaciones, allowEmpty: true, maxLength: 4000);
        $this->docenteId = EntityId::fromInt($docenteId);
        $this->asignaturaId = EntityId::fromInt($asignaturaId);
        $this->tipoConstanciaId = EntityId::fromInt($tipoConstanciaId);
    }

    public function adjuntarConstancia(?ArchivoConstancia $constancia): void
    {
        $this->constancia = $constancia;
    }

    public function eliminarConstancia(): void
    {
        $this->constancia = null;
    }

    public function actualizarEstado(EstadoSolicitud $estado, ?string $respuesta): void
    {
        if ($estado === EstadoSolicitud::Pendiente && $respuesta !== null) {
            throw new InvalidArgumentException('Las solicitudes pendientes no deben contener respuesta.');
        }

        $this->estado = $estado;
        $this->respuesta = $respuesta !== null
            ? new Texto($respuesta, allowEmpty: false, maxLength: 4000)
            : null;

        $this->ensureRespuestaConsistente();
    }

    public function id(): ?EntityId
    {
        return $this->id;
    }

    public function estudianteId(): EntityId
    {
        return $this->estudianteId;
    }

    public function docenteId(): EntityId
    {
        return $this->docenteId;
    }

    public function asignaturaId(): EntityId
    {
        return $this->asignaturaId;
    }

    public function tipoConstanciaId(): EntityId
    {
        return $this->tipoConstanciaId;
    }

    public function estado(): EstadoSolicitud
    {
        return $this->estado;
    }

    public function respuesta(): ?Texto
    {
        return $this->respuesta;
    }

    public function fechaAusencia(): DateTimeImmutable
    {
        return $this->fechaAusencia;
    }

    public function constancia(): ?ArchivoConstancia
    {
        return $this->constancia;
    }

    public function observaciones(): Texto
    {
        return $this->observaciones;
    }

    /**
     * @return array<string, mixed>
     */
    public function payloadParaCreacion(): array
    {
        return [
            'fecha_ausencia' => $this->fechaAusencia->format('Y-m-d'),
            'constancia' => $this->constancia?->path(),
            'observaciones' => $this->observaciones->value(),
            'respuesta' => null,
            'estado' => $this->estado,
            'estudiante_id' => $this->estudianteId->value(),
            'docente_id' => $this->docenteId->value(),
            'asignatura_id' => $this->asignaturaId->value(),
            'tipo_constancia_id' => $this->tipoConstanciaId->value(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function payloadParaActualizacion(): array
    {
        return [
            'fecha_ausencia' => $this->fechaAusencia->format('Y-m-d'),
            'constancia' => $this->constancia?->path(),
            'observaciones' => $this->observaciones->value(),
            'docente_id' => $this->docenteId->value(),
            'asignatura_id' => $this->asignaturaId->value(),
            'tipo_constancia_id' => $this->tipoConstanciaId->value(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function payloadParaCambioEstado(): array
    {
        return [
            'estado' => $this->estado,
            'respuesta' => $this->respuesta?->value(),
        ];
    }

    private function ensureRespuestaConsistente(): void
    {
        if ($this->estado !== EstadoSolicitud::Pendiente && $this->respuesta === null) {
            throw new InvalidArgumentException('Una solicitud resuelta debe contar con respuesta.');
        }
    }
}
