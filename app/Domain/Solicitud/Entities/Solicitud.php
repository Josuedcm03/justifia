<?php

namespace App\Domain\Solicitud\Entities;

use App\Domain\Apelaciones\Entities\Apelacion;
use App\Domain\Catalogo\Entities\Asignatura;
use App\Domain\Catalogo\Entities\TipoConstancia;
use App\Domain\Docente\Entities\Docente;
use App\Domain\Estudiante\Entities\Estudiante;
use App\Domain\Reprogramacion\Entities\Reprogramacion;
use App\Enums\EstadoSolicitud;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;

class Solicitud extends Model
{
    use HasFactory, Notifiable;

    protected $table = 'solicitudes';
    public $timestamps = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'fecha_ausencia',
        'constancia',             // "jpg" | "pdf"
        'observaciones',
        'respuesta',
        'estado',                 // "pendiente" | "aprobada" | "rechazada"
        'estudiante_id',
        'docente_id',
        'asignatura_id',
        'tipo_constancia_id',
    ];

    protected $dates = [
        'fecha_ausencia',
    ];

    protected $casts = [
        'estado' => EstadoSolicitud::class,
    ];

    // Relaciones

    public function estudiante()
    {
        return $this->belongsTo(Estudiante::class, 'estudiante_id', 'id');
    }

    public function docente()
    {
        return $this->belongsTo(Docente::class, 'docente_id', 'id');
    }

    public function asignatura()
    {
        return $this->belongsTo(Asignatura::class, 'asignatura_id', 'id');
    }

    public function tipoConstancia()
    {
        return $this->belongsTo(TipoConstancia::class, 'tipo_constancia_id', 'id');
    }

    public function apelaciones()
    {
        return $this->hasMany(Apelacion::class, 'solicitud_id', 'id');
    }

    public function reprogramacion()
    {
        return $this->hasOne(Reprogramacion::class, 'solicitud_id', 'id');
    }
}

\class_alias(Solicitud::class, 'App\\Models\\ModuloEstudiante\\Solicitud');
