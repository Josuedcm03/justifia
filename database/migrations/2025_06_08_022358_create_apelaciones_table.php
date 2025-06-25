<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('apelaciones', function (Blueprint $table) {
            $table->id();
            $table->text('observacion');
            $table->text('respuesta')->nullable();
            $table->string('estado');
            $table->foreignId('solicitud_id')->constrained('solicitudes');
            $table->foreignId('apelacion_id')->nullable()->constrained('apelaciones');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('apelaciones');
    }
};