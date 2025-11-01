<?php

namespace App\Application\Shared\Contracts;

use Closure;

interface TransactionManager
{
    public function run(Closure $callback): mixed;
}
