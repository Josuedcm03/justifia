<?php

namespace App\Application\Shared\Event;

interface EventBus
{
    /**
     * @param callable(object): void $listener
     */
    public function subscribe(string $eventName, callable $listener): void;

    /**
     * @param callable(object): void $listener
     */
    public function unsubscribe(string $eventName, callable $listener): void;

    public function publish(object $event): void;
}
