<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('solicitudes', function (Blueprint $table) {
            $table->id();
            $table->date('fecha_ausencia');
            $table->string('constancia');
            $table->text('observaciones')->nullable();
            $table->string('estado');
            $table->foreignId('estudiante_id')->constrained('estudiantes');
            $table->foreignId('docente_asignatura_id')->constrained('docente_asignaturas');
            $table->foreignId('tipo_constancia_id')->constrained('tipo_constancias');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('solicitudes');
    }
};
