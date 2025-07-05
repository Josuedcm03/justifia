<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('solicitudes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('docente_asignatura_id');
            $table->foreignId('docente_id')->after('estudiante_id')->constrained('docentes');
            $table->foreignId('asignatura_id')->after('docente_id')->constrained('asignaturas');
        });

        Schema::dropIfExists('docente_asignaturas');
    }

    public function down(): void
    {
        Schema::create('docente_asignaturas', function (Blueprint $table) {
            $table->id();
            $table->string('grupo');
            $table->foreignId('docente_id')->constrained('docentes');
            $table->foreignId('asignatura_id')->constrained('asignaturas');
        });

        Schema::table('solicitudes', function (Blueprint $table) {
            $table->dropForeign(['docente_id']);
            $table->dropColumn('docente_id');
            $table->dropForeign(['asignatura_id']);
            $table->dropColumn('asignatura_id');
            $table->foreignId('docente_asignatura_id')->constrained('docente_asignaturas');
        });
    }
};