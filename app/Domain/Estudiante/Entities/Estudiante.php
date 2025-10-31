<?php

namespace App\Domain\Estudiante\Entities;

use App\Domain\Catalogo\Entities\Carrera;
use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Usuarios\Entities\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Estudiante extends Model
{
    use HasFactory;

    protected $table = 'estudiantes';
    public $timestamps = false;
    protected $primaryKey = 'id';

    /**
     * @var array<string>
     */
    protected $fillable = [
        'cif',
        'usuario_id',
        'carrera_id',
    ];

    // Relaciones

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id', 'id');
    }

    public function carrera()
    {
        return $this->belongsTo(Carrera::class, 'carrera_id', 'id');
    }

    public function solicitudes()
    {
        return $this->hasMany(Solicitud::class, 'estudiante_id', 'id');
    }
}

\class_alias(Estudiante::class, 'App\\Models\\ModuloEstudiante\\Estudiante');
