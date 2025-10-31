<?php

namespace App\Domain\Shared;

use DateTimeImmutable;

abstract class DomainEvent
{
    private readonly DateTimeImmutable $occurredOn;

    public function __construct(?DateTimeImmutable $occurredOn = null)
    {
        $this->occurredOn = $occurredOn ?? new DateTimeImmutable();
    }

    public function occurredOn(): DateTimeImmutable
    {
        return $this->occurredOn;
    }

    abstract public function eventName(): string;

    /**
     * @return array<string, mixed>
     */
    abstract public function payload(): array;
}
