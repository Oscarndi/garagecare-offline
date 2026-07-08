<?php

use App\Http\Controllers\Api\AssistantController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\ServiceItemController;
use App\Http\Controllers\Api\StockItemController;
use App\Http\Controllers\Api\StockMovementController;
use App\Http\Controllers\Api\VehicleController;
use App\Http\Controllers\Api\WorkOrderController;
use App\Http\Middleware\GarageCareAdminOnly;
use App\Http\Middleware\GarageCareTokenAuth;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\LoyaltyController;

Route::get('/health', function () {
    return response()->json([
        'ok' => true,
        'app' => 'GarageCare Offline',
        'service' => 'garagecare-api',
        'stage' => 'R1C_BACKEND_CORE',
    ]);
});

Route::post('/login', [AuthController::class, 'login']);

Route::middleware([GarageCareTokenAuth::class])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{user}/password', [UserController::class, 'resetPassword']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('vehicles', VehicleController::class);
    Route::apiResource('services', ServiceItemController::class)->parameters(['services' => 'serviceItem']);
    Route::apiResource('work-orders', WorkOrderController::class)->parameters(['work-orders' => 'workOrder']);

    Route::post('/assistant/message', [AssistantController::class, 'message']);
    Route::get('/assistant/messages', [AssistantController::class, 'index']);

    Route::middleware([GarageCareAdminOnly::class])->group(function () {
        Route::get('/stock-items', [StockItemController::class, 'index']);
        Route::get('/stock-movements', [StockMovementController::class, 'index']);
        Route::post('/stock-items', [StockItemController::class, 'store']);
        Route::put('/stock-items/{stockItem}', [StockItemController::class, 'update']);

        Route::get('/expenses', [ExpenseController::class, 'index']);
        Route::post('/expenses', [ExpenseController::class, 'store']);
        Route::put('/expenses/{expense}', [ExpenseController::class, 'update']);
    });
});


Route::get('/customers/{customer}/loyalty', [LoyaltyController::class, 'show']);
    Route::post('/customers/{customer}/loyalty/earn', [LoyaltyController::class, 'earn']);
    Route::post('/customers/{customer}/loyalty/redeem', [LoyaltyController::class, 'redeem']);
    Route::post('/customers/{customer}/loyalty/adjust', [LoyaltyController::class, 'adjust']);
    Route::post('/customers/{customer}/loyalty/apply-reward', [LoyaltyController::class, 'applyRewardToWorkOrder']);
    Route::post('/customers/{customer}/loyalty/pay-debt', [LoyaltyController::class, 'payDebt']);
    Route::post('/customers/{customer}/loyalty/debt-reminder', [LoyaltyController::class, 'debtReminder']);


