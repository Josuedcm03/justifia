<?php

namespace Tests\Unit\Application\Shared\Event;

use App\Infrastructure\Event\InMemoryEventBus;
use PHPUnit\Framework\TestCase;

final class InMemoryEventBusTest extends TestCase
{
    public function testPublishNotifiesSubscribedListeners(): void
    {
        $bus = new InMemoryEventBus();
        $event = new DummyEvent();
        $received = 0;

        $listener = function (DummyEvent $emitted) use (&$received, $event): void {
            if ($emitted === $event) {
                $received++;
            }
        };

        $bus->subscribe(DummyEvent::class, $listener);
        $bus->publish($event);

        self::assertSame(1, $received);

        $bus->unsubscribe(DummyEvent::class, $listener);
        $bus->publish(new DummyEvent());

        self::assertSame(1, $received, 'Listener should not be triggered after unsubscribe.');
    }
}

final class DummyEvent
{
}
