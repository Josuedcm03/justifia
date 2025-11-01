<?php

namespace App\Infrastructure\Event;

use App\Application\Shared\Event\EventBus;

final class InMemoryEventBus implements EventBus
{
    /**
     * @var array<string, list<callable(object): void>>
     */
    private array $listeners = [];

    public function subscribe(string $eventName, callable $listener): void
    {
        $this->listeners[$eventName][] = $listener;
    }

    public function unsubscribe(string $eventName, callable $listener): void
    {
        if (! isset($this->listeners[$eventName])) {
            return;
        }

        $this->listeners[$eventName] = array_values(array_filter(
            $this->listeners[$eventName],
            static fn (callable $registered): bool => $registered !== $listener
        ));

        if ($this->listeners[$eventName] === []) {
            unset($this->listeners[$eventName]);
        }
    }

    public function publish(object $event): void
    {
        $eventName = $event::class;

        foreach ($this->listeners[$eventName] ?? [] as $listener) {
            $listener($event);
        }
    }
}
