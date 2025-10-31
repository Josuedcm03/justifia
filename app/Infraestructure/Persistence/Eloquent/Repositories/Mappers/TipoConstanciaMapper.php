<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Domain\Catalogo\Entities\TipoConstancia as TipoConstanciaEntity;
use App\Domain\Shared\Contracts\Entity;
use App\Models\ModuloSecretaria\TipoConstancia as TipoConstanciaModel;
use Illuminate\Database\Eloquent\Model;

class TipoConstanciaMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return TipoConstanciaModel::class;
    }

    protected function entityClass(): string
    {
        return TipoConstanciaEntity::class;
    }

    protected function mapToEntity(Model $model): Entity
    {
        /** @var TipoConstanciaModel $model */
        return TipoConstanciaEntity::reconstruir(
            (int) $model->id,
            $model->nombre
        );
    }

    protected function mapToModel(Entity $entity): Model
    {
        /** @var TipoConstanciaEntity $entity */
        $modelClass = $this->modelClass();

        /** @var TipoConstanciaModel $model */
        $model = $entity->id() !== null
            ? $modelClass::findOrFail($entity->id()->value())
            : new $modelClass();

        $model->fill([
            'nombre' => $entity->nombre()->value(),
        ]);

        return $model;
    }
}
