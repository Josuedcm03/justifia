<?php

namespace App\Models\ModuloSecretaria;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Factories\HasFactory;

// Models
use App\Models\ModuloEstudiante\Solicitud;

class TipoConstancia extends Model
{
    use HasFactory, Notifiable;

    protected $table = 'tipo_constancias';
    protected $primaryKey = 'id';

    protected $fillable = [
        'nombre',
    ];

    // Relaciones

    public function solicitudes()
    {
        return $this->hasMany(Solicitud::class, 'tipo_constancia_id', 'id');
    }

}
