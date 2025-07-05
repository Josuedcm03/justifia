<?php

namespace App\Models\ModuloSecretaria;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;

// Models
use App\Models\ModuloSecretaria\Carrera;
use App\Models\ModuloSecretaria\Asignatura;

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
