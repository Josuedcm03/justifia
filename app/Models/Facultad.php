<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;

class Facultad extends Model
{
    use HasFactory, Notifiable;

    protected $table = 'facultad';
    public $timestamps = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'nombre',
    ];

    // Relaciones
    public function carreras()
    {
        return $this->hasMany(Carrera::class, 'facultad_id', 'id');
    }
}
