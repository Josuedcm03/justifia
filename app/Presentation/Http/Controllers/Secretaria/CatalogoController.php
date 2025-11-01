<?php

namespace App\Presentation\Http\Controllers\Secretaria;

use App\Presentation\Http\Controllers\Shared\Controller;

class CatalogoController extends Controller
{
    public function index()
    {
        return view('presentation.secretaria.catalogos.index');
    }
}