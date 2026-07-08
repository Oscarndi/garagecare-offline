<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StockMovementController extends Controller
{
    public function index(Request $request)
    {
        if (! Schema::hasTable('stock_movements')) {
            return response()->json(['data' => []]);
        }

        $limit = min(max((int) $request->query('limit', 80), 1), 200);

        $rows = DB::table('stock_movements')
            ->leftJoin('stock_items', 'stock_movements.stock_item_id', '=', 'stock_items.id')
            ->leftJoin('work_orders', 'stock_movements.work_order_id', '=', 'work_orders.id')
            ->leftJoin('users', 'stock_movements.user_id', '=', 'users.id')
            ->orderByDesc('stock_movements.id')
            ->limit($limit)
            ->get([
                'stock_movements.id',
                'stock_movements.stock_item_id',
                'stock_items.name as stock_item_name',
                'stock_movements.work_order_id',
                'work_orders.title as work_order_title',
                'work_orders.status as work_order_status',
                'stock_movements.user_id',
                'users.name as user_name',
                'stock_movements.type',
                'stock_movements.quantity_delta',
                'stock_movements.quantity_before',
                'stock_movements.quantity_after',
                'stock_movements.reason',
                'stock_movements.created_at',
            ]);

        return response()->json(['data' => $rows]);
    }
}
