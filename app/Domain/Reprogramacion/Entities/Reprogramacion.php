<?php

namespace App\Models\ModuloDocente;

use App\Domain\Shared\Contracts\Entity;
use App\Enums\EstadoAsistencia;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

// Models
use App\Models\ModuloEstudiante\Solicitud;

class Reprogramacion extends Model implements Entity
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