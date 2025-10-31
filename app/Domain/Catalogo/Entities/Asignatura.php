<?php

namespace App\Models\ModuloSecretaria;

use App\Domain\Shared\Contracts\Entity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;

// Models
use App\Models\ModuloSecretaria\Facultad;
use App\Models\ModuloEstudiante\Solicitud;

class Asignatura extends Model implements Entity
{
    use HasFactory, Notifiable;

    protected $table = 'asignaturas';
    public $timestamps = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'nombre',
        'facultad_id',
    ];

    public function facultad()
    {
        return $this->belongsTo(Facultad::class, 'facultad_id', 'id');
    }

    public function solicitudes()
    {
        return $this->hasMany(Solicitud::class, 'asignatura_id', 'id');
    }
}
