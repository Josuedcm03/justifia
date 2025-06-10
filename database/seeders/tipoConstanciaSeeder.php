<?php

namespace Database\Seeders;

use App\Models\tipoConstancia;
use Illuminate\Database\Seeder;

class TipoConstanciaSeeder extends Seeder
{
    public function run(): void
    {
        $tipos = ['Médica', 'Cultural','Deportiva','Otros'];

        foreach ($tipos as $nombre) {
            tipoConstancia::firstOrCreate(['nombre' => $nombre]);
        }
    }
}