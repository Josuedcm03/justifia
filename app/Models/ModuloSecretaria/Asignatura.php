<?php

namespace App\Models\ModuloSecretaria;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Factories\HasFactory;

// Models
use App\Models\ModuloSecretaria\DocenteAsignatura;
use App\Models\ModuloEstudiante\Solicitud;

class Asignatura extends Model
{
    use HasFactory, Notifiable;

    protected $table = 'asignaturas';
    public $timestamps = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'nombre',
    ];

    /**
     * 1 Asignatura puede tener N grupos asignados a través de DocenteAsignatura
     */
    public function docenteAsignaturas()
    {
        return $this->hasMany(DocenteAsignatura::class, 'asignatura_id', 'id');
    }

    /**
     * (Opcional) Solicitudes asociadas atravesando DocenteAsignatura
     */
    public function solicitudes()
    {
        return $this->hasManyThrough(
            Solicitud::class,
            DocenteAsignatura::class,
            'asignatura_id',          // FK en docente_asignatura
            'docente_asignatura_id',  // FK en solicitud
            'id',                     // PK local de asignatura
            'id'                      // PK local de docente_asignatura
        );
    }
}
