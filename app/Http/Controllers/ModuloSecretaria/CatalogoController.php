<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;

class CatalogoController extends Controller
{
    public function index()
    {
        return view('ModuloSecretaria.catalogos.index');
    }
}