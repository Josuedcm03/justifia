<?php

namespace App\Presentation\Http\Controllers\Secretaria;

use App\Presentation\Http\Controllers\Controller;

class CatalogoController extends Controller
{
    public function index()
    {
        return view('ModuloSecretaria.catalogos.index');
    }
}