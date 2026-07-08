<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\StockItem;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    public function index()
    {
        $revenue = WorkOrder::whereIn('status', ['accepte', 'prevu', 'en_cours', 'termine'])->sum('estimated_amount');
        $expenses = Expense::sum('amount');

        return response()->json([
            'data' => [
                'customers_count' => Customer::count(),
                'vehicles_count' => Vehicle::count(),
                'work_orders_open_count' => WorkOrder::whereNotIn('status', ['termine', 'annule'])->count(),
                'today_appointments_count' => WorkOrder::whereDate('scheduled_at', Carbon::today())->count(),
                'low_stock_count' => StockItem::whereColumn('quantity', '<=', 'alert_threshold')->count(),
                'estimated_revenue' => (float) $revenue,
                'expenses_total' => (float) $expenses,
                'estimated_balance' => (float) ($revenue - $expenses),
            ],
        ]);
    }
}
