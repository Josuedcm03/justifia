<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Solicitud extends Model
{
    use HasFactory, Notifiable;

    protected $table = 'solicitud';
    public $timestamps = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'fecha_ausencia',
        'constancia',             // "jpg" | "pdf"
        'observaciones',
        'estado',                 // "pendiente" | "aprobada" | "rechazada"
        'estudiante_id',
        'docente_asignatura_id',
        'tipo_constancia_id',
    ];

    protected $dates = [
        'fecha_ausencia',
    ];

    // Relaciones

    public function estudiante()
    {
        return $this->belongsTo(Estudiante::class, 'estudiante_id', 'id');
    }

    public function docenteAsignatura()
    {
        return $this->belongsTo(DocenteAsignatura::class, 'docente_asignatura_id', 'id');
    }

    public function tipoConstancia()
    {
        return $this->belongsTo(tipoConstancia::class, 'tipo_constancia_id', 'id');
    }
}
