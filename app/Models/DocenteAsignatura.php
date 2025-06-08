<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class DocenteAsignatura extends Model
{
    use HasFactory, Notifiable;

    protected $table = 'docente_asignaturas';
    public $timestamps = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'grupo',
        'docente_id',
        'asignatura_id',
    ];

    /**
     * N grupos los imparte 1 Docente
     */
    public function docente()
    {
        return $this->belongsTo(Docente::class, 'docente_id', 'id');
    }

    /**
     * N grupos pertenecen a 1 Asignatura
     */
    public function asignatura()
    {
        return $this->belongsTo(Asignatura::class, 'asignatura_id', 'id');
    }

    /**
     * 1 DocenteAsignatura puede tener N Solicitudes
     */
    public function solicitudes()
    {
        return $this->hasMany(Solicitud::class, 'docente_asignatura_id', 'id');
    }
}
