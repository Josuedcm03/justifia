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
}