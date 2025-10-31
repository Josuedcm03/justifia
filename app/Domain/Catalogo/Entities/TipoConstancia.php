<?php

namespace App\Domain\Catalogo\Entities;

use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;

class TipoConstancia extends Model
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

\class_alias(TipoConstancia::class, 'App\\Models\\ModuloSecretaria\\TipoConstancia');
