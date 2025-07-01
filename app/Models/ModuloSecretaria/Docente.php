<?php

namespace App\Models\ModuloSecretaria;

use Illuminate\Database\Eloquent\Model;
use \Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;

// Models
use App\Models\User;
use App\Models\ModuloSecretaria\Carrera;
use App\Models\ModuloSecretaria\DocenteAsignatura;

class Docente extends Model
{
    use HasFactory, Notifiable; 

    protected $table = 'docentes';
    public $timestamps = false;
    protected $primaryKey = 'id';


    protected $fillable = [
        'cif',
        'usuario_id',
        'carrera_id',
    ];

    // Relaciones

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id', 'id');
    }

    public function carrera()
    {
        return $this->belongsTo(Carrera::class, 'carrera_id', 'id');
    }

    public function asignaturas()
    {
        return $this->hasMany(DocenteAsignatura::class, 'docente_id', 'id');
    }


}
