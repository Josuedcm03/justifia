<?php

namespace App\Infrastructure\Persistence;

use App\Application\Shared\Contracts\TransactionManager;
use Closure;
use Illuminate\Database\DatabaseManager;

final class DatabaseTransactionManager implements TransactionManager
{
    public function __construct(private readonly DatabaseManager $database)
    {
    }

    public function run(Closure $callback): mixed
    {
        return $this->database->connection()->transaction($callback);
    }
}
