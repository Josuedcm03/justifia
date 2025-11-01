<?php

namespace App\Models\ModuloEstudiante;

use App\Domain\Apelaciones\Tree\ApelacionHistorialBuilder;
use App\Domain\Shared\Enums\EstadoApelacion;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Apelacion extends Model
{
    use HasFactory;

    protected $table = 'apelaciones';
    public $timestamps = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'observacion',
        'respuesta',
        'estado',
        'solicitud_id',
        'apelacion_id',
    ];

    protected $casts = [
        'estado' => EstadoApelacion::class,
    ];

    public function solicitud()
    {
        return $this->belongsTo(Solicitud::class, 'solicitud_id', 'id');
    }

    public function apelacionPadre()
    {
        return $this->belongsTo(Apelacion::class, 'apelacion_id', 'id');
    }

    public function apelacionesHijas()
    {
        return $this->hasMany(Apelacion::class, 'apelacion_id', 'id');
    }

    /**
     * Obtener el historial completo de esta apelación en orden cronológico.
     * El historial comienza con la primera respuesta de la secretaría a la
     * solicitud inicial y continúa con las observaciones y respuestas de cada
     * apelación.
     */
    public function historial(): array
    {
        $cadena = [];
        $actual = $this;
        while ($actual) {
            $cadena[] = [
                'observacion' => $actual->observacion,
                'respuesta' => $actual->respuesta,
            ];
            $actual = $actual->apelacionPadre;
        }

        $builder = new ApelacionHistorialBuilder();

        return $builder->build($this->solicitud->respuesta, array_reverse($cadena));
    }
}
