<?php

namespace App\Domain\Seguridad\Entities;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    use HasFactory;

    protected $table = 'roles';
    public $timestamps = false;
    protected $fillable = ['name'];
}

\class_alias(Role::class, 'App\\Models\\ModuloSeguridad\\Role');
