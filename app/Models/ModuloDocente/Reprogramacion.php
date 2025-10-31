<?php

namespace App\Models\ModuloDocente;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Enums\EstadoAsistencia;

// Models
use App\Models\ModuloEstudiante\Solicitud;

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