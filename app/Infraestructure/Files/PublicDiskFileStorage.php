<?php

namespace App\Infraestructure\Files;

use App\Application\Shared\Contracts\FileStorage;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;

final class PublicDiskFileStorage implements FileStorage
{
    public function __construct(private readonly FilesystemAdapter $filesystem)
    {
    }

    public function store(string $directory, UploadedFile $file): string
    {
        return $this->filesystem->putFile($directory, $file);
    }

    public function exists(string $path): bool
    {
        return $this->filesystem->exists($path);
    }

    public function delete(string $path): void
    {
        $this->filesystem->delete($path);
    }
}
