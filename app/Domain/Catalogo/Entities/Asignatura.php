<?php

namespace App\Domain\Catalogo\Entities;

use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;

class Asignatura extends Model
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

\class_alias(Asignatura::class, 'App\\Models\\ModuloSecretaria\\Asignatura');
