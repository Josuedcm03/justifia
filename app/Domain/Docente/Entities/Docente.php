<?php

namespace App\Models\ModuloSecretaria;

use App\Domain\Shared\Contracts\Entity;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Model;
use \Illuminate\Database\Eloquent\Factories\HasFactory;

// Models
use App\Models\User;

use App\Models\ModuloEstudiante\Solicitud;


class Docente extends Model implements Entity
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
