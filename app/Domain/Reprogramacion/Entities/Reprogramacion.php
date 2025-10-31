<?php

namespace App\Domain\Reprogramacion\Entities;

use App\Domain\Solicitud\Entities\Solicitud;
use App\Enums\EstadoAsistencia;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Reprogramacion extends Model
{
    use HasFactory;

    protected $table = 'reprogramaciones';
    public $timestamps = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'fecha',
        'hora',
        'asistencia',
        'observaciones',
        'solicitud_id',
    ];

    protected $dates = [
        'fecha',
    ];

    protected $casts = [
        'asistencia' => EstadoAsistencia::class,
    ];

    public function solicitud()
    {
        return $this->belongsTo(Solicitud::class, 'solicitud_id', 'id');
    }
}

\class_alias(Reprogramacion::class, 'App\\Models\\ModuloDocente\\Reprogramacion');
