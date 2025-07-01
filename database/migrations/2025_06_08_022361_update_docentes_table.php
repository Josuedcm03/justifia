<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('docentes', function (Blueprint $table) {
            $table->string('cif')->after('id');
            $table->unsignedBigInteger('usuario_id')->nullable()->change();
            $table->unsignedBigInteger('carrera_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('docentes', function (Blueprint $table) {
            $table->dropColumn('cif');
            $table->unsignedBigInteger('usuario_id')->nullable(false)->change();
            $table->unsignedBigInteger('carrera_id')->nullable(false)->change();
        });
    }
};