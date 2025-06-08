<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use \Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;

class Docente extends Model
{
    use HasFactory, Notifiable; 

    protected $table = 'docente';
    public $timestamps = false;
    protected $primaryKey = 'id';


    protected $fillable = [
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
