<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Models\ModuloSeguridad\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Auth\Notifications\VerifyEmail;
use Tests\TestCase;

class TeacherEmailVerificationOnLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_unverified_teacher_receives_verification_email_on_login(): void
    {
        $role = Role::create(['name' => 'docente']);
        $user = User::factory()->unverified()->create(['role_id' => $role->id]);

        Notification::fake();

        $response = $this->post('/login', [
            'login' => $user->email,
            'password' => 'password',
        ]);

        Notification::assertSentTo($user, VerifyEmail::class);
        $response->assertRedirect(route('docente.solicitudes.index', absolute: false));
    }
}