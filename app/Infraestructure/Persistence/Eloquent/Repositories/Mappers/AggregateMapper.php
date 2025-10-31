<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Domain\Shared\Contracts\Entity;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

abstract class AggregateMapper
{
    abstract protected function modelClass(): string;

    public function toEntity(Model $model): Entity
    {
        $class = $this->modelClass();

        if (! $model instanceof $class) {
            throw new InvalidArgumentException(
                sprintf('Expected instance of %s, got %s.', $class, $model::class)
            );
        }

        return $model;
    }

    public function toModel(Entity $entity): Model
    {
        $class = $this->modelClass();

        if (! $entity instanceof $class) {
            throw new InvalidArgumentException(
                sprintf('Expected instance of %s, got %s.', $class, $entity::class)
            );
        }

        return $entity;
    }
}
