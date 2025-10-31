<?php

namespace App\Models\ModuloSecretaria;

use App\Domain\Shared\Contracts\Entity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;

// Models
use App\Models\ModuloEstudiante\Estudiante;

use App\Models\ModuloSecretaria\Facultad;

class Carrera extends Model implements Entity
{
    use HasFactory, Notifiable;

    protected $table = 'carreras';
    public $timestamps = false;
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

    public function facultad()
    {
        return $this->belongsTo(Facultad::class, 'facultad_id', 'id');
    }
}
