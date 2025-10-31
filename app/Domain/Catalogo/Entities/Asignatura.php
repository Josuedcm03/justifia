<?php

namespace App\Domain\Catalogo\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Factories\HasFactory;

use App\Domain\Catalogo\Entities\Facultad;
use App\Domain\Solicitud\Entities\Solicitud;

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
