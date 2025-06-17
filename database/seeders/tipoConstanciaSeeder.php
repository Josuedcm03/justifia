<?php

namespace Database\Seeders;

use App\Models\TipoConstancia;
use Illuminate\Database\Seeder;

class TipoConstanciaSeeder extends Seeder
{
    public function run(): void
    {
        $tipos = ['Médica', 'Cultural','Deportiva','Otros'];

        foreach ($tipos as $nombre) {
            TipoConstancia::firstOrCreate(['nombre' => $nombre]);
        }
    }
}