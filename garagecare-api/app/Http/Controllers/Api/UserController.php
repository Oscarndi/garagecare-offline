<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const ROLES = ['admin', 'agent'];

    private const STATUSES = ['actif', 'inactif'];

    public function index(): array
    {
        return [
            'data' => User::query()
                ->select(['id', 'name', 'email', 'role', 'status', 'created_at', 'updated_at'])
                ->orderBy('name')
                ->get()
                ->map(fn (User $user) => $this->serialize($user))
                ->values(),
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'role' => ['required', Rule::in(self::ROLES)],
            'status' => ['sometimes', Rule::in(self::STATUSES)],
            'password' => ['required', 'string', 'min:6'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'role' => $data['role'],
            'status' => $data['status'] ?? 'actif',
            'password' => Hash::make($data['password']),
        ]);

        return response()->json([
            'message' => 'Utilisateur créé.',
            'data' => $this->serialize($user),
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'email' => ['sometimes', 'required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['sometimes', Rule::in(self::ROLES)],
            'status' => ['sometimes', Rule::in(self::STATUSES)],
        ]);

        $this->ensureLastAdminIsSafe($user, $data);

        $user->fill($data);
        $user->save();

        return response()->json([
            'message' => 'Utilisateur mis à jour.',
            'data' => $this->serialize($user->refresh()),
        ]);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'password' => ['required', 'string', 'min:6'],
        ]);

        $user->forceFill([
            'password' => Hash::make($data['password']),
            'api_token' => null,
        ])->save();

        return response()->json([
            'message' => 'Mot de passe réinitialisé.',
            'data' => $this->serialize($user->refresh()),
        ]);
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Action réservée aux administrateurs.');
    }

    private function ensureLastAdminIsSafe(User $target, array $data): void
    {
        $currentRole = $target->role ?: 'agent';
        $currentStatus = $target->status ?: 'actif';

        $nextRole = $data['role'] ?? $currentRole;
        $nextStatus = $data['status'] ?? $currentStatus;

        $isActiveAdmin = $currentRole === 'admin' && $currentStatus === 'actif';
        $wouldRemainActiveAdmin = $nextRole === 'admin' && $nextStatus === 'actif';

        if (! $isActiveAdmin || $wouldRemainActiveAdmin) {
            return;
        }

        $activeAdmins = User::query()
            ->where('role', 'admin')
            ->where('status', 'actif')
            ->count();

        abort_if($activeAdmins <= 1, 422, 'Impossible de retirer ou désactiver le dernier administrateur actif.');
    }

    private function serialize(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role ?: 'agent',
            'status' => $user->status ?: 'actif',
            'created_at' => optional($user->created_at)->toDateTimeString(),
            'updated_at' => optional($user->updated_at)->toDateTimeString(),
        ];
    }
}
