<?php

namespace App\Domain\Shared;

final class OptimisticLockException extends DomainException
{
    public static function conflicted(
        string $aggregate,
        int $id,
        int $expectedVersion,
        ?int $currentVersion = null
    ): self {
        $message = sprintf(
            'Conflicto de concurrencia al actualizar %s #%d. Versión esperada: %d%s.',
            $aggregate,
            $id,
            $expectedVersion,
            $currentVersion !== null ? ', versión actual: ' . $currentVersion : ''
        );

        return self::withMessage($message, [
            'aggregate' => $aggregate,
            'id' => $id,
            'expected_version' => $expectedVersion,
            'current_version' => $currentVersion,
        ]);
    }
}
