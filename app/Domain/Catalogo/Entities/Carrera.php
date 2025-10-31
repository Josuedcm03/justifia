<?php

namespace App\Domain\Catalogo\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;

use App\Domain\Estudiante\Entities\Estudiante;
use App\Domain\Catalogo\Entities\Facultad;

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
