<?php

namespace App\Domain\Catalogo\Entities;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;

class Facultad extends Model
{
    use HasFactory, Notifiable;

    protected $table = 'facultades';
    public $timestamps = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'nombre',
    ];

    // Relaciones
    public function carreras()
    {
        return $this->hasMany(Carrera::class, 'facultad_id', 'id');
    }

    public function asignaturas()
    {
        return $this->hasMany(Asignatura::class, 'facultad_id', 'id');
    }
}

\class_alias(Facultad::class, 'App\\Models\\ModuloSecretaria\\Facultad');
