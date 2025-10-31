<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asignaturas', function (Blueprint $table) {
            $table->foreignId('facultad_id')->nullable()->after('nombre')->constrained('facultades');
        });
    }

    public function down(): void
    {
        Schema::table('asignaturas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('facultad_id');
        });
    }
};