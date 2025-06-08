<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;

class Carrera extends Model
{
    use HasFactory, Notifiable;

    protected $table = 'carreras';
    public $timestamps = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'nombre',
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
