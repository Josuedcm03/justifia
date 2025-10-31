<?php

namespace App\Domain\Catalogo\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;

use App\Domain\Catalogo\Entities\Carrera;
use App\Domain\Catalogo\Entities\Asignatura;

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
