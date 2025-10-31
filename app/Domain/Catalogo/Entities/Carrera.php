<?php

namespace App\Domain\Catalogo\Entities;

use App\Domain\Estudiante\Entities\Estudiante;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;

class Carrera extends Model
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

\class_alias(Carrera::class, 'App\\Models\\ModuloSecretaria\\Carrera');
