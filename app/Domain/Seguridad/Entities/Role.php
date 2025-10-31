<?php

namespace App\Models\ModuloSeguridad;

use App\Domain\Shared\Contracts\Entity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Role extends Model implements Entity
{
    use HasFactory;

    protected $table = 'roles';
    public $timestamps = false;
    protected $fillable = ['name'];
}