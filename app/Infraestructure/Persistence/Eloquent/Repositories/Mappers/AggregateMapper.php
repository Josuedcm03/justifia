<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Domain\Shared\Contracts\Entity;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

abstract class AggregateMapper
{
    abstract protected function modelClass(): string;

    abstract protected function entityClass(): string;

    /**
     * @param Model $model
     */
    abstract protected function mapToEntity(Model $model): Entity;

    /**
     * @param Entity $entity
     */
    abstract protected function mapToModel(Entity $entity): Model;

    public function toEntity(Model $model): Entity
    {
        $modelClass = $this->modelClass();

        if (! $model instanceof $modelClass) {
            throw new InvalidArgumentException(
                sprintf('Expected instance of %s, got %s.', $modelClass, $model::class)
            );
        }

        return $this->mapToEntity($model);
    }

    public function toModel(Entity $entity): Model
    {
        $entityClass = $this->entityClass();

        if (! $entity instanceof $entityClass) {
            throw new InvalidArgumentException(
                sprintf('Expected instance of %s, got %s.', $entityClass, $entity::class)
            );
        }

        return $this->mapToModel($entity);
    }
}
