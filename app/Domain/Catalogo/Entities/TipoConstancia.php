<?php

namespace App\Models\ModuloSecretaria;

use App\Domain\Shared\Contracts\Entity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;

// Models
use App\Models\ModuloEstudiante\Solicitud;

class TipoConstancia extends Model implements Entity
{
    use HasFactory, Notifiable;

    protected $table = 'tipo_constancias';
    public $timestamps = false;
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
