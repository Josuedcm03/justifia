<?php

namespace App\Models\ModuloEstudiante;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Enums\EstadoApelacion;

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
        $historial = [];

        $cadena = [];
        $actual = $this;
        while ($actual) {
            $cadena[] = $actual;
            $actual = $actual->apelacionPadre;
        }
        $cadena = array_reverse($cadena);

        $respuestaInicial = $this->solicitud->respuesta;
        if ($respuestaInicial) {
            $historial[] = ['autor' => 'secretaria', 'mensaje' => $respuestaInicial];
        }

        foreach ($cadena as $apelacion) {
            $historial[] = ['autor' => 'estudiante', 'mensaje' => $apelacion->observacion];
            if ($apelacion->respuesta) {
                $historial[] = ['autor' => 'secretaria', 'mensaje' => $apelacion->respuesta];
            }
        }

        return $historial;
    }
}