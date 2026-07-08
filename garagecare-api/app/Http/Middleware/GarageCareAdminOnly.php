<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class GarageCareAdminOnly
{
    public function handle(Request $request, Closure $next)
    {
        if (($request->user()?->role ?? null) !== 'admin') {
            return response()->json(['message' => 'Action réservée à l’administrateur.'], 403);
        }

        return $next($request);
    }
}
