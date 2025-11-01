<?php

namespace App\Application\Shared\Contracts;

use Illuminate\Http\UploadedFile;

interface FileStorage
{
    public function store(string $directory, UploadedFile $file): string;

    public function exists(string $path): bool;

    public function delete(string $path): void;
}
