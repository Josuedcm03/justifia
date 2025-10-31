<?php

namespace App\Domain\Docente\Entities;

use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Usuarios\Entities\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;

class Docente extends Model
{
    use HasFactory, Notifiable;

    protected $table = 'docentes';
    public $timestamps = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'cif',
        'usuario_id',
    ];

    // Relaciones

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id', 'id');
    }

    public function solicitudes()
    {
        return $this->hasMany(Solicitud::class, 'docente_id', 'id');
    }
}

\class_alias(Docente::class, 'App\\Models\\ModuloSecretaria\\Docente');
