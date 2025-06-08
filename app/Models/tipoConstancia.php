<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class tipoConstancia extends Model
{
    use HasFactory, Notifiable;

    protected $table = 'tipo_constancia';
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
