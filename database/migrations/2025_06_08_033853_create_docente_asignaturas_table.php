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
        Schema::create('docente_asignaturas', function (Blueprint $table) {
            $table->id();
            $table->string('grupo');
            $table->foreignId('docente_id')->constrained('docentes');
            $table->foreignId('asignatura_id')->constrained('asignaturas');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('docente_asignaturas');
    }
};
