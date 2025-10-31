<?php

namespace App\Domain\Usuarios\Entities;

use App\Domain\Shared\Contracts\Entity;
use App\Domain\Shared\ValueObjects\EmailAddress;
use App\Domain\Shared\ValueObjects\EntityId;
use App\Domain\Shared\ValueObjects\Nombre;
use DateTimeImmutable;

final class User implements Entity
{
    private ?EntityId $id;
    private Nombre $nombre;
    private EmailAddress $email;
    private ?string $passwordHash;
    private ?EntityId $roleId;
    private ?DateTimeImmutable $emailVerificadoEn;

    private function __construct(
        ?EntityId $id,
        Nombre $nombre,
        EmailAddress $email,
        ?string $passwordHash,
        ?EntityId $roleId,
        ?DateTimeImmutable $emailVerificadoEn
    ) {
        $this->id = $id;
        $this->nombre = $nombre;
        $this->email = $email;
        $this->passwordHash = $passwordHash;
        $this->roleId = $roleId;
        $this->emailVerificadoEn = $emailVerificadoEn;
    }

    public static function registrar(string $nombre, string $email, ?string $passwordHash, ?int $roleId = null): self
    {
        return new self(
            null,
            new Nombre($nombre),
            new EmailAddress($email),
            $passwordHash,
            $roleId ? EntityId::fromInt($roleId) : null,
            null
        );
    }

    public static function reconstruir(
        int $id,
        string $nombre,
        string $email,
        ?string $passwordHash,
        ?int $roleId,
        ?DateTimeImmutable $emailVerificadoEn
    ): self {
        return new self(
            EntityId::fromInt($id),
            new Nombre($nombre),
            new EmailAddress($email),
            $passwordHash,
            $roleId ? EntityId::fromInt($roleId) : null,
            $emailVerificadoEn
        );
    }

    public function cambiarNombre(string $nombre): void
    {
        $this->nombre = new Nombre($nombre);
    }

    public function cambiarEmail(string $email): void
    {
        $this->email = new EmailAddress($email);
        $this->emailVerificadoEn = null;
    }

    public function asignarRole(?int $roleId): void
    {
        $this->roleId = $roleId ? EntityId::fromInt($roleId) : null;
    }

    public function establecerPasswordHash(?string $hash): void
    {
        $this->passwordHash = $hash;
    }

    public function verificarEmail(DateTimeImmutable $fecha): void
    {
        $this->emailVerificadoEn = $fecha;
    }

    public function id(): ?EntityId
    {
        return $this->id;
    }

    public function nombre(): Nombre
    {
        return $this->nombre;
    }

    public function email(): EmailAddress
    {
        return $this->email;
    }

    public function passwordHash(): ?string
    {
        return $this->passwordHash;
    }

    public function roleId(): ?EntityId
    {
        return $this->roleId;
    }

    public function emailVerificadoEn(): ?DateTimeImmutable
    {
        return $this->emailVerificadoEn;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'name' => $this->nombre->value(),
            'email' => (string) $this->email,
            'password' => $this->passwordHash,
            'role_id' => $this->roleId?->value(),
            'email_verified_at' => $this->emailVerificadoEn?->format('Y-m-d H:i:s'),
        ];
    }
}
