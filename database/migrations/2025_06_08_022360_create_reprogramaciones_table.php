<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reprogramaciones', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->time('hora');
            $table->string('asistencia')->default('pendiente');
            $table->text('observaciones')->nullable();
            $table->foreignId('solicitud_id')->constrained('solicitudes');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reprogramaciones');
    }
};