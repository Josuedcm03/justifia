<?php

namespace App\Models\ModuloSecretaria;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;

// Models
use App\Models\ModuloEstudiante\Estudiante;
use App\Models\ModuloSecretaria\Docente;
use App\Models\ModuloSecretaria\Facultad;

class Carrera extends Model
{
    use HasFactory, Notifiable;

    protected $table = 'carreras';
    protected $primaryKey = 'id';

    protected $fillable = [
        'nombre',
        'facultad_id',
    ];

    // Relaciones

    public function estudiantes()
    {
        return $this->hasMany(Estudiante::class, 'carrera_id', 'id');
    }

    public function docentes()
    {
        return $this->hasMany(Docente::class, 'carrera_id', 'id');
    }

    public function facultad()
    {
        return $this->belongsTo(Facultad::class, 'facultad_id', 'id');
    }
}
