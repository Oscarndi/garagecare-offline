<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'app' => 'GarageCare Offline API',
        'status' => 'ok',
        'message' => 'Backend Laravel opérationnel. Utiliser les routes /api/* pour accéder aux données.',
    ]);
});
